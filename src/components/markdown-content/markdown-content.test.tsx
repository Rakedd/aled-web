import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import type Markdown from 'react-markdown'
import { MarkdownContent } from './markdown-content'

type MarkdownProps = ComponentProps<typeof Markdown>

const mockedMarkdownRenderer = jest.fn((markdownProps: MarkdownProps): ReactElement => (
  <div data-testid="markdown">{markdownProps.children}</div>
))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (markdownProps: MarkdownProps) => mockedMarkdownRenderer(markdownProps),
}))

const getCustomLinkRenderer = () => {
  const LinkRenderer = mockedMarkdownRenderer.mock.calls[0][0].components?.a
  if (typeof LinkRenderer !== 'function') throw new Error('Expected a custom link renderer')
  return LinkRenderer
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('MarkdownContent', () => {
  it('renders the markdown without raw html or images', () => {
    render(<MarkdownContent markdown={'## Chiffres clés\n\nCA : 1 Md€'} />)

    expect(screen.getByTestId('markdown')).toHaveTextContent('Chiffres clés')
    const markdownProps = mockedMarkdownRenderer.mock.calls[0][0]
    expect(markdownProps.skipHtml).toBe(true)
    expect(markdownProps.disallowedElements).toEqual(['img'])
  })

  it('renders no javascript: link while keeping http and https ones', () => {
    render(<MarkdownContent markdown="[x](javascript:alert(1))" />)

    const urlTransform = mockedMarkdownRenderer.mock.calls[0][0].urlTransform
    const anchorNode: Parameters<NonNullable<MarkdownProps['urlTransform']>>[2] = {
      type: 'element',
      tagName: 'a',
      properties: {},
      children: [],
    }
    expect(urlTransform?.('javascript:alert(1)', 'href', anchorNode)).toBe('')
    expect(urlTransform?.('data:text/html;base64,AAAA', 'href', anchorNode)).toBe('')
    expect(urlTransform?.('https://example.com/a', 'href', anchorNode)).toBe('https://example.com/a')
    expect(urlTransform?.('http://example.com/a', 'href', anchorNode)).toBe('http://example.com/a')
  })

  it('opens links in a new tab without giving them access to the page', () => {
    render(<MarkdownContent markdown="x" />)
    const LinkRenderer = getCustomLinkRenderer()

    render(<LinkRenderer href="https://example.com/news">Actualité</LinkRenderer>)

    const briefLink = screen.getByRole('link', { name: 'Actualité' })
    expect(briefLink).toHaveAttribute('target', '_blank')
    expect(briefLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows a link whose url was rejected as plain text', () => {
    render(<MarkdownContent markdown="x" />)
    const LinkRenderer = getCustomLinkRenderer()

    render(<LinkRenderer href="">Lien piégé</LinkRenderer>)

    expect(screen.getByText('Lien piégé')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Lien piégé' })).not.toBeInTheDocument()
  })
})
