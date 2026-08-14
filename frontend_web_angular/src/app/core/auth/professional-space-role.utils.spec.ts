import { describe, expect, it } from 'vitest';
import { UserDto } from '../../features/auth/domain/models/auth.models';
import { isDoctorAccount, isProviderAccount } from './professional-space-role.utils';

function professionalUser(role: 'PRESTATAIRE' | 'MEDECIN', categories: string[]): UserDto {
  return {
    id: 'user-id',
    phoneNumber: '+221770000000',
    name: 'Compte professionnel',
    role,
    professionalProfile: {
      id: 'profile-id',
      nomEntreprise: 'Tiak Tiak Sante Express',
      categories,
    },
  };
}

describe('professional space role', () => {
  it('never classifies a provider as a doctor from its name or categories', () => {
    const provider = professionalUser('PRESTATAIRE', ['Sante', 'Medecine', 'Livraison']);

    expect(isDoctorAccount(provider)).toBe(false);
    expect(isProviderAccount(provider)).toBe(true);
  });

  it('classifies a doctor only from the persisted doctor role', () => {
    const doctor = professionalUser('MEDECIN', ['Medecine generale']);

    expect(isDoctorAccount(doctor)).toBe(true);
    expect(isProviderAccount(doctor)).toBe(false);
  });
});
