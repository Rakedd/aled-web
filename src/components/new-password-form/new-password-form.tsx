'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_UPDATED_HOME_ROUTE } from '@/domain/routes'
import { MINIMUM_PASSWORD_LENGTH } from '@/domain/sign-up'
import { useController } from './controller'
import type { NewPasswordFormProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'new-password-form-error-message'
const PASSWORD_HINT_ELEMENT_ID = 'new-password-form-hint'

export const NewPasswordForm = ({ updatePassword }: NewPasswordFormProps) => {
  const router = useRouter()
  const {
    password,
    setPassword,
    confirmation,
    setConfirmation,
    isPasswordVisible,
    togglePasswordVisibility,
    status,
    errorMessage,
    submit,
    errorAlertReference,
  } = useController({
    updatePassword,
    onPasswordUpdated: () => router.push(PASSWORD_UPDATED_HOME_ROUTE),
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const hasError = status === 'error'
  const inputType = isPasswordVisible ? 'text' : 'password'
  const describedBy = [PASSWORD_HINT_ELEMENT_ID, errorMessage ? ERROR_MESSAGE_ELEMENT_ID : null]
    .filter(Boolean)
    .join(' ')

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password-form-password">Nouveau mot de passe</Label>
        <div className="flex gap-2">
          <Input
            id="new-password-form-password"
            type={inputType}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(changeEvent) => setPassword(changeEvent.target.value)}
            aria-invalid={hasError}
            aria-describedby={describedBy}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-controls="new-password-form-password new-password-form-confirmation"
            onClick={togglePasswordVisibility}
          >
            {isPasswordVisible ? 'Masquer' : 'Afficher'}
            <span className="sr-only"> le mot de passe</span>
          </Button>
        </div>
        <p id={PASSWORD_HINT_ELEMENT_ID} className="text-sm text-ink-secondary">
          {MINIMUM_PASSWORD_LENGTH} caractères minimum.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password-form-confirmation">Confirme-le</Label>
        <Input
          id="new-password-form-confirmation"
          type={inputType}
          name="confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(changeEvent) => setConfirmation(changeEvent.target.value)}
          aria-invalid={hasError}
          aria-describedby={describedBy}
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
        {status === 'submitting' ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
