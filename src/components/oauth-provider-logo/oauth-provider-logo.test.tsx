import { render } from '@testing-library/react'
import { OAuthProviderLogo } from './oauth-provider-logo'

describe('OAuthProviderLogo', () => {
  it('draws the Google logo in its four brand colours, hidden from assistive technologies', () => {
    const { container } = render(<OAuthProviderLogo provider="google" />)

    const logo = container.querySelector('svg')
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    const pathFills = [...container.querySelectorAll('path')].map((path) => path.style.fill)
    expect(pathFills).toEqual(['var(--google-red)', 'var(--google-blue)', 'var(--google-yellow)', 'var(--google-green)'])
  })

  it('draws the LinkedIn logo in the LinkedIn blue of the current theme, hidden from assistive technologies', () => {
    const { container } = render(<OAuthProviderLogo provider="linkedin_oidc" />)

    const logo = container.querySelector('svg')
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    expect(logo).toHaveClass('text-linkedin')
    expect(logo).toHaveAttribute('fill', 'currentColor')
    expect(container.querySelectorAll('path')).toHaveLength(1)
  })
})
