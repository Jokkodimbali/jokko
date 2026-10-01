export interface InvoiceTemplate {
  brandName: string;
  footerText: string;
  feesLabel: string;
  logoUrl: string;
  signatureUrl: string;
  stampUrl: string;
}

export interface InvoiceDocument {
  template: InvoiceTemplate;
  reference: string;
  issuedAt: string;
  serviceDate: string | null;
  provider: { name: string; subtitle?: string; phone: string; address: string };
  client: { name: string; subtitle?: string; phone: string; address: string };
  travelMode: string;
  location: string;
  parcel?: { pickup: { name: string; phone: string; address: string }; dropoff: { name: string; phone: string; address: string } } | null;
  items: Array<{ name: string; quantity: number; amount: number }>;
  total: number;
  includedFees: number | null;
  paymentStatus: string;
  paymentMethod: string | null;
  durationMinutes: number | null;
}

export function buildInvoiceDocument(data: InvoiceDocument): string {
  const template = data.template;
  const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  const money = (value: number): string =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value).replace(/\s/g, ' ') + ' FCFA';
  const date = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' :
      new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' }).format(parsed);
  };
  // Only application assets and imported Cloudinary images may enter the HTML.
  const imageUrl = (value: string): string => {
    if (value === '/logojokko.png') return (globalThis.location?.origin || '') + value;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
          /^\/[^/]+\/image\/upload\/(?:v\d+\/)?jokko\/invoices\//.test(url.pathname)) return url.href;
    } catch { /* Invalid images are omitted, never interpreted as HTML. */ }
    return '';
  };
  const image = (url: string, label: string, className: string): string => {
    const safe = imageUrl(url);
    return safe ? `<img class="${className}" src="${escape(safe)}" alt="${escape(label)}" crossorigin="anonymous">` : '';
  };
  const status: Record<string, string> = {
    SUCCES: 'Payée', EN_ATTENTE: 'À payer', ECHEC: 'Paiement échoué', REMBOURSE: 'Remboursée',
  };
  const modes: Record<string, string> = {
    CLIENT_SE_DEPLACE: 'Client se déplace', PRESTATAIRE_SE_DEPLACE: 'Prestataire se déplace',
    TRANSPORT_COLIS: 'Transport de colis',
  };
  const modeStyles: Record<string, string> = {
    CLIENT_SE_DEPLACE: 'is-client', PRESTATAIRE_SE_DEPLACE: 'is-provider', TRANSPORT_COLIS: 'is-parcel',
  };
  const modeIcons: Record<string, string> = {
    CLIENT_SE_DEPLACE: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    PRESTATAIRE_SE_DEPLACE: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    TRANSPORT_COLIS: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12m-8.7-5 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
  };
  const modeIcon = modeIcons[data.travelMode]
    ? `<svg class="invoice-mode__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${modeIcons[data.travelMode]}</svg>`
    : '';
  const methods: Record<string, string> = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', CARTE: 'Carte bancaire' };
  const party = (label: string, value: InvoiceDocument['client'], className: string) =>
    `<section class="invoice-party ${className}"><span class="invoice-caption">${label}</span><strong>${escape(value.name)}</strong>${value.subtitle ? `<p class="invoice-profession">${escape(value.subtitle)}</p>` : ''}${value.phone ? `<p>${escape(value.phone)}</p>` : ''}${value.address ? `<p>${escape(value.address)}</p>` : ''}</section>`;
  // The payment commission is already part of the charged amount. Split the
  // single reservation line for display, never add the commission to the total.
  const splitIncludedFees = data.includedFees !== null && Number.isFinite(data.includedFees) &&
    data.includedFees >= 0 && data.includedFees <= data.total && data.items.length === 1 &&
    Math.abs(data.items[0].amount - data.total) < 0.01;
  const serviceAmount = splitIncludedFees ? data.total - data.includedFees! : data.total;
  return `<style>
.system-invoice,.system-invoice *{box-sizing:border-box}
.system-invoice{font-family:Inter,Arial,sans-serif;background:#fff;color:#294056;width:794px;min-height:1123px;padding:44px 48px 30px;display:flex;flex-direction:column;font-size:14px;line-height:1.5;word-spacing:.16em;letter-spacing:normal}
.system-invoice p{margin:5px 0;line-height:1.55;white-space:pre-line}
.system-invoice h1{font-size:30px;letter-spacing:.12em;font-weight:800;color:#865221;margin:0 0 8px;line-height:1.2}
.system-invoice strong{font-weight:700}
.invoice-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:30px}
.invoice-logo{width:104px;height:104px;object-fit:contain;border-radius:12px;background:#faf7f3}
.invoice-heading{flex:0 0 230px;min-width:0;margin-left:auto;text-align:center}
.invoice-reference{font-size:11px;overflow-wrap:anywhere;color:#667085}
.invoice-status-slot{display:flex;align-items:center;justify-content:center;width:100%;margin-top:8px}
.invoice-status{display:flex;align-items:center;justify-content:center;height:28px;line-height:1;text-align:center;white-space:nowrap;background:#f3e9df;color:#865221;font-size:12px;font-weight:700;padding:0 12px;border-radius:20px}
.invoice-badge-text{display:block;line-height:1;position:relative;top:-1px}
/* html2canvas places glyphs lower than the browser in the PDF capture frame. */
.invoice-sheet .invoice-badge-text{top:-7px}
.invoice-status.is-paid{color:#127a86;background:#e4f4f6}
.invoice-parties{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-bottom:24px}
.invoice-party{padding:19px 22px;border-radius:14px;overflow-wrap:anywhere}
.invoice-provider{background:#f3e9df}.invoice-client{background:#e4f4f6}
.invoice-caption{display:block;font-size:11px;font-weight:700;letter-spacing:.09em;word-spacing:.26em;text-transform:uppercase;color:#865221;margin-bottom:8px}
.invoice-client .invoice-caption{color:#287884}.invoice-party strong{display:block;font-size:18px;margin-bottom:7px}
.invoice-party p{font-size:13px}.invoice-profession{font-weight:600}
.invoice-location{border:1px solid #e7ded3;border-radius:12px;padding:16px 20px;margin-bottom:25px;overflow-wrap:anywhere}
.invoice-location__head{display:flex;align-items:center;justify-content:space-between;gap:14px}.invoice-location__head .invoice-caption{margin:0}
.invoice-mode-slot{display:flex;align-items:center;justify-content:center;min-width:210px;max-width:60%}
.invoice-mode{display:flex;align-items:center;justify-content:center;gap:5px;height:28px;line-height:1;text-align:center;white-space:nowrap;font-size:12px;font-weight:700;color:#865221;background:#f3e9df;border-radius:999px;padding:0 12px}
.invoice-mode__icon{display:block;flex:none}
.invoice-mode.is-client{background:#fadbd8;color:#a8322a}.invoice-mode.is-provider{background:#d6efd8;color:#1f6b33}.invoice-mode.is-parcel{background:#f3e6d6;color:#865221}
.invoice-location p{color:#53636d;font-size:13px}
.invoice-route{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:11px}
.invoice-route strong{font-size:13px;color:#865221}.invoice-route>div+div strong{color:#287884}
.invoice-route p{margin:3px 0;font-size:12px}
.system-invoice table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}
.system-invoice th{text-align:left;background:#f7f3ee;color:#865221;padding:12px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;border:0}
.system-invoice th:first-child{width:60%}.system-invoice th:nth-child(2){width:10%}
.system-invoice td{padding:15px 14px;border:0;border-bottom:1px solid #ece7e1;vertical-align:top;overflow-wrap:anywhere}
.system-invoice .invoice-money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.invoice-summary{width:360px;max-width:100%;margin:24px 0 26px auto}
.invoice-summary-row{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center;gap:16px;min-height:24px;padding:3px 0;font-size:12px;line-height:1.5;color:#60717d}
.invoice-summary-row strong{color:#294056;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.invoice-total{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#865221;color:#fff;padding:12px 20px;border-radius:12px;font-size:16px;margin:10px 0 5px;min-height:54px}
.invoice-total strong{font-size:21px;white-space:nowrap}
.invoice-bottom{margin-top:auto;padding-top:20px}
.invoice-auth{display:flex;align-items:flex-end;justify-content:flex-end;gap:28px;margin-bottom:24px;break-inside:avoid}
.invoice-auth figure{margin:0;text-align:center;max-width:180px}
.invoice-auth img{display:block;object-fit:contain;width:160px;height:100px}
.invoice-auth figcaption{font-size:11px;color:#667085;margin-top:8px}
.invoice-footer{border-top:1px solid #e7ded3;padding-top:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:30px;font-size:12px;overflow-wrap:anywhere}
.invoice-footer strong{color:#865221;max-width:45%}.invoice-footer span{color:#71808a;text-align:right;max-width:55%}
.invoice-row,.invoice-parties,.invoice-location,.invoice-summary,.invoice-footer{break-inside:avoid}
</style>
<article class="system-invoice">
  <header class="invoice-header">
    <div>${image(template.logoUrl, template.brandName, 'invoice-logo')}</div>
    <div class="invoice-heading"><h1>Facture</h1><div class="invoice-reference">N° ${escape(data.reference)}</div><p>${escape(date(data.issuedAt))}</p><div class="invoice-status-slot"><span class="invoice-status ${data.paymentStatus === 'SUCCES' ? 'is-paid' : ''}"><span class="invoice-badge-text">${escape(status[data.paymentStatus] || 'Statut non renseigné')}</span></span></div></div>
  </header>
  <div class="invoice-parties">${party('Prestataire', data.provider, 'invoice-provider')}${party('Client', data.client, 'invoice-client')}</div>
  <section class="invoice-location"><div class="invoice-location__head"><span class="invoice-caption">Type de prestation</span><div class="invoice-mode-slot"><span class="invoice-mode ${modeStyles[data.travelMode] || ''}">${modeIcon}<span class="invoice-badge-text">${escape(modes[data.travelMode] || 'Prestation')}</span></span></div></div>
    ${data.parcel ? `<div class="invoice-route"><div><strong>Retrait du colis</strong><p>${escape(data.parcel.pickup.name)}</p><p>${escape(data.parcel.pickup.phone)}</p><p>${escape(data.parcel.pickup.address)}</p></div><div><strong>Dépôt du colis</strong><p>${escape(data.parcel.dropoff.name)}</p><p>${escape(data.parcel.dropoff.phone)}</p><p>${escape(data.parcel.dropoff.address)}</p></div></div>` : data.location ? `<p>${escape(data.location)}</p>` : ''}
    ${data.serviceDate ? `<p>Prestation du ${escape(date(data.serviceDate))}${data.durationMinutes ? ` · ${escape(data.durationMinutes)} min` : ''}</p>` : ''}
  </section>
  <table><thead><tr><th>Motif / prestation</th><th>Qté</th><th class="invoice-money">Montant</th></tr></thead><tbody>
    ${data.items.map(item => `<tr class="invoice-row"><td>${escape(item.name)}</td><td>${escape(item.quantity)}</td><td class="invoice-money">${escape(money(splitIncludedFees ? serviceAmount : item.amount))}</td></tr>`).join('')}
  </tbody></table>
  <section class="invoice-summary">
    <div class="invoice-summary-row invoice-subtotal"><span>${data.items.length > 1 ? 'Sous-total des articles et services' : 'Prix de la prestation'}</span><strong>${escape(money(serviceAmount))}</strong></div>
    ${data.includedFees !== null ? `<div class="invoice-summary-row invoice-fees"><span>${escape(template.feesLabel || 'Frais de service inclus')}</span><strong>${escape(money(data.includedFees))}</strong></div>` : ''}
    <div class="invoice-total"><span>Total</span><strong>${escape(money(data.total))}</strong></div>
    <div class="invoice-summary-row invoice-payment"><span>Mode de paiement</span><strong>${escape(data.paymentMethod ? methods[data.paymentMethod] || data.paymentMethod : 'Non renseigné')}</strong></div>
  </section>
  <div class="invoice-bottom">
    <div class="invoice-auth">
      ${imageUrl(template.signatureUrl) ? `<figure>${image(template.signatureUrl, 'Signature du système', '')}<figcaption>Signature</figcaption></figure>` : ''}
      ${imageUrl(template.stampUrl) ? `<figure>${image(template.stampUrl, 'Cachet du système', '')}<figcaption>Cachet</figcaption></figure>` : ''}
    </div>
    <footer class="invoice-footer"><strong>${escape(template.brandName)}</strong><span>${escape(template.footerText)}</span></footer>
  </div>
</article>`;
}
