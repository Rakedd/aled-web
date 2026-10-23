'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRef } from 'react'
import { TechnicalBriefSection } from '@/components/technical-brief-section'
import { Button, buttonVariants } from '@/components/ui/button'
import { TECHNICAL_BRIEF_MESSAGES } from '@/domain/technical-brief'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { TechnicalBriefButtonProps } from './interfaces'

export const TechnicalBriefButton = (controllerParameters: TechnicalBriefButtonProps) => {
  const openingButtonRef = useRef<HTMLButtonElement | null>(null)
  const { isDialogOpen, openDialog, closeDialog, buttonLabel, closedDialogAnnouncement, ...sectionState } = useController(controllerParameters)
  const { jobApplicationId, hasAnthropicApiKey } = controllerParameters

  return (
    <>
      <Button
        ref={openingButtonRef}
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto"
        onClick={openDialog}
      >
        {buttonLabel}
      </Button>
      <p role="status" className="sr-only">
        {closedDialogAnnouncement}
      </p>
      <Dialog.Root
        open={isDialogOpen}
        onOpenChange={(isDialogNowOpen) => {
          if (!isDialogNowOpen) closeDialog()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Popup
            finalFocus={openingButtonRef}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">{TECHNICAL_BRIEF_MESSAGES.title}</Dialog.Title>
            <TechnicalBriefSection
              jobApplicationId={jobApplicationId}
              hasAnthropicApiKey={hasAnthropicApiKey}
              {...sectionState}
            />
            <div className="mt-auto flex justify-end border-t pt-4">
              <Dialog.Close className={cn(buttonVariants())}>Fermer</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
