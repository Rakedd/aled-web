'use client'

import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MAXIMUM_FOLLOW_UP_DELAY_DAYS,
  MAXIMUM_PROFILE_LINK_COUNT,
  MINIMUM_FOLLOW_UP_DELAY_DAYS,
} from '@/domain/profile-settings'
import { PROFESSIONAL_STATUSES, PROFESSIONAL_STATUS_LABELS } from '@/domain/sign-up'
import { useController } from './controller'
import type { ProfileFormProps } from './interfaces'

export const ProfileForm = ({ initialProfileSettings, updateProfileSettings }: ProfileFormProps) => {
  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    followUpDelayDaysText,
    setFollowUpDelayDaysText,
    professionalStatus,
    setProfessionalStatus,
    links,
    addLink,
    updateLink,
    removeLink,
    status,
    errorMessage,
    successMessage,
    submit,
  } = useController({ initialProfileSettings, updateProfileSettings })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-form-first-name">Prénom</Label>
          <Input
            id="profile-form-first-name"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(changeEvent) => setFirstName(changeEvent.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-form-last-name">Nom</Label>
          <Input
            id="profile-form-last-name"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(changeEvent) => setLastName(changeEvent.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="profile-form-email">Adresse e-mail</Label>
          <Input id="profile-form-email" type="email" value={email} readOnly aria-describedby="profile-form-email-hint" />
          <p id="profile-form-email-hint" className="text-xs text-muted-foreground">
            L&apos;adresse de connexion ne se modifie pas ici.
          </p>
        </div>
      </div>
      <div role="radiogroup" aria-labelledby="profile-form-professional-status-label" className="flex flex-col gap-2">
        <span id="profile-form-professional-status-label" className="text-sm font-medium">
          Je suis
        </span>
        <div className="flex gap-4">
          {PROFESSIONAL_STATUSES.map((statusOption) => (
            <label key={statusOption} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="professionalStatus"
                value={statusOption}
                checked={professionalStatus === statusOption}
                onChange={() => setProfessionalStatus(statusOption)}
                className="size-4 accent-primary"
              />
              {PROFESSIONAL_STATUS_LABELS[statusOption]}
            </label>
          ))}
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Liens</legend>
        {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien pour l&apos;instant.</p>}
        {links.map((profileLink, linkIndex) => (
          <div key={linkIndex} className="flex flex-col gap-2 rounded-2xl bg-muted p-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2 sm:w-40">
              <Label htmlFor={`profile-form-link-label-${linkIndex}`}>Libellé</Label>
              <Input
                id={`profile-form-link-label-${linkIndex}`}
                placeholder="LinkedIn"
                value={profileLink.label}
                onChange={(changeEvent) => updateLink(linkIndex, 'label', changeEvent.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={`profile-form-link-url-${linkIndex}`}>Adresse</Label>
              <Input
                id={`profile-form-link-url-${linkIndex}`}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={profileLink.url}
                onChange={(changeEvent) => updateLink(linkIndex, 'url', changeEvent.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeLink(linkIndex)}
              aria-label={`Retirer le lien ${profileLink.label || linkIndex + 1}`}
            >
              Retirer
            </Button>
          </div>
        ))}
        {links.length < MAXIMUM_PROFILE_LINK_COUNT && (
          <Button type="button" variant="outline" onClick={addLink} className="self-start">
            <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Ajouter un lien
          </Button>
        )}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-form-follow-up-delay">Relance après (jours)</Label>
        <Input
          id="profile-form-follow-up-delay"
          type="number"
          inputMode="numeric"
          min={MINIMUM_FOLLOW_UP_DELAY_DAYS}
          max={MAXIMUM_FOLLOW_UP_DELAY_DAYS}
          className="w-24"
          value={followUpDelayDaysText}
          onChange={(changeEvent) => setFollowUpDelayDaysText(changeEvent.target.value)}
          aria-describedby="profile-form-follow-up-delay-hint"
        />
        <p id="profile-form-follow-up-delay-hint" className="text-xs text-muted-foreground">
          Une relance t&apos;est proposée quand une candidature reste sans échange pendant ce nombre de jours.
        </p>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={status === 'saving'}>
        {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
