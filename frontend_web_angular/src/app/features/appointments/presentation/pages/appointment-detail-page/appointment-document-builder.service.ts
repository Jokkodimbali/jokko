import { Injectable } from '@angular/core';
import {
  AppointmentView,
  MedicalPrescriptionPayload,
} from '../../../domain/appointments.models';

export interface MissionInvoiceDocumentData {
  appointment: AppointmentView;
  subtotal: number;
  isParcelTransport: boolean;
}

export interface MedicalReceiptDocumentData {
  appointment: AppointmentView;
  acts: string[];
  vaccines: string[];
  invoiceCodeLabel: string;
  finalPriceAmount: number;
  medicalTotalLabel: string;
  generatedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentDocumentBuilderService {
  buildMissionInvoiceHtml(data: MissionInvoiceDocumentData): string {
    const { appointment, subtotal, isParcelTransport } = data;
    const issuedAt = new Date();
    const commissionRate = 5;
    const commissionAmount = Math.round(subtotal * commissionRate) / 100;
    const totalAmount = subtotal + commissionAmount;
    const serviceLabel = isParcelTransport ? 'Transport de colis' : appointment.serviceName;

    return `
      <article class="mission-invoice">
        <header class="mission-invoice__header">
          <div class="mission-invoice__brand">
            <img src="${this.escapeHtml(this.invoiceLogoUrl())}" alt="Jokko Dimbali">
            <h1>Jokko Dimbali</h1>
          </div>
          <div class="mission-invoice__meta">
            <span>Facture</span>
            <strong>${this.escapeHtml(this.missionInvoiceReference(appointment))}</strong>
            <small>${this.escapeHtml(this.formatInvoiceIssueDate(issuedAt))}</small>
          </div>
        </header>

        <section class="mission-invoice__parties">
          <div class="mission-invoice__party">
            <small>Client</small>
            <strong>${this.escapeHtml(appointment.clientName)}</strong>
            <p>${this.escapeHtml(appointment.addressLabel || 'Adresse non renseignee')}</p>
            <p>${this.escapeHtml(appointment.clientPhone || 'Telephone non renseigne')}</p>
          </div>
          <div class="mission-invoice__party">
            <small>Prestataire</small>
            <strong>${this.escapeHtml(appointment.doctorName)}</strong>
            <p>${this.escapeHtml(appointment.specialty || appointment.serviceCategoryName || 'Professionnel Jokko')}</p>
            <p>${this.escapeHtml(appointment.professionalPhone || 'Telephone non renseigne')}</p>
          </div>
        </section>

        <section class="mission-invoice__body">
          <div class="mission-invoice__notice">
            <span class="mission-invoice__pin" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="9" r="2.4" stroke-width="2"/>
              </svg>
            </span>
            <p>
              <b>${this.escapeHtml(this.travelModeInvoiceTitle(appointment))}</b>
              ${this.escapeHtml(this.travelModeInvoiceDescription(appointment))}
            </p>
          </div>

          <div class="mission-invoice__table-head">
            <span>Designation</span>
            <span class="right">Qte / Duree</span>
            <span class="right">Montant</span>
          </div>
          <div class="mission-invoice__row">
            <strong>${this.escapeHtml(serviceLabel)}</strong>
            <span class="right">Forfait</span>
            <strong class="right">${this.escapeHtml(this.formatCurrency(subtotal))}</strong>
          </div>
          <div class="mission-invoice__row">
            <strong>Duree de la prestation</strong>
            <span class="right"></span>
            <span class="right">${this.escapeHtml(this.invoiceDurationLabel(appointment))}</span>
          </div>

          <section class="mission-invoice__summary">
            <div class="mission-invoice__summary-line">
              <span>Sous-total</span>
              <strong>${this.escapeHtml(this.formatCurrency(subtotal))}</strong>
            </div>
            <div class="mission-invoice__summary-line mission-invoice__commission">
              <span>Commission Jokko Dimbali (${commissionRate}%)</span>
              <strong>${this.escapeHtml(this.formatCurrency(commissionAmount))}</strong>
            </div>
            <div class="mission-invoice__total">
              <span>Total a payer</span>
              <strong>${this.escapeHtml(this.formatCurrency(totalAmount))}</strong>
            </div>
          </section>
        </section>

        <footer class="mission-invoice__footer">
          <span>Merci de faire confiance a <b>Jokko Dimbali</b></span>
          <span>jokko-dimbali.sn &middot; Dakar, Senegal</span>
        </footer>
      </article>
    `;
  }

  buildMedicalReceiptHtml(data: MedicalReceiptDocumentData): string {
    const actsRows = data.acts
      .map(
        (act, index) => `<tr><td>${this.escapeHtml(act)}</td><td class="right">1</td><td class="right">${this.escapeHtml(
          this.formatCurrency(index === 0 ? data.finalPriceAmount : 5000),
        )}</td></tr>`,
      )
      .join('');
    const vaccinesRows = data.vaccines
      .map(
        (vaccine) => `<tr><td>${this.escapeHtml(vaccine)}</td><td class="right">1</td><td class="right">${this.escapeHtml(
          this.formatCurrency(3000),
        )}</td></tr>`,
      )
      .join('');

    return `
      <div class="top">
        <div>
          <h1>Recu medical</h1>
          <p class="muted">Reference ${this.escapeHtml(data.invoiceCodeLabel)}</p>
          <p>Jokko Dimbali</p>
        </div>
        <div class="right">
          <p><strong>Date</strong></p>
          <p>${this.escapeHtml(this.formatLongDateTime(data.generatedAtIso))}</p>
        </div>
      </div>
      <section class="box">
        <p><strong>Patient:</strong> ${this.escapeHtml(data.appointment.clientName)}</p>
        <p><strong>Medecin:</strong> ${this.escapeHtml(data.appointment.doctorName)}</p>
        <p><strong>Motif:</strong> ${this.escapeHtml(data.appointment.serviceName)}</p>
        <p><strong>Adresse:</strong> ${this.escapeHtml(data.appointment.addressLabel)}</p>
      </section>
      <h2>Detail des honoraires</h2>
      <table>
        <thead><tr><th>Libelle</th><th class="right">Qte</th><th class="right">Montant</th></tr></thead>
        <tbody>${actsRows}${vaccinesRows}</tbody>
      </table>
      <p class="right total">Total paye: ${this.escapeHtml(data.medicalTotalLabel)}</p>
      <p class="muted">Document genere automatiquement depuis le dossier de consultation Jokko.</p>
    `;
  }

  buildMedicalPrescriptionHtml(
    appointment: AppointmentView,
    prescription: MedicalPrescriptionPayload,
  ): string {
    const issuedAt = new Date();
    const prescriptionItems = this.medicalPrescriptionItems(prescription);

    return `
      <article class="medical-prescription">
        <header class="medical-prescription__header">
          <div class="medical-prescription__doctor">
            <small>${this.escapeHtml(appointment.specialty || 'Medecin generaliste')}</small>
            <h1>${this.escapeHtml(appointment.doctorName)}</h1>
            <p>${this.escapeHtml(appointment.professionalAddressLabel || 'Cabinet medical Jokko Dimbali, Dakar')}</p>
            <p>${this.escapeHtml(appointment.professionalPhone || 'Telephone non renseigne')}</p>
          </div>
          <div class="medical-prescription__meta">
            <span>Ref.</span>
            <strong>${this.escapeHtml(this.medicalPrescriptionReference(appointment))}</strong>
            <small>${this.escapeHtml(this.formatInvoiceIssueDate(issuedAt))}</small>
          </div>
        </header>

        <section class="medical-prescription__banner">
          <h2>Ordonnance medicale</h2>
        </section>

        <section class="medical-prescription__body">
          <section class="medical-prescription__patient">
            <div>
              <small>Patient</small>
              <strong>${this.escapeHtml(appointment.clientName)}</strong>
              <span>Date de naissance non renseignee</span>
            </div>
            <div>
              <em>${this.escapeHtml(appointment.clientPhone || 'Telephone non renseigne')}</em>
              <em>${this.escapeHtml(appointment.addressLabel || 'Adresse non renseignee')}</em>
            </div>
          </section>

          <h3 class="medical-prescription__section-title">Prescriptions</h3>
          ${
            prescriptionItems.length
              ? `<ol class="medical-prescription__list">${prescriptionItems
                  .map((item) => `<li class="medical-prescription__item"><span>${item}</span></li>`)
                  .join('')}</ol>`
              : '<p class="medical-prescription__empty">Aucune prescription renseignee sur cette ordonnance.</p>'
          }
        </section>

        <footer class="medical-prescription__footer">
          <div class="medical-prescription__signature">
            <span>Cachet &amp; Signature du medecin</span>
            <strong>Signature</strong>
          </div>
          <div class="medical-prescription__generated">
            <span>Document genere via</span>
            <div class="medical-prescription__brand">
              <img src="${this.escapeHtml(this.invoiceLogoUrl())}" alt="Jokko Dimbali">
              <div>
                <b>Jokko Dimbali</b>
                <small>jokko-dimbali.sn</small>
              </div>
            </div>
          </div>
        </footer>
      </article>
    `;
  }

  private missionInvoiceReference(appointment: AppointmentView): string {
    const compact = appointment.id.replace(/-/g, '').toUpperCase();
    return `JD-${new Date().getFullYear()}-${compact.slice(-5) || '00000'}`;
  }

  private invoiceLogoUrl(): string {
    return `${globalThis.location?.origin || ''}/logojokko.png`;
  }

  private formatInvoiceIssueDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .replace(/^\w/, (first) => first.toUpperCase());
  }

  private invoiceDurationLabel(appointment: AppointmentView): string {
    const minutes = appointment.durationMinutes || 30;
    if (minutes >= 60 && minutes % 60 === 0) {
      return `${minutes / 60} heure${minutes >= 120 ? 's' : ''}`;
    }
    return `${minutes} minutes`;
  }

  private travelModeInvoiceTitle(appointment: AppointmentView): string {
    if (appointment.travelMode === 'CLIENT_SE_DEPLACE') {
      return 'Deplacement - client chez le prestataire';
    }
    if (appointment.travelMode === 'TRANSPORT_COLIS') {
      return 'Deplacement - transport de colis';
    }
    return 'Deplacement - prestataire chez le client';
  }

  private travelModeInvoiceDescription(appointment: AppointmentView): string {
    if (appointment.travelMode === 'CLIENT_SE_DEPLACE') {
      return `Le client ${appointment.clientName} s'est deplace chez le prestataire ${appointment.doctorName} a l'adresse : ${appointment.addressLabel}.`;
    }
    if (appointment.travelMode === 'TRANSPORT_COLIS') {
      return `La mission de transport a ete realisee par ${appointment.doctorName} pour le client ${appointment.clientName}. Adresse reference : ${appointment.addressLabel}.`;
    }
    return `Le prestataire ${appointment.doctorName} s'est deplace chez le client ${appointment.clientName} a l'adresse : ${appointment.addressLabel}.`;
  }

  private medicalPrescriptionItems(prescription: MedicalPrescriptionPayload): string[] {
    return [
      ...prescription.treatments.map((treatment) => `<b>${this.escapeHtml(treatment)}</b>`),
      ...prescription.vaccines.map((vaccine) => `<b>${this.escapeHtml(vaccine)}</b> Vaccin administre`),
      ...prescription.acts.map((act) => `<b>${this.escapeHtml(act)}</b> Acte clinique realise`),
    ];
  }

  private medicalPrescriptionReference(appointment: AppointmentView): string {
    const compact = appointment.id.replace(/-/g, '').toUpperCase();
    return `ORD-${new Date().getFullYear()}-${compact.slice(-5) || '00000'}`;
  }

  private formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    })
      .format(value || 0)
      .replace(/\s/g, ' ')} FCFA`;
  }

  private formatLongDateTime(value: string | null | undefined): string {
    if (!value) return 'date non renseignee';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'date non renseignee';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
