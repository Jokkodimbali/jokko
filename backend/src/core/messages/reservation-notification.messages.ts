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
} as const;
