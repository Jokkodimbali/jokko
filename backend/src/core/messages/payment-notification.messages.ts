export const PAYMENT_NOTIFICATION_MESSAGES = {
  CLIENT_ESCROW_CONFIRMED_TITLE: 'Paiement confirme',
  CLIENT_ESCROW_CONFIRMED_BODY:
    'Votre paiement a ete confirme et les fonds sont securises par Jokko.',
  CLIENT_ESCROW_CONFIRMED_EMAIL_SUBJECT: 'Confirmation de votre paiement Jokko',
  CLIENT_ESCROW_CONFIRMED_SMS_BODY: (serviceName: string) =>
    `Jokko: votre paiement pour "${serviceName}" a ete confirme et securise.`,
  PROFESSIONAL_ESCROW_CONFIRMED_TITLE: 'Paiement client confirme',
  PROFESSIONAL_ESCROW_CONFIRMED_BODY: (serviceName: string) =>
    `Le paiement de la reservation ${serviceName} est securise.`,
  PROFESSIONAL_ESCROW_CONFIRMED_EMAIL_SUBJECT:
    'Paiement client confirme sur Jokko',
  PROFESSIONAL_ESCROW_CONFIRMED_SMS_BODY: (serviceName: string) =>
    `Jokko: le paiement client pour "${serviceName}" est securise.`,
  SEED_CLIENT_ESCROW_CONFIRMED_BODY:
    'Votre paiement demo a ete confirme et les fonds sont securises par Jokko.',
  SEED_PROFESSIONAL_ESCROW_CONFIRMED_BODY:
    'Un paiement client demo est securise en escrow.',
  WALLET_ESCROW_RELEASED_DESCRIPTION:
    'Fonds escrow liberes vers le portefeuille professionnel.',
  WALLET_WITHDRAWAL_DEBIT_DESCRIPTION:
    'Retrait professionnel debite du portefeuille.',
} as const;
