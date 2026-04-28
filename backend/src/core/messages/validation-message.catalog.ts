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
  NEGOTIATION_AMOUNT_INVALID: 'Le montant de negotiation est invalide.',
  NEGOTIATION_AMOUNT_MIN:
    'Le montant de negotiation doit etre superieur ou egal a 1 FCFA.',
  NEGOTIATION_AMOUNT_MAX:
    'Le montant de negotiation ne doit pas depasser 100000000 FCFA.',
  NEGOTIATION_MESSAGE_INVALID: 'Le message de negotiation est invalide.',
  NEGOTIATION_MESSAGE_MAX:
    'Le message de negotiation ne doit pas depasser 1000 caracteres.',
  NEGOTIATION_REASON_INVALID:
    'Le motif de cloture de negotiation est invalide.',
  NEGOTIATION_REASON_MAX:
    'Le motif de cloture de negotiation ne doit pas depasser 1000 caracteres.',
  NEGOTIATION_SCOPE_INVALID: 'Le scope de negotiation est invalide.',
  NEGOTIATION_STATUS_INVALID: 'Le statut de negotiation est invalide.',
  NEGOTIATION_LIMIT_INVALID:
    'La limite des negotiations doit etre un nombre entier.',
  NEGOTIATION_LIMIT_MIN:
    'La limite des negotiations doit etre superieure ou egale a 1.',
  NEGOTIATION_LIMIT_MAX: 'La limite des negotiations ne doit pas depasser 100.',
  NEGOTIATION_OFFSET_INVALID:
    "L'offset des negotiations doit etre un nombre entier.",
  NEGOTIATION_OFFSET_MIN: "L'offset des negotiations ne peut pas etre negatif.",
  MESSAGING_PROFESSIONAL_ID_FORMAT:
    "Le format de l'identifiant du professionnel est invalide.",
  MESSAGING_CLIENT_ID_FORMAT:
    "Le format de l'identifiant du client est invalide.",
  MESSAGING_RESERVATION_ID_REQUIRED:
    "L'identifiant de reservation est obligatoire pour la conversation.",
  MESSAGING_RESERVATION_ID_FORMAT:
    "Le format de l'identifiant de reservation est invalide.",
  MESSAGING_MESSAGE_CONTENT_INVALID: 'Le contenu du message est invalide.',
  MESSAGING_MESSAGE_CONTENT_MAX:
    'Le contenu du message ne doit pas depasser 2000 caracteres.',
  MESSAGING_MEDIA_URL_INVALID: "L'URL du media du message est invalide.",
  MESSAGING_LIMIT_INVALID:
    'La limite des conversations doit etre un nombre entier.',
  MESSAGING_LIMIT_MIN:
    'La limite des conversations doit etre superieure ou egale a 1.',
  MESSAGING_LIMIT_MAX: 'La limite des conversations ne doit pas depasser 100.',
  MESSAGING_OFFSET_INVALID:
    "L'offset des conversations doit etre un nombre entier.",
  MESSAGING_OFFSET_MIN: "L'offset des conversations ne peut pas etre negatif.",
  RESERVATION_CANCEL_REASON_MAX:
    "Le motif d'annulation ne doit pas depasser 1000 caracteres.",
  RESERVATION_PRICE_ADJUSTMENT_AMOUNT_INVALID:
    "Le montant propose pour l'ajustement de prix est invalide.",
  RESERVATION_PRICE_ADJUSTMENT_AMOUNT_MIN:
    "Le montant propose pour l'ajustement de prix doit etre superieur ou egal a 1 FCFA.",
  RESERVATION_PRICE_ADJUSTMENT_AMOUNT_MAX:
    "Le montant propose pour l'ajustement de prix ne doit pas depasser 100000000 FCFA.",
  RESERVATION_PRICE_ADJUSTMENT_REASON_MAX:
    "Le motif d'ajustement de prix ne doit pas depasser 1000 caracteres.",
  RESERVATION_REVIEW_RATING_INVALID:
    'La note de reservation doit etre un entier valide.',
  RESERVATION_REVIEW_RATING_MIN:
    'La note de reservation doit etre au minimum de 1 sur 5.',
  RESERVATION_REVIEW_RATING_MAX:
    'La note de reservation doit etre au maximum de 5 sur 5.',
  RESERVATION_REVIEW_MAX: "L'avis client ne doit pas depasser 1000 caracteres.",
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
  PAYMENT_BOOKING_ID_FORMAT: "Le format de l'ID de reservation est invalide.",
  PAYMENT_BOOKING_ID_REQUIRED:
    'La reservation est obligatoire pour le paiement.',
  PAYMENT_METHOD_REQUIRED: 'La methode de paiement est obligatoire.',
  PAYMENT_METHOD_INVALID: 'La methode de paiement est invalide.',
  PAYMENT_CALLBACK_URL_INVALID: "L'URL de retour est invalide.",
  PAYMENT_SUCCESS_URL_INVALID: "L'URL de succes est invalide.",
  PAYMENT_CANCEL_URL_INVALID: "L'URL d'annulation est invalide.",
  PAYMENT_STATUS_INVALID: 'Le statut de paiement est invalide.',
  WITHDRAWAL_AMOUNT_REQUIRED: 'Le montant du retrait est obligatoire.',
  WITHDRAWAL_AMOUNT_INVALID: 'Le montant du retrait est invalide.',
  WITHDRAWAL_AMOUNT_MIN: "Le montant minimum de retrait n'est pas atteint.",
  WITHDRAWAL_AMOUNT_MAX: 'Le montant maximum de retrait est depasse.',
  WITHDRAWAL_METHOD_REQUIRED: 'La methode de retrait est obligatoire.',
  WITHDRAWAL_METHOD_INVALID: 'La methode de retrait est invalide.',
  PAYMENT_REASON_MAX: 'Le motif ne doit pas depasser 1000 caracteres.',

  // -- Notifications --
  NOTIFICATION_READ_INVALID:
    'Le filtre de lecture doit etre un booleen valide.',
  NOTIFICATION_LIMIT_INVALID:
    'La limite des notifications doit etre un nombre entier.',
  NOTIFICATION_LIMIT_MIN:
    'La limite des notifications doit etre superieure ou egale a 1.',
  NOTIFICATION_LIMIT_MAX:
    'La limite des notifications ne doit pas depasser 100.',
  NOTIFICATION_OFFSET_INVALID:
    "L'offset des notifications doit etre un nombre entier.",
  NOTIFICATION_OFFSET_MIN:
    "L'offset des notifications ne peut pas etre negatif.",
  NOTIFICATION_FCM_TOKEN_REQUIRED:
    'Le token de notification mobile est obligatoire.',
  NOTIFICATION_FCM_TOKEN_INVALID:
    'Le token de notification mobile est invalide.',
  NOTIFICATION_FCM_TOKEN_TOO_LONG:
    'Le token de notification mobile ne doit pas depasser 500 caracteres.',

  // -- Search --
  SEARCH_LATITUDE_INVALID:
    'La latitude doit etre un nombre decimal compris entre -90 et 90.',
  SEARCH_LONGITUDE_INVALID:
    'La longitude doit etre un nombre decimal compris entre -180 et 180.',
  SEARCH_RADIUS_INVALID:
    'Le rayon de recherche doit etre un nombre positif inferieur ou egal a 100.',
  SEARCH_PAGE_INVALID:
    'Le numero de page doit etre un nombre entier superieur ou egal a 1.',
  SEARCH_LIMIT_MIN:
    'Le nombre de resultats de recherche doit etre d au moins 1.',
  SEARCH_LIMIT_MAX:
    'Le nombre de resultats de recherche ne doit pas depasser 50.',
  SEARCH_QUERY_MAX:
    'Le texte de recherche ne doit pas depasser 150 caracteres.',
  SEARCH_CATEGORY_ID_FORMAT:
    "Le format de l'identifiant de categorie de recherche est invalide.",
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
