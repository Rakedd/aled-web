'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { Pill } from '@/components/pill'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InterviewRevisionPanelProps } from './interfaces'

export const InterviewRevisionPanel = ({ content, onClose }: InterviewRevisionPanelProps) => {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isOpen = content !== null

  useEffect(() => {
    if (isOpen) titleRef.current?.focus()
  }, [isOpen])

  if (content === null) return null

  return (
    <aside
      aria-labelledby={titleId}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Escape') onClose()
      }}
      className="flex min-w-0 flex-col gap-5 rounded-2xl bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-heading text-lg font-bold outline-none">
          {content.jobApplicationTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {content.kindLabel} · {content.formatLabel} · {content.startsAtLabel}
        </p>
      </div>
      <p className="text-sm">
        <span className="font-medium">Client final : </span>
        {content.endClientLabel ?? 'Non renseigné'}
      </p>
      <section aria-labelledby="interview-revision-mission-title" className="flex flex-col gap-3">
        <h3 id="interview-revision-mission-title" className="text-sm font-semibold">
          Mission
        </h3>
        {content.missionDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun détail renseigné pour cette mission.</p>
        ) : (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            {content.missionDetails.map((missionDetail) => (
              <div key={missionDetail.label} className="contents">
                <dt className="font-medium">{missionDetail.label}</dt>
                <dd className="break-words">{missionDetail.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {content.postingRawText !== null && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">Texte original de l&apos;annonce</summary>
            <p className="mt-3 text-sm break-words whitespace-pre-wrap">{content.postingRawText}</p>
          </details>
        )}
      </section>
      <section aria-labelledby="interview-revision-stack-title" className="flex flex-col gap-3">
        <h3 id="interview-revision-stack-title" className="text-sm font-semibold">
          Stack à réviser
        </h3>
        {content.stackGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune stack renseignée pour cette mission.</p>
        ) : (
          content.stackGroups.map((stackGroup) => (
            <div key={stackGroup.categoryLabel} className="flex flex-col gap-1">
              <h4 className="text-xs font-medium text-muted-foreground">{stackGroup.categoryLabel}</h4>
              <ul className="flex flex-wrap gap-1.5">
                {stackGroup.stackItemNames.map((stackItemName) => (
                  <li key={stackItemName}>
                    <Pill tone="sage">{stackItemName}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href={content.jobApplicationHref} className={buttonVariants()}>
          Ouvrir la fiche
        </Link>
        <Link href={content.briefHref} className={cn(buttonVariants({ variant: 'outline' }))}>
          Voir mon brief
        </Link>
        <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: 'outline' }))}>
          Fermer
        </button>
      </div>
    </aside>
  )
}
