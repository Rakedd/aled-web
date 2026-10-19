'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_FORMATS,
  INTERVIEW_KIND_LABELS,
  INTERVIEW_KINDS,
} from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
import { useController } from './controller'
import type { InterviewsSectionProps } from './interfaces'
import { NATIVE_SELECT_CLASS_NAME, TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'

const DATE_TIME_INPUT_ID = 'interview-date-time'
const KIND_SELECT_ID = 'interview-kind'
const FORMAT_SELECT_ID = 'interview-format'
const PARTICIPANTS_INPUT_ID = 'interview-participants'
const NOTES_TEXTAREA_ID = 'interview-notes'
const DELETE_CONFIRMATION_MESSAGE = 'Supprimer cet entretien ?'

export const InterviewsSection = ({
  jobApplicationId,
  initialInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  listInterviewsForJobApplication,
}: InterviewsSectionProps) => {
  const router = useRouter()
  const {
    interviews,
    editorTarget,
    formValues,
    isSubmitting,
    errorMessage,
    startCreating,
    startEditing,
    cancelEditing,
    setFormValue,
    submitInterview,
    removeInterview,
  } = useController({
    jobApplicationId,
    initialInterviews,
    createInterview,
    updateInterview,
    deleteInterview,
    listInterviewsForJobApplication,
    onDataChanged: router.refresh,
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submitInterview()
  }

  const handleDeleteClick = (interviewId: string) => {
    if (window.confirm(DELETE_CONFIRMATION_MESSAGE)) void removeInterview(interviewId)
  }

  const handleKindChange = (candidate: string) => {
    const matchingKind = INTERVIEW_KINDS.find((interviewKind) => interviewKind === candidate)
    if (matchingKind) setFormValue('kind', matchingKind)
  }

  const handleFormatChange = (candidate: string) => {
    const matchingFormat = INTERVIEW_FORMATS.find((interviewFormat) => interviewFormat === candidate)
    if (matchingFormat) setFormValue('format', matchingFormat)
  }

  return (
    <section aria-labelledby="interviews-section-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="interviews-section-title" className="text-lg font-semibold">
          Entretiens
        </h2>
        {editorTarget === null && (
          <Button type="button" variant="outline" onClick={startCreating} disabled={isSubmitting}>
            Ajouter un entretien
          </Button>
        )}
      </div>
      {interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun entretien pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {interviews.map((interview) => (
            <li key={interview.id} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {formatParisInterviewDateTime(interview.startsAt)} · {INTERVIEW_KIND_LABELS[interview.kind]} ·{' '}
                  {INTERVIEW_FORMAT_LABELS[interview.format]}
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(interview)}
                    disabled={isSubmitting}
                  >
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(interview.id)}
                    disabled={isSubmitting}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
              {interview.participants && (
                <p className="text-sm break-words text-muted-foreground">Avec : {interview.participants}</p>
              )}
              {interview.notes && <p className="text-sm break-words whitespace-pre-wrap">{interview.notes}</p>}
            </li>
          ))}
        </ul>
      )}
      {editorTarget !== null && (
        <form
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby="interview-form-title"
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <h3 id="interview-form-title" className="text-sm font-semibold">
            {editorTarget.mode === 'create' ? 'Nouvel entretien' : "Modifier l'entretien"}
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={DATE_TIME_INPUT_ID}>Date et heure (heure de Paris)</Label>
              <Input
                id={DATE_TIME_INPUT_ID}
                type="datetime-local"
                required
                value={formValues.parisLocalDateTime}
                onChange={(changeEvent) => setFormValue('parisLocalDateTime', changeEvent.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={KIND_SELECT_ID}>Type</Label>
              <select
                id={KIND_SELECT_ID}
                className={NATIVE_SELECT_CLASS_NAME}
                value={formValues.kind}
                onChange={(changeEvent) => handleKindChange(changeEvent.target.value)}
                disabled={isSubmitting}
              >
                {INTERVIEW_KINDS.map((interviewKind) => (
                  <option key={interviewKind} value={interviewKind}>
                    {INTERVIEW_KIND_LABELS[interviewKind]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={FORMAT_SELECT_ID}>Modalité</Label>
              <select
                id={FORMAT_SELECT_ID}
                className={NATIVE_SELECT_CLASS_NAME}
                value={formValues.format}
                onChange={(changeEvent) => handleFormatChange(changeEvent.target.value)}
                disabled={isSubmitting}
              >
                {INTERVIEW_FORMATS.map((interviewFormat) => (
                  <option key={interviewFormat} value={interviewFormat}>
                    {INTERVIEW_FORMAT_LABELS[interviewFormat]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={PARTICIPANTS_INPUT_ID}>Interlocuteurs</Label>
            <Input
              id={PARTICIPANTS_INPUT_ID}
              value={formValues.participants}
              onChange={(changeEvent) => setFormValue('participants', changeEvent.target.value)}
              placeholder="Ex. : Jeanne Martin (CTO)"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={NOTES_TEXTAREA_ID}>Notes</Label>
            <textarea
              id={NOTES_TEXTAREA_ID}
              rows={3}
              className={cn(TEXTAREA_CLASS_NAME, 'min-h-20 w-full resize-y')}
              value={formValues.notes}
              onChange={(changeEvent) => setFormValue('notes', changeEvent.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Enregistrer
            </Button>
            <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSubmitting}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
