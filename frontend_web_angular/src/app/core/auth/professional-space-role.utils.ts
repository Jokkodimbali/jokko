import { UserDto } from '../../features/auth/domain/models/auth.models';

type AccountRoleSource = Pick<UserDto, 'role'> | null | undefined;

/** Professional spaces are selected exclusively from the persisted account role. */
export function isDoctorAccount(user: AccountRoleSource): boolean {
  return user?.role === 'MEDECIN';
}

export function isProviderAccount(user: AccountRoleSource): boolean {
  return user?.role === 'PRESTATAIRE';
}
