'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InterviewRevisionPanelProps } from './interfaces'

export const InterviewRevisionPanel = ({ content, onClose }: InterviewRevisionPanelProps) => (
  <Dialog.Root
    open={content !== null}
    onOpenChange={(isOpen) => {
      if (!isOpen) onClose()
    }}
  >
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
      <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 overflow-y-auto border-l bg-background p-6 shadow-xl outline-none">
        {content !== null && (
          <>
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold">{content.jobApplicationTitle}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {content.kindLabel} · {content.formatLabel} · {content.startsAtLabel}
              </Dialog.Description>
            </div>
            <p className="text-sm">
              <span className="font-medium">Client final : </span>
              {content.endClientLabel ?? 'Non renseigné'}
            </p>
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
                        <li key={stackItemName} className="rounded-full border px-2 py-0.5 text-xs">
                          {stackItemName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={content.jobApplicationHref} className={buttonVariants()}>
                Ouvrir la candidature
              </Link>
              <Dialog.Close className={cn(buttonVariants({ variant: 'outline' }))}>Fermer</Dialog.Close>
            </div>
          </>
        )}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
)
