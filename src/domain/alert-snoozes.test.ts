import { findAlertKindsClearedByActivity, isSnoozableAlertKind, validateSnoozeAlertArguments } from './alert-snoozes'

const jobApplicationId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'

describe('isSnoozableAlertKind', () => {
  it('never lets an upcoming interview be snoozed', () => {
    expect(isSnoozableAlertKind('upcoming_interview')).toBe(false)
  })

  it('lets every other alert be snoozed', () => {
    expect(isSnoozableAlertKind('follow_up_due')).toBe(true)
    expect(isSnoozableAlertKind('no_news_suggestion')).toBe(true)
  })
})

describe('findAlertKindsClearedByActivity', () => {
  it('clears every alert kind when the status changes', () => {
    expect(findAlertKindsClearedByActivity('status_change')).toEqual([
      'follow_up_due',
      'job_spec_missing',
      'end_client_unknown',
      'upcoming_interview',
      'no_news_suggestion',
    ])
  })

  it.each(['call', 'message', 'email', 'other'] as const)(
    'clears only the follow-up and no-news alerts after a manual %s exchange',
    (activityKind) => {
      expect(findAlertKindsClearedByActivity(activityKind)).toEqual(['follow_up_due', 'no_news_suggestion'])
    },
  )
})

describe('validateSnoozeAlertArguments', () => {
  it('accepts a snoozable alert for 3 or 7 days', () => {
    expect(validateSnoozeAlertArguments(jobApplicationId, 'follow_up_due', 7)).toEqual({
      ok: true,
      data: { jobApplicationId, alertKind: 'follow_up_due', snoozeDays: 7 },
    })
  })

  it('refuses to snooze an upcoming interview', () => {
    expect(validateSnoozeAlertArguments(jobApplicationId, 'upcoming_interview', 3)).toEqual({
      ok: false,
      errorMessage: 'Un entretien à venir ne peut pas être reporté',
    })
  })

  it.each([0, 5, '3', 30])('rejects a snooze of %p days', (snoozeDays) => {
    expect(validateSnoozeAlertArguments(jobApplicationId, 'follow_up_due', snoozeDays)).toEqual({
      ok: false,
      errorMessage: 'Report de 3 ou 7 jours uniquement',
    })
  })

  it('rejects an unknown alert kind', () => {
    expect(validateSnoozeAlertArguments(jobApplicationId, 'coffee_break', 3)).toEqual({
      ok: false,
      errorMessage: "Type d'alerte invalide",
    })
  })

  it('rejects a malformed job application id', () => {
    expect(validateSnoozeAlertArguments('42', 'follow_up_due', 3)).toEqual({
      ok: false,
      errorMessage: 'Candidature introuvable',
    })
  })
})
