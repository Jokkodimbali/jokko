type ReservationClientNotificationTemplateInput = {
  clientName: string;
  serviceName: string;
  professionalName: string;
  formattedDate: string;
  address: string;
};

type ReservationGenericNotificationTemplateInput = {
  serviceName: string;
  professionalName: string;
  formattedDate: string;
  eventType: string;
};

type ReservationPriceAdjustmentTemplateInput = {
  serviceName: string;
  professionalName: string;
  formattedDate: string;
  currentPrice: number | null;
  proposedPrice: number;
  reason?: string | null;
};

export const RESERVATION_NOTIFICATION_MESSAGES = {
  createdTitle: 'Reservation enregistree',
  createdEmailSubject: 'Confirmation de votre reservation Jokko',
  createdPushBody: ({
    clientName,
    serviceName,
    professionalName,
    formattedDate,
    address,
  }: ReservationClientNotificationTemplateInput) =>
    `Bonjour ${clientName}, votre reservation pour "${serviceName}" avec ${professionalName} est enregistree dans le systeme pour le ${formattedDate}. Lieu: ${address}.`,
  createdSmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<
    ReservationClientNotificationTemplateInput,
    'clientName' | 'address'
  >) =>
    `Jokko: votre reservation "${serviceName}" avec ${professionalName} est enregistree pour le ${formattedDate}.`,
  genericEventTitle: (eventType: string) => `Reservation ${eventType}`,
  genericEventEmailSubject: (eventType: string) =>
    `Mise a jour de votre reservation Jokko: ${eventType}`,
  genericEventBody: ({
    serviceName,
    professionalName,
    formattedDate,
    eventType,
  }: ReservationGenericNotificationTemplateInput) =>
    `Votre reservation pour ${serviceName} avec ${professionalName} le ${formattedDate} a ete ${eventType}.`,
  genericEventSmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
    eventType,
  }: ReservationGenericNotificationTemplateInput) =>
    `Jokko: votre reservation ${serviceName} avec ${professionalName} du ${formattedDate} a ete ${eventType}.`,
  onTheWayTitle: 'Prestataire en route',
  onTheWayEmailSubject: 'Votre prestataire est en route',
  onTheWayBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<ReservationGenericNotificationTemplateInput, 'eventType'>) =>
    `Votre prestataire ${professionalName} est en route pour la reservation ${serviceName} prevue le ${formattedDate}.`,
  onTheWaySmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<ReservationGenericNotificationTemplateInput, 'eventType'>) =>
    `Jokko: ${professionalName} est en route pour votre reservation ${serviceName} du ${formattedDate}.`,
  priceAdjustmentProposedTitle: 'Demande d ajustement de prix',
  priceAdjustmentProposedEmailSubject:
    'Mise a jour du prix de votre reservation Jokko',
  priceAdjustmentProposedBody: ({
    serviceName,
    professionalName,
    formattedDate,
    currentPrice,
    proposedPrice,
    reason,
  }: ReservationPriceAdjustmentTemplateInput) =>
    `Le prestataire ${professionalName} propose un ajustement du prix de votre reservation ${serviceName} prevue le ${formattedDate}. Ancien prix: ${currentPrice ?? 0} FCFA. Nouveau prix propose: ${proposedPrice} FCFA.${reason ? ` Motif: ${reason}.` : ''}`,
  priceAdjustmentProposedSmsBody: ({
    serviceName,
    professionalName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'professionalName' | 'proposedPrice'
  >) =>
    `Jokko: ${professionalName} propose un nouveau prix de ${proposedPrice} FCFA pour ${serviceName}.`,
  priceAdjustmentAcceptedTitle: 'Ajustement de prix accepte',
  priceAdjustmentAcceptedBody: ({
    serviceName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'proposedPrice'
  >) =>
    `Votre ajustement de prix pour ${serviceName} a ete accepte. Nouveau montant: ${proposedPrice} FCFA.`,
  priceAdjustmentRejectedTitle: 'Ajustement de prix refuse',
  priceAdjustmentRejectedBody: ({
    serviceName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'proposedPrice'
  >) =>
    `Votre ajustement de prix pour ${serviceName} a ete refuse. Montant propose: ${proposedPrice} FCFA.`,
} as const;
