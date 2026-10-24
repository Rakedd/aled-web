'use client'

import { useRouter } from 'next/navigation'
import { ContactProfileForm } from '@/components/contact-profile-form'
import { ContactProfileView } from '@/components/contact-profile-view'
import { EditableBlock } from '@/components/editable-block'
import type { ContactProfileBlockProps } from './interfaces'

export const ContactProfileBlock = ({ heading, ...formParameters }: ContactProfileBlockProps) => {
  const router = useRouter()

  return (
    <EditableBlock
      title="Coordonnées"
      heading={heading}
      view={<ContactProfileView profile={formParameters.profile} />}
      renderEdit={(close) => <ContactProfileForm {...formParameters} onDataChanged={router.refresh} onClose={close} />}
    />
  )
}
