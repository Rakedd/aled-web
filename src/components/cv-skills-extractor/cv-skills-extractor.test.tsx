import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CvOption } from '@/domain/cv-library'
import { CvSkillsExtractor } from './cv-skills-extractor'
import type { CvSkillsExtractorProps } from './interfaces'

const CV_OPTIONS: CvOption[] = [
  { id: 'cv-react', label: 'CV React' },
  { id: 'cv-java', label: 'CV Java' },
]

const renderExtractor = (overrides: Partial<CvSkillsExtractorProps> = {}) => {
  const extractSkillsFromCv = jest.fn().mockResolvedValue({ ok: true, data: ['Docker'] })
  const onSkillsExtracted = jest.fn()
  render(
    <CvSkillsExtractor
      cvOptions={CV_OPTIONS}
      hasAnthropicApiKey
      cvLibraryErrorMessage={null}
      mySkills={[]}
      extractSkillsFromCv={extractSkillsFromCv}
      onSkillsExtracted={onSkillsExtracted}
      {...overrides}
    />,
  )
  return { extractSkillsFromCv, onSkillsExtracted }
}

describe('CvSkillsExtractor', () => {
  it('lets me pick a CV of my library and extract its skills', async () => {
    const { extractSkillsFromCv, onSkillsExtracted } = renderExtractor()

    expect(screen.getByRole('heading', { name: 'Remplir depuis mon CV' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'CV à analyser' }), 'cv-java')
    await userEvent.click(screen.getByRole('button', { name: 'Extraire les compétences' }))

    expect(extractSkillsFromCv).toHaveBeenCalledWith('cv-java')
    expect(onSkillsExtracted).toHaveBeenCalledWith(['Docker'])
    expect(await screen.findByRole('status')).toHaveTextContent('1 compétence ajoutée. Pense à enregistrer.')
  })

  it('never submits the surrounding form', async () => {
    renderExtractor()
    expect(screen.getByRole('button', { name: 'Extraire les compétences' })).toHaveAttribute('type', 'button')
  })

  it('announces the failure as an alert', async () => {
    renderExtractor({
      extractSkillsFromCv: jest.fn().mockResolvedValue({
        ok: false,
        errorMessage: "L'extraction a échoué. Ajoute tes compétences à la main.",
      }),
    })

    await userEvent.click(screen.getByRole('button', { name: 'Extraire les compétences' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("L'extraction a échoué. Ajoute tes compétences à la main.")
  })

  it('shows « Extraction… » on a disabled button while the extraction runs', async () => {
    renderExtractor({ extractSkillsFromCv: jest.fn().mockReturnValue(new Promise(() => undefined)) })

    await userEvent.click(screen.getByRole('button', { name: 'Extraire les compétences' }))

    expect(screen.getByRole('button', { name: 'Extraction…' })).toBeDisabled()
  })

  it('invites me to add a CV, with a link to my CVs, when my library has none', () => {
    renderExtractor({ cvOptions: [] })

    expect(screen.getByRole('link', { name: 'Mes CV' })).toHaveAttribute('href', '/cv')
    expect(screen.getByRole('link', { name: 'Mes CV' }).closest('p')).toHaveTextContent(
      'Ajoute un CV dans Mes CV pour remplir ta liste automatiquement.',
    )
    expect(screen.queryByRole('button', { name: 'Extraire les compétences' })).not.toBeInTheDocument()
  })

  it('shows the failure to load my CVs instead of inviting me to add one', () => {
    renderExtractor({ cvOptions: [], cvLibraryErrorMessage: 'Impossible de charger tes CV pour le moment.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger tes CV pour le moment.')
    expect(screen.queryByRole('link', { name: 'Mes CV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Extraire les compétences' })).not.toBeInTheDocument()
  })

  it('asks for a Claude key instead of the extraction when I have none', () => {
    renderExtractor({ hasAnthropicApiKey: false })

    expect(screen.getByRole('note')).toHaveTextContent(
      "Ajoute ta clé Claude dans tes préférences pour activer l'extraction de tes compétences depuis ton CV.",
    )
    expect(screen.queryByRole('button', { name: 'Extraire les compétences' })).not.toBeInTheDocument()
  })
})
