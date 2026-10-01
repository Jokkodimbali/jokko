import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AppFeedbackService } from '../../core/feedback/app-feedback.service';
import { SKIP_HTTP_CACHE } from '../../core/http/http-cache.interceptor';
import { AppointmentDocumentRendererService } from '../../features/appointments/presentation/pages/appointment-detail-page/appointment-document-renderer.service';
import { InvoiceDocumentService } from './invoice-document.service';

describe('InvoiceDocumentService', () => {
  const render = vi.fn().mockResolvedValue(true);
  let service: InvoiceDocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    render.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppointmentDocumentRendererService, useValue: { downloadHtmlDocument: render } },
        { provide: AppFeedbackService, useValue: { error: vi.fn() } },
      ],
    });
    service = TestBed.inject(InvoiceDocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('always refreshes the admin invoice template', () => {
    service.loadTemplate().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/admin/app-settings/invoice`);
    expect(request.request.context.get(SKIP_HTTP_CACHE)).toBe(true);
    request.flush({ success: true, data: { brandName: 'JOKKO' } });
  });

  it('regenerates an older reservation with the latest template and without the HTTP cache', async () => {
    const download = service.downloadReservation('historical-id');
    const request = http.expectOne(`${environment.apiUrl}/invoices/reservations/historical-id`);
    expect(request.request.context.get(SKIP_HTTP_CACHE)).toBe(true);
    request.flush({ success: true, data: {
      template: { brandName: 'JOKKO', footerText: 'Nouveau pied de page', feesLabel: 'Frais inclus', logoUrl: '', signatureUrl: '', stampUrl: '' },
      reference: 'JD-PRE-HISTORICAL', issuedAt: '2025-01-01T12:00:00Z', serviceDate: null,
      provider: { name: 'Prestataire', phone: '', address: '' },
      client: { name: 'Client', phone: '', address: '' },
      travelMode: 'CLIENT_SE_DEPLACE', location: 'Dakar',
      items: [{ name: 'Prestation', quantity: 1, amount: 10000 }],
      total: 10000, includedFees: 500, paymentStatus: 'SUCCES', paymentMethod: 'WAVE', durationMinutes: null,
    } });
    expect(await download).toBe(true);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][2]).toContain('Nouveau pied de page');
  });
});
