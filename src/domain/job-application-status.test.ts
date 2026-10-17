import {
  JOB_APPLICATION_STATUS_LABELS,
  getNextPipelineStatus,
  getSuggestedKoStatuses,
  isActiveStatus,
  isJobApplicationStatus,
  isTerminalStatus,
} from './job-application-status'

describe('job application status', () => {
  it('labels statuses in French', () => {
    expect(JOB_APPLICATION_STATUS_LABELS.applied).toBe('Postulé')
    expect(JOB_APPLICATION_STATUS_LABELS.intermediary_contact).toBe('Échange intermédiaire')
    expect(JOB_APPLICATION_STATUS_LABELS.cv_submitted).toBe('CV positionné')
    expect(JOB_APPLICATION_STATUS_LABELS.interview_scheduled).toBe('Entretien planifié')
    expect(JOB_APPLICATION_STATUS_LABELS.interview_done).toBe('Entretien passé')
    expect(JOB_APPLICATION_STATUS_LABELS.contract_received).toBe('Contrat reçu')
    expect(JOB_APPLICATION_STATUS_LABELS.signed).toBe('Signé')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_after_contact).toBe('KO après échange')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_cv).toBe('KO CV')
    expect(JOB_APPLICATION_STATUS_LABELS.ko_interview).toBe('KO entretien')
    expect(JOB_APPLICATION_STATUS_LABELS.no_news_abandoned).toBe('Sans nouvelles / abandonnée')
  })
  it('walks the pipeline in order and stops at signed', () => {
    expect(getNextPipelineStatus('applied')).toBe('intermediary_contact')
    expect(getNextPipelineStatus('contract_received')).toBe('signed')
    expect(getNextPipelineStatus('signed')).toBeNull()
    expect(getNextPipelineStatus('ko_cv')).toBeNull()
  })
  it('treats signed and every KO as terminal', () => {
    expect(isTerminalStatus('signed')).toBe(true)
    expect(isTerminalStatus('no_news_abandoned')).toBe(true)
    expect(isTerminalStatus('cv_submitted')).toBe(false)
    expect(isActiveStatus('cv_submitted')).toBe(true)
  })
  it('suggests KO outcomes that fit the current step', () => {
    expect(getSuggestedKoStatuses('applied')).toEqual(['ko_after_contact', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('intermediary_contact')).toEqual(['ko_after_contact', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('cv_submitted')).toEqual(['ko_cv', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('interview_scheduled')).toEqual(['ko_interview', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('interview_done')).toEqual(['ko_interview', 'no_news_abandoned'])
    expect(getSuggestedKoStatuses('contract_received')).toEqual(['no_news_abandoned'])
    expect(getSuggestedKoStatuses('signed')).toEqual([])
  })
})

describe('isJobApplicationStatus', () => {
  it('recognizes every known status', () => {
    expect(isJobApplicationStatus('applied')).toBe(true)
    expect(isJobApplicationStatus('no_news_abandoned')).toBe(true)
  })

  it.each(['hired', 'toString', '', null, 3])('rejects %p', (candidate) => {
    expect(isJobApplicationStatus(candidate)).toBe(false)
  })
})
