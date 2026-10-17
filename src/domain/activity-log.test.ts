import { formatStatusChangeSummary, validateActivityLogEntryInput } from './activity-log'

describe('formatStatusChangeSummary', () => {
  it('describes the change with the French status labels', () => {
    expect(formatStatusChangeSummary('applied', 'cv_submitted')).toBe('Statut : Postulé → CV positionné')
  })
})

describe('validateActivityLogEntryInput', () => {
  it('trims the summary and keeps only the known fields', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: ' Appel avec Jean ', user_id: 'forged' })).toEqual({
      ok: true,
      data: { kind: 'call', summary: 'Appel avec Jean' },
    })
  })

  it('keeps a valid occurrence date', () => {
    const occurredAt = new Date('2026-10-15T09:30:00Z')
    expect(validateActivityLogEntryInput({ kind: 'email', summary: 'Relance', occurredAt })).toEqual({
      ok: true,
      data: { kind: 'email', summary: 'Relance', occurredAt },
    })
  })

  it('requires a summary', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: '   ' })).toEqual({
      ok: false,
      errorMessage: 'Le résumé est obligatoire',
    })
  })

  it('rejects an overly long summary', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'a'.repeat(2001) })).toEqual({
      ok: false,
      errorMessage: 'Résumé : 2000 caractères maximum',
    })
  })

  it('rejects an unknown kind', () => {
    expect(validateActivityLogEntryInput({ kind: 'visit', summary: 'Visite' })).toEqual({
      ok: false,
      errorMessage: "Type d'échange invalide",
    })
  })

  it('rejects an invalid occurrence date', () => {
    expect(validateActivityLogEntryInput({ kind: 'call', summary: 'Appel', occurredAt: '2026-10-15' })).toEqual({
      ok: false,
      errorMessage: "Date de l'échange invalide",
    })
  })
})
