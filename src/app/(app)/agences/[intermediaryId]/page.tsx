import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ExchangesSection } from '@/components/exchanges-section'
import { IntermediaryContactsList } from '@/components/intermediary-contacts-list'
import { IntermediaryHeader } from '@/components/intermediary-header'
import { ProposedMissionsList } from '@/components/proposed-missions-list'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { INTERMEDIARIES_LIST_ROUTE } from '@/domain/routes'
import { createContact, getIntermediaryPage } from '@/server/actions/contact-actions'
import { searchEntities, updateIntermediaryKind } from '@/server/actions/entity-actions'

const PANEL_CARD_CLASS_NAME = 'flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6'

const SECTION_TITLE_CLASS_NAME = 'font-heading text-xl font-extrabold'

const loadIntermediaryPage = cache(getIntermediaryPage)

export const generateMetadata = async ({ params }: PageProps<'/agences/[intermediaryId]'>): Promise<Metadata> => {
  const { intermediaryId } = await params
  const intermediaryPageResult = await loadIntermediaryPage(intermediaryId)
  return { title: intermediaryPageResult.ok ? `${intermediaryPageResult.data.intermediary.name} · Aled` : 'Agence · Aled' }
}

const IntermediaryDetailPage = async ({ params }: PageProps<'/agences/[intermediaryId]'>) => {
  const { intermediaryId } = await params
  const intermediaryPageResult = await loadIntermediaryPage(intermediaryId)

  if (!intermediaryPageResult.ok) {
    if (intermediaryPageResult.errorMessage === ENTITY_NOT_FOUND_MESSAGES.intermediary) notFound()
    return (
      <p role="alert" className="text-sm text-destructive">
        {intermediaryPageResult.errorMessage}
      </p>
    )
  }

  const { intermediary, contacts, exchanges, proposedMissions } = intermediaryPageResult.data

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={PANEL_CARD_CLASS_NAME}>
        <Link
          href={INTERMEDIARIES_LIST_ROUTE}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent-text hover:underline focus-visible:underline"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Mes contacts
        </Link>
        <IntermediaryHeader intermediary={intermediary} updateIntermediaryKind={updateIntermediaryKind} />
      </div>
      <section aria-labelledby="intermediary-contacts-title" className={PANEL_CARD_CLASS_NAME}>
        <h2 id="intermediary-contacts-title" className={SECTION_TITLE_CLASS_NAME}>
          Contacts
        </h2>
        <IntermediaryContactsList
          contacts={contacts}
          intermediaryName={intermediary.name}
          createContact={createContact}
          searchEntities={searchEntities}
        />
      </section>
      <section aria-labelledby="intermediary-exchanges-title" className={PANEL_CARD_CLASS_NAME}>
        <h2 id="intermediary-exchanges-title" className={SECTION_TITLE_CLASS_NAME}>
          Échanges
        </h2>
        <ExchangesSection exchanges={exchanges} showsContactName exchangeForm={null} />
      </section>
      <section aria-labelledby="intermediary-missions-title" className={PANEL_CARD_CLASS_NAME}>
        <h2 id="intermediary-missions-title" className={SECTION_TITLE_CLASS_NAME}>
          Missions proposées
        </h2>
        <ProposedMissionsList proposedMissions={proposedMissions} showsContactName />
      </section>
    </div>
  )
}

export default IntermediaryDetailPage
