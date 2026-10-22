'use client'

import { useRouter } from 'next/navigation'
import { ContactEditForm } from '@/components/contact-edit-form'
import { EditableBlock } from '@/components/editable-block'
import { HeaderEditForm } from '@/components/header-edit-form'
import { MissionDetailsForm } from '@/components/mission-details-form'
import { SentCvEditForm } from '@/components/sent-cv-edit-form'
import { StackEditForm } from '@/components/stack-edit-form'
import type { JobApplicationBlockForm, JobApplicationBlockProps } from './interfaces'

const renderBlockForm = (form: JobApplicationBlockForm, onDataChanged: () => void, onClose: () => void) => {
  switch (form.kind) {
    case 'header':
      return <HeaderEditForm {...form.props} onDataChanged={onDataChanged} onClose={onClose} />
    case 'missionDetails':
      return <MissionDetailsForm {...form.props} onDataChanged={onDataChanged} onClose={onClose} />
    case 'contact':
      return <ContactEditForm {...form.props} onDataChanged={onDataChanged} onClose={onClose} />
    case 'sentCv':
      return <SentCvEditForm {...form.props} onDataChanged={onDataChanged} onClose={onClose} />
    case 'stack':
      return <StackEditForm {...form.props} onDataChanged={onDataChanged} onClose={onClose} />
  }
}

export const JobApplicationBlock = ({ title, isTitleHidden, view, form }: JobApplicationBlockProps) => {
  const router = useRouter()

  return (
    <EditableBlock
      title={title}
      isTitleHidden={isTitleHidden}
      view={view}
      renderEdit={(close) => renderBlockForm(form, router.refresh, close)}
    />
  )
}
