export const DISPUTE_NOTIFICATION_MESSAGES = {
  ADMIN_DISPUTE_OPENED_TITLE: 'Nouveau litige',
  ADMIN_DISPUTE_OPENED_BODY: (reservationId: string) =>
    `Un nouveau litige a ete ouvert pour la reservation ${reservationId}.`,
  DISPUTE_RESOLVED_TITLE: 'Litige traite',
  DISPUTE_RESOLVED_BODY: (decisionLabel: string) =>
    `Votre litige a ete traite. Decision admin: ${decisionLabel}.`,
  DISPUTE_REJECTED_TITLE: 'Litige rejete',
  DISPUTE_REJECTED_BODY:
    'Votre litige a ete rejete apres analyse du dossier par ladministration.',
  DECISION_LABELS: {
    REMBOURSER_CLIENT: 'remboursement client',
    CREDITER_PRESTATAIRE: 'versement au prestataire',
    PARTAGER: 'partage entre client et prestataire',
  },
} as const;
