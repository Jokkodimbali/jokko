export const DISPUTE_NOTIFICATION_MESSAGES = {
  ADMIN_DISPUTE_OPENED_TITLE: 'Nouveau litige',
  ADMIN_DISPUTE_OPENED_BODY: (reservationId: string) =>
    `Un nouveau litige a été ouvert pour la réservation ${reservationId}.`,
  DISPUTE_RESOLVED_TITLE: 'Litige traité',
  DISPUTE_RESOLVED_BODY: (decisionLabel: string) =>
    `Votre litige a été traité. Décision administrative : ${decisionLabel}.`,
  DISPUTE_REJECTED_TITLE: 'Litige rejeté',
  DISPUTE_REJECTED_BODY:
    'Votre litige a été rejeté après analyse de votre dossier par l’administration.',
  DECISION_LABELS: {
    REMBOURSER_CLIENT: 'remboursement client',
    CREDITER_PRESTATAIRE: 'versement au prestataire',
    PARTAGER: 'partage entre client et prestataire',
  },
} as const;
