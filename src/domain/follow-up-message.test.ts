import { AI_ERROR_MESSAGES } from './ai-errors'
import {
  buildFollowUpMailtoUrl,
  canDraftFollowUp,
  formatCompactFollowUpButtonAccessibleLabel,
  isFollowUpMessageDraft,
  FOLLOW_UP_AI_ERROR_MESSAGES,
  FOLLOW_UP_DRAFTABLE_STATUSES,
  FOLLOW_UP_FORMALITIES,
  FOLLOW_UP_MESSAGES,
  parseFollowUpMessageDraft,
  toExternalLinkUrlOrNull,
  validateFollowUpMessageRequest,
} from './follow-up-message'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from './job-application'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

describe('validateFollowUpMessageRequest', () => {
  it.each(FOLLOW_UP_FORMALITIES)('accepts a uuid with the %s formality', (formality) => {
    expect(validateFollowUpMessageRequest({ jobApplicationId: JOB_APPLICATION_ID, formality })).toEqual({
      ok: true,
      data: { jobApplicationId: JOB_APPLICATION_ID, formality },
    })
  })

  it('rejects a body that is not an object', () => {
    expect(validateFollowUpMessageRequest(['vous'])).toEqual({ ok: false, errorMessage: FOLLOW_UP_MESSAGES.invalidRequest })
    expect(validateFollowUpMessageRequest(null)).toEqual({ ok: false, errorMessage: FOLLOW_UP_MESSAGES.invalidRequest })
  })

  it('rejects an identifier that is not a uuid', () => {
    expect(validateFollowUpMessageRequest({ jobApplicationId: 'pas-un-uuid', formality: 'vous' })).toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })
  })

  it.each([['toi'], ['Vous'], [undefined], [null]])('rejects the unknown formality %p', (formality) => {
    expect(validateFollowUpMessageRequest({ jobApplicationId: JOB_APPLICATION_ID, formality })).toEqual({
      ok: false,
      errorMessage: FOLLOW_UP_MESSAGES.invalidRequest,
    })
  })
})

describe('buildFollowUpMailtoUrl', () => {
  it('encodes the subject and the body, with accents and ampersands', () => {
    expect(buildFollowUpMailtoUrl('marie@acme.fr', 'Relance & suivi', 'Bonjour Hélène')).toBe(
      'mailto:marie@acme.fr?subject=Relance%20%26%20suivi&body=Bonjour%20H%C3%A9l%C3%A8ne',
    )
  })

  it('turns every line break into an encoded CRLF', () => {
    expect(buildFollowUpMailtoUrl('marie@acme.fr', 'Objet', 'Bonjour,\n\nMerci\r\nRayan')).toBe(
      'mailto:marie@acme.fr?subject=Objet&body=Bonjour%2C%0D%0A%0D%0AMerci%0D%0ARayan',
    )
  })

  it('keeps the at sign of the address but encodes characters that would add parameters', () => {
    expect(buildFollowUpMailtoUrl(' marie?cc=x@acme.fr ', 'Objet', 'Corps')).toBe(
      'mailto:marie%3Fcc%3Dx@acme.fr?subject=Objet&body=Corps',
    )
  })
})

describe('FOLLOW_UP_DRAFTABLE_STATUSES', () => {
  it('holds every active status and no terminal status', () => {
    expect(FOLLOW_UP_DRAFTABLE_STATUSES).toEqual([
      'applied',
      'intermediary_contact',
      'cv_submitted',
      'interview_scheduled',
      'interview_done',
      'contract_received',
    ])
  })

  it('lets a follow up be drafted only for an active status', () => {
    expect(canDraftFollowUp('cv_submitted')).toBe(true)
    expect(canDraftFollowUp('signed')).toBe(false)
    expect(canDraftFollowUp('no_news_abandoned')).toBe(false)
  })
})

describe('parseFollowUpMessageDraft', () => {
  const validDraft = {
    subject: 'Suivi de ma candidature',
    message: 'Bonjour Marie, ...',
    contactEmail: 'marie@acme.fr',
    contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
  }

  it('accepts a complete draft', () => {
    expect(parseFollowUpMessageDraft(validDraft)).toEqual(validDraft)
  })

  it('accepts a draft without contact details', () => {
    const draftWithoutContact = { ...validDraft, contactEmail: null, contactLinkedinUrl: null }
    expect(parseFollowUpMessageDraft(draftWithoutContact)).toEqual(draftWithoutContact)
  })

  it('drops a profile link that is not an http link', () => {
    expect(parseFollowUpMessageDraft({ ...validDraft, contactLinkedinUrl: 'javascript:alert(1)' })).toEqual({
      ...validDraft,
      contactLinkedinUrl: null,
    })
  })

  it.each([
    ['a missing subject', { ...validDraft, subject: undefined }],
    ['a message that is not a string', { ...validDraft, message: 12 }],
    ['an email that is neither a string nor null', { ...validDraft, contactEmail: 3 }],
    ['a profile link that is neither a string nor null', { ...validDraft, contactLinkedinUrl: undefined }],
    ['a value that is not an object', 'draft'],
  ])('rejects %s', (_caseName, candidate) => {
    expect(parseFollowUpMessageDraft(candidate)).toBeNull()
  })
})

describe('FOLLOW_UP_AI_ERROR_MESSAGES', () => {
  it('uses the follow up wording for a failed or refused draft and the shared wording otherwise', () => {
    expect(FOLLOW_UP_AI_ERROR_MESSAGES.unknown).toBe('La rédaction a échoué. Réessaie dans un instant.')
    expect(FOLLOW_UP_AI_ERROR_MESSAGES.refused).toBe("Claude n'a pas pu rédiger cette relance. Écris-la à la main.")
    expect(FOLLOW_UP_AI_ERROR_MESSAGES.rate_limited).toBe(AI_ERROR_MESSAGES.rate_limited)
    expect(FOLLOW_UP_AI_ERROR_MESSAGES.timeout).toBe(AI_ERROR_MESSAGES.timeout)
  })
})

describe('FOLLOW_UP_MESSAGES', () => {
  it('holds the copy of the spec', () => {
    expect(FOLLOW_UP_MESSAGES).toEqual(
      expect.objectContaining({
        openButton: 'Rédiger une relance',
        compactOpenButton: 'Rédiger',
        drafting: 'Rédaction…',
        copy: 'Copier',
        copied: 'Message copié.',
        sendByEmail: 'Envoyer par e-mail',
        openLinkedin: 'Ouvrir LinkedIn',
        linkedinCopied: 'Message copié, colle-le dans LinkedIn.',
        regenerate: 'Régénérer',
        markAsSent: "J'ai envoyé la relance",
        sentActivitySummary: 'Relance envoyée',
        replaceEditedMessageQuestion: 'Remplacer ton message modifié ?',
        confirmReplace: 'Remplacer',
        cancelReplace: 'Annuler',
        newTabHint: ' (nouvel onglet)',
      }),
    )
    expect(FOLLOW_UP_MESSAGES.formalityLabels).toEqual({ vous: 'Vous', tu: 'Tu' })
  })
})

describe('toExternalLinkUrlOrNull', () => {
  it('keeps an http or https link and drops anything else', () => {
    expect(toExternalLinkUrlOrNull('https://www.linkedin.com/in/marie')).toBe('https://www.linkedin.com/in/marie')
    expect(toExternalLinkUrlOrNull('http://linkedin.com/in/marie')).toBe('http://linkedin.com/in/marie')
    expect(toExternalLinkUrlOrNull('javascript:alert(1)')).toBeNull()
    expect(toExternalLinkUrlOrNull('pas une url')).toBeNull()
    expect(toExternalLinkUrlOrNull(null)).toBeNull()
  })
})

describe('formatCompactFollowUpButtonAccessibleLabel', () => {
  it('names the job application so that each compact button can be told apart', () => {
    expect(formatCompactFollowUpButtonAccessibleLabel('Dev React')).toBe('Rédiger une relance pour « Dev React »')
  })
})

describe('isFollowUpMessageDraft', () => {
  it('accepts a draft with or without contact channels', () => {
    expect(
      isFollowUpMessageDraft({ subject: 'Suivi', message: 'Bonjour', contactEmail: null, contactLinkedinUrl: null }),
    ).toBe(true)
    expect(
      isFollowUpMessageDraft({
        subject: 'Suivi',
        message: 'Bonjour',
        contactEmail: 'marie@acme.fr',
        contactLinkedinUrl: 'https://www.linkedin.com/in/marie',
      }),
    ).toBe(true)
  })

  it.each([
    ['a missing message', { subject: 'Suivi', contactEmail: null, contactLinkedinUrl: null }],
    ['an email that is not a string', { subject: 'Suivi', message: 'Bonjour', contactEmail: 1, contactLinkedinUrl: null }],
    ['a missing profile link', { subject: 'Suivi', message: 'Bonjour', contactEmail: null }],
    ['an array', []],
    ['null', null],
  ])('rejects %s', (_caseName, candidate) => {
    expect(isFollowUpMessageDraft(candidate)).toBe(false)
  })
})
