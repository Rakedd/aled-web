import type { ComponentProps } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import { isExternalLinkUrl } from '@/domain/client-brief'
import type { MarkdownContentProps } from './interfaces'

const DISALLOWED_MARKDOWN_ELEMENTS = ['img']

const MarkdownLink = ({ href, children }: ComponentProps<'a'> & ExtraProps) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )

const MARKDOWN_COMPONENTS: Components = { a: MarkdownLink }

const keepOnlyExternalLinkUrl = (url: string): string => (isExternalLinkUrl(url) ? url : '')

export const MarkdownContent = ({ markdown }: MarkdownContentProps) => (
  <div className="min-w-0 text-sm break-words [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mt-2 [&_ul]:list-disc">
    <Markdown
      skipHtml
      disallowedElements={DISALLOWED_MARKDOWN_ELEMENTS}
      urlTransform={keepOnlyExternalLinkUrl}
      components={MARKDOWN_COMPONENTS}
    >
      {markdown}
    </Markdown>
  </div>
)
