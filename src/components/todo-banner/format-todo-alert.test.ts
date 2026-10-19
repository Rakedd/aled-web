import type { TodoAlert } from '@/domain/todo-alerts'
import {
  TODO_ALERT_KIND_TAG_LABELS,
  TODO_ALERT_KIND_TONES,
  formatTodoAlertKindCount,
  formatTodoAlertMessage,
  getTodoAlertKey,
} from './format-todo-alert'

const now = new Date('2026-10-17T10:00:00Z')

const buildAlert = (overrides: Partial<TodoAlert>): TodoAlert => ({
  kind: 'job_spec_missing',
  jobApplicationId: 'application-1',
  jobApplicationTitle: 'Dev React',
  referenceDate: new Date('2026-10-10T10:00:00Z'),
  ...overrides,
})

describe('formatTodoAlertMessage', () => {
  it('names the contact on a follow-up', () => {
    const message = formatTodoAlertMessage(
      buildAlert({ kind: 'follow_up_due' }),
      { id: 'application-1', status: 'cv_submitted', contactName: 'Marie', intermediaryName: 'Acme' },
      [],
      now,
    )
    expect(message).toBe('Relancer Marie : CV positionné il y a 7 j sans retour')
  })

  it('never says yesterday and omits a missing status cleanly', () => {
    const message = formatTodoAlertMessage(
      buildAlert({ kind: 'follow_up_due', referenceDate: new Date('2026-10-16T10:00:00Z') }),
      undefined,
      [],
      now,
    )
    expect(message).toBe('Relancer Dev React : il y a 1 j sans retour')
  })

  it('falls back to the intermediary on a follow-up without contact', () => {
    const message = formatTodoAlertMessage(
      buildAlert({ kind: 'follow_up_due' }),
      { id: 'application-1', status: 'intermediary_contact', contactName: null, intermediaryName: 'Acme' },
      [],
      now,
    )
    expect(message).toBe('Relancer Acme : Échange intermédiaire il y a 7 j sans retour')
  })

  it('writes the job spec and end client messages', () => {
    expect(formatTodoAlertMessage(buildAlert({}), undefined, [], now)).toBe('Pas de fiche métier pour « Dev React »')
    expect(formatTodoAlertMessage(buildAlert({ kind: 'end_client_unknown' }), undefined, [], now)).toBe(
      "Client final inconnu pour « Dev React » : demande-le avant l'entretien",
    )
  })

  it('writes the upcoming interview message in Paris time', () => {
    const message = formatTodoAlertMessage(
      buildAlert({ kind: 'upcoming_interview', interviewId: 'interview-1', referenceDate: new Date('2026-10-20T12:00:00Z') }),
      undefined,
      [{ id: 'interview-1', jobApplicationId: 'application-1', startsAt: new Date('2026-10-20T12:00:00Z'), kind: 'mock' }],
      now,
    )
    expect(message).toBe('Entretien blanc mardi 20 octobre à 14h00 : Dev React')
  })

  it('writes the no news suggestion', () => {
    const message = formatTodoAlertMessage(
      buildAlert({ kind: 'no_news_suggestion', referenceDate: new Date('2026-09-20T10:00:00Z') }),
      undefined,
      [],
      now,
    )
    expect(message).toBe('Sans nouvelles depuis 27 j : Dev React. La clore ?')
  })

  it('builds a distinct key per alert', () => {
    expect(getTodoAlertKey(buildAlert({}))).not.toBe(getTodoAlertKey(buildAlert({ kind: 'end_client_unknown' })))
  })
})

describe('TODO_ALERT_KIND_TAG_LABELS', () => {
  it.each([
    ['follow_up_due', 'Relance'],
    ['job_spec_missing', 'Fiche métier'],
    ['end_client_unknown', 'Client inconnu'],
    ['no_news_suggestion', 'Sans nouvelles'],
    ['upcoming_interview', 'Entretien à venir'],
  ] as const)('labels %s as %s', (alertKind, label) => {
    expect(TODO_ALERT_KIND_TAG_LABELS[alertKind]).toBe(label)
  })
})

describe('TODO_ALERT_KIND_TONES', () => {
  it.each([
    ['follow_up_due', 'peach'],
    ['job_spec_missing', 'lilac'],
    ['end_client_unknown', 'lilac'],
    ['no_news_suggestion', 'clay'],
    ['upcoming_interview', 'sage'],
  ] as const)('gives %s the %s tone', (alertKind, tone) => {
    expect(TODO_ALERT_KIND_TONES[alertKind]).toBe(tone)
  })
})

describe('formatTodoAlertKindCount', () => {
  it.each([
    ['follow_up_due', 1, '1 relance'],
    ['follow_up_due', 8, '8 relances'],
    ['no_news_suggestion', 1, '1 sans nouvelles'],
    ['no_news_suggestion', 6, '6 sans nouvelles'],
    ['job_spec_missing', 1, '1 fiche métier'],
    ['job_spec_missing', 5, '5 fiches métier'],
    ['end_client_unknown', 1, '1 client inconnu'],
    ['end_client_unknown', 4, '4 clients inconnus'],
    ['upcoming_interview', 1, '1 entretien à venir'],
    ['upcoming_interview', 2, '2 entretiens à venir'],
  ] as const)('formats %s x%i as "%s"', (kind, count, expected) => {
    expect(formatTodoAlertKindCount(kind, count)).toBe(expected)
  })
})
