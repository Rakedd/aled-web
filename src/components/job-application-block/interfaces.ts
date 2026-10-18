import type { ReactNode } from 'react'
import type { ContactEditFormProps } from '@/components/contact-edit-form/interfaces'
import type { HeaderEditFormProps } from '@/components/header-edit-form/interfaces'
import type { MissionDetailsFormProps } from '@/components/mission-details-form/interfaces'
import type { StackEditFormProps } from '@/components/stack-edit-form/interfaces'

export type JobApplicationBlockForm =
  | { kind: 'header'; props: Omit<HeaderEditFormProps, 'onClose'> }
  | { kind: 'missionDetails'; props: Omit<MissionDetailsFormProps, 'onClose'> }
  | { kind: 'contact'; props: Omit<ContactEditFormProps, 'onClose'> }
  | { kind: 'stack'; props: Omit<StackEditFormProps, 'onClose'> }

export type JobApplicationBlockProps = {
  title: string
  isTitleHidden?: boolean
  view: ReactNode
  form: JobApplicationBlockForm
}
