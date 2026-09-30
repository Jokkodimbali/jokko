import { AppointmentView } from '../../../domain/appointments.models';
import { MedicalPrescriptionTemplate } from '../../../domain/medical-prescription-template';

type Item = { text: string };

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeImage = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url, globalThis.location?.origin ?? 'https://jokko.invalid');
    return ['https:', 'http:'].includes(parsed.protocol) ? escapeHtml(parsed.href) : '';
  } catch {
    return '';
  }
};

export function buildPersonalizedMedicalPrescription(
  appointment: AppointmentView,
  template: MedicalPrescriptionTemplate | null | undefined,
  items: Item[],
): string {
  const model = template ?? ({} as Partial<MedicalPrescriptionTemplate>);
  const doctor = escapeHtml(model.prescripteur?.trim() || appointment.doctorName);
  const issued = new Date(appointment.scheduledAt);
  const date = Number.isNaN(issued.getTime())
    ? ''
    : new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(issued);
  const address = model.adresse || appointment.professionalAddressLabel;
  const phone = model.telephone || appointment.professionalPhone;
  const prescriptionLines = items.flatMap((item) =>
    item.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  );
  const logo = safeImage(model.logoUrl);
  const signature = safeImage(model.signatureUrl);
  const stamp = safeImage(model.cachetUrl);

  return `
    <article class="medical-prescription custom-prescription" style="box-sizing:border-box;border:0;color:#1d2b38;display:flex;flex-direction:column;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.45;min-height:1123px;padding:58px 47px 28px;width:794px">
      <header style="display:flex;justify-content:space-between;gap:20px">
        <div style="display:flex;gap:13px;min-width:0">
          ${logo ? `<img src="${logo}" alt="Logo du médecin" style="height:56px;object-fit:contain;width:56px">` : ''}
          <div style="min-width:0">
            <div style="color:#4b575f;font-size:11px;letter-spacing:.04em;text-transform:uppercase">${escapeHtml(model.tutelle || '')}</div>
            <div style="color:#4b575f;font-size:11px;letter-spacing:.04em;text-transform:uppercase">${escapeHtml(model.region || '')}</div>
            <strong style="display:block;font-size:17px;margin-top:4px">${escapeHtml(model.structure || '')}</strong>
            <b style="display:block;font-size:15px">${doctor}</b>
            <div>${escapeHtml(model.qualification || appointment.specialty || '')}</div>
            <div class="custom-prescription__contact" style="color:#4b575f;display:grid;gap:4px;line-height:1.55;margin-top:6px;word-spacing:.14em">
              ${address ? `<span>${escapeHtml(address)}</span>` : ''}
              ${phone ? `<span>${escapeHtml(phone)}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:grid;flex:0 0 38%;gap:7px;min-width:0">
          <div style="border-bottom:1px dotted #9db0bf">Date : <b>${escapeHtml(date)}</b></div>
          <div style="border-bottom:1px dotted #9db0bf">Patient : <b>${escapeHtml(appointment.clientName)}</b></div>
          <div style="border-bottom:1px dotted #9db0bf">Adresse : <b>${escapeHtml(appointment.patientAddress || '')}</b></div>
        </div>
      </header>
      <h1 style="align-self:center;border:2px solid #1d2b38;font-size:21px;letter-spacing:.07em;margin:34px 0 30px;padding:8px 33px">ORDONNANCE</h1>
      <div style="flex:1;min-height:0">
        ${prescriptionLines
          .map(
            (line) => `
          <div class="custom-prescription__item" style="align-items:baseline;break-inside:avoid;display:flex;font-size:18px;gap:11px;line-height:1.55;margin-bottom:16px;overflow-wrap:anywhere">
            <span aria-hidden="true" style="flex:0 0 auto">–</span><span style="white-space:pre-wrap">${escapeHtml(line)}</span>
          </div>`,
          )
          .join('')}
        ${prescriptionLines.length ? '' : '<p>Aucune prescription renseignée.</p>'}
      </div>
      <div class="custom-prescription__signatures" style="align-self:flex-end;break-inside:avoid;min-height:130px;text-align:center;width:48%">
        <small style="color:#4b575f;display:block;margin-bottom:7px">Signature et cachet</small>
        <div style="align-items:center;display:flex;justify-content:center;min-height:90px">
          ${signature ? `<img src="${signature}" alt="Signature du médecin" style="max-height:90px;max-width:55%;object-fit:contain">` : ''}
          ${stamp ? `<img src="${stamp}" alt="Cachet du médecin" style="max-height:90px;max-width:55%;object-fit:contain">` : ''}
        </div>
      </div>
      <footer class="custom-prescription__footer" style="border-top:1px solid #1d2b38;font-size:13px;font-style:italic;letter-spacing:.015em;line-height:1.6;margin-top:18px;padding-top:10px;text-align:center;word-spacing:.15em">${escapeHtml(model.piedDePage || '')}</footer>
    </article>
  `;
}
