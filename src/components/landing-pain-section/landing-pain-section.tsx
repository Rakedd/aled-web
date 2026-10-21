import { LANDING_COPY } from '@/domain/landing-copy'

const EMAIL_OFFSETS = ['ml-0', 'ml-4', 'ml-8', 'ml-2']

export const LandingPainSection = () => (
  <section className="bg-card">
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-10 sm:py-20 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-3xl leading-tight font-extrabold text-ink sm:text-4xl">
          {LANDING_COPY.pain.titleStart}{' '}
          <span className="rounded-md bg-peach px-1.5 whitespace-nowrap text-on-peach">{LANDING_COPY.pain.highlightedText}</span>{' '}
          {LANDING_COPY.pain.titleEnd}
        </h2>
        <p className="text-base leading-relaxed text-ink-secondary">{LANDING_COPY.pain.text}</p>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {LANDING_COPY.pain.emails.map((email, emailIndex) => (
          <div
            key={email.subject}
            className={`${EMAIL_OFFSETS[emailIndex]} rounded-xl border border-hairline bg-surface-soft px-3 py-2.5 text-sm text-ink-muted`}
          >
            <span className="font-semibold text-ink">{email.subject}</span> {email.detail}
          </div>
        ))}
      </div>
    </div>
  </section>
)
