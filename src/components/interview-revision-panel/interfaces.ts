export type InterviewRevisionStackGroup = {
  categoryLabel: string
  stackItemNames: string[]
}

export type InterviewRevisionPanelContent = {
  jobApplicationTitle: string
  endClientLabel: string | null
  startsAtLabel: string
  kindLabel: string
  formatLabel: string
  stackGroups: InterviewRevisionStackGroup[]
  jobApplicationHref: string
}

export type InterviewRevisionPanelProps = {
  content: InterviewRevisionPanelContent | null
  onClose: () => void
}
