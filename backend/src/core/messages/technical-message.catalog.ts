export const ENV_MESSAGES = {
  INVALID_PORT: (value: string) =>
    `Variable d'environnement invalide: PORT=${value}. Le port doit etre un nombre positif.`,
  INVALID_SECRET_MIN_LENGTH: (name: string) =>
    `Variable d'environnement invalide: ${name} doit contenir au moins 16 caracteres.`,
  INVALID_NODE_ENV: (value: string) =>
    `Variable d'environnement invalide: NODE_ENV=${value}.`,
  INVALID_DATABASE_URL:
    "Variable d'environnement invalide: DATABASE_URL doit commencer par postgresql://.",
} as const;

export const TECHNICAL_MESSAGES = {
  DATABASE_HEALTH_TIMEOUT:
    'Le delai de verification de la base de donnees est depasse.',
  RESERVATION_EMAIL_PROVIDER_NOT_CONFIGURED:
    'Email provider not configured. Reservation email skipped.',
  RESERVATION_EMAIL_PROVIDER_CONFIGURATION_MISSING:
    'Email provider not configured',
  RESERVATION_EMAIL_FAILED: (error: string) =>
    `Reservation email failed: ${error}`,
  RESERVATION_SMS_PROVIDER_NOT_CONFIGURED:
    'Twilio is not configured. Reservation SMS notification skipped.',
  RESERVATION_SMS_PROVIDER_CONFIGURATION_MISSING:
    'Twilio provider not configured',
  RESERVATION_SMS_FAILED: (error: string) => `Reservation SMS failed: ${error}`,
  OUTBOX_EVENT_PERSIST_FAILED: (eventName: string, error: string) =>
    `Failed to persist event ${eventName} to outbox: ${error}`,
  AUDIT_LOG_WRITE_FAILED: (error: string) =>
    `Failed to write audit log: ${error}`,
  SEED_DATABASE_URL_MISSING: 'DATABASE_URL not set',
  SEED_CATEGORY_NOT_FOUND: 'Category not found',
  SEED_SUCCESS: 'Seed complete: Users, Prof, Services, Reservation creee!',
} as const;
