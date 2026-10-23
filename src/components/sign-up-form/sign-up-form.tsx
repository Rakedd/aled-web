'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIGN_IN_PATHNAME } from '@/domain/landing-routing'
import {
  LEGAL_LINK_LABELS,
  PROFESSIONAL_STATUSES,
  PROFESSIONAL_STATUS_LABELS,
  SIGN_UP_MESSAGES,
  formatResendCooldown,
} from '@/domain/sign-up'
import { useController } from './controller'
import type { SignUpFormProps } from './interfaces'

const ERROR_MESSAGE_ELEMENT_ID = 'sign-up-form-error-message'
const LEGAL_LINK_CLASS_NAME = 'text-accent-text underline underline-offset-4'
const CHOICE_LABEL_CLASS_NAME = 'min-h-11 cursor-pointer text-base font-normal leading-normal text-ink'
const CHOICE_INPUT_CLASS_NAME = 'size-5 shrink-0 accent-primary'
const SIGN_IN_LINK_CLASS_NAME = 'font-semibold text-accent-text underline underline-offset-4'

export const SignUpForm = ({
  signUpWithPassword,
  resendSignUpConfirmation,
  termsOfUseHref,
  privacyPolicyHref,
}: SignUpFormProps) => {
  const {
    firstName,
    setFirstName,
    email,
    setEmail,
    password,
    setPassword,
    isPasswordVisible,
    togglePasswordVisibility,
    professionalStatus,
    setProfessionalStatus,
    hasAcceptedTerms,
    setHasAcceptedTerms,
    status,
    errorMessage,
    submit,
    submittedEmail,
    secondsBeforeResend,
    isResending,
    hasResent,
    resend,
    errorAlertReference,
    confirmationReference,
  } = useController({ signUpWithPassword, resendSignUpConfirmation })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const signInPrompt = (
    <p className="text-sm text-ink-secondary">
      Déjà un compte ?{' '}
      <Link href={SIGN_IN_PATHNAME} className={SIGN_IN_LINK_CLASS_NAME}>
        Se connecter
      </Link>
    </p>
  )

  const errorParagraph = errorMessage && (
    <p
      id={ERROR_MESSAGE_ELEMENT_ID}
      ref={errorAlertReference}
      tabIndex={-1}
      role="alert"
      className="text-sm text-destructive outline-none"
    >
      {errorMessage}
    </p>
  )

  if (status === 'sent') {
    return (
      <div ref={confirmationReference} tabIndex={-1} className="flex flex-col gap-4 outline-none">
        <p className="text-base text-ink">{SIGN_UP_MESSAGES.checkInbox}</p>
        <p className="text-base font-semibold break-all text-ink">{submittedEmail}</p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={secondsBeforeResend > 0 || isResending}
          onClick={() => void resend()}
        >
          {secondsBeforeResend > 0 ? formatResendCooldown(secondsBeforeResend) : SIGN_UP_MESSAGES.resend}
        </Button>
        <p role="status" className="text-sm text-ink-secondary">
          {hasResent ? SIGN_UP_MESSAGES.resent : null}
        </p>
        {errorParagraph}
        {signInPrompt}
      </div>
    )
  }

  const hasError = status === 'error'
  const errorMessageElementId = errorMessage ? ERROR_MESSAGE_ELEMENT_ID : undefined

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sign-up-form-first-name">Prénom</Label>
        <Input
          id="sign-up-form-first-name"
          type="text"
          name="firstName"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(changeEvent) => setFirstName(changeEvent.target.value)}
          aria-invalid={hasError}
          aria-describedby={errorMessageElementId}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sign-up-form-email">Adresse e-mail</Label>
        <Input
          id="sign-up-form-email"
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="sign-up-form-password">Mot de passe</Label>
        <div className="flex gap-2">
          <Input
            id="sign-up-form-password"
            type={isPasswordVisible ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(changeEvent) => setPassword(changeEvent.target.value)}
            aria-invalid={hasError}
            aria-describedby={errorMessageElementId}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-controls="sign-up-form-password"
            onClick={togglePasswordVisibility}
          >
            {isPasswordVisible ? 'Masquer' : 'Afficher'}
          </Button>
        </div>
      </div>
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-semibold text-ink-muted">Je suis</legend>
        {PROFESSIONAL_STATUSES.map((candidateStatus) => (
          <Label key={candidateStatus} className={CHOICE_LABEL_CLASS_NAME}>
            <input
              type="radio"
              name="professionalStatus"
              value={candidateStatus}
              checked={professionalStatus === candidateStatus}
              onChange={() => setProfessionalStatus(candidateStatus)}
              aria-describedby={errorMessageElementId}
              className={CHOICE_INPUT_CLASS_NAME}
            />
            {PROFESSIONAL_STATUS_LABELS[candidateStatus]}
          </Label>
        ))}
      </fieldset>
      <Label className={CHOICE_LABEL_CLASS_NAME}>
        <input
          type="checkbox"
          name="hasAcceptedTerms"
          checked={hasAcceptedTerms}
          onChange={(changeEvent) => setHasAcceptedTerms(changeEvent.target.checked)}
          aria-describedby={errorMessageElementId}
          className={CHOICE_INPUT_CLASS_NAME}
        />
        <span>
          J&apos;accepte les{' '}
          <a href={termsOfUseHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
            {LEGAL_LINK_LABELS.termsOfUse}
          </a>{' '}
          et la{' '}
          <a href={privacyPolicyHref} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS_NAME}>
            {LEGAL_LINK_LABELS.privacyPolicy}
          </a>
        </span>
      </Label>
      {errorParagraph}
      <Button type="submit" size="lg" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Création en cours…' : 'Créer mon compte'}
      </Button>
      {signInPrompt}
    </form>
  )
}
