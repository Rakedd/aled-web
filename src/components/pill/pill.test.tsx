import { render, screen } from '@testing-library/react'
import { Pill } from './pill'

describe('Pill', () => {
  it('renders its content with the requested tone', () => {
    render(<Pill tone="peach">Entretien</Pill>)

    expect(screen.getByText('Entretien')).toHaveAttribute('data-tone', 'peach')
  })

  it('inverts the forest tone so it stands out on soft forest surfaces', () => {
    render(<Pill tone="forest">Entretien à venir</Pill>)

    expect(screen.getByText('Entretien à venir')).toHaveClass('bg-on-forest-soft', 'text-forest-soft')
  })
})
