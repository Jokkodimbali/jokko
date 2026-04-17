export const DOMAIN_MESSAGE_CATALOG = {
  PASSWORD_REQUIRED: 'Le mot de passe est obligatoire',
  PASSWORD_TOO_SHORT: ({ length }: { length: number }) =>
    `Le mot de passe doit contenir au moins 8 caracteres (actuellement ${length})`,
  PASSWORD_TOO_LONG: ({ length }: { length: number }) =>
    `Le mot de passe ne doit pas depasser 64 caracteres (actuellement ${length})`,
  PHONE_INVALID: ({ phoneNumber }: { phoneNumber: string }) =>
    `Le numero de telephone ${phoneNumber} est invalide`,
  OTP_INVALID_OR_EXPIRED: 'Le code OTP est invalide ou a expire',
  OTP_TOO_MANY_REQUESTS:
    'Trop de tentatives OTP. Veuillez reessayer plus tard.',
  OTP_RESEND_TOO_EARLY: 'Veuillez attendre avant de redemander un code OTP.',
  INVALID_CATEGORY_NAME_LENGTH: ({ length }: { length: number }) =>
    `Le nom de categorie doit contenir entre 2 et 100 caracteres. Longueur recue: ${length}.`,
  INVALID_CATEGORY_ICON_URL: ({ url }: { url: string }) =>
    `L'URL d'icone de categorie est invalide: ${url}.`,
  INVALID_CATEGORY_SORT_ORDER: ({ value }: { value: number }) =>
    `L'ordre de tri doit etre un entier entre 0 et 32767. Valeur recue: ${value}.`,
  INVALID_BIO_LENGTH: ({ length }: { length: number }) =>
    `Bio length must be between 1 and 1000 characters. Got: ${length}`,
  INVALID_COMPANY_NAME_LENGTH: ({ length }: { length: number }) =>
    `Company name length must be between 1 and 150 characters. Got: ${length}`,
  INVALID_CITY_LENGTH: ({ length }: { length: number }) =>
    `City length must be between 1 and 100 characters. Got: ${length}`,
  INVALID_KYC_URL: ({ url }: { url: string }) =>
    `Invalid KYC ID card URL format: ${url}`,
  INVALID_TIME_FORMAT: ({ time }: { time: string }) =>
    `Invalid time format, expected HH:mm: ${time}`,
  INVALID_DAY_OF_WEEK: ({ day }: { day: number }) =>
    `Day of week must be between 0 and 6. Got: ${day}`,
  PROFILE_NOT_FOUND: ({ profileId }: { profileId: string }) =>
    `Profile not found: ${profileId}`,
  PROFILE_ALREADY_EXISTS: ({ userId }: { userId: string }) =>
    `Profile already exists for user: ${userId}`,
  INVALID_RATING: ({ rating }: { rating: number }) =>
    `Rating must be between 0 and 5. Got: ${rating}`,
  KYC_ALREADY_SUBMITTED:
    'KYC has already been submitted and is pending or verified',
  KYC_NOT_SUBMITTED:
    'KYC must be submitted before it can be approved or rejected',
  REJECT_REASON_EMPTY: 'Le motif de rejet ne peut pas etre vide',
  INVALID_ROLE: ({ role }: { role: string }) => `Role invalide : ${role}`,
  RESERVATION_CLIENT_REQUIRED: 'Le client est obligatoire.',
  RESERVATION_PROFESSIONAL_REQUIRED: 'Le professionnel est obligatoire.',
  RESERVATION_SERVICE_REQUIRED: 'Le service est obligatoire.',
  RESERVATION_ADDRESS_REQUIRED: "L'adresse du client est obligatoire.",
  RESERVATION_INVALID_DURATION: 'La duree de reservation est invalide.',
  RESERVATION_INVALID_DATETIME:
    'La date et l heure de reservation sont invalides.',
  RESERVATION_PAST_DATETIME: 'La date et l heure doivent etre dans le futur.',
  RESERVATION_NOT_PENDING: 'La reservation doit etre en attente.',
  RESERVATION_NOT_ACTIVE: 'La reservation doit etre confirmee ou en cours.',
  RESERVATION_ALREADY_CLOSED: 'La reservation est deja terminee ou annulee.',
  RESERVATION_CANNOT_RESCHEDULE:
    'Impossible de reprogrammer cette reservation.',
  RESERVATION_CANNOT_CANCEL:
    'Impossible d annuler cette reservation dans son statut actuel.',
  RESERVATION_NOT_FOUND: 'Reservation introuvable.',
  RESERVATION_UNAUTHORIZED:
    "Vous n'etes pas autorise a modifier cette reservation.",
  RESERVATION_TIME_SLOT_UNAVAILABLE: 'Ce creneau horaire n est pas disponible.',
  USER_NOT_FOUND: 'Utilisateur introuvable',
  USER_ALREADY_EXISTS: ({ identifier }: { identifier: string }) =>
    `L'utilisateur avec ${identifier} existe deja`,
  USER_NOT_ACTIVE: 'Le compte utilisateur est desactive',
  USER_ALREADY_DEACTIVATED: 'Le compte utilisateur est deja desactive',
  INVALID_EMAIL: ({ email }: { email: string }) =>
    `L'email ${email} est invalide`,
  EMAIL_ALREADY_USED: ({ email }: { email: string }) =>
    `L'email ${email} est deja utilise`,
  INVALID_NAME: ({ name }: { name: string }) =>
    `Le nom "${name}" est trop court (minimum 2 caracteres)`,
  INVALID_ADDRESS: "L'adresse est trop longue (maximum 255 caracteres)",
  CANNOT_DELETE_ACTIVE_USER: 'Impossible de supprimer un utilisateur actif',
} as const;

type DomainMessageCatalog = typeof DOMAIN_MESSAGE_CATALOG;
type DomainMessageKey = keyof DomainMessageCatalog;

export function domainMessage<TKey extends DomainMessageKey>(
  key: TKey,
  params?: DomainMessageCatalog[TKey] extends (...args: never[]) => string
    ? Parameters<
        Extract<DomainMessageCatalog[TKey], (...args: never[]) => string>
      >[0]
    : never,
): string {
  const template = DOMAIN_MESSAGE_CATALOG[key];

  if (typeof template === 'function') {
    return template(params as never);
  }

  return template;
}
