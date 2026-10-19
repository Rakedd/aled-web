'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { InterviewPreparationModal } from '@/components/interview-preparation-modal'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BRIEF_LANGUAGES, BRIEF_LANGUAGE_LABELS, isBriefLanguage } from '@/domain/interview-preparation'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { useController } from './controller'
import type { InterviewPreparationButtonProps } from './interfaces'

const LANGUAGE_SELECT_ID = 'interview-preparation-language'

export const InterviewPreparationButton = (controllerParameters: InterviewPreparationButtonProps) => {
  const router = useRouter()
  const openingButtonRef = useRef<HTMLButtonElement | null>(null)
  const {
    preparation,
    language,
    changeLanguage,
    isGenerating,
    generationProgressLabel,
    errorMessage,
    buttonLabel,
    isButtonDisabled,
    handleButtonClick,
    regenerate,
    generateMissingPart,
    isModalOpen,
    closeModal,
    notes,
    changeNotes,
    notesSaveStatus,
    notesErrorMessage,
    retryNotesSave,
  } = useController({ ...controllerParameters, onDataChanged: router.refresh })
  const { hasAnthropicApiKey } = controllerParameters

  return (
    <section aria-labelledby="interview-preparation-title" className="flex min-w-0 flex-col gap-3">
      <h2 id="interview-preparation-title" className="text-lg font-semibold">
        Préparation d&apos;entretien
      </h2>
      {!hasAnthropicApiKey && <MissingAnthropicApiKeyNotice featureDescription="la génération du brief" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button ref={openingButtonRef} type="button" onClick={() => void handleButtonClick()} disabled={isButtonDisabled}>
          {buttonLabel}
        </Button>
        <Label htmlFor={LANGUAGE_SELECT_ID} className="sr-only">
          Langue du brief
        </Label>
        <select
          id={LANGUAGE_SELECT_ID}
          value={language}
          disabled={isGenerating}
          onChange={(changeEvent) => {
            if (isBriefLanguage(changeEvent.target.value)) void changeLanguage(changeEvent.target.value)
          }}
          className={NATIVE_SELECT_CLASS_NAME}
        >
          {BRIEF_LANGUAGES.map((briefLanguage) => (
            <option key={briefLanguage} value={briefLanguage}>
              {BRIEF_LANGUAGE_LABELS[briefLanguage]}
            </option>
          ))}
        </select>
      </div>
      {!isModalOpen && errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <InterviewPreparationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        preparation={preparation}
        generationProgressLabel={generationProgressLabel}
        errorMessage={errorMessage}
        hasAnthropicApiKey={hasAnthropicApiKey}
        onRegenerate={(regenerationLanguage) => void regenerate(regenerationLanguage)}
        onGenerateMissingPart={() => void generateMissingPart()}
        notes={notes}
        changeNotes={changeNotes}
        notesSaveStatus={notesSaveStatus}
        notesErrorMessage={notesErrorMessage}
        retryNotesSave={retryNotesSave}
        finalFocusRef={openingButtonRef}
      />
    </section>
  )
}
