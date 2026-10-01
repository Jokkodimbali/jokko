import { buildInvoiceDocument, InvoiceDocument } from './invoice-document';

describe('Shared invoice document', () => {
  const data: InvoiceDocument = {
    template: { brandName: 'JOKKO', footerText: 'Merci', feesLabel: 'Frais inclus',
      logoUrl: '/logojokko.png', signatureUrl: '', stampUrl: '' },
    reference: 'JD-PRE-TEST', issuedAt: '2026-10-01T10:00:00Z', serviceDate: null,
    provider: { name: 'Prestataire', phone: '770000000', address: 'Dakar' },
    client: { name: 'Client', phone: '780000000', address: 'Thiès' },
    travelMode: 'PRESTATAIRE_SE_DEPLACE', location: 'Lieu réel',
    items: [{ name: 'Consultation', quantity: 1, amount: 10000 }],
    total: 10000, includedFees: 500, paymentStatus: 'SUCCES', paymentMethod: 'WAVE', durationMinutes: null,
  };

  it('uses the central design and real total without adding included fees', () => {
    const html = buildInvoiceDocument(data);
    expect(html).toContain('system-invoice');
    expect(html).toContain('10 000 FCFA');
    expect(html).toContain('500 FCFA');
    expect(html).not.toContain('10 500 FCFA');
    expect(html).not.toContain('mission-invoice');
  });

  it('escapes names and template text and drops unsafe images', () => {
    const html = buildInvoiceDocument({ ...data, client: { ...data.client, name: '<script>alert(1)</script>' },
      template: { ...data.template, footerText: '<img src=x onerror=alert(1)>', logoUrl: 'javascript:alert(1)' } });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('renders both parcel endpoints from the saved reservation', () => {
    const html = buildInvoiceDocument({ ...data, travelMode: 'TRANSPORT_COLIS',
      parcel: {
        pickup: { name: 'Expéditeur', phone: '771234567', address: 'Dakar Centre' },
        dropoff: { name: 'Destinataire', phone: '781234567', address: 'Thiès Gare' },
      } });
    expect(html).toContain('Retrait du colis');
    expect(html).toContain('Dépôt du colis');
    expect(html).toContain('Dakar Centre');
    expect(html).toContain('Thiès Gare');
  });

  it('does not turn failed or refunded payments into paid invoices', () => {
    expect(buildInvoiceDocument({ ...data, paymentStatus: 'ECHEC' })).toContain('Paiement échoué');
    expect(buildInvoiceDocument({ ...data, paymentStatus: 'REMBOURSE' })).toContain('Remboursée');
  });

  it('uses the same customized logo, signature, stamp and footer', () => {
    const folder = 'https://res.cloudinary.com/demo/image/upload/v1/jokko/invoices/';
    const html = buildInvoiceDocument({ ...data, template: { ...data.template,
      logoUrl: folder + 'logo.png', signatureUrl: folder + 'signature.png', stampUrl: folder + 'stamp.png',
      footerText: 'Texte commun' } });
    expect(html).toContain(folder + 'logo.png');
    expect(html).toContain(folder + 'signature.png');
    expect(html).toContain(folder + 'stamp.png');
    expect(html).toContain('Texte commun');
  });
});
