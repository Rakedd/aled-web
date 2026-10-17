'use client'

import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useController } from './controller'
import type { AnthropicApiKeyFormProps } from './interfaces'

const API_KEY_INPUT_ELEMENT_ID = 'anthropic-api-key-input'
const API_KEY_ERROR_ELEMENT_ID = 'anthropic-api-key-error-message'

export const AnthropicApiKeyForm = ({
  initialApiKeyLastFour,
  saveAnthropicApiKey,
  deleteAnthropicApiKey,
}: AnthropicApiKeyFormProps) => {
  const {
    apiKeyInput,
    setApiKeyInput,
    maskedApiKey,
    isApiKeyInputVisible,
    isReplacingApiKey,
    isConfirmingDeletion,
    status,
    errorMessage,
    successMessage,
    startReplacingApiKey,
    cancelReplacingApiKey,
    submitApiKey,
    requestApiKeyDeletion,
    cancelApiKeyDeletion,
    confirmApiKeyDeletion,
  } = useController({ initialApiKeyLastFour, saveAnthropicApiKey, deleteAnthropicApiKey })
  const isBusy = status !== 'idle'

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submitApiKey()
  }

  return (
    <div className="flex flex-col gap-4">
      {maskedApiKey && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            <span className="font-mono">{maskedApiKey}</span>{' '}
            <span className="text-muted-foreground">✓ active</span>
          </p>
          {!isReplacingApiKey && !isConfirmingDeletion && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={startReplacingApiKey} disabled={isBusy}>
                Remplacer
              </Button>
              <Button type="button" variant="destructive" onClick={requestApiKeyDeletion} disabled={isBusy}>
                Supprimer
              </Button>
            </div>
          )}
        </div>
      )}
      {isConfirmingDeletion && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm">
            Supprimer ta clé désactive le pré-remplissage et le brief client. Tu devras la saisir à nouveau pour les
            réactiver.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={() => void confirmApiKeyDeletion()} disabled={isBusy}>
              {status === 'deleting' ? 'Suppression…' : 'Confirmer la suppression'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelApiKeyDeletion} disabled={isBusy}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {isApiKeyInputVisible && (
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Label htmlFor={API_KEY_INPUT_ELEMENT_ID}>{isReplacingApiKey ? 'Nouvelle clé API' : 'Clé API'}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={API_KEY_INPUT_ELEMENT_ID}
              type="password"
              name="anthropic-api-key"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={apiKeyInput}
              onChange={(changeEvent) => setApiKeyInput(changeEvent.target.value)}
              aria-invalid={errorMessage !== null}
              aria-describedby={errorMessage ? API_KEY_ERROR_ELEMENT_ID : undefined}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={isBusy}>
                {status === 'saving' ? 'Vérification…' : 'Enregistrer'}
              </Button>
              {isReplacingApiKey && (
                <Button type="button" variant="outline" onClick={cancelReplacingApiKey} disabled={isBusy}>
                  Annuler
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
      {errorMessage && (
        <p id={API_KEY_ERROR_ELEMENT_ID} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      )}
    </div>
  )
}
