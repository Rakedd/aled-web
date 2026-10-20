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
  it('is neutral and unpressed at rest, then action and pressed after a click', async () => {
    const onPressedChange = jest.fn()
    render(<ToggleHarness onPressedChange={onPressedChange} />)
    const toggle = screen.getByRole('button', { name: 'Remote' })

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('data-tone', 'neutral')

    await userEvent.click(toggle)

    expect(onPressedChange).toHaveBeenCalledWith(true)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('data-tone', 'action')
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
})
