export type InterviewRevisionStackGroup = {
  categoryLabel: string
  stackItemNames: string[]
}

export type InterviewRevisionMissionDetail = {
  label: string
  value: string
}

export type InterviewRevisionPanelContent = {
  jobApplicationTitle: string
  endClientLabel: string | null
  startsAtLabel: string
  kindLabel: string
  formatLabel: string
  stackGroups: InterviewRevisionStackGroup[]
  missionDetails: InterviewRevisionMissionDetail[]
  postingRawText: string | null
  jobApplicationHref: string
}

export type InterviewRevisionPanelProps = {
  content: InterviewRevisionPanelContent | null
  onClose: () => void
}
