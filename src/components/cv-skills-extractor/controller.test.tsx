import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { CvOption } from '@/domain/cv-library'
import { useController } from './controller'

const CV_OPTIONS: CvOption[] = [
  { id: 'cv-react', label: 'CV React' },
  { id: 'cv-java', label: 'CV Java' },
]

const renderExtractorController = (
  extractionResult: ActionResult<string[]> = { ok: true, data: ['React', 'Docker'] },
  mySkills: string[] = ['react'],
) => {
  const extractSkillsFromCv = jest.fn().mockResolvedValue(extractionResult)
  const onSkillsExtracted = jest.fn()
  const hook = renderHook(
    ({ currentSkills }: { currentSkills: string[] }) =>
      useController({ cvOptions: CV_OPTIONS, mySkills: currentSkills, extractSkillsFromCv, onSkillsExtracted }),
    { initialProps: { currentSkills: mySkills } },
  )
  return { ...hook, extractSkillsFromCv, onSkillsExtracted }
}

describe('cv-skills-extractor useController', () => {
  it('selects the first CV by default', () => {
    const { result } = renderExtractorController()
    expect(result.current.selectedCvId).toBe('cv-react')
  })

  it('extracts the skills of the selected CV, hands them over and tells how many are new', async () => {
    const { result, extractSkillsFromCv, onSkillsExtracted } = renderExtractorController()
    act(() => result.current.selectCv('cv-java'))

    await act(() => result.current.extract())

    expect(extractSkillsFromCv).toHaveBeenCalledWith('cv-java')
    expect(onSkillsExtracted).toHaveBeenCalledWith(['React', 'Docker'])
    expect(result.current.statusMessage).toBe('1 compétence ajoutée. Pense à enregistrer.')
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isExtracting).toBe(false)
  })

  it('counts the new skills against the list as it is when the extraction ends', async () => {
    const { result, rerender, extractSkillsFromCv } = renderExtractorController()
    let resolveExtraction: (actionResult: ActionResult<string[]>) => void = () => undefined
    extractSkillsFromCv.mockReturnValue(new Promise((resolve) => (resolveExtraction = resolve)))
    let pendingExtraction: Promise<void> = Promise.resolve()
    act(() => {
      pendingExtraction = result.current.extract()
    })

    rerender({ currentSkills: ['react', 'docker'] })
    await act(async () => {
      resolveExtraction({ ok: true, data: ['React', 'Docker'] })
      await pendingExtraction
    })

    expect(result.current.statusMessage).toBe('Aucune nouvelle compétence trouvée dans ce CV.')
  })

  it('says how many extracted skills are left out once my list reaches 100 skills', async () => {
    const ninetyEightSkills = Array.from({ length: 98 }, (_, index) => `Techno ${index}`)
    const { result, onSkillsExtracted } = renderExtractorController(
      { ok: true, data: ['Docker', 'Kubernetes', 'Terraform', 'Ansible'] },
      ninetyEightSkills,
    )

    await act(() => result.current.extract())

    expect(onSkillsExtracted).toHaveBeenCalledWith(['Docker', 'Kubernetes', 'Terraform', 'Ansible'])
    expect(result.current.statusMessage).toBe(
      '2 compétences ajoutées, 2 ignorées : 100 au maximum. Pense à enregistrer.',
    )
  })

  it('shows the error of the extraction without handing anything over', async () => {
    const { result, onSkillsExtracted } = renderExtractorController({
      ok: false,
      errorMessage: "L'extraction a échoué. Ajoute tes compétences à la main.",
    })

    await act(() => result.current.extract())

    expect(result.current.errorMessage).toBe("L'extraction a échoué. Ajoute tes compétences à la main.")
    expect(result.current.statusMessage).toBeNull()
    expect(onSkillsExtracted).not.toHaveBeenCalled()
  })

  it('shows the generic error when the action throws', async () => {
    const { result, extractSkillsFromCv } = renderExtractorController()
    extractSkillsFromCv.mockRejectedValue(new Error('network'))

    await act(() => result.current.extract())

    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(result.current.isExtracting).toBe(false)
  })

  it('refuses a CV that is not in the library without calling the server', async () => {
    const { result, extractSkillsFromCv } = renderExtractorController()
    act(() => result.current.selectCv('unknown-cv'))

    await act(() => result.current.extract())

    expect(extractSkillsFromCv).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Choisis un CV de ta bibliothèque.')
  })

  it('ignores a second extraction while one is in flight', async () => {
    const { result, extractSkillsFromCv } = renderExtractorController()
    let resolveExtraction: (actionResult: ActionResult<string[]>) => void = () => undefined
    extractSkillsFromCv.mockReturnValue(new Promise((resolve) => (resolveExtraction = resolve)))
    let firstExtraction: Promise<void> = Promise.resolve()
    act(() => {
      firstExtraction = result.current.extract()
    })

    expect(result.current.isExtracting).toBe(true)
    await act(() => result.current.extract())
    await act(async () => {
      resolveExtraction({ ok: true, data: [] })
      await firstExtraction
    })

    expect(extractSkillsFromCv).toHaveBeenCalledTimes(1)
  })

  it('clears the previous messages when another CV is selected', async () => {
    const { result } = renderExtractorController()
    await act(() => result.current.extract())

    act(() => result.current.selectCv('cv-java'))

    expect(result.current.statusMessage).toBeNull()
    expect(result.current.errorMessage).toBeNull()
  })
})
