import { AppointmentView } from '../../appointments/domain/appointments.models';
import { TrackingScenarioStateService } from './tracking-scenario-state.service';

describe('shared delivery tracking scenario', () => {
  const scenarios = new TrackingScenarioStateService();

  it.each([
    ['colis', 'Type de livraison: Colis'],
    ['medicaments', 'Type de livraison: Medicaments'],
    ['materiel', 'Type de livraison: Materiel de prestation'],
  ])('uses the same map journey for %s', (_kind, notes) => {
    const appointment = {
      travelMode: 'TRANSPORT_COLIS',
      notes,
    } as AppointmentView;

    const scenario = scenarios.scenarioFor(appointment);
    expect(scenario).toBe(scenarios.scenarioFor({ ...appointment, notes: null }));
    expect(scenario.id).toBe('parcel-delivery');
    expect(scenario.isProviderTraveler()).toBe(true);
    expect(scenario.isParcelDelivery()).toBe(true);
    expect(scenario.shouldUseCurrentGpsOnly()).toBe(false);
  });
});
