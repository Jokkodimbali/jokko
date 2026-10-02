import { RESERVATION_NOTIFICATION_MESSAGES } from './reservation-notification.messages';

describe('Reservation notification messages', () => {
  const input = {
    serviceName: 'Consultation',
    professionalName: 'Dr Ndiaye',
    formattedDate: 'vendredi 9 octobre 2026 à 10:00',
  };

  it('explains the new appointment date to the client', () => {
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventTitle('reprogrammée'))
      .toBe('Date ou heure de votre rendez-vous modifiée');
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventBody({
      ...input,
      eventType: 'reprogrammée',
    })).toContain(`Nouveau créneau : ${input.formattedDate}`);
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventSmsBody({
      ...input,
      eventType: 'reprogrammée',
    })).toContain(input.formattedDate);
  });

  it('identifies a cancellation made by the professional', () => {
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventTitle('annulée par le professionnel'))
      .toBe('Votre rendez-vous a été annulé par le professionnel');
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventBody({
      ...input,
      eventType: 'annulée par le professionnel',
    })).toContain('Dr Ndiaye a annulé votre rendez-vous');
    expect(RESERVATION_NOTIFICATION_MESSAGES.genericEventSmsBody({
      ...input,
      eventType: 'annulée par le professionnel',
    })).toContain('Dr Ndiaye a annulé votre RDV');
  });
});
