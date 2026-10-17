export const INVALID_EMAIL_ADDRESS_MESSAGE = 'Adresse e-mail invalide'

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmailAddress = (emailAddress: string): boolean => EMAIL_ADDRESS_PATTERN.test(emailAddress)
