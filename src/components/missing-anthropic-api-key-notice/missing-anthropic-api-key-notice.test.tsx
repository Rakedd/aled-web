import { render, screen } from '@testing-library/react'
import { MissingAnthropicApiKeyNotice } from './missing-anthropic-api-key-notice'

describe('MissingAnthropicApiKeyNotice', () => {
  it('asks to add a Claude key to enable the feature and links to the settings', () => {
    render(<MissingAnthropicApiKeyNotice featureDescription="le pré-remplissage" />)

    expect(screen.getByRole('note')).toHaveTextContent(
      'Ajoute ta clé Claude dans tes préférences pour activer le pré-remplissage.',
    )
    expect(screen.getByRole('link', { name: 'préférences' })).toHaveAttribute('href', '/preferences')
  })
})
