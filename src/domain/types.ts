export type StackCategory = 'language' | 'framework' | 'tool' | 'method' | 'other'

export type StackItemOrigin = 'posting' | 'job_spec'

export type StackItem = {
  name: string
  category: StackCategory
  origin: StackItemOrigin
}

export type ActivityKind = 'call' | 'message' | 'email' | 'status_change' | 'other'

export type InterviewKind = 'client' | 'mock' | 'other'

export type InterviewFormat = 'video' | 'onsite' | 'phone'

export type IntermediaryKind = 'agency' | 'esn' | 'platform' | 'direct' | 'other'

export type AlertKind =
  | 'follow_up_due'
  | 'job_spec_missing'
  | 'end_client_unknown'
  | 'upcoming_interview'
  | 'no_news_suggestion'
