export type AiErrorKind =
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'rate_limited'
  | 'refused'
  | 'timeout'
  | 'input_too_long'
  | 'unknown'

export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  missing_api_key:
    'Ajoute ta clé Claude dans les réglages pour activer le pré-remplissage. Tu peux saisir à la main en attendant.',
  invalid_api_key: 'Ta clé Claude est invalide ou sans crédit, remplace-la dans les réglages.',
  rate_limited: 'Claude est saturé, réessaie dans une minute.',
  refused: "Claude n'a pas pu traiter ce texte. Saisis les champs à la main.",
  timeout: "Claude n'a pas répondu à temps, réessaie.",
  input_too_long: 'Texte trop long (50 000 caractères maximum).',
  unknown: "L'extraction a échoué. Saisis les champs à la main.",
}
