/**
 * @jest-environment node
 */
import { TECHNICAL_BRIEF_AI_ERROR_MESSAGES, TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefContent } from '@/domain/technical-brief'
import type { JobApplicationOverview } from '@/domain/job-application'
import { AiError } from '@/server/ai/ai-error'
import { findCvVersionForTechnicalBrief } from '@/server/repositories/cvs-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { findLanguageBrief } from '@/server/repositories/interview-preparation-repository'
import { downloadJobSpecPdfAsBase64, findJobSpec } from '@/server/repositories/job-specs-repository'
import { findTechnicalBrief, saveTechnicalBrief } from '@/server/repositories/technical-briefs-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import {
  generateTechnicalBriefForUser,
  type TechnicalBriefDependencies,
} from './prepare-technical-brief'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/job-applications-repository')
jest.mock('@/server/repositories/job-specs-repository')
jest.mock('@/server/repositories/cvs-repository')
jest.mock('@/server/repositories/interview-preparation-repository')
jest.mock('@/server/repositories/technical-briefs-repository')

const supabase = {} as FreeclutchSupabaseClient
const USER_ID = 'user-1'
const JOB_APPLICATION_ID = 'application-1'
const SENT_CV_VERSION_ID = 'version-1'
const CV_UPLOADED_AT = new Date('2026-10-20T09:00:00.000Z')
const NOW = new Date('2026-10-23T10:00:00.000Z')
const STACK = [{ name: 'React', category: 'framework' as const, origin: 'job_spec' as const }]

const usableContent: TechnicalBriefContent = {
  storyline: Array.from({ length: 5 }, (_, stepIndex) => ({ title: `Étape ${stepIndex + 1}`, guidance: 'Raconte' })),
  missions: [
    {
      label: 'Mission React',
      period: '2024',
      emphasis: 'lean_on',
      sharedStack: ['React'],
      why: 'Même stack',
      reflectionQuestions: ['Comment ?'],
    },
  ],
  gaps: [],
}

const buildJobApplication = (overrides: Partial<JobApplicationOverview> = {}): JobApplicationOverview =>
  ({
    id: JOB_APPLICATION_ID,
    title: 'Développeur React',
    stack: STACK,
    hasJobSpec: false,
    endClientId: 'end-client-1',
    endClientName: 'Acme',
    intermediaryName: 'Malt',
    sentCv: { versionId: SENT_CV_VERSION_ID, label: 'CV envoyé', uploadedAt: CV_UPLOADED_AT },
    ...overrides,
  }) as JobApplicationOverview

const buildDependencies = (overrides: Partial<TechnicalBriefDependencies> = {}): TechnicalBriefDependencies => ({
  getApiKey: jest.fn().mockResolvedValue('sk-ant-test-key'),
  generateTechnicalBrief: jest.fn().mockResolvedValue({ cvStatus: 'usable', content: usableContent }),
  now: () => NOW,
  ...overrides,
})

const mockJobApplication = (overrides: Partial<JobApplicationOverview> = {}) =>
  jest.mocked(findJobApplicationOverview).mockResolvedValue({ ok: true, data: buildJobApplication(overrides) })

const generate = (dependencies: TechnicalBriefDependencies) =>
  generateTechnicalBriefForUser(supabase, USER_ID, { jobApplicationId: JOB_APPLICATION_ID, language: 'fr' }, dependencies)

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.resetAllMocks()
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.mocked(findTechnicalBrief).mockResolvedValue(null)
  jest.mocked(findLanguageBrief).mockResolvedValue(null)
  jest.mocked(findJobSpec).mockResolvedValue(null)
  jest.mocked(saveTechnicalBrief).mockResolvedValue({ ok: true, data: null })
  jest.mocked(findCvVersionForTechnicalBrief).mockResolvedValue({
    ok: true,
    data: { versionId: SENT_CV_VERSION_ID, label: 'CV envoyé', uploadedAt: CV_UPLOADED_AT, pdfBase64: 'cv-base64' },
  })
  mockJobApplication()
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('generateTechnicalBriefForUser', () => {
  it.each([
    ['without a sent cv', { sentCv: null }, TECHNICAL_BRIEF_MESSAGES.missingSentCv],
    ['without mission details', { stack: [], hasJobSpec: false }, TECHNICAL_BRIEF_MESSAGES.missingMissionDetails],
  ])('refuses %s and never calls the ai', async (_name, overrides, expectedMessage) => {
    mockJobApplication(overrides)
    const dependencies = buildDependencies()

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: false, errorMessage: expectedMessage })
    expect(dependencies.getApiKey).not.toHaveBeenCalled()
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
  })

  it('refuses without a claude key', async () => {
    const dependencies = buildDependencies({ getApiKey: jest.fn().mockResolvedValue(null) })

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_AI_ERROR_MESSAGES.missing_api_key })
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
  })

  it('refuses when the sent cv version cannot be read', async () => {
    jest.mocked(findCvVersionForTechnicalBrief).mockResolvedValue({ ok: false, errorMessage: 'introuvable' })
    const dependencies = buildDependencies()

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.missingSentCv })
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
  })

  it('sends the cv, the stack, the text job spec and the brief of the language', async () => {
    jest.mocked(findJobSpec).mockResolvedValue({
      sourceKind: 'text',
      rawText: 'Fiche de poste',
      pendingStack: null,
      updatedAt: NOW,
    })
    jest.mocked(findLanguageBrief).mockResolvedValue({
      language: 'fr',
      markdown: '## Acme',
      sources: [],
      generatedAt: NOW,
    })
    const dependencies = buildDependencies()

    await generate(dependencies)

    expect(findLanguageBrief).toHaveBeenCalledWith(supabase, USER_ID, 'end-client-1', 'fr')
    expect(dependencies.generateTechnicalBrief).toHaveBeenCalledWith('sk-ant-test-key', {
      language: 'fr',
      cvPdfBase64: 'cv-base64',
      missionTitle: 'Développeur React',
      stack: STACK,
      jobSpec: { kind: 'text', text: 'Fiche de poste' },
      endClientName: 'Acme',
      intermediaryName: 'Malt',
      briefMarkdown: '## Acme',
    })
  })

  it('sends the pdf job spec when the job spec is a pdf', async () => {
    mockJobApplication({ hasJobSpec: true })
    jest.mocked(findJobSpec).mockResolvedValue({
      sourceKind: 'pdf',
      rawText: null,
      pendingStack: null,
      updatedAt: NOW,
    })
    jest.mocked(downloadJobSpecPdfAsBase64).mockResolvedValue('job-spec-base64')
    const dependencies = buildDependencies()

    await generate(dependencies)

    expect(dependencies.generateTechnicalBrief).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ jobSpec: { kind: 'pdf', base64Pdf: 'job-spec-base64' } }),
    )
  })

  it.each([
    ['a text job spec without text', { sourceKind: 'text' as const, rawText: null }, null],
    ['a pdf job spec that cannot be downloaded', { sourceKind: 'pdf' as const, rawText: null }, null],
  ])('refuses an empty stack with %s and never calls the ai', async (_name, jobSpecFields, pdfBase64) => {
    mockJobApplication({ stack: [], hasJobSpec: true })
    jest.mocked(findJobSpec).mockResolvedValue({ ...jobSpecFields, pendingStack: null, updatedAt: NOW })
    jest.mocked(downloadJobSpecPdfAsBase64).mockResolvedValue(pdfBase64)
    const dependencies = buildDependencies()

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.missingMissionDetails })
    expect(dependencies.generateTechnicalBrief).not.toHaveBeenCalled()
    expect(saveTechnicalBrief).not.toHaveBeenCalled()
  })

  it('still calls the ai with a stack and no usable job spec', async () => {
    const dependencies = buildDependencies()

    await generate(dependencies)

    expect(dependencies.generateTechnicalBrief).toHaveBeenCalledWith(
      'sk-ant-test-key',
      expect.objectContaining({ stack: STACK, jobSpec: null }),
    )
  })

  it.each([
    ['missing_mission_stacks', 'cv_missing_information'],
    ['unreadable', 'cv_unreadable'],
  ])('maps %s to %s and saves nothing', async (cvStatus, expectedKind) => {
    const dependencies = buildDependencies({ generateTechnicalBrief: jest.fn().mockResolvedValue({ cvStatus }) })

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: true, data: { kind: expectedKind } })
    expect(saveTechnicalBrief).not.toHaveBeenCalled()
  })

  it('saves the brief with the cv label and date, then returns the reloaded view', async () => {
    const savedBrief = {
      language: 'fr' as const,
      content: usableContent,
      cvVersionId: SENT_CV_VERSION_ID,
      cvLabel: 'CV envoyé',
      cvUploadedAt: CV_UPLOADED_AT,
      generatedAt: NOW,
    }
    jest.mocked(findTechnicalBrief).mockResolvedValueOnce(null).mockResolvedValueOnce(savedBrief)

    const result = await generate(buildDependencies())

    expect(saveTechnicalBrief).toHaveBeenCalledWith(supabase, USER_ID, JOB_APPLICATION_ID, savedBrief)
    expect(result).toEqual({
      ok: true,
      data: {
        kind: 'generated',
        view: { language: 'fr', availability: 'ready', brief: savedBrief, isCvOutdated: false },
      },
    })
  })

  it('returns the ai error message and logs without the cv content', async () => {
    const dependencies = buildDependencies({
      generateTechnicalBrief: jest.fn().mockRejectedValue(new AiError('rate_limited')),
    })

    const result = await generate(dependencies)

    expect(result).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_AI_ERROR_MESSAGES.rate_limited })
    expect(saveTechnicalBrief).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('cv-base64')
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })
})
