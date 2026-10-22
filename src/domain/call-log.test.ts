import { AI_ERROR_MESSAGES } from './ai-errors'
import {
  CALL_JOB_APPLICATION_STATUSES,
  CALL_LOG_MESSAGES,
  CALL_OUTCOME_STATUSES,
  type CallOutcome,
  looksLikePhoneNumber,
  toCallDraftAiErrorMessage,
  validateCallDraftRequest,
  validateRecordCallRequest,
} from './call-log'
import { ACTIVITY_LOG_VALIDATION_MESSAGES } from './activity-log'
import { ENTITY_NOT_FOUND_MESSAGES } from './entities'
import { JOB_APPLICATION_VALIDATION_MESSAGES } from './job-application'
import { PIPELINE_STATUSES } from './job-application-status'

const now = new Date('2026-10-22T10:00:00.000Z')
const contactId = '11111111-1111-4111-8111-111111111111'
const jobApplicationId = '22222222-2222-4222-8222-222222222222'
const cvId = '33333333-3333-4333-8333-333333333333'
const occurredAtIso = '2026-10-22T09:00:00.000Z'

const validJobApplication = {
  title: ' Développeur React ',
  endClientName: 'BNP',
  intermediaryName: 'Hays',
  postedDailyRate: 550,
  location: 'Paris',
  remotePolicy: null,
  desiredStart: 'ASAP',
  duration: '6 mois',
  stack: [{ name: 'React', category: 'framework', origin: 'job_spec' }],
  status: 'cv_submitted',
  cvId,
}

const newContactProfile = { fullName: 'Jean', phone: null, email: null, linkedinUrl: null }

const validRecordCallRequest = {
  contact: { id: contactId },
  contactDetails: { phone: '06 12 34 56 78', email: null, linkedinUrl: null },
  userEditedContactFields: ['phone'],
  exchange: { summary: 'Appel avec Jean', occurredAt: occurredAtIso },
  jobApplication: null,
}

describe('call outcomes', () => {
  it.each([
    ['cv_submitted', 'cv_submitted'],
    ['interview_scheduled', 'interview_scheduled'],
    ['declined', 'ko_after_contact'],
    ['discussed', 'intermediary_contact'],
  ] as const)('maps the outcome %s to the status %s', (outcome: CallOutcome, status) => {
    expect(CALL_OUTCOME_STATUSES[outcome]).toBe(status)
  })

  it('offers the pipeline statuses plus KO après échange', () => {
    expect(CALL_JOB_APPLICATION_STATUSES).toEqual([...PIPELINE_STATUSES, 'ko_after_contact'])
  })
})

describe('looksLikePhoneNumber', () => {
  it.each(['06 12 34 56 78', '+33 6 12 34 56 78', '06.12.34.56.78', '(+33) 612345678'])(
    'recognises %p as a phone number',
    (text) => {
      expect(looksLikePhoneNumber(text)).toBe(true)
    },
  )

  it.each(['', 'Rappeler Jean-Marc au 06 12 34 56 78', 'https://www.hays.fr', '1234', '0'.repeat(60), '((((', '-----', '+ ( ) .'])(
    'does not take %p for a phone number',
    (text) => {
      expect(looksLikePhoneNumber(text)).toBe(false)
    },
  )
})

describe('toCallDraftAiErrorMessage', () => {
  it('words the AI errors for the call screen', () => {
    expect(toCallDraftAiErrorMessage('missing_api_key')).toBe(CALL_LOG_MESSAGES.missingApiKey)
    expect(toCallDraftAiErrorMessage('invalid_api_key')).toBe(CALL_LOG_MESSAGES.invalidApiKey)
    expect(toCallDraftAiErrorMessage('unknown')).toBe(CALL_LOG_MESSAGES.aiFailed)
    expect(toCallDraftAiErrorMessage('rate_limited')).toBe(AI_ERROR_MESSAGES.rate_limited)
  })
})

describe('validateCallDraftRequest', () => {
  const validCallDraftRequest = { text: ' Jean de Hays a appelé ', phone: null, contactId: null, occurredAt: occurredAtIso }

  it('accepts a valid request and turns occurredAt into a Date', () => {
    expect(validateCallDraftRequest(validCallDraftRequest, now)).toEqual({
      ok: true,
      data: { text: 'Jean de Hays a appelé', phone: null, contactId: null, occurredAt: new Date(occurredAtIso) },
    })
  })

  it('requires a call note of at most 3000 characters', () => {
    expect(validateCallDraftRequest({ ...validCallDraftRequest, text: 'a'.repeat(3000) }, now).ok).toBe(true)
    expect(validateCallDraftRequest({ ...validCallDraftRequest, text: 'a'.repeat(3001) }, now)).toEqual({
      ok: false,
      errorMessage: "Récit de l'appel : 3000 caractères maximum",
    })
    expect(validateCallDraftRequest({ ...validCallDraftRequest, text: '   ' }, now)).toEqual({
      ok: false,
      errorMessage: CALL_LOG_MESSAGES.missingCallNote,
    })
  })

  it('rejects a malformed contact id with Contact introuvable', () => {
    expect(validateCallDraftRequest({ ...validCallDraftRequest, contactId: 'nope' }, now)).toEqual({
      ok: false,
      errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact,
    })
    expect(validateCallDraftRequest({ ...validCallDraftRequest, contactId }, now).ok).toBe(true)
  })

  it('validates the phone', () => {
    expect(validateCallDraftRequest({ ...validCallDraftRequest, phone: 5 }, now).ok).toBe(false)
    expect(validateCallDraftRequest({ ...validCallDraftRequest, phone: ' 06 12 ' }, now)).toMatchObject({
      ok: true,
      data: { phone: '06 12' },
    })
  })

  it('parses occurredAt and refuses a date in the future', () => {
    expect(validateCallDraftRequest({ ...validCallDraftRequest, occurredAt: 'yesterday' }, now)).toEqual({
      ok: false,
      errorMessage: ACTIVITY_LOG_VALIDATION_MESSAGES.invalidOccurredAt,
    })
    expect(validateCallDraftRequest({ ...validCallDraftRequest, occurredAt: 12 }, now)).toEqual({
      ok: false,
      errorMessage: ACTIVITY_LOG_VALIDATION_MESSAGES.invalidOccurredAt,
    })
    expect(
      validateCallDraftRequest({ ...validCallDraftRequest, occurredAt: '2026-10-22T10:06:00.000Z' }, now),
    ).toEqual({ ok: false, errorMessage: ACTIVITY_LOG_VALIDATION_MESSAGES.futureOccurredAt })
    expect(
      validateCallDraftRequest({ ...validCallDraftRequest, occurredAt: '2026-10-22T10:04:00.000Z' }, now).ok,
    ).toBe(true)
  })

  it('rejects a non-record', () => {
    expect(validateCallDraftRequest('text', now)).toEqual({ ok: false, errorMessage: CALL_LOG_MESSAGES.malformedRequest })
  })
})

describe('validateRecordCallRequest', () => {
  it('accepts an existing contact with details and no job application', () => {
    expect(validateRecordCallRequest(validRecordCallRequest, now)).toEqual({
      ok: true,
      data: {
        contact: { kind: 'existing', contactId },
        contactDetails: { phone: '06 12 34 56 78', email: null, linkedinUrl: null },
        userEditedContactFields: ['phone'],
        exchange: { summary: 'Appel avec Jean', occurredAt: new Date(occurredAtIso) },
        jobApplication: null,
        existingJobApplicationId: null,
      },
    })
  })

  it('requires exactly one of id or new for the contact', () => {
    const malformed = { ok: false, errorMessage: CALL_LOG_MESSAGES.malformedRequest }
    expect(validateRecordCallRequest({ ...validRecordCallRequest, contact: {} }, now)).toEqual(malformed)
    expect(validateRecordCallRequest({ ...validRecordCallRequest, contact: 'x' }, now)).toEqual(malformed)
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, contact: { id: contactId, new: newContactProfile } }, now),
    ).toEqual(malformed)
    expect(validateRecordCallRequest({ ...validRecordCallRequest, contact: { id: 'nope' } }, now)).toEqual({
      ok: false,
      errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact,
    })
  })

  it('validates a new contact with the contact profile rules', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, contact: { new: { ...newContactProfile, fullName: ' ' } } }, now),
    ).toEqual({ ok: false, errorMessage: 'Le nom du contact est obligatoire' })
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, contact: { new: { ...newContactProfile, intermediaryName: 'Hays' } } }, now),
    ).toMatchObject({
      ok: true,
      data: { contact: { kind: 'new', profile: { fullName: 'Jean', intermediaryName: 'Hays' } } },
    })
  })

  it('rejects malformed contact details and edited fields', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, contactDetails: { phone: null, email: 'x', linkedinUrl: null } }, now),
    ).toEqual({ ok: false, errorMessage: 'E-mail invalide' })
    expect(validateRecordCallRequest({ ...validRecordCallRequest, userEditedContactFields: ['x'] }, now)).toEqual({
      ok: false,
      errorMessage: 'Champs modifiés invalides',
    })
  })

  it('builds the job application with source Appel, the call date and no contact name', () => {
    const validation = validateRecordCallRequest({ ...validRecordCallRequest, jobApplication: validJobApplication }, now)
    expect(validation).toMatchObject({
      ok: true,
      data: {
        jobApplication: {
          sentCvId: cvId,
          input: {
            title: 'Développeur React',
            source: 'Appel',
            postingUrl: null,
            status: 'cv_submitted',
            postedDailyRate: 550,
            requestedDailyRate: null,
            appliedOn: new Date(occurredAtIso),
            contactName: null,
            userEditedContactFields: [],
            intermediaryName: 'Hays',
            endClientName: 'BNP',
            endClientParentName: null,
          },
        },
      },
    })
  })

  it('refuses a status outside the call statuses', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, jobApplication: { ...validJobApplication, status: 'ko_cv' } }, now),
    ).toEqual({ ok: false, errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.invalidStatus })
  })

  it('requires a title when a job application is sent', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, jobApplication: { ...validJobApplication, title: ' ' } }, now),
    ).toEqual({ ok: false, errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.missingTitle })
  })

  it('refuses a summary longer than 2000 characters', () => {
    expect(
      validateRecordCallRequest(
        { ...validRecordCallRequest, exchange: { summary: 'a'.repeat(2001), occurredAt: occurredAtIso } },
        now,
      ),
    ).toEqual({ ok: false, errorMessage: 'Résumé : 2000 caractères maximum' })
  })

  it('refuses an exchange date in the future', () => {
    expect(
      validateRecordCallRequest(
        { ...validRecordCallRequest, exchange: { summary: 'Appel', occurredAt: '2026-10-23T10:00:00.000Z' } },
        now,
      ),
    ).toEqual({ ok: false, errorMessage: ACTIVITY_LOG_VALIDATION_MESSAGES.futureOccurredAt })
  })

  it('accepts an existing job application only with an existing contact', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, existingJobApplicationId: jobApplicationId }, now),
    ).toMatchObject({ ok: true, data: { existingJobApplicationId: jobApplicationId } })
    expect(
      validateRecordCallRequest(
        { ...validRecordCallRequest, contact: { new: newContactProfile }, existingJobApplicationId: jobApplicationId },
        now,
      ),
    ).toEqual({ ok: false, errorMessage: CALL_LOG_MESSAGES.malformedRequest })
    expect(validateRecordCallRequest({ ...validRecordCallRequest, existingJobApplicationId: 'nope' }, now)).toEqual({
      ok: false,
      errorMessage: CALL_LOG_MESSAGES.malformedRequest,
    })
  })

  it('rejects a malformed cv id', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, jobApplication: { ...validJobApplication, cvId: 'nope' } }, now),
    ).toEqual({ ok: false, errorMessage: CALL_LOG_MESSAGES.malformedRequest })
  })

  it('accepts a job application without cv', () => {
    expect(
      validateRecordCallRequest({ ...validRecordCallRequest, jobApplication: { ...validJobApplication, cvId: null } }, now),
    ).toMatchObject({ ok: true, data: { jobApplication: { sentCvId: null } } })
  })
})
