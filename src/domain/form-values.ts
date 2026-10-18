import { parseParisCalendarDate } from './paris-time'

export const toFormText = (value: string | null): string => value ?? ''

export const toNullableText = (text: string): string | null => (text.trim().length === 0 ? null : text)

export const toDailyRateText = (dailyRate: number | null): string => (dailyRate === null ? '' : String(dailyRate))

export const toNullableDailyRate = (dailyRateText: string): number | null =>
  dailyRateText.trim().length === 0 ? null : Number(dailyRateText)

export const toNullableParisDate = (calendarDate: string): Date | null =>
  calendarDate.length === 0 ? null : parseParisCalendarDate(calendarDate)

export const isSameFormValue = (firstValue: unknown, secondValue: unknown): boolean =>
  typeof firstValue === 'number' || typeof secondValue === 'number'
    ? Object.is(firstValue, secondValue)
    : JSON.stringify(firstValue) === JSON.stringify(secondValue)

export const findChangedFields = (
  initialFields: Record<string, unknown>,
  currentFields: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(currentFields).filter(
      ([fieldName, fieldValue]) => !isSameFormValue(fieldValue, initialFields[fieldName]),
    ),
  )

export const mergeUntouchedFormValues = <FormValues extends Record<string, unknown>>(
  previousBaseline: FormValues,
  nextBaseline: FormValues,
  currentFormValues: FormValues,
): FormValues => {
  const mergedFormValues: FormValues = { ...currentFormValues }
  for (const valueName of Object.keys(nextBaseline) as (keyof FormValues)[]) {
    if (isSameFormValue(currentFormValues[valueName], previousBaseline[valueName])) {
      mergedFormValues[valueName] = nextBaseline[valueName]
    }
  }
  return mergedFormValues
}
