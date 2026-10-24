import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PillToggle } from './pill-toggle'

const ToggleHarness = ({ onPressedChange }: { onPressedChange: (isPressed: boolean) => void }) => {
  const [isPressed, setIsPressed] = useState(false)

  return (
    <PillToggle
      isPressed={isPressed}
      onPressedChange={(nextIsPressed) => {
        setIsPressed(nextIsPressed)
        onPressedChange(nextIsPressed)
      }}
    >
      Remote
    </PillToggle>
  )
}

describe('PillToggle', () => {
  it('is neutral and unpressed at rest, then pressed with a check mark after a click', async () => {
    const onPressedChange = jest.fn()
    render(<ToggleHarness onPressedChange={onPressedChange} />)
    const toggle = screen.getByRole('button', { name: 'Remote' })

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('data-tone', 'neutral')
    expect(toggle.querySelector('svg')).toBeNull()

    await userEvent.click(toggle)

    expect(onPressedChange).toHaveBeenCalledWith(true)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('data-tone', 'pressed')
    expect(toggle).toHaveClass('bg-toggle-pressed', 'text-on-toggle-pressed')
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(toggle).toHaveAccessibleName('Remote')
  })

  it('does not toggle while disabled', async () => {
    const onPressedChange = jest.fn()
    render(
      <PillToggle isPressed={false} onPressedChange={onPressedChange} disabled>
        Remote
      </PillToggle>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remote' }))

    expect(screen.getByRole('button', { name: 'Remote' })).toBeDisabled()
    expect(onPressedChange).not.toHaveBeenCalled()
  })

  it('matches the comfortable control height with a 44px touch target on phone', () => {
    render(
      <PillToggle isPressed={false} onPressedChange={jest.fn()}>
        Remote
      </PillToggle>,
    )
    const toggle = screen.getByRole('button', { name: 'Remote' })
    expect(toggle).toHaveClass('h-11', 'sm:h-9', 'px-4', 'text-sm')
    expect(toggle).not.toHaveClass('text-xs')
  })
})
