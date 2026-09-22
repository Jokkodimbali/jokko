import { of, throwError } from 'rxjs';
import { AppointmentDetailPageComponent } from './appointment-detail-page.component';

describe('AppointmentDetailPageComponent - reprise de teleconsultation', () => {
  it('reprend la session serveur sans creer un second appel apres rechargement', async () => {
    const component = teleconsultationComponent({
      callId: 'call-active',
      conversationId: 'conversation-id',
    });

    await component['resumeOrStartTeleconsultation'](component['_appointment']);

    expect(component['startTeleconsultation']).not.toHaveBeenCalled();
  });

  it('demarre un appel uniquement quand le serveur ne possede aucune session active', async () => {
    const component = teleconsultationComponent(null);

    await component['resumeOrStartTeleconsultation'](component['_appointment']);

    expect(component['startTeleconsultation']).toHaveBeenCalledOnce();
    expect(component['startTeleconsultation']).toHaveBeenCalledWith(component['_appointment']);
  });

  it('ne cree pas un appel si la verification serveur echoue', async () => {
    const component = teleconsultationComponent(null);
    component['callsApi'] = {
      getActiveCall: () => throwError(() => new Error('network')),
    };
    component['autoStartedTeleconsultationId'] = 'reservation-id';

    await component['resumeOrStartTeleconsultation'](component['_appointment']);

    expect(component['startTeleconsultation']).not.toHaveBeenCalled();
    expect(component['autoStartedTeleconsultationId']).toBeNull();
  });
});

function teleconsultationComponent(activeCall: Record<string, unknown> | null): Record<string, any> {
  const component = Object.create(AppointmentDetailPageComponent.prototype) as Record<string, any>;
  const appointment = {
    id: 'reservation-id',
    status: 'EN_COURS',
    consultationType: 'TELECONSULTATION',
    conversationId: 'conversation-id',
  };

  component['_appointment'] = appointment;
  component['appointment'] = () => appointment;
  component['teleconsultationCompleted'] = () => false;
  component['callsApi'] = { getActiveCall: () => of(activeCall) };
  component['startTeleconsultation'] = vi.fn();
  return component;
}
