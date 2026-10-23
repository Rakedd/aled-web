import { INTERVIEW_PREPARATION_MESSAGES } from './interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from './job-application'
import {
  formatTechnicalBriefSource,
  normalizeTechnicalBriefContent,
  splitGuidanceByMissionLabels,
  toTechnicalBriefView,
  validateTechnicalBriefRequest,
  type TechnicalBrief,
  type TechnicalBriefContent,
} from './technical-brief'

const buildStoryline = (stepCount: number) =>
  Array.from({ length: stepCount }, (_, index) => ({ title: `Étape ${index + 1}`, guidance: `Conseil ${index + 1}` }))

const buildMission = (overrides: Record<string, unknown> = {}) => ({
  label: 'Dev chez Acme',
  period: '2022 - 2024',
  emphasis: 'lean_on',
  sharedStack: ['React'],
  why: 'Stack identique',
  reflectionQuestions: ['Quel défi ?', 'Quel résultat ?'],
  ...overrides,
})

const buildCandidate = (overrides: Record<string, unknown> = {}) => ({
  storyline: buildStoryline(5),
  missions: [buildMission()],
  gaps: [{ stackItem: 'Kafka', question: 'As-tu déjà utilisé Kafka ?' }],
  ...overrides,
})

const buildContent = (): TechnicalBriefContent => ({
  storyline: [],
  missions: [],
  gaps: [],
})

const buildBrief = (overrides: Partial<TechnicalBrief> = {}): TechnicalBrief => ({
  language: 'fr',
  content: buildContent(),
  cvVersionId: 'cv-1',
  cvLabel: 'CV Freelance',
  cvUploadedAt: new Date('2026-03-05T10:00:00Z'),
  generatedAt: new Date('2026-03-06T10:00:00Z'),
  ...overrides,
})

describe('normalizeTechnicalBriefContent', () => {
  it('keeps a well-formed content and sorts the missions lean_on, intro, skim', () => {
    const content = normalizeTechnicalBriefContent(
      buildCandidate({
        missions: [
          buildMission({ label: 'A', emphasis: 'skim', reflectionQuestions: [] }),
          buildMission({ label: 'B', emphasis: 'intro', reflectionQuestions: ['Q ?'] }),
          buildMission({ label: 'C', emphasis: 'lean_on' }),
          buildMission({ label: 'D', emphasis: 'lean_on' }),
        ],
      }),
    )

    expect(content?.missions.map((mission) => mission.label)).toEqual(['C', 'D', 'B', 'A'])
    expect(content?.storyline).toHaveLength(5)
    expect(content?.gaps).toEqual([{ stackItem: 'Kafka', question: 'As-tu déjà utilisé Kafka ?' }])
  })

  it('does not reject a lean_on mission that has fewer questions than the prompt asks for', () => {
    const content = normalizeTechnicalBriefContent(
      buildCandidate({ missions: [buildMission({ reflectionQuestions: [] })] }),
    )

    expect(content?.missions[0].reflectionQuestions).toEqual([])
  })

  it('cuts the lists and texts to their limits and empties the questions of skim missions', () => {
    const content = normalizeTechnicalBriefContent(
      buildCandidate({
        missions: [
          ...Array.from({ length: 6 }, (_, index) =>
            buildMission({
              label: `M${index}`,
              why: 'x'.repeat(500),
              sharedStack: Array.from({ length: 15 }, (_, stackIndex) => `T${stackIndex}`),
              reflectionQuestions: ['1', '2', '3', '4', '5', '6'],
            }),
          ),
          buildMission({ label: 'Skim', emphasis: 'skim', reflectionQuestions: ['a', 'b', 'c'] }),
        ],
        gaps: Array.from({ length: 8 }, (_, index) => ({ stackItem: `G${index}`, question: `Q${index}` })),
      }),
    )

    expect(content?.missions).toHaveLength(6)
    expect(content?.missions.every((mission) => mission.why.length === 300)).toBe(true)
    expect(content?.missions[0].reflectionQuestions).toHaveLength(4)
    expect(content?.missions[0].sharedStack).toHaveLength(12)
    expect(content?.gaps).toHaveLength(5)

    const skimContent = normalizeTechnicalBriefContent(
      buildCandidate({ missions: [buildMission({ emphasis: 'skim', reflectionQuestions: ['a', 'b', 'c'] })] }),
    )
    expect(skimContent?.missions[0].reflectionQuestions).toEqual([])

    const introContent = normalizeTechnicalBriefContent(
      buildCandidate({ missions: [buildMission({ emphasis: 'intro', reflectionQuestions: ['a', 'b', 'c'] })] }),
    )
    expect(introContent?.missions[0].reflectionQuestions).toEqual(['a', 'b'])
  })

  it('trims texts and drops blank entries', () => {
    const content = normalizeTechnicalBriefContent(
      buildCandidate({
        missions: [
          buildMission({ label: '  Acme  ', sharedStack: [' React ', '  '], reflectionQuestions: ['  ', 'Q ?'] }),
          buildMission({ label: '   ' }),
        ],
        gaps: [
          { stackItem: ' ', question: 'Q' },
          { stackItem: ' Go ', question: ' Pourquoi ? ' },
        ],
      }),
    )

    expect(content?.missions).toHaveLength(1)
    expect(content?.missions[0].label).toBe('Acme')
    expect(content?.missions[0].sharedStack).toEqual(['React'])
    expect(content?.missions[0].reflectionQuestions).toEqual(['Q ?'])
    expect(content?.gaps).toEqual([{ stackItem: 'Go', question: 'Pourquoi ?' }])
  })

  it.each([
    ['a 4-step storyline', buildCandidate({ storyline: buildStoryline(4) })],
    ['no mission', buildCandidate({ missions: [] })],
    ['only blank missions', buildCandidate({ missions: [buildMission({ label: ' ' })] })],
    ['a non-string label', buildCandidate({ missions: [buildMission({ label: 42 })] })],
    ['an unknown emphasis', buildCandidate({ missions: [buildMission({ emphasis: 'other' })] })],
    ['null', null],
  ])('rejects an unusable content: %s', (_description, candidate) => {
    expect(normalizeTechnicalBriefContent(candidate)).toBeNull()
  })
})

describe('toTechnicalBriefView', () => {
  it('marks the brief outdated when the sent cv changed, was removed or the stored version is gone', () => {
    const view = (sentCvVersionId: string | null, storedCvVersionId: string | null) =>
      toTechnicalBriefView({
        language: 'fr',
        sentCvVersionId,
        hasMissionDetails: true,
        brief: buildBrief({ cvVersionId: storedCvVersionId }),
      })

    expect(view('cv-1', 'cv-1').isCvOutdated).toBe(false)
    expect(view('cv-2', 'cv-1').isCvOutdated).toBe(true)
    expect(view(null, 'cv-1').isCvOutdated).toBe(true)
    expect(view('cv-1', null).isCvOutdated).toBe(true)
    expect(
      toTechnicalBriefView({ language: 'fr', sentCvVersionId: 'cv-1', hasMissionDetails: true, brief: null })
        .isCvOutdated,
    ).toBe(false)
  })

  it('asks for a sent cv before mission details', () => {
    const view = toTechnicalBriefView({
      language: 'fr',
      sentCvVersionId: null,
      hasMissionDetails: false,
      brief: null,
    })

    expect(view.availability).toBe('missing_sent_cv')
    expect(
      toTechnicalBriefView({ language: 'fr', sentCvVersionId: 'cv-1', hasMissionDetails: false, brief: null })
        .availability,
    ).toBe('missing_mission_details')
  })

  it('is ready with a sent cv and either a stack or a job spec', () => {
    const view = toTechnicalBriefView({
      language: 'en',
      sentCvVersionId: 'cv-1',
      hasMissionDetails: true,
      brief: null,
    })

    expect(view).toEqual({ language: 'en', availability: 'ready', brief: null, isCvOutdated: false })
  })
})

describe('formatTechnicalBriefSource', () => {
  it('describes the cv source with the Paris date', () => {
    expect(formatTechnicalBriefSource(buildBrief({ cvUploadedAt: new Date('2026-03-05T23:30:00Z') }))).toBe(
      'Basé sur : CV Freelance · version du 06/03/2026 (le CV envoyé)',
    )
  })
})

describe('validateTechnicalBriefRequest', () => {
  const jobApplicationId = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

  it('accepts a uuid and a known language', () => {
    expect(validateTechnicalBriefRequest(jobApplicationId, 'en')).toEqual({
      ok: true,
      data: { jobApplicationId, language: 'en' },
    })
  })

  it('refuses a malformed job application id, then an unknown language', () => {
    expect(validateTechnicalBriefRequest('pas-un-uuid', 'de')).toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })
    expect(validateTechnicalBriefRequest(jobApplicationId, 'de')).toEqual({
      ok: false,
      errorMessage: INTERVIEW_PREPARATION_MESSAGES.invalidLanguage,
    })
  })
})

describe('splitGuidanceByMissionLabels', () => {
  it('keeps the guidance as one plain part without mission labels', () => {
    expect(splitGuidanceByMissionLabels('Dis qui tu es.', [])).toEqual([{ text: 'Dis qui tu es.', isMissionLabel: false }])
  })

  it('marks every occurrence of every mission label', () => {
    expect(
      splitGuidanceByMissionLabels('Raconte Alpha Corp, relie Beta Labs à Alpha Corp.', ['Alpha Corp', 'Beta Labs']),
    ).toEqual([
      { text: 'Raconte ', isMissionLabel: false },
      { text: 'Alpha Corp', isMissionLabel: true },
      { text: ', relie ', isMissionLabel: false },
      { text: 'Beta Labs', isMissionLabel: true },
      { text: ' à ', isMissionLabel: false },
      { text: 'Alpha Corp', isMissionLabel: true },
      { text: '.', isMissionLabel: false },
    ])
  })

  it('is case-sensitive and ignores labels of two characters or less', () => {
    expect(splitGuidanceByMissionLabels('Parle de alpha corp et de BI.', ['Alpha Corp', 'BI'])).toEqual([
      { text: 'Parle de alpha corp et de BI.', isMissionLabel: false },
    ])
  })

  it('prefers the longest label when labels overlap', () => {
    expect(splitGuidanceByMissionLabels('Alpha Corp puis Alpha', ['Alpha', 'Alpha Corp'])).toEqual([
      { text: 'Alpha Corp', isMissionLabel: true },
      { text: ' puis ', isMissionLabel: false },
      { text: 'Alpha', isMissionLabel: true },
    ])
  })

  it('matches labels that contain regular expression characters literally', () => {
    expect(splitGuidanceByMissionLabels('Cite C++ (2020) puis C+++.', ['C++ (2020)'])).toEqual([
      { text: 'Cite ', isMissionLabel: false },
      { text: 'C++ (2020)', isMissionLabel: true },
      { text: ' puis C+++.', isMissionLabel: false },
    ])
  })

  it('answers no part for an empty guidance', () => {
    expect(splitGuidanceByMissionLabels('', ['Alpha Corp'])).toEqual([])
  })
})
