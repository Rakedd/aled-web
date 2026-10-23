'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FORGOT_PASSWORD_ROUTE, HOME_ROUTE, SIGN_UP_ROUTE } from '@/domain/routes'
import { SIGN_UP_MESSAGES, formatResendCooldown } from '@/domain/sign-up'
import { useController } from './controller'
import type { LoginFormProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'login-form-error-message'
const LINK_CLASS_NAME = 'text-accent-text underline underline-offset-4'

export const LoginForm = ({ signInWithPassword, resendSignUpConfirmation }: LoginFormProps) => {
  const router = useRouter()
  const {
    email,
    setEmail,
    password,
    setPassword,
    submit,
    status,
    errorMessage,
    isActivationResendOffered,
    secondsBeforeActivationResend,
    isResendingActivationEmail,
    hasResentActivationEmail,
    activationResendErrorMessage,
    resendActivationEmail,
  } = useController({
    signInWithPassword,
    resendSignUpConfirmation,
    onSignedIn: () => router.replace(HOME_ROUTE),
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const hasError = status === 'error'
  const errorMessageElementId = errorMessage ? ERROR_MESSAGE_ELEMENT_ID : undefined

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-form-email">Adresse e-mail</Label>
        <Input
          id="login-form-email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(changeEvent) => setEmail(changeEvent.target.value)}
          aria-invalid={hasError}
          aria-describedby={errorMessageElementId}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-form-password">Mot de passe</Label>
        <Input
          id="login-form-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(changeEvent) => setPassword(changeEvent.target.value)}
          aria-invalid={hasError}
          aria-describedby={errorMessageElementId}
        />
        <Link href={FORGOT_PASSWORD_ROUTE} className={`${LINK_CLASS_NAME} inline-flex min-h-11 items-center text-sm`}>
          Mot de passe oublié ?
        </Link>
      </div>
      {errorMessage && (
        <p id={ERROR_MESSAGE_ELEMENT_ID} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {isActivationResendOffered && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={secondsBeforeActivationResend > 0 || isResendingActivationEmail}
            onClick={() => void resendActivationEmail()}
          >
            {secondsBeforeActivationResend > 0
              ? formatResendCooldown(secondsBeforeActivationResend)
              : "Renvoyer l'e-mail d'activation"}
          </Button>
          <p role="status" className="text-sm text-ink-secondary">
            {hasResentActivationEmail ? SIGN_UP_MESSAGES.checkInbox : null}
          </p>
          {activationResendErrorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {activationResendErrorMessage}
            </p>
          )}
        </div>
      )}
      <Button type="submit" size="lg" disabled={status === 'signing-in'}>
        {status === 'signing-in' ? 'Connexion en cours…' : 'Se connecter'}
      </Button>
      <p className="text-sm text-ink-secondary">
        Pas encore de compte ?{' '}
        <Link href={SIGN_UP_ROUTE} className={`${LINK_CLASS_NAME} font-semibold`}>
          Créer un compte
        </Link>
      </p>
    </form>
  )
}
