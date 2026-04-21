export const VALIDATION_MESSAGE_CATALOG = {
  PHONE_REQUIRED: 'Le numero de telephone est obligatoire.',
  PHONE_FORMAT: 'Le numero de telephone doit etre au format international.',
  OTP_CODE_REQUIRED: 'Le code OTP est obligatoire.',
  OTP_CODE_LENGTH: 'Le code OTP doit contenir exactement 6 chiffres.',
  NAME_REQUIRED: 'Le nom est obligatoire.',
  NAME_MIN: 'Le nom doit contenir au moins 2 caracteres.',
  NAME_MAX: 'Le nom ne doit pas depasser 100 caracteres.',
  EMAIL_INVALID: "L'adresse email est invalide.",
  AVATAR_URL_INVALID: "L'URL de l'avatar est invalide.",
  AVATAR_URL_REQUIRED: "L'URL de l'avatar est obligatoire.",
  ADDRESS_INVALID: "L'adresse est invalide.",
  ADDRESS_MAX: "L'adresse ne doit pas depasser 255 caracteres.",
  HISTORY_LIMIT_MIN: 'La limite minimale est 1.',
  HISTORY_LIMIT_MAX:
    "Le nombre de resultats de l'historique ne doit pas depasser 100.",
  HISTORY_LIMIT_INVALID:
    "Le nombre de resultats de l'historique doit etre un nombre entier superieur ou egal a 1.",
  BIO_MAX: 'La biographie ne doit pas depasser 1000 caracteres.',
  COMPANY_NAME_MAX:
    "Le nom de l'entreprise ne doit pas depasser 150 caracteres.",
  CITY_MAX: 'La ville ne doit pas depasser 100 caracteres.',
  KYC_ID_CARD_URL_REQUIRED: "L'URL de la piece d'identite est obligatoire.",
  KYC_ID_CARD_URL_INVALID: "L'URL de la piece d'identite est invalide.",
  PROFESSIONALS_LIMIT_MIN:
    "Le nombre de resultats par page doit etre d'au moins 1.",
  PROFESSIONALS_LIMIT_MAX:
    'Le nombre de resultats par page ne doit pas depasser 50.',
  PROFESSIONALS_PAGE_INVALID:
    'Le numero de page doit etre un nombre entier superieur ou egal a 1.',
  KYC_REJECT_REASON_REQUIRED: 'Le motif de rejet KYC est obligatoire.',
  KYC_REJECT_REASON_MIN:
    'Le motif de rejet KYC doit contenir au moins 10 caracteres.',
  KYC_REJECT_REASON_MAX:
    'Le motif de rejet KYC ne doit pas depasser 1000 caracteres.',
  CATEGORY_ID_REQUIRED: 'La categorie est obligatoire.',
  CATEGORY_ID_FORMAT: "Le format de l'identifiant de categorie est invalide.",
  CATEGORY_NAME_REQUIRED: 'Le nom de la categorie est obligatoire.',
  CATEGORY_NAME_MIN:
    'Le nom de la categorie doit contenir au moins 2 caracteres.',
  CATEGORY_NAME_MAX:
    'Le nom de la categorie ne doit pas depasser 100 caracteres.',
  CATEGORY_ICON_URL_INVALID: "L'URL de l'icone de categorie est invalide.",
  CATEGORY_SORT_ORDER_INTEGER:
    "L'ordre de tri de la categorie doit etre un nombre entier.",
  CATEGORY_SORT_ORDER_MIN:
    "L'ordre de tri de la categorie ne peut pas etre negatif.",
  CATEGORY_SORT_ORDER_MAX:
    "L'ordre de tri de la categorie ne doit pas depasser 32767.",
  SERVICE_NAME_REQUIRED: 'Le nom du service est obligatoire.',
  SERVICE_NAME_MAX: 'Le nom du service ne doit pas depasser 200 caracteres.',
  SERVICE_DESCRIPTION_REQUIRED: 'La description du service est obligatoire.',
  SERVICE_PRICE_INVALID: 'Le prix du service est invalide.',
  SERVICE_PRICE_MUST_BE_POSITIVE:
    'Le prix du service doit etre un nombre positif.',
  SERVICE_PRICE_TYPE_INVALID: 'Le type de prix est invalide.',
  SERVICE_ID_REQUIRED: 'Le service est obligatoire.',
  SERVICE_ID_FORMAT: "Le format de l'identifiant du service est invalide.",
  PORTFOLIO_TITLE_REQUIRED: 'Le titre du portfolio est obligatoire.',
  PORTFOLIO_TITLE_MAX:
    'Le titre du portfolio ne doit pas depasser 200 caracteres.',
  PORTFOLIO_IMAGE_URL_REQUIRED: "L'URL de l'image est obligatoire.",
  PORTFOLIO_IMAGE_URL_INVALID: "L'URL de l'image est invalide.",
  DAY_OF_WEEK_INVALID:
    'Le jour de semaine doit etre un nombre entier entre 0 et 6.',
  DAY_OF_WEEK_MUST_BE_INTEGER: 'Le jour de semaine doit etre un nombre entier.',
  START_TIME_REQUIRED: "L'heure de debut est obligatoire.",
  END_TIME_REQUIRED: "L'heure de fin est obligatoire.",
  TIME_FORMAT_INVALID: "Le format d'heure doit etre HH:mm.",
  PROFESSIONALS_UPDATE_EMPTY:
    'Au moins un champ doit etre fourni pour la mise a jour.',
  PROFESSIONALS_REJECT_REASON_EMPTY: 'Le motif de rejet ne peut pas etre vide.',
  RESERVATION_PROFESSIONAL_ID_REQUIRED: 'Le professionnel est obligatoire.',
  RESERVATION_PROFESSIONAL_ID_FORMAT:
    "Le format de l'identifiant du professionnel est invalide.",
  RESERVATION_NEGOTIATION_ID_REQUIRED: 'La negotiation est obligatoire.',
  RESERVATION_NEGOTIATION_ID_FORMAT:
    "Le format de l'identifiant de negotiation est invalide.",
  RESERVATION_DATE_REQUIRED: 'La date de reservation est obligatoire.',
  RESERVATION_DATE_INVALID:
    'La date de reservation doit etre une date ISO valide.',
  RESERVATION_ADDRESS_REQUIRED:
    "L'adresse client de reservation est obligatoire.",
  RESERVATION_ADDRESS_MAX:
    "L'adresse client de reservation ne doit pas depasser 255 caracteres.",
  RESERVATION_DURATION_REQUIRED: 'La duree de reservation est obligatoire.',
  RESERVATION_DURATION_INTEGER:
    'La duree de reservation doit etre un nombre entier.',
  RESERVATION_DURATION_MIN:
    'La duree de reservation doit etre d au moins 15 minutes.',
  RESERVATION_DURATION_MAX:
    'La duree de reservation ne doit pas depasser 1440 minutes.',
  RESERVATION_NOTES_MAX:
    'Les notes de reservation ne doivent pas depasser 1000 caracteres.',
  RESERVATION_CANCEL_REASON_MAX:
    "Le motif d'annulation ne doit pas depasser 1000 caracteres.",
  RESERVATION_QUERY_DATE_INVALID:
    'La date fournie dans les filtres est invalide.',
  PASSWORD_REQUIRED: 'Le mot de passe est obligatoire.',
  PASSWORD_LENGTH: 'Le mot de passe doit contenir entre 8 et 64 caracteres.',
  ID_TOKEN_REQUIRED: 'Le token Google est obligatoire.',
  ID_TOKEN_MIN: 'Le token Google est invalide.',
  REFRESH_TOKEN_REQUIRED: 'Le refresh token est obligatoire.',
  REFRESH_TOKEN_MIN: 'Le refresh token est invalide.',
  NON_WHITELISTED_FIELD:
    'La requete contient un champ non autorise par le backend.',

  // -- Paiements --
  PAYMENT_BOOKING_ID_FORMAT: "Le format de l'ID de réservation est invalide.",
  PAYMENT_BOOKING_ID_REQUIRED:
    'La réservation est obligatoire pour le paiement.',
  PAYMENT_METHOD_REQUIRED: 'La méthode de paiement est obligatoire.',
  PAYMENT_METHOD_INVALID: 'La méthode de paiement est invalide.',
  PAYMENT_CALLBACK_URL_INVALID: "L'URL de retour est invalide.",
  PAYMENT_SUCCESS_URL_INVALID: "L'URL de succès est invalide.",
  PAYMENT_CANCEL_URL_INVALID: "L'URL d'annulation est invalide.",
  PAYMENT_STATUS_INVALID: 'Le statut de paiement est invalide.',
  WITHDRAWAL_AMOUNT_REQUIRED: 'Le montant du retrait est obligatoire.',
  WITHDRAWAL_AMOUNT_INVALID: 'Le montant du retrait est invalide.',
  WITHDRAWAL_AMOUNT_MIN: "Le montant minimum de retrait n'est pas atteint.",
  WITHDRAWAL_AMOUNT_MAX: 'Le montant maximum de retrait est dépassé.',
  WITHDRAWAL_METHOD_REQUIRED: 'La méthode de retrait est obligatoire.',
  WITHDRAWAL_METHOD_INVALID: 'La méthode de retrait est invalide.',
} as const;

export type ValidationMessageKey = keyof typeof VALIDATION_MESSAGE_CATALOG;

export const VALIDATION_MESSAGES = Object.freeze(
  Object.keys(VALIDATION_MESSAGE_CATALOG).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: VALIDATION_MESSAGE_CATALOG[key as ValidationMessageKey],
    }),
    {} as Record<ValidationMessageKey, string>,
  ),
) as Record<ValidationMessageKey, string>;

export function resolveValidationMessage(message: string): string {
  if (message in VALIDATION_MESSAGE_CATALOG) {
    return VALIDATION_MESSAGE_CATALOG[message as ValidationMessageKey];
  }

  return message;
}
