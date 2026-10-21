import type { LegalDocumentProps } from './interfaces'

export const LegalDocument = ({ document }: LegalDocumentProps) => (
  <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-14 sm:px-10 sm:py-20">
    <h1 className="font-heading text-4xl font-extrabold text-ink">{document.title}</h1>
    {document.sections.map((section) => (
      <section key={section.heading} className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-extrabold text-ink">{section.heading}</h2>
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-ink-secondary">
            {paragraph}
          </p>
        ))}
      </section>
    ))}
  </article>
)
