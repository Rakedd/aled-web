import { render, screen } from '@testing-library/react'
import { AnthropicApiKeyForm } from './anthropic-api-key-form'

const renderForm = (initialApiKeyLastFour: string | null) =>
  render(
    <AnthropicApiKeyForm
      initialApiKeyLastFour={initialApiKeyLastFour}
      saveAnthropicApiKey={jest.fn()}
      deleteAnthropicApiKey={jest.fn()}
    />,
  )

describe('AnthropicApiKeyForm on the dark key card', () => {
  it('keeps the label light and the typed key dark', () => {
    renderForm(null)

    expect(screen.getByText('Clé API')).toHaveClass('text-on-deep-surface-secondary')
    expect(screen.getByLabelText('Clé API')).toHaveClass('text-ink')
  })

  it('keeps the outline action dark on its light background', () => {
    renderForm('4f2a')

    expect(screen.getByRole('button', { name: 'Remplacer' })).toHaveClass('text-ink')
  })
})

describe('AnthropicApiKeyForm submission', () => {
  it('posts the key so it never lands in the URL before hydration', () => {
    renderForm(null)

    expect(screen.getByLabelText('Clé API').closest('form')).toHaveAttribute('method', 'post')
  })
})
