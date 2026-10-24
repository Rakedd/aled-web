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

  it('colours link buttons with the accent text token', () => {
    expect(buttonVariants({ variant: 'link' }).split(' ')).toContain('text-accent-text')
  })

  it('paints ink buttons with a ring that stands out from peach and lilac tiles', () => {
    const classNames = buttonVariants({ variant: 'ink' }).split(' ')
    expect(classNames).toEqual(
      expect.arrayContaining([
        'bg-deep-surface',
        'text-on-deep-surface-soft',
        'hover:bg-deep-surface/90',
        'focus-visible:border-ink-button-ring',
        'focus-visible:ring-ink-button-ring',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-card',
      ]),
    )
  })

  it.each(['outline', 'destructive'] as const)('keeps the visible border of %s buttons used on links', (variant) => {
    const classNames = buttonVariants({ variant }).split(' ')
    expect(classNames).toContain('border-input')
    expect(classNames).not.toContain('border-transparent')
  })

  it('lets a caller class name override a variant class', () => {
    const classNames = buttonVariants({ variant: 'outline', size: 'sm', className: 'px-0' }).split(' ')
    expect(classNames).toContain('px-0')
    expect(classNames).not.toContain('px-3.5')
  })
})
