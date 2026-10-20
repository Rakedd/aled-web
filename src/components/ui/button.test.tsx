import { buttonVariants } from './button'

describe('buttonVariants', () => {
  it('renders a pill with the primary colour by default', () => {
    const classNames = buttonVariants()
    expect(classNames).toContain('rounded-full')
    expect(classNames).toContain('bg-primary')
  })

  it('gives icon buttons a 44px touch target', () => {
    expect(buttonVariants({ size: 'icon' })).toContain('size-11')
  })

  it('colours destructive buttons with the destructive text token', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('text-destructive')
  })

  it('paints ink buttons with a ring that stands out from peach and lilac tiles', () => {
    const classNames = buttonVariants({ variant: 'ink' }).split(' ')
    expect(classNames).toEqual(
      expect.arrayContaining([
        'bg-ink',
        'text-on-forest',
        'hover:bg-ink/90',
        'focus-visible:ring-ink',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-card',
      ]),
    )
  })
})
