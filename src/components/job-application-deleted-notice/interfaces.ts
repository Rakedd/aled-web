export type JobApplicationDeletedNoticeProps = {
  isJobApplicationDeleted: boolean
}

export type JobApplicationDeletedNoticeControllerParameters = JobApplicationDeletedNoticeProps & {
  replaceRoute: (route: string, options: { scroll: boolean }) => void
}
