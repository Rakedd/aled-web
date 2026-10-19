import { buildHomeSummarySentence, type HomeSummaryInput } from './home-summary'

const NOW = new Date('2026-10-19T08:00:00Z')

const buildInput = (overrides: Partial<HomeSummaryInput>): HomeSummaryInput => ({
  reminderCount: 0,
  nextInterview: null,
  recentOpportunityCount: 0,
  now: NOW,
  ...overrides,
})

describe('buildHomeSummarySentence', () => {
  it.each([
    ['nothing to report', {}, "Rien d'urgent aujourd'hui."],
    [
      'reminders and a client interview',
      { reminderCount: 4, nextInterview: { startsAt: new Date('2026-10-22T08:00:00Z'), kind: 'client' } },
      '4 choses à faire et un entretien client jeudi.',
    ],
    ['a single reminder', { reminderCount: 1 }, '1 chose à faire.'],
    [
      'a mock interview today',
      { nextInterview: { startsAt: new Date('2026-10-19T14:00:00Z'), kind: 'mock' }, recentOpportunityCount: 2 },
      "Un entretien blanc aujourd'hui.",
    ],
    [
      'an other interview on friday',
      { nextInterview: { startsAt: new Date('2026-10-23T08:00:00Z'), kind: 'other' } },
      'Un entretien vendredi.',
    ],
    [
      'an interview exactly seven days away',
      { nextInterview: { startsAt: new Date('2026-10-26T08:00:00Z'), kind: 'client' } },
      'Un entretien client lundi prochain.',
    ],
    [
      'an interview beyond the window falls back to opportunities',
      {
        reminderCount: 2,
        nextInterview: { startsAt: new Date('2026-10-27T08:00:00Z'), kind: 'client' },
        recentOpportunityCount: 3,
      },
      '2 choses à faire et 3 missions intéressantes de moins de 48 h.',
    ],
    ['a single recent opportunity', { recentOpportunityCount: 1 }, '1 mission intéressante de moins de 48 h.'],
    [
      'an interview beyond the window alone',
      { nextInterview: { startsAt: new Date('2026-10-27T08:00:00Z'), kind: 'client' } },
      "Rien d'urgent aujourd'hui.",
    ],
    [
      'a past interview',
      { nextInterview: { startsAt: new Date('2026-10-19T07:00:00Z'), kind: 'client' } },
      "Rien d'urgent aujourd'hui.",
    ],
    [
      'an interview after midnight Paris time',
      {
        now: new Date('2026-10-19T21:30:00Z'),
        reminderCount: 3,
        nextInterview: { startsAt: new Date('2026-10-19T22:30:00Z'), kind: 'client' },
      },
      '3 choses à faire et un entretien client demain.',
    ],
  ] satisfies [string, Partial<HomeSummaryInput>, string][])('handles %s', (_scenario, overrides, expectedSentence) => {
    expect(buildHomeSummarySentence(buildInput(overrides))).toBe(expectedSentence)
  })
})
