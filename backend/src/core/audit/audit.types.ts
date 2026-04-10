import type { Request } from 'express';
import type { TypeActionAudit } from '@prisma/client';

export interface AuditLogData {
  utilisateurId?: string;
  nomUtilisateur?: string;
  typeAction: TypeActionAudit;
  description: string;
  entiteType?: string;
  entiteId?: string;
  adresseIp?: string;
  userAgent?: string;
  latitude?: number;
  longitude?: number;
  localisationTexte?: string;
}

export interface AuthenticatedRequestUser {
  sub: string;
  role: string;
  phoneNumber: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedRequestUser;
}

export interface RouteInfo {
  path?: string;
}
