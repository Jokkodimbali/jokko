import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { NearbyPharmacyView, PharmacyOrdersService } from './pharmacy-orders.service';

describe('PharmacyOrdersService', () => {
  let service: PharmacyOrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PharmacyOrdersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads nearby pharmacies with the current coordinates and requested radius', () => {
    const pharmacies: NearbyPharmacyView[] = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Pharmacie Jokko',
        address: 'Dakar',
        city: 'Dakar',
        latitude: 14.7167,
        longitude: -17.4677,
        distanceKm: 2.4,
        rating: 4.8,
        totalReviews: 32,
      },
    ];
    let result: NearbyPharmacyView[] | undefined;

    service
      .listNearby({ latitude: 14.7, longitude: -17.4, radiusKm: 15 })
      .subscribe((items) => (result = items));

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/pharmacy-orders/nearby`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('latitude')).toBe('14.7');
    expect(request.request.params.get('longitude')).toBe('-17.4');
    expect(request.request.params.get('radiusKm')).toBe('15');
    request.flush({ success: true, data: pharmacies });
    expect(result).toEqual(pharmacies);
  });

  it('sends the selected pharmacy and medical reservation identifiers', () => {
    const input = {
      medicalReservationId: '44444444-4444-4444-8444-444444444444',
      pharmacyId: '33333333-3333-4333-8333-333333333333',
    };

    service.create(input).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/pharmacy-orders`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({
      success: true,
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        status: 'EN_ATTENTE_PHARMACIE',
        medicineAmount: null,
        pharmacyNote: null,
        unavailableItems: [],
        medicineItems: [],
        validatedAt: null,
        medicalReservation: {
          id: input.medicalReservationId,
          scheduledAt: '2026-08-24T10:00:00.000Z',
          prescription: { acts: [], vaccines: [], treatments: [] },
        },
        client: { id: '11111111-1111-4111-8111-111111111111', nom: 'Client Jokko' },
        pharmacy: { id: input.pharmacyId, name: 'Pharmacie Jokko', userId: 'user-id' },
        createdAt: '2026-08-24T10:00:00.000Z',
      },
    });
  });

  it('loads the pharmacy order inbox', () => {
    service.list().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/pharmacy-orders`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: [] });
  });

  it('checks whether the current provider has pharmacy access', () => {
    service.getAccess().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/pharmacy-orders/access`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { isPharmacy: true } });
  });

  it('submits a validated pharmacy decision', () => {
    const orderId = '55555555-5555-4555-8555-555555555555';
    const decision = {
      status: 'EN_ATTENTE_PAIEMENT' as const,
      pharmacyNote: 'Commande disponible.',
      medicineItems: [{ position: 0, name: 'Paracétamol', isAvailable: true, price: 12500 }],
    };

    service.validate(orderId, decision).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/pharmacy-orders/${orderId}/validation`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(decision);
    request.flush({ success: true, data: {} });
  });

  it('initiates an idempotent pharmacy order payment', () => {
    const orderId = '55555555-5555-4555-8555-555555555555';

    service.initiatePayment(orderId, 'WAVE').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/pharmacy-orders/${orderId}/payment`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.method).toBe('WAVE');
    expect(request.request.body.successUrl).toContain(`/pharmacy-orders/${orderId}/delivery`);
    expect(request.request.headers.get('Idempotency-Key')).toBe(`pharmacy-payment-${orderId}-WAVE`);
    request.flush({ success: true, data: {} });
  });

  it('confirms a mock pharmacy payment through its dedicated endpoint', () => {
    const orderId = '55555555-5555-4555-8555-555555555555';

    service.confirmMockPayment(orderId).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/pharmacy-orders/${orderId}/payment/mock-confirm`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: {} });
  });

  it('loads a nearby courier delivery offer', () => {
    const orderId = '55555555-5555-4555-8555-555555555555';

    service.getDeliveryOffer(orderId).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/pharmacy-orders/${orderId}/delivery-offer`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { id: orderId, distanceKm: 4.2 } });
  });

  it('accepts a pharmacy delivery atomically through its dedicated endpoint', () => {
    const orderId = '55555555-5555-4555-8555-555555555555';

    service.acceptDelivery(orderId).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/pharmacy-orders/${orderId}/delivery/accept`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: { id: orderId } });
  });
});
