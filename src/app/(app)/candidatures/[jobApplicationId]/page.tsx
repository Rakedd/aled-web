import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivityLog } from '@/components/activity-log'
import { JobApplicationHeader } from '@/components/job-application-header'
import { JobSpecSection } from '@/components/job-spec-section'
import { MissionInfoForm } from '@/components/mission-info-form'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { getContactDetails, searchEntities, setEndClientParent, updateContactDetails } from '@/server/actions/entity-actions'
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
  getJobSpecDownloadUrl,
  saveJobSpecText,
  uploadJobSpecPdf,
} from '@/server/actions/job-spec-actions'

export const metadata: Metadata = { title: 'Candidature · Freeclutch' }

export const maxDuration = 120

const SectionPlaceholder = ({ name }: { name: string }) => (
  <section aria-label={name} data-slot={name} className="hidden" />
)

const ClientBriefSection = () => <SectionPlaceholder name="ClientBriefSection" />
const InterviewsSection = () => <SectionPlaceholder name="InterviewsSection" />

const JobApplicationDetailPage = async ({ params }: { params: Promise<{ jobApplicationId: string }> }) => {
  const { jobApplicationId } = await params
  const [jobApplicationResult, activityLogEntriesResult, jobSpecResult] = await Promise.all([
    getJobApplication(jobApplicationId),
    listActivityLogEntries(jobApplicationId),
    getJobSpec(jobApplicationId),
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

  const jobApplication = jobApplicationResult.data

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
            getJobSpecDownloadUrl={getJobSpecDownloadUrl}
          />
          <ClientBriefSection />
          <InterviewsSection />
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
