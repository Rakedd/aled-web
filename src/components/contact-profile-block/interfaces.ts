import type { ReactNode } from 'react'
import type { ContactProfileFormProps } from '@/components/contact-profile-form/interfaces'

export type ContactProfileBlockProps = Omit<ContactProfileFormProps, 'onDataChanged' | 'onClose'> & {
  heading: ReactNode
}
