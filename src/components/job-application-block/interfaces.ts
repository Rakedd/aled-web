import type { ReactNode } from 'react'
import type { ContactEditFormProps } from '@/components/contact-edit-form/interfaces'
import type { HeaderEditFormProps } from '@/components/header-edit-form/interfaces'
import type { MissionDetailsFormProps } from '@/components/mission-details-form/interfaces'
import type { StackEditFormProps } from '@/components/stack-edit-form/interfaces'

export type JobApplicationBlockForm =
  | { kind: 'header'; props: Omit<HeaderEditFormProps, 'onClose' | 'onDataChanged'> }
  | { kind: 'missionDetails'; props: Omit<MissionDetailsFormProps, 'onClose' | 'onDataChanged'> }
  | { kind: 'contact'; props: Omit<ContactEditFormProps, 'onClose' | 'onDataChanged'> }
  | { kind: 'stack'; props: Omit<StackEditFormProps, 'onClose' | 'onDataChanged'> }

export type JobApplicationBlockProps = {
  title: string
  isTitleHidden?: boolean
  view: ReactNode
  form: JobApplicationBlockForm
}
