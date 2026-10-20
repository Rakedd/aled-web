import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeywordTagsInput } from './keyword-tags-input'

describe('KeywordTagsInput', () => {
  it('renders each keyword as a pill of the requested tone', () => {
    render(<KeywordTagsInput label="Exclure toujours" helpText="aide" values={['react']} onChange={jest.fn()} tone="clay" />)

    expect(screen.getByText('react').closest('[data-tone]')).toHaveAttribute('data-tone', 'clay')
  })

  it('removes a keyword from the Retirer button', async () => {
    const onChange = jest.fn()
    render(
      <KeywordTagsInput label="Exclure toujours" helpText="aide" values={['react', 'vue']} onChange={onChange} tone="clay" />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Retirer react' }))

    expect(onChange).toHaveBeenCalledWith(['vue'])
  })
})
