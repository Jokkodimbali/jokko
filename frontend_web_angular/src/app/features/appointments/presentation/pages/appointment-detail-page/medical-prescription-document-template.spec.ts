import { AppointmentView } from '../../../domain/appointments.models';
import { buildPersonalizedMedicalPrescription } from './medical-prescription-document-template';

describe('buildPersonalizedMedicalPrescription', () => {
  const appointment = {
    doctorName: 'Dr Ndiaye',
    clientName: 'Awa Diop',
    specialty: 'Médecine générale',
    professionalAddressLabel: 'Dakar',
    professionalPhone: '+221770000000',
    addressLabel: 'Dakar',
    updatedAt: '2026-09-30T12:00:00.000Z',
    scheduledAt: '2026-09-30T10:00:00.000Z',
  } as AppointmentView;

  it('combines the doctor model with the patient prescription', () => {
    const html = buildPersonalizedMedicalPrescription(
      appointment,
      {
        tutelle: 'Ministère de la Santé',
        region: 'Dakar',
        structure: 'Cabinet Test',
        prescripteur: 'Dr Ndiaye',
        qualification: 'Médecin généraliste',
        adresse: 'Dakar',
        telephone: '+221770000000',
        piedDePage: 'Revoir dans 7 jours',
        logoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/jokko/professionals/logo.png',
        signatureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/jokko/professionals/signature.png',
        cachetUrl: 'https://res.cloudinary.com/demo/image/upload/v1/jokko/professionals/cachet.png',
      },
      [{ text: 'Paracétamol 500 mg' }],
    );
    expect(html).toContain('Cabinet Test');
    expect(html).toContain('Awa Diop');
    expect(html).toContain('Paracétamol 500 mg');
    expect(html).toContain('<span>Dakar</span>');
    expect(html).toContain('<span>+221770000000</span>');
    expect(html).toContain('font-size:18px');
    expect(html).toContain('word-spacing:.15em');
    expect(html).toContain('Revoir dans 7 jours');
    expect(html).toContain('professionals/logo.png');
    expect(html).toContain('professionals/signature.png');
    expect(html).toContain('professionals/cachet.png');
    expect(html).not.toContain('1. Paracétamol');
    expect(html).not.toContain('>Traitement</div>');
    expect(html.indexOf('class="custom-prescription__signatures"')).toBeLessThan(
      html.indexOf('class="custom-prescription__footer"'),
    );
    expect(html).not.toContain('Cabinet médical Jokko Dimbali');
  });

  it('adds a dash to each non-empty prescription line', () => {
    const html = buildPersonalizedMedicalPrescription(
      appointment,
      null,
      [{ text: 'Première ligne\nDeuxième ligne' }],
    );
    expect(html.match(/>–<\/span>/g)).toHaveLength(2);
    expect(html).toContain('Première ligne');
    expect(html).toContain('Deuxième ligne');
  });

  it('escapes patient and prescription text', () => {
    const html = buildPersonalizedMedicalPrescription(
      { ...appointment, clientName: '<script>alert(1)</script>' },
      null,
      [{ text: '<img src=x onerror=alert(1)>' }],
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});
