import { buildCvVersionPdfPath, formatSentCvVersionLabel } from '@/domain/cv-library'
import type { SentCvViewProps } from './interfaces'

export const SentCvView = ({ sentCv }: SentCvViewProps) => {
  if (sentCv === null) return <p className="text-sm text-muted-foreground">Aucun CV indiqué</p>

  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-sm">
      <span className="break-words">{formatSentCvVersionLabel(sentCv)}</span>
      <a
        href={buildCvVersionPdfPath(sentCv.versionId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-text underline underline-offset-2"
      >
        Voir
      </a>
    </p>
  )
}
