export const PAYMENT_NOTIFICATION_MESSAGES = {
  CLIENT_ESCROW_CONFIRMED_TITLE: 'Paiement confirmé',
  CLIENT_ESCROW_CONFIRMED_BODY:
    'Votre paiement a été confirmé et les fonds sont sécurisés par Jokko.',
  CLIENT_ESCROW_CONFIRMED_EMAIL_SUBJECT: 'Confirmation de votre paiement Jokko',
  CLIENT_ESCROW_CONFIRMED_SMS_BODY: (serviceName: string) =>
    `Jokko : votre paiement pour « ${serviceName} » a été confirmé et sécurisé.`,
  PROFESSIONAL_ESCROW_CONFIRMED_TITLE: 'Paiement client confirmé',
  PROFESSIONAL_ESCROW_CONFIRMED_BODY: (serviceName: string) =>
    `Le paiement de la réservation ${serviceName} est sécurisé.`,
  PROFESSIONAL_ESCROW_CONFIRMED_EMAIL_SUBJECT:
    'Paiement client confirmé sur Jokko',
  PROFESSIONAL_ESCROW_CONFIRMED_SMS_BODY: (serviceName: string) =>
    `Jokko : le paiement client pour « ${serviceName} » est sécurisé.`,
  SEED_CLIENT_ESCROW_CONFIRMED_BODY:
    'Votre paiement de démonstration a été confirmé et les fonds sont sécurisés par Jokko.',
  SEED_PROFESSIONAL_ESCROW_CONFIRMED_BODY:
    'Un paiement client de démonstration est sécurisé en séquestre.',
  WALLET_ESCROW_RELEASED_DESCRIPTION:
    'Fonds libérés vers le portefeuille professionnel.',
  WALLET_WITHDRAWAL_DEBIT_DESCRIPTION:
    'Retrait professionnel débité du portefeuille.',
} as const;
