import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivityLog } from '@/components/activity-log'
import { ClientBriefSection } from '@/components/client-brief-section'
import { InterviewsSection } from '@/components/interviews-section'
import { JobApplicationHeader } from '@/components/job-application-header'
import { JobSpecSection } from '@/components/job-spec-section'
import { MissionInfoForm } from '@/components/mission-info-form'
import type { ActionResult } from '@/domain/action-result'
import type { EndClientBrief } from '@/domain/client-brief'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { generateBriefForEndClient, getEndClientBrief, updateEndClientNotes } from '@/server/actions/client-brief-actions'
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

const loadEndClientBrief = (endClientId: string | null): Promise<ActionResult<EndClientBrief | null>> =>
  endClientId === null ? Promise.resolve({ ok: true, data: null }) : getEndClientBrief(endClientId)

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
  const endClientBriefResult = await loadEndClientBrief(jobApplication.endClientId)

  if (!endClientBriefResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {endClientBriefResult.errorMessage}
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <JobApplicationHeader
        jobApplication={jobApplication}
        changeJobApplicationStatus={changeJobApplicationStatus}
        now={new Date()}
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
          <ClientBriefSection
            key={jobApplication.endClientId ?? 'unknown-end-client'}
            endClientBrief={endClientBriefResult.data}
            endClientLabel={jobApplication.endClientLabel}
            generateBriefForEndClient={generateBriefForEndClient}
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
      />
    </div>
  )
}

export default JobApplicationDetailPage
