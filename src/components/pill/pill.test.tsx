import { render, screen } from '@testing-library/react'
import { Pill } from './pill'

describe('Pill', () => {
  it('renders its content with the requested tone', () => {
    render(<Pill tone="peach">Entretien</Pill>)

    expect(screen.getByText('Entretien')).toHaveAttribute('data-tone', 'peach')
  })
})
