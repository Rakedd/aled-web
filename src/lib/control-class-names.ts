const FOCUS_RING_CLASS_NAME =
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 motion-reduce:transition-none'

export const NATIVE_SELECT_CLASS_NAME = `h-11 appearance-none rounded-lg border border-input bg-muted bg-(image:--select-chevron) bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat px-3.5 pr-10 text-base transition-colors md:text-sm ${FOCUS_RING_CLASS_NAME}`

export const TEXTAREA_CLASS_NAME = `rounded-lg border border-input bg-muted px-3.5 py-2.5 text-base transition-colors md:text-sm ${FOCUS_RING_CLASS_NAME}`

export const FIELD_LABEL_CLASS_NAME = 'text-sm leading-none font-semibold text-ink-muted'
