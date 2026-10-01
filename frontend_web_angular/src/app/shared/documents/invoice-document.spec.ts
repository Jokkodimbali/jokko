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

  it('shows service price, included fees, total and payment in the requested order', () => {
    const html = buildInvoiceDocument(data);
    const summary = html.slice(html.indexOf('<section class="invoice-summary">'));
    expect(summary.indexOf('Prix de la prestation')).toBeLessThan(summary.indexOf('Frais inclus'));
    expect(summary.indexOf('Frais inclus')).toBeLessThan(summary.indexOf('<div class="invoice-total">'));
    expect(summary.indexOf('<div class="invoice-total">')).toBeLessThan(summary.indexOf('Mode de paiement'));
    expect(html).toContain('9 500 FCFA');
    expect(summary).toContain('10 000 FCFA');
    expect(html).not.toContain('10 500 FCFA');
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

  it('centers the paid badge and the travel badge in dedicated slots', () => {
    const html = buildInvoiceDocument({ ...data, travelMode: 'CLIENT_SE_DEPLACE' });
    expect(html).toContain('<div class="invoice-status-slot"><span class="invoice-status is-paid"><span class="invoice-badge-text">Payée</span></span>');
    expect(html).toContain('<div class="invoice-mode-slot"><span class="invoice-mode is-client">');
    expect(html).toContain('Client se déplace');
    expect(html).toContain('invoice-mode__icon');
    expect(html).toContain('.invoice-sheet .invoice-badge-text{top:-7px}');
    expect(html).not.toContain('height:28px;line-height:28px');
  });

  it('keeps visible spacing between words throughout the invoice', () => {
    const html = buildInvoiceDocument(data);
    expect(html).toContain('word-spacing:.16em');
    expect(html).toContain('word-spacing:.26em');
    expect(html).toContain('Type de prestation');
    expect(html).toContain('Prestataire se déplace');
    expect(html).toContain('Mode de paiement');
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
