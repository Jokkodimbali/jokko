import type { Request } from 'express';
import type { TypeActionAudit } from '@prisma/client';

export interface AuditLogData {
  utilisateurId?: string;
  typeAction: TypeActionAudit;
  description: string;
  entiteType?: string;
  entiteId?: string;
}

export interface AuthenticatedRequestUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedRequestUser;
}

export interface RouteInfo {
  path?: string;
}
