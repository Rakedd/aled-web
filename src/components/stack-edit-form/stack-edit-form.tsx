'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { BlockFormActions } from '@/components/block-form-actions'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { useController } from './controller'
import type { StackEditFormProps } from './interfaces'

export const StackEditForm = ({ jobApplication, updateJobApplication, onClose }: StackEditFormProps) => {
  const router = useRouter()
  const { stack, setStack, isSaving, errorMessage, save, cancel } = useController({
    jobApplication,
    updateJobApplication,
    onDataChanged: router.refresh,
    onClose,
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void save()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <StackChipsEditor stack={stack} onChange={setStack} origin="posting" />
      <BlockFormActions isSaving={isSaving} errorMessage={errorMessage} onCancel={cancel} />
    </form>
  )
}
