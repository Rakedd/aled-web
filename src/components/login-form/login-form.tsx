'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HOME_ROUTE } from '@/domain/routes'
import { useController } from './controller'
import type { LoginFormProps } from './interfaces'

const INVITATION_ONLY_MESSAGE = 'Accès sur invitation uniquement.'
const ERROR_MESSAGE_ELEMENT_ID = 'login-form-error-message'

export const LoginForm = ({ signInWithPassword }: LoginFormProps) => {
  const router = useRouter()
  const { email, setEmail, password, setPassword, submit, status, errorMessage } = useController({
    signInWithPassword,
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
      </div>
      {errorMessage && (
        <p id={ERROR_MESSAGE_ELEMENT_ID} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <Button type="submit" size="lg" disabled={status === 'signing-in'}>
        {status === 'signing-in' ? 'Connexion en cours…' : 'Se connecter'}
      </Button>
      <p className="text-sm text-ink-secondary">{INVITATION_ONLY_MESSAGE}</p>
    </form>
  )
}
