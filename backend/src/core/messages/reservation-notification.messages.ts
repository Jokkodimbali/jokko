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
  createdTitle: 'Réservation enregistrée',
  createdEmailSubject: 'Confirmation de votre réservation Jokko',
  createdPushBody: ({
    clientName,
    serviceName,
    professionalName,
    formattedDate,
    address,
  }: ReservationClientNotificationTemplateInput) =>
    `Bonjour ${clientName}, votre réservation pour « ${serviceName} » avec ${professionalName} est enregistrée pour le ${formattedDate}. Lieu : ${address}.`,
  createdSmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<
    ReservationClientNotificationTemplateInput,
    'clientName' | 'address'
  >) =>
    `Jokko : votre réservation « ${serviceName} » avec ${professionalName} est enregistrée pour le ${formattedDate}.`,
  genericEventTitle: (eventType: string) =>
    eventType === 'reprogrammée'
      ? 'Date ou heure de votre rendez-vous modifiée'
      : eventType === 'annulée par le professionnel'
        ? 'Votre rendez-vous a été annulé par le professionnel'
        : `Réservation ${eventType}`,
  genericEventEmailSubject: (eventType: string) =>
    `Mise à jour de votre réservation Jokko : ${eventType}`,
  genericEventBody: ({
    serviceName,
    professionalName,
    formattedDate,
    eventType,
  }: ReservationGenericNotificationTemplateInput) =>
    eventType === 'reprogrammée'
      ? `La date ou l'heure de votre rendez-vous « ${serviceName} » avec ${professionalName} a été modifiée. Nouveau créneau : ${formattedDate}.`
      : eventType === 'annulée par le professionnel'
        ? `${professionalName} a annulé votre rendez-vous « ${serviceName} » prévu le ${formattedDate}.`
        : `Votre réservation pour ${serviceName} avec ${professionalName}, prévue le ${formattedDate}, a été ${eventType}.`,
  genericEventSmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
    eventType,
  }: ReservationGenericNotificationTemplateInput) =>
    eventType === 'reprogrammée'
      ? `Jokko : la date ou l'heure de votre RDV ${serviceName} a changé. Nouveau créneau : ${formattedDate}.`
      : eventType === 'annulée par le professionnel'
        ? `Jokko : ${professionalName} a annulé votre RDV ${serviceName} du ${formattedDate}.`
        : `Jokko : votre réservation ${serviceName} avec ${professionalName}, prévue le ${formattedDate}, a été ${eventType}.`,
  onTheWayTitle: 'Votre prestataire est en route vers votre rendez-vous',
  onTheWayEmailSubject: 'Votre prestataire est en route',
  onTheWayBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<ReservationGenericNotificationTemplateInput, 'eventType'>) =>
    `Votre prestataire ${professionalName} est en route pour la réservation ${serviceName}, prévue le ${formattedDate}.`,
  onTheWaySmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<ReservationGenericNotificationTemplateInput, 'eventType'>) =>
    `Jokko : ${professionalName} est en route pour votre réservation ${serviceName} du ${formattedDate}.`,
  priceAdjustmentProposedTitle: 'Demande d’ajustement de prix',
  priceAdjustmentProposedEmailSubject:
    'Mise à jour du prix de votre réservation Jokko',
  priceAdjustmentProposedBody: ({
    serviceName,
    professionalName,
    formattedDate,
    currentPrice,
    proposedPrice,
    reason,
  }: ReservationPriceAdjustmentTemplateInput) =>
    `Le prestataire ${professionalName} propose un ajustement pour ${serviceName}, prévue le ${formattedDate}. Ancien prix : ${currentPrice ?? 0} FCFA. Nouveau prix proposé : ${proposedPrice} FCFA.${reason ? ` Motif : ${reason}.` : ''}`,
  priceAdjustmentProposedSmsBody: ({
    serviceName,
    professionalName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'professionalName' | 'proposedPrice'
  >) =>
    `Jokko : ${professionalName} propose un nouveau prix de ${proposedPrice} FCFA pour ${serviceName}.`,
  priceAdjustmentAcceptedTitle: 'Ajustement de prix accepté',
  priceAdjustmentAcceptedBody: ({
    serviceName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'proposedPrice'
  >) =>
    `Votre ajustement de prix pour ${serviceName} a été accepté. Nouveau montant : ${proposedPrice} FCFA.`,
  priceAdjustmentRejectedTitle: 'Ajustement de prix refusé',
  priceAdjustmentRejectedBody: ({
    serviceName,
    proposedPrice,
  }: Pick<
    ReservationPriceAdjustmentTemplateInput,
    'serviceName' | 'proposedPrice'
  >) =>
    `Votre ajustement de prix pour ${serviceName} a été refusé. Montant proposé : ${proposedPrice} FCFA.`,
} as const;
