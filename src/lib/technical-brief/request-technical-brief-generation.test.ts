/** @jest-environment node */
import { TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefContent } from '@/domain/technical-brief'
import {
  parseTechnicalBriefGenerationResponse,
  requestTechnicalBriefGeneration,
} from './request-technical-brief-generation'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const briefContent: TechnicalBriefContent = {
  storyline: Array.from({ length: 5 }, (_, stepIndex) => ({ title: `Étape ${stepIndex + 1}`, guidance: 'Raconte' })),
  missions: [
    {
      label: 'Mission React',
      period: '2024-2025',
      emphasis: 'lean_on',
      sharedStack: ['React'],
      why: 'Même stack que la mission',
      reflectionQuestions: ['Comment as-tu structuré le front ?'],
    },
  ],
  gaps: [{ stackItem: 'Kafka', question: 'As-tu déjà opéré Kafka ?' }],
}

const buildSerializedBrief = (overrides: Record<string, unknown> = {}) => ({
  language: 'fr',
  content: briefContent,
  cvVersionId: 'cv-version-1',
  cvLabel: 'CV 2026',
  cvUploadedAt: '2026-10-20T09:00:00.000Z',
  generatedAt: '2026-10-23T10:00:00.000Z',
  ...overrides,
})

const buildGeneratedResponseBody = (briefOverrides: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    kind: 'generated',
    view: { language: 'fr', availability: 'ready', isCvOutdated: false, brief: buildSerializedBrief(briefOverrides) },
  },
})

const mockFetchResponse = (body: unknown, status = 200) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe('parseTechnicalBriefGenerationResponse', () => {
  it('revives the dates of a generated brief', () => {
    expect(parseTechnicalBriefGenerationResponse(buildGeneratedResponseBody())).toEqual({
      ok: true,
      data: {
        kind: 'generated',
        view: {
          language: 'fr',
          availability: 'ready',
          isCvOutdated: false,
          brief: {
            language: 'fr',
            content: briefContent,
            cvVersionId: 'cv-version-1',
            cvLabel: 'CV 2026',
            cvUploadedAt: new Date('2026-10-20T09:00:00.000Z'),
            generatedAt: new Date('2026-10-23T10:00:00.000Z'),
          },
        },
      },
    })
  })

  it('keeps a generated view without brief and a cv outcome', () => {
    const viewWithoutBrief = { language: 'en', availability: 'missing_sent_cv', isCvOutdated: false, brief: null }
    expect(parseTechnicalBriefGenerationResponse({ ok: true, data: { kind: 'generated', view: viewWithoutBrief } })).toEqual({
      ok: true,
      data: { kind: 'generated', view: viewWithoutBrief },
    })
    expect(parseTechnicalBriefGenerationResponse({ ok: true, data: { kind: 'cv_unreadable' } })).toEqual({
      ok: true,
      data: { kind: 'cv_unreadable' },
    })
    expect(parseTechnicalBriefGenerationResponse({ ok: true, data: { kind: 'cv_missing_information' } })).toEqual({
      ok: true,
      data: { kind: 'cv_missing_information' },
    })
  })

  it('passes the refusal message and the request error through', () => {
    expect(parseTechnicalBriefGenerationResponse({ ok: false, errorMessage: 'Candidature introuvable' })).toEqual({
      ok: false,
      errorMessage: 'Candidature introuvable',
    })
    expect(parseTechnicalBriefGenerationResponse({ error: TECHNICAL_BRIEF_MESSAGES.sessionExpired })).toEqual({
      ok: false,
      errorMessage: TECHNICAL_BRIEF_MESSAGES.sessionExpired,
    })
  })

  it.each([
    ['a non object', 'du texte'],
    ['an unknown kind', { ok: true, data: { kind: 'brief_ready' } }],
    ['a generated outcome without view', { ok: true, data: { kind: 'generated' } }],
    ['an invalid date', buildGeneratedResponseBody({ generatedAt: 'pas une date' })],
    ['a missing cv label', buildGeneratedResponseBody({ cvLabel: undefined })],
    ['an unusable content', buildGeneratedResponseBody({ content: { storyline: [], missions: [], gaps: [] } })],
    ['an unknown availability', { ok: true, data: { kind: 'generated', view: { language: 'fr', availability: 'soon', isCvOutdated: false, brief: null } } }],
  ])('rejects %s with the generation failure message', (_caseName, responseBody) => {
    expect(parseTechnicalBriefGenerationResponse(responseBody)).toEqual({
      ok: false,
      errorMessage: TECHNICAL_BRIEF_MESSAGES.generationFailure,
    })
  })
})

describe('requestTechnicalBriefGeneration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('posts the job application and the language to the route and revives the answer', async () => {
    const fetchMock = mockFetchResponse(buildGeneratedResponseBody())

    const generationResult = await requestTechnicalBriefGeneration(JOB_APPLICATION_ID, 'fr')

    expect(fetchMock).toHaveBeenCalledWith('/api/technical-briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, language: 'fr' }),
    })
    expect(generationResult.ok && generationResult.data.kind === 'generated' && generationResult.data.view.brief?.generatedAt).toEqual(
      new Date('2026-10-23T10:00:00.000Z'),
    )
  })

  it('answers the error of a rejected request', async () => {
    mockFetchResponse({ error: TECHNICAL_BRIEF_MESSAGES.sessionExpired }, 401)

    expect(await requestTechnicalBriefGeneration(JOB_APPLICATION_ID, 'fr')).toEqual({
      ok: false,
      errorMessage: TECHNICAL_BRIEF_MESSAGES.sessionExpired,
    })
  })

  it('answers the generation failure message on a network error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await requestTechnicalBriefGeneration(JOB_APPLICATION_ID, 'fr')).toEqual({
      ok: false,
      errorMessage: TECHNICAL_BRIEF_MESSAGES.generationFailure,
    })
  })

  it('answers the generation failure message when the answer is not JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 504 }))

    expect(await requestTechnicalBriefGeneration(JOB_APPLICATION_ID, 'fr')).toEqual({
      ok: false,
      errorMessage: TECHNICAL_BRIEF_MESSAGES.generationFailure,
    })
  })
})
