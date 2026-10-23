'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIGN_IN_PATHNAME } from '@/domain/landing-routing'
import { SIGN_UP_MESSAGES } from '@/domain/sign-up'
import { useController } from './controller'
import type { ForgotPasswordFormProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'forgot-password-form-error-message'
const BACK_LINK_CLASS_NAME = 'text-sm font-semibold text-accent-text underline underline-offset-4'

export const ForgotPasswordForm = ({ requestPasswordReset }: ForgotPasswordFormProps) => {
  const { email, setEmail, status, errorMessage, submit, errorAlertReference, confirmationReference } = useController({
    requestPasswordReset,
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const backToSignInLink = (
    <Link href={SIGN_IN_PATHNAME} className={BACK_LINK_CLASS_NAME}>
      Retour à la connexion
    </Link>
  )

  if (status === 'sent') {
    return (
      <div ref={confirmationReference} tabIndex={-1} className="flex flex-col gap-4 outline-none">
        <p role="status" className="text-base text-ink">
          {SIGN_UP_MESSAGES.passwordResetSent}
        </p>
        {backToSignInLink}
      </div>
    )
  }

  const hasError = status === 'error'
  const errorMessageElementId = errorMessage ? ERROR_MESSAGE_ELEMENT_ID : undefined

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-password-form-email">Adresse e-mail</Label>
        <Input
          id="forgot-password-form-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(changeEvent) => setEmail(changeEvent.target.value)}
          aria-invalid={hasError}
          aria-describedby={errorMessageElementId}
        />
      </div>
      {errorMessage && (
        <p
          id={ERROR_MESSAGE_ELEMENT_ID}
          ref={errorAlertReference}
          tabIndex={-1}
          role="alert"
          className="text-sm text-destructive outline-none"
        >
          {errorMessage}
        </p>
      )}
      <Button type="submit" size="lg" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Envoi en cours…' : 'Recevoir un lien'}
      </Button>
      {backToSignInLink}
    </form>
  )
}
