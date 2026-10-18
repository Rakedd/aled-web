import { findChangedFields } from '@/domain/form-values'
import type { StackItem } from '@/domain/types'
import { planJobApplicationUpdate, useBlockForm } from '@/lib/use-block-form'
import type { StackEditFormControllerParameters, StackEditFormValues } from './interfaces'

export const useController = ({
  jobApplication,
  updateJobApplication,
  onDataChanged,
  onClose,
}: StackEditFormControllerParameters) => {
  const { baselineFormValues, formValues, setFormValue, isSaving, errorMessage, save } =
    useBlockForm<StackEditFormValues>({
      serverFormValues: { stack: jobApplication.stack },
      onDataChanged,
      onClose,
    })

  const setStack = (stack: StackItem[]) => setFormValue('stack', stack)

  const saveChangedStack = () =>
    save(() =>
      planJobApplicationUpdate(findChangedFields(baselineFormValues, formValues), (validatedInput) =>
        updateJobApplication(jobApplication.id, validatedInput),
      ),
    )

  return {
    stack: formValues.stack,
    setStack,
    isSaving,
    errorMessage,
    save: saveChangedStack,
    cancel: onClose,
  }
}
