'use client'

import { BlockForm } from '@/components/block-form'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { useController } from './controller'
import type { StackEditFormProps } from './interfaces'

export const StackEditForm = (props: StackEditFormProps) => {
  const { stack, setStack, isSaving, errorMessage, save, cancel } = useController(props)

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={cancel}>
      <StackChipsEditor stack={stack} onChange={setStack} origin="posting" />
    </BlockForm>
  )
}
