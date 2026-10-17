import {
  type JobApplicationInput,
  validateJobApplicationId,
  validateJobApplicationInput,
  validateJobApplicationUpdateInput,
} from './job-application'

const validJobApplicationInput: JobApplicationInput = {
  title: ' Développeur React ',
  source: 'LinkedIn',
  postingUrl: 'https://www.free-work.com/fr/tech-it/jobs/react',
  postingRawText: 'Mission React de 6 mois',
  status: 'applied',
  postedDailyRate: 550,
  requestedDailyRate: 600,
  location: 'Paris',
  remotePolicy: '2 jours sur site',
  desiredStart: 'ASAP',
  duration: '6 mois',
  appliedOn: new Date('2026-10-16T22:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [{ name: ' React ', category: 'framework', origin: 'posting' }],
  intermediaryName: ' Agence X ',
  contactName: 'Jean Dupont',
  contactEmail: 'jean@agence-x.fr',
  contactPhone: '06 12 34 56 78',
  endClientName: 'BNP Paribas AM',
  endClientParentName: 'BNP Paribas',
}

describe('validateJobApplicationInput', () => {
  it('accepts a valid input, trims text and keeps only the known fields', () => {
    const validationResult = validateJobApplicationInput({
      ...validJobApplicationInput,
      user_id: 'forged-user',
      id: 'forged-id',
    })
    expect(validationResult).toEqual({
      ok: true,
      data: {
        ...validJobApplicationInput,
        title: 'Développeur React',
        intermediaryName: 'Agence X',
        stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
      },
    })
  })

  it('turns blank optional text into null', () => {
    const validationResult = validateJobApplicationInput({ ...validJobApplicationInput, source: '  ', endClientName: '' })
    expect(validationResult).toMatchObject({ ok: true, data: { source: null, endClientName: null } })
  })

  it('requires a title', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, title: '   ' })).toEqual({
      ok: false,
      errorMessage: 'Le titre est obligatoire',
    })
  })

  it('requires every field', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, status: undefined })).toEqual({
      ok: false,
      errorMessage: 'Statut invalide',
    })
  })

  it.each([-1, 550.5, Number.NaN, '550', 100_001])('rejects the daily rate %p', (postedDailyRate) => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, postedDailyRate })).toEqual({
      ok: false,
      errorMessage: 'TJM invalide',
    })
  })

  it('rejects an unknown status', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, status: 'hired' })).toEqual({
      ok: false,
      errorMessage: 'Statut invalide',
    })
  })

  it('rejects an invalid application date', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, appliedOn: new Date('nope') })).toEqual({
      ok: false,
      errorMessage: 'Date de candidature invalide',
    })
  })

  it('rejects a posting url that is not http or https', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, postingUrl: 'javascript:alert(1)' })).toEqual({
      ok: false,
      errorMessage: "Lien de l'annonce invalide",
    })
  })

  it('rejects a malformed contact e-mail', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, contactEmail: 'jean@' })).toEqual({
      ok: false,
      errorMessage: 'E-mail invalide',
    })
  })

  it('rejects a stack item with an unknown category', () => {
    expect(
      validateJobApplicationInput({
        ...validJobApplicationInput,
        stack: [{ name: 'React', category: 'library', origin: 'posting' }],
      }),
    ).toEqual({ ok: false, errorMessage: 'Stack invalide' })
  })

  it('rejects an overly long text field with its own label', () => {
    expect(validateJobApplicationInput({ ...validJobApplicationInput, location: 'a'.repeat(201) })).toEqual({
      ok: false,
      errorMessage: 'Lieu : 200 caractères maximum',
    })
  })

  it('rejects a payload that is not an object', () => {
    expect(validateJobApplicationInput(null)).toEqual({ ok: false, errorMessage: 'Candidature invalide' })
  })
})

describe('validateJobApplicationUpdateInput', () => {
  it('keeps only the provided known fields', () => {
    expect(
      validateJobApplicationUpdateInput({ notes: ' Rappeler lundi ', user_id: 'forged-user', end_client_id: 'forged' }),
    ).toEqual({ ok: true, data: { notes: 'Rappeler lundi' } })
  })

  it('keeps an explicit null to clear a field', () => {
    expect(validateJobApplicationUpdateInput({ intermediaryName: null })).toEqual({
      ok: true,
      data: { intermediaryName: null },
    })
  })

  it('validates each provided field', () => {
    expect(validateJobApplicationUpdateInput({ requestedDailyRate: -5 })).toEqual({
      ok: false,
      errorMessage: 'TJM invalide',
    })
    expect(validateJobApplicationUpdateInput({ title: '' })).toEqual({
      ok: false,
      errorMessage: 'Le titre est obligatoire',
    })
  })
})

describe('validateJobApplicationId', () => {
  it('accepts a uuid', () => {
    expect(validateJobApplicationId('6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f')).toEqual({
      ok: true,
      data: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    })
  })

  it.each(['42', '', null, "' or 1=1 --"])('rejects %p as not found', (jobApplicationId) => {
    expect(validateJobApplicationId(jobApplicationId)).toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
  })
})
