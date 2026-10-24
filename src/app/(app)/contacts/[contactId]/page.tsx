import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ContactProfileBlock } from '@/components/contact-profile-block'
import { DeleteContactButton } from '@/components/delete-contact-button'
import { ExchangesSection } from '@/components/exchanges-section'
import { ProposedMissionsList } from '@/components/proposed-missions-list'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { CONTACTS_ROUTE } from '@/domain/routes'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import {
  addContactExchange,
  deleteContact,
  getContactPage,
  updateContactProfile,
} from '@/server/actions/contact-actions'
import { searchEntities } from '@/server/actions/entity-actions'

const PANEL_CARD_CLASS_NAME = 'flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6'

const SECTION_TITLE_CLASS_NAME = 'font-heading text-xl font-extrabold'

const loadContactPage = cache(getContactPage)

export const generateMetadata = async ({ params }: PageProps<'/contacts/[contactId]'>): Promise<Metadata> => {
  const { contactId } = await params
  const contactPageResult = await loadContactPage(contactId)
  return { title: contactPageResult.ok ? `${contactPageResult.data.profile.fullName} · Aled` : 'Contact · Aled' }
}

const ContactDetailPage = async ({ params }: PageProps<'/contacts/[contactId]'>) => {
  const { contactId } = await params
  const contactPageResult = await loadContactPage(contactId)

  if (!contactPageResult.ok) {
    if (contactPageResult.errorMessage === ENTITY_NOT_FOUND_MESSAGES.contact) notFound()
    return (
      <p role="alert" className="text-sm text-destructive">
        {contactPageResult.errorMessage}
      </p>
    )
  }

  const { profile, proposedMissions, exchanges } = contactPageResult.data
  const jobApplicationOptions = proposedMissions.map((mission) => ({
    id: mission.jobApplicationId,
    title: mission.title,
  }))

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={PANEL_CARD_CLASS_NAME}>
        <Link
          href={CONTACTS_ROUTE}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent-text hover:underline focus-visible:underline"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Mes contacts
        </Link>
        <ContactProfileBlock
          heading={<h1 className={PAGE_TITLE_CLASS_NAME}>{profile.fullName}</h1>}
          profile={profile}
          updateContactProfile={updateContactProfile}
          searchEntities={searchEntities}
        />
      </div>
      <section aria-labelledby="contact-missions-title" className={PANEL_CARD_CLASS_NAME}>
        <h2 id="contact-missions-title" className={SECTION_TITLE_CLASS_NAME}>
          Missions proposées
        </h2>
        <ProposedMissionsList proposedMissions={proposedMissions} showsContactName={false} />
      </section>
      <section aria-labelledby="contact-exchanges-title" className={PANEL_CARD_CLASS_NAME}>
        <h2 id="contact-exchanges-title" className={SECTION_TITLE_CLASS_NAME}>
          Échanges
        </h2>
        <ExchangesSection
          exchanges={exchanges}
          showsContactName={false}
          exchangeForm={{ contactId: profile.id, jobApplicationOptions, addContactExchange, now: new Date() }}
        />
      </section>
      <DeleteContactButton contactId={profile.id} deleteContact={deleteContact} />
    </div>
  )
}

export default ContactDetailPage
