import type { CreateCv } from '@/components/cv-library/interfaces'

export type AddCvFormProps = {
  createCv: CreateCv
  onCreated: () => void
  onCancel: () => void
}

export type AddCvFormControllerParameters = Omit<AddCvFormProps, 'onCancel'>
