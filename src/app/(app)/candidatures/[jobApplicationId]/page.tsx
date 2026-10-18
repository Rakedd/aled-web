import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivityLog } from '@/components/activity-log'
import { InterviewPreparationButton } from '@/components/interview-preparation-button'
import { InterviewsSection } from '@/components/interviews-section'
import { JobApplicationHeader } from '@/components/job-application-header'
import { JobSpecSection } from '@/components/job-spec-section'
import { MissionInfoForm } from '@/components/mission-info-form'
import type { ActionResult } from '@/domain/action-result'
import type { InterviewPreparation } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { updateEndClientNotes } from '@/server/actions/client-brief-actions'
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
import {
  addActivityLogEntry,
  changeJobApplicationStatus,
  getJobApplication,
  listActivityLogEntries,
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

export const metadata: Metadata = { title: 'Candidature · Freeclutch' }

export const maxDuration = 300

const DEFAULT_BRIEF_LANGUAGE = 'fr'

const loadInitialInterviewPreparation = async (jobApplicationId: string): Promise<ActionResult<InterviewPreparation>> => {
  const defaultLanguagePreparationResult = await getInterviewPreparation(jobApplicationId, DEFAULT_BRIEF_LANGUAGE)
  if (!defaultLanguagePreparationResult.ok) return defaultLanguagePreparationResult
  const { lastUsedLanguage } = defaultLanguagePreparationResult.data
  if (lastUsedLanguage === null || lastUsedLanguage === DEFAULT_BRIEF_LANGUAGE) return defaultLanguagePreparationResult
  return getInterviewPreparation(jobApplicationId, lastUsedLanguage)
}

const JobApplicationDetailPage = async ({ params }: { params: Promise<{ jobApplicationId: string }> }) => {
  const { jobApplicationId } = await params
  const [jobApplicationResult, activityLogEntriesResult, jobSpecResult, interviewsResult, hasAnthropicApiKey] =
    await Promise.all([
      getJobApplication(jobApplicationId),
      listActivityLogEntries(jobApplicationId),
      getJobSpec(jobApplicationId),
      listInterviewsForJobApplication(jobApplicationId),
      hasAnthropicApiKeyConfigured(),
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
  const interviewPreparationResult = await loadInitialInterviewPreparation(jobApplication.id)

  if (!interviewPreparationResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {interviewPreparationResult.errorMessage}
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <JobApplicationHeader
        jobApplication={jobApplication}
        changeJobApplicationStatus={changeJobApplicationStatus}
        now={now}
      />
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MissionInfoForm
          jobApplication={jobApplication}
          updateJobApplication={updateJobApplication}
          setEndClientParent={setEndClientParent}
          getContactDetails={getContactDetails}
          updateContactDetails={updateContactDetails}
          updateIntermediaryKind={updateIntermediaryKind}
          searchEntities={searchEntities}
        />
        <div className="flex min-w-0 flex-col gap-8">
          <JobSpecSection
            key={jobApplication.id}
            jobApplicationId={jobApplication.id}
            jobSpec={jobSpecResult.data}
            uploadJobSpecPdf={uploadJobSpecPdf}
            saveJobSpecText={saveJobSpecText}
            confirmJobSpecStack={confirmJobSpecStack}
            discardPendingJobSpecStack={discardPendingJobSpecStack}
            hasAnthropicApiKey={hasAnthropicApiKey}
          />
          <InterviewPreparationButton
            key={`${jobApplication.id}-${jobApplication.endClientId ?? 'unknown-end-client'}`}
            jobApplicationId={jobApplication.id}
            initialPreparation={interviewPreparationResult.data}
            getInterviewPreparation={getInterviewPreparation}
            generateInterviewPreparation={generateInterviewPreparation}
            updateEndClientNotes={updateEndClientNotes}
            hasAnthropicApiKey={hasAnthropicApiKey}
          />
          <InterviewsSection
            key={jobApplication.id}
            jobApplicationId={jobApplication.id}
            initialInterviews={interviewsResult.data}
            createInterview={createInterview}
            updateInterview={updateInterview}
            deleteInterview={deleteInterview}
            listInterviewsForJobApplication={listInterviewsForJobApplication}
          />
        </div>
      </div>
      <ActivityLog
        jobApplicationId={jobApplication.id}
        initialEntries={activityLogEntriesResult.data}
        addActivityLogEntry={addActivityLogEntry}
        listActivityLogEntries={listActivityLogEntries}
        now={now}
      />
    </div>
  )
}

export default JobApplicationDetailPage
