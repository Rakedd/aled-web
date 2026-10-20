'use client'

import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useController } from './controller'
import type { LoginFormProps } from './interfaces'

const MAGIC_LINK_SENT_MESSAGE = "Si ce compte existe, un lien de connexion vient d'être envoyé."
const INVITATION_ONLY_MESSAGE = 'Accès sur invitation uniquement.'
const ERROR_MESSAGE_ELEMENT_ID = 'login-form-error-message'

export const LoginForm = ({ requestMagicLink }: LoginFormProps) => {
  const { email, setEmail, submit, status, errorMessage } = useController({ requestMagicLink })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const invitationOnlyReminder = <p className="text-sm text-ink-secondary">{INVITATION_ONLY_MESSAGE}</p>

  if (status === 'sent') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-ink-secondary">
          {MAGIC_LINK_SENT_MESSAGE}
        </p>
        {invitationOnlyReminder}
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-form-email">Adresse e-mail</Label>
        <Input
          id="login-form-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(changeEvent) => setEmail(changeEvent.target.value)}
          aria-invalid={status === 'error'}
          aria-describedby={errorMessage ? ERROR_MESSAGE_ELEMENT_ID : undefined}
        />
      </div>
      {errorMessage && (
        <p id={ERROR_MESSAGE_ELEMENT_ID} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <Button type="submit" size="lg" disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi en cours…' : 'Recevoir un lien de connexion'}
      </Button>
      {invitationOnlyReminder}
    </form>
  )
}
