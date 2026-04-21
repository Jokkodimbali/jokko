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
  RESERVATION_NOT_CONFIRMED: 'La reservation doit etre confirmee.',
  RESERVATION_ALREADY_CLOSED: 'La reservation est deja terminee ou annulee.',
  RESERVATION_CANNOT_RESCHEDULE:
    'Impossible de reprogrammer cette reservation.',
  RESERVATION_CANNOT_CANCEL:
    'Impossible d annuler cette reservation dans son statut actuel.',
  RESERVATION_NOT_FOUND: 'Reservation introuvable.',
  RESERVATION_UNAUTHORIZED:
    "Vous n'etes pas autorise a modifier cette reservation.",
  RESERVATION_TIME_SLOT_UNAVAILABLE: 'Ce creneau horaire n est pas disponible.',
  RESERVATION_CANNOT_MARK_AS_PAID:
    'Impossible de marquer cette reservation comme payee.',
  RESERVATION_CANNOT_START: 'Impossible de demarrer cette reservation.',
  RESERVATION_CANNOT_OPEN_DISPUTE:
    "Impossible d'ouvrir un litige pour cette reservation.",
  RESERVATION_CANCELLATION_TOO_LATE:
    'Annulation impossible moins de 24h avant la reservation.',
  RESERVATION_RESCHEDULE_TOO_LATE:
    'Reprogrammation impossible moins de 24h avant la reservation.',
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

  // -- Paiements --
  PAYMENT_INVALID_AMOUNT: ({ reason }: { reason: string }) =>
    `Montant invalide : ${reason}`,
  PAYMENT_AMOUNT_NOT_NUMERIC: 'Valeur non numerique',
  PAYMENT_AMOUNT_NEGATIVE: 'Montant negatif non autorise',
  PAYMENT_AMOUNT_TOO_HIGH: 'Montant trop eleve',
  PAYMENT_AMOUNT_RESULT_NEGATIVE: 'Resultat negatif non autorise',
  PAYMENT_AMOUNT_DIVISION_BY_ZERO: 'Division par zero',
  PAYMENT_INVALID_REFERENCE: ({ reason }: { reason: string }) =>
    `Reference invalide : ${reason}`,
  PAYMENT_REFERENCE_LENGTH_INVALID: 'Longueur invalide (10-100 caracteres)',
  PAYMENT_REFERENCE_FORMAT_INVALID:
    'Caracteres non autorises (uniquement lettres, chiffres, tirets et underscores)',
  PAYMENT_INSUFFICIENT_FUNDS: ({
    requested,
    available,
  }: {
    requested: number;
    available: number;
  }) => `Fonds insuffisants. Demande: ${requested}, Disponible: ${available}`,
  PAYMENT_INVALID_METHOD: ({ method }: { method: string }) =>
    `Methode de paiement invalide : ${method}`,
  PAYMENT_ALREADY_PROCESSED: 'Ce paiement a deja ete traite',
  PAYMENT_IDEMPOTENCY_KEY_REQUIRED:
    "La cle d'idempotence est obligatoire pour initier un paiement.",
  PAYMENT_IDEMPOTENCY_CONFLICT:
    "Cette cle d'idempotence a deja ete utilisee avec une requete differente.",
  PAYMENT_IDEMPOTENCY_IN_PROGRESS:
    'Une demande de paiement identique est deja en cours de traitement.',
  ESCROW_ALREADY_RELEASED: 'Les fonds sous sequestre ont deja ete liberes',
  ESCROW_ALREADY_DISPUTED: 'Ces fonds sont deja en litige',
  WITHDRAWAL_TOO_SOON: ({ hoursRemaining }: { hoursRemaining: number }) =>
    `Impossible de retirer. Veuillez patienter ${hoursRemaining} heures.`,
  WITHDRAWAL_AMOUNT_TOO_LOW: ({
    minimum,
    requested,
  }: {
    minimum: number;
    requested: number;
  }) => `Montant trop faible. Minimum: ${minimum}, Demande: ${requested}`,
  WITHDRAWAL_AMOUNT_TOO_HIGH: ({
    maximum,
    requested,
  }: {
    maximum: number;
    requested: number;
  }) => `Montant trop eleve. Maximum: ${maximum}, Demande: ${requested}`,
  PAYMENT_NOT_FOUND: ({ paymentId }: { paymentId: string }) =>
    `Paiement introuvable: ${paymentId}`,
  ESCROW_NOT_FOUND: ({ paymentId }: { paymentId: string }) =>
    `Paiement sous sequestre introuvable: ${paymentId}`,
  PAYMENT_GATEWAY_ERROR: ({ details }: { details: string }) =>
    `Erreur du prestataire de paiement: ${details}`,
  PAYMENT_GATEWAY_UNKNOWN_ERROR: 'Erreur gateway inconnue',
  PAYMENT_FAILED_BY_PROVIDER: 'Paiement refuse par le prestataire',
  PAYMENT_INVALID_WEBHOOK_SIGNATURE: 'Signature webhook invalide',
  PAYMENT_WEBHOOK_REPLAY_IGNORED:
    'Ce webhook paiement a deja ete recu et ne sera pas rejoue.',
  PAYMENT_UNAUTHORIZED_ACCESS: ({ paymentId }: { paymentId: string }) =>
    `Acces non autorise au paiement ${paymentId}.`,
  WITHDRAWAL_NOT_FOUND: ({ withdrawalId }: { withdrawalId: string }) =>
    `Demande de retrait introuvable : ${withdrawalId}.`,
  WITHDRAWAL_ALREADY_PROCESSED: ({ status }: { status: string }) =>
    `Cette demande de retrait a deja ete traitee (statut : ${status}).`,
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
