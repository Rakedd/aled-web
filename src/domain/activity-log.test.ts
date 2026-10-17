import { formatStatusChangeSummary, validateActivityLogEntryInput } from './activity-log'

describe('formatStatusChangeSummary', () => {
  it('describes the change with the French status labels', () => {
    expect(formatStatusChangeSummary('applied', 'cv_submitted')).toBe('Statut : Postulé → CV positionné')
  })
})

const NOW = new Date('2026-10-17T10:00:00Z')

describe('validateActivityLogEntryInput', () => {
  it('trims the summary and keeps only the known fields', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: ' Appel avec Jean ', user_id: 'forged' }, NOW)).toEqual({
      ok: true,
      data: { kind: 'call', summary: 'Appel avec Jean' },
    })
  })

  it('keeps a valid occurrence date', () => {
    const occurredAt = new Date('2026-10-15T09:30:00Z')
    expect(validateActivityLogEntryInput({ kind: 'email', summary: 'Relance', occurredAt }, NOW)).toEqual({
      ok: true,
      data: { kind: 'email', summary: 'Relance', occurredAt },
    })
  })

  it('requires a summary', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: '   ' }, NOW)).toEqual({
      ok: false,
      errorMessage: 'Le résumé est obligatoire',
    })
  })

  it('rejects an overly long summary', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'a'.repeat(2001) }, NOW)).toEqual({
      ok: false,
      errorMessage: 'Résumé : 2000 caractères maximum',
    })
  })

  it('rejects an unknown kind', () => {
    expect(validateActivityLogEntryInput({ kind: 'visit', summary: 'Visite' }, NOW)).toEqual({
      ok: false,
      errorMessage: "Type d'échange invalide",
    })
  })

  it('reserves the status_change kind for status changes', () => {
    expect(validateActivityLogEntryInput({ kind: 'status_change', summary: 'Statut : Postulé → Signé' }, NOW)).toEqual({
      ok: false,
      errorMessage: "Type d'échange invalide",
    })
  })

  it('rejects an invalid occurrence date', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'Appel', occurredAt: '2026-10-15' }, NOW)).toEqual({
      ok: false,
      errorMessage: "Date de l'échange invalide",
    })
  })

  it('refuses an exchange dated in the future', () => {
    const tomorrow = new Date('2026-10-18T10:00:00Z')
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'Appel', occurredAt: tomorrow }, NOW)).toEqual({
      ok: false,
      errorMessage: "La date de l'échange ne peut pas être dans le futur",
    })
  })

  it('tolerates a few minutes of clock difference between the browser and the server', () => {
    const twoMinutesAhead = new Date('2026-10-17T10:02:00Z')
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'Appel', occurredAt: twoMinutesAhead }, NOW)).toEqual({
      ok: true,
      data: { kind: 'call', summary: 'Appel', occurredAt: twoMinutesAhead },
    })
  })
})
