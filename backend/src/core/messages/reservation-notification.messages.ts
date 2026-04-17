type ReservationClientNotificationTemplateInput = {
  clientName: string;
  serviceName: string;
  professionalName: string;
  formattedDate: string;
  address: string;
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
    `Bonjour ${clientName}, votre reservation pour "${serviceName}" avec ${professionalName} est confirmee dans le systeme pour le ${formattedDate}. Lieu: ${address}.`,
  createdSmsBody: ({
    serviceName,
    professionalName,
    formattedDate,
  }: Omit<
    ReservationClientNotificationTemplateInput,
    'clientName' | 'address'
  >) =>
    `Jokko: votre reservation "${serviceName}" avec ${professionalName} est enregistree pour le ${formattedDate}.`,
} as const;
