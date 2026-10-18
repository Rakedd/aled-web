'use client'

import { ContactEditForm } from '@/components/contact-edit-form'
import { EditableBlock } from '@/components/editable-block'
import { HeaderEditForm } from '@/components/header-edit-form'
import { MissionDetailsForm } from '@/components/mission-details-form'
import { StackEditForm } from '@/components/stack-edit-form'
import type { JobApplicationBlockForm, JobApplicationBlockProps } from './interfaces'

const renderBlockForm = (form: JobApplicationBlockForm, close: () => void) => {
  switch (form.kind) {
    case 'header':
      return <HeaderEditForm {...form.props} onClose={close} />
    case 'missionDetails':
      return <MissionDetailsForm {...form.props} onClose={close} />
    case 'contact':
      return <ContactEditForm {...form.props} onClose={close} />
    case 'stack':
      return <StackEditForm {...form.props} onClose={close} />
  }
}

export const JobApplicationBlock = ({ title, isTitleHidden, view, form }: JobApplicationBlockProps) => (
  <EditableBlock
    title={title}
    isTitleHidden={isTitleHidden}
    view={view}
    renderEdit={(close) => renderBlockForm(form, close)}
  />
)
