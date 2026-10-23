import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActivityLog } from '@/components/activity-log'
import { DeleteJobApplicationButton } from '@/components/delete-job-application-button'
import { HeaderView } from '@/components/header-view'
import { InterviewPreparationButton } from '@/components/interview-preparation-button'
import { InterviewsSection } from '@/components/interviews-section'
import { ContactView } from '@/components/contact-view'
import { JobApplicationBlock } from '@/components/job-application-block'
import { JobApplicationHeader } from '@/components/job-application-header'
import { JobApplicationHighlights } from '@/components/job-application-highlights'
import { JobApplicationTabs } from '@/components/job-application-tabs'
import { JobSpecSection } from '@/components/job-spec-section'
import { MissionDetailsView } from '@/components/mission-details-view'
import { SentCvView } from '@/components/sent-cv-view'
import { StackView } from '@/components/stack-view'
import type { ActionResult } from '@/domain/action-result'
import type { ContactDetails } from '@/domain/entities'
import type { InterviewPreparation } from '@/domain/interview-preparation'
import { toCvOptions } from '@/domain/cv-library'
import { findNextInterview } from '@/domain/interviews'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE, type JobApplicationOverview } from '@/domain/job-application'
import { JOB_APPLICATION_TAB_SEARCH_PARAMETER, resolveJobApplicationTab } from '@/domain/job-application-tabs'
import { JOB_APPLICATIONS_ROUTE } from '@/domain/routes'
import { toPositionedJobApplications } from '@/lib/duplicate-positioning-risks'
import { updateEndClientNotes } from '@/server/actions/client-brief-actions'
import {
  attachLibraryCvToJobApplication,
  detachSentCvFromJobApplication,
  listCvs,
  uploadTailoredCvForJobApplication,
} from '@/server/actions/cv-actions'
import {
  getContactDetails,
  searchEntities,
  setEndClientParent,
  updateContactDetails,
  updateIntermediaryKind,
} from '@/server/actions/entity-actions'
import {
  createInterview,
  deleteInterview,
  listInterviewsForJobApplication,
  updateInterview,
} from '@/server/actions/interview-actions'
import { generateInterviewPreparation, getInterviewPreparation } from '@/server/actions/interview-preparation-actions'
import { getTechnicalBriefView } from '@/server/actions/technical-brief-actions'
import {
  addActivityLogEntry,
  changeJobApplicationStatus,
  deleteJobApplication,
  getJobApplication,
  listActivityLogEntries,
  listJobApplications,
  updateJobApplication,
} from '@/server/actions/job-application-actions'
import {
  confirmJobSpecStack,
  discardPendingJobSpecStack,
  getJobSpec,
  saveJobSpecText,
  uploadJobSpecPdf,
} from '@/server/actions/job-spec-actions'
import { hasAnthropicApiKeyConfigured } from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Candidature · Aled' }

export const maxDuration = 300

const DEFAULT_BRIEF_LANGUAGE = 'fr'

const PANEL_CARD_CLASS_NAME = 'min-w-0 rounded-2xl bg-card p-6'

const loadInitialInterviewPreparation = async (jobApplicationId: string): Promise<ActionResult<InterviewPreparation>> => {
  const defaultLanguagePreparationResult = await getInterviewPreparation(jobApplicationId, DEFAULT_BRIEF_LANGUAGE)
  if (!defaultLanguagePreparationResult.ok) return defaultLanguagePreparationResult
  const { lastUsedLanguage } = defaultLanguagePreparationResult.data
  if (lastUsedLanguage === null || lastUsedLanguage === DEFAULT_BRIEF_LANGUAGE) return defaultLanguagePreparationResult
  return getInterviewPreparation(jobApplicationId, lastUsedLanguage)
}

type JobApplicationWithContactDetails = {
  jobApplicationResult: ActionResult<JobApplicationOverview>
  contactDetailsResult: ActionResult<ContactDetails> | null
}

const loadJobApplicationWithContactDetails = async (
  jobApplicationId: string,
): Promise<JobApplicationWithContactDetails> => {
  const jobApplicationResult = await getJobApplication(jobApplicationId)
  if (!jobApplicationResult.ok || jobApplicationResult.data.contactId === null) {
    return { jobApplicationResult, contactDetailsResult: null }
  }
  return { jobApplicationResult, contactDetailsResult: await getContactDetails(jobApplicationResult.data.contactId) }
}

const JobApplicationDetailPage = async ({ params, searchParams }: PageProps<'/candidatures/[jobApplicationId]'>) => {
  const [{ jobApplicationId }, { [JOB_APPLICATION_TAB_SEARCH_PARAMETER]: requestedTab }] = await Promise.all([
    params,
    searchParams,
  ])
  const [
    { jobApplicationResult, contactDetailsResult },
    activityLogEntriesResult,
    jobSpecResult,
    interviewsResult,
    interviewPreparationResult,
    hasAnthropicApiKey,
    cvsResult,
    jobApplicationsResult,
  ] = await Promise.all([
    loadJobApplicationWithContactDetails(jobApplicationId),
    listActivityLogEntries(jobApplicationId),
    getJobSpec(jobApplicationId),
    listInterviewsForJobApplication(jobApplicationId),
    loadInitialInterviewPreparation(jobApplicationId),
    hasAnthropicApiKeyConfigured(),
    listCvs(),
    listJobApplications(),
  ])

  if (!jobApplicationResult.ok) {
    if (jobApplicationResult.errorMessage === JOB_APPLICATION_NOT_FOUND_MESSAGE) notFound()
    return (
      <p role="alert" className="text-sm text-destructive">
        {jobApplicationResult.errorMessage}
      </p>
    )
  }

  if (!activityLogEntriesResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {activityLogEntriesResult.errorMessage}
      </p>
    )
  }

  if (!jobSpecResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {jobSpecResult.errorMessage}
      </p>
    )
  }

  if (!interviewsResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {interviewsResult.errorMessage}
      </p>
    )
  }

  const jobApplication = jobApplicationResult.data
  const now = new Date()

  if (!interviewPreparationResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {interviewPreparationResult.errorMessage}
      </p>
    )
  }

  const contactDetails = contactDetailsResult?.ok ? contactDetailsResult.data : null
  const contactDetailsErrorMessage =
    contactDetailsResult !== null && !contactDetailsResult.ok ? contactDetailsResult.errorMessage : null

  const cvOptions = cvsResult.ok ? toCvOptions(cvsResult.data) : []
  const positionedJobApplications = jobApplicationsResult.ok ? toPositionedJobApplications(jobApplicationsResult.data) : []

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6 lg:col-span-3">
          <Link
            href={JOB_APPLICATIONS_ROUTE}
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent-text hover:underline focus-visible:underline"
          >
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Mes candidatures
          </Link>
          <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight break-words md:text-4xl">
            {jobApplication.title}
          </h1>
          <JobApplicationBlock
            title="En-tête"
            isTitleHidden
            view={<HeaderView jobApplication={jobApplication} />}
            form={{
              kind: 'header',
              props: {
                jobApplication,
                updateJobApplication,
                setEndClientParent,
                updateIntermediaryKind,
                searchEntities,
                positionedJobApplications,
              },
            }}
          />
          <JobApplicationHeader jobApplication={jobApplication} changeJobApplicationStatus={changeJobApplicationStatus} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <JobApplicationHighlights
            requestedDailyRate={jobApplication.requestedDailyRate}
            postedDailyRate={jobApplication.postedDailyRate}
            nextInterview={findNextInterview(interviewsResult.data, now)}
            now={now}
            preparation={
              <InterviewPreparationButton
                key={`${jobApplication.id}-${jobApplication.endClientId ?? 'unknown-end-client'}`}
                jobApplicationId={jobApplication.id}
                initialPreparation={interviewPreparationResult.data}
                getInterviewPreparation={getInterviewPreparation}
                generateInterviewPreparation={generateInterviewPreparation}
                updateEndClientNotes={updateEndClientNotes}
                getTechnicalBriefView={getTechnicalBriefView}
                hasAnthropicApiKey={hasAnthropicApiKey}
              />
            }
          />
        </div>
      </div>
      <JobApplicationTabs
        key={jobApplication.id}
        initialTab={resolveJobApplicationTab(requestedTab, interviewsResult.data, now)}
        interviewCount={interviewsResult.data.length}
        activityLogEntryCount={activityLogEntriesResult.data.length}
        panels={{
          apercu: (
            <div className="flex min-w-0 flex-col gap-5">
              <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
                <div className={PANEL_CARD_CLASS_NAME}>
                  <JobApplicationBlock
                    title="Infos mission"
                    view={<MissionDetailsView jobApplication={jobApplication} />}
                    form={{ kind: 'missionDetails', props: { jobApplication, updateJobApplication } }}
                  />
                </div>
                <div className={PANEL_CARD_CLASS_NAME}>
                  <JobApplicationBlock
                    title="Contact"
                    view={
                      <ContactView
                        contactName={jobApplication.contactName}
                        contactDetails={contactDetails}
                        loadErrorMessage={contactDetailsErrorMessage}
                        contactId={jobApplication.contactId}
                      />
                    }
                    form={{
                      kind: 'contact',
                      props: { jobApplication, contactDetails, updateJobApplication, updateContactDetails, searchEntities },
                    }}
                  />
                </div>
                <div id="cv-envoye" className={`${PANEL_CARD_CLASS_NAME} scroll-mt-24`}>
                  <JobApplicationBlock
                    title="CV envoyé"
                    view={<SentCvView sentCv={jobApplication.sentCv} />}
                    form={{
                      kind: 'sentCv',
                      props: {
                        jobApplicationId: jobApplication.id,
                        jobApplicationTitle: jobApplication.title,
                        sentCv: jobApplication.sentCv,
                        cvOptions,
                        hasCvLoadFailed: !cvsResult.ok,
                        attachLibraryCvToJobApplication,
                        uploadTailoredCvForJobApplication,
                        detachSentCvFromJobApplication,
                      },
                    }}
                  />
                </div>
              </div>
              <DeleteJobApplicationButton jobApplicationId={jobApplication.id} deleteJobApplication={deleteJobApplication} />
            </div>
          ),
          mission: (
            <div className="flex min-w-0 flex-col gap-5">
              <div className={PANEL_CARD_CLASS_NAME}>
                <JobApplicationBlock
                  title="Stack"
                  view={<StackView stack={jobApplication.stack} />}
                  form={{ kind: 'stack', props: { jobApplication, updateJobApplication } }}
                />
              </div>
              <div className={PANEL_CARD_CLASS_NAME}>
                <JobSpecSection
                  jobApplicationId={jobApplication.id}
                  jobSpec={jobSpecResult.data}
                  uploadJobSpecPdf={uploadJobSpecPdf}
                  saveJobSpecText={saveJobSpecText}
                  confirmJobSpecStack={confirmJobSpecStack}
                  discardPendingJobSpecStack={discardPendingJobSpecStack}
                  hasAnthropicApiKey={hasAnthropicApiKey}
                />
              </div>
            </div>
          ),
          entretiens: (
            <div className={PANEL_CARD_CLASS_NAME}>
              <InterviewsSection
                jobApplicationId={jobApplication.id}
                initialInterviews={interviewsResult.data}
                createInterview={createInterview}
                updateInterview={updateInterview}
                deleteInterview={deleteInterview}
                listInterviewsForJobApplication={listInterviewsForJobApplication}
              />
            </div>
          ),
          journal: (
            <ActivityLog
              jobApplicationId={jobApplication.id}
              initialEntries={activityLogEntriesResult.data}
              addActivityLogEntry={addActivityLogEntry}
              listActivityLogEntries={listActivityLogEntries}
              now={now}
            />
          ),
        }}
      />
    </div>
  )
}

export default JobApplicationDetailPage
