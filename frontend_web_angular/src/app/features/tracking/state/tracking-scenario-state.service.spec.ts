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

  it.each([
    ['PRESTATAIRE_SE_DEPLACE', 'doctor-to-client', false],
    ['CLIENT_SE_DEPLACE', 'client-to-doctor', true],
  ] as const)('partage le même acteur du trajet médical %s pour les deux écrans', (travelMode, id, clientTraveler) => {
    const appointment = { travelMode } as AppointmentView;
    const scenario = scenarios.scenarioFor(appointment, true);
    expect(scenario.id).toBe(id);
    expect(scenario.isClientTraveler()).toBe(clientTraveler);
    expect(scenarios.routeActorIsClient(appointment, true)).toBe(clientTraveler);
    expect(scenarios.routeActorIsProvider(appointment, true)).toBe(!clientTraveler);
  });
});
