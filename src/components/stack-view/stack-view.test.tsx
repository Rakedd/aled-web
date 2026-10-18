import { render, screen, within } from '@testing-library/react'
import { StackView } from './stack-view'

describe('StackView', () => {
  it('shows the technologies as tags grouped by category', () => {
    render(
      <StackView
        stack={[
          { name: 'React', category: 'framework', origin: 'posting' },
          { name: 'TypeScript', category: 'language', origin: 'posting' },
          { name: 'Next.js', category: 'framework', origin: 'job_spec' },
        ]}
      />,
    )
    const frameworkTags = within(screen.getByRole('list', { name: 'Framework' })).getAllByRole('listitem')
    expect(frameworkTags.map((tag) => tag.textContent)).toEqual(['React', 'Next.js'])
    expect(within(screen.getByRole('list', { name: 'Langage' })).getByRole('listitem')).toHaveTextContent('TypeScript')
    expect(screen.queryByRole('list', { name: 'Outil' })).not.toBeInTheDocument()
  })

  it('shows a dash when there is no technology', () => {
    render(<StackView stack={[]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
