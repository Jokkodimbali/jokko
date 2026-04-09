import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TypeActionAudit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AuthenticatedRequest,
  AuthenticatedRequestUser,
  RouteInfo,
} from './audit.types';

const ACTION_MAP: Record<string, TypeActionAudit> = {
  '/auth/login': 'CONNEXION',
  '/auth/logout': 'DECONNEXION',
  '/kyc': 'KYC_SOUMISSION',
  '/kyc/approve': 'KYC_APPROBATION',
  '/kyc/reject': 'KYC_REJET',
  '/payments': 'PAIEMENT',
  '/payments/withdraw': 'RETRAIT',
  '/bookings': 'RESERVATION_CREATION',
  '/bookings/confirm': 'RESERVATION_CONFIRMATION',
  '/bookings/cancel': 'RESERVATION_ANNULATION',
  '/disputes': 'LITIGE_OUVERTURE',
  '/disputes/resolve': 'LITIGE_RESOLUTION',
};

const METHOD_ACTION_MAP: Record<string, TypeActionAudit> = {
  GET: 'CONNEXION',
  POST: 'CREATION',
  PATCH: 'MODIFICATION',
  PUT: 'MODIFICATION',
  DELETE: 'SUPPRESSION',
};

const ENTITY_PATTERNS: Record<string, string> = {
  '/users': 'USER',
  '/professionals': 'PROFESSIONAL',
  '/services': 'SERVICE',
  '/bookings': 'BOOKING',
  '/payments': 'PAYMENT',
  '/categories': 'CATEGORY',
  '/conversations': 'CONVERSATION',
  '/notifications': 'NOTIFICATION',
};

@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLoggerMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const originalEnd = res.end.bind(res);

    res.end = (chunk?: unknown, encoding?: unknown) => {
      void this.logAudit(req, res, Date.now() - startTime);
      return originalEnd(chunk as string, encoding as BufferEncoding);
    };

    next();
  }

  private async logAudit(
    req: AuthenticatedRequest,
    res: Response,
    duration: number,
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const route = req.route as RouteInfo | undefined;
      const normalizedPath = req.originalUrl.toLowerCase();
      const actionType = this.mapMethodToAction(req.method, normalizedPath);
      const entityInfo = this.extractEntityInfo(
        normalizedPath,
        req.params as Record<string, string>,
      );

      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: userId,
          typeAction: actionType,
          description: `${req.method} ${route?.path ?? req.path} - ${res.statusCode} (${duration}ms)`,
          entiteType: entityInfo.entityType,
          entiteId: entityInfo.entityId,
          adresseIp: req.ip ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`Failed to write audit log: ${errorMessage}`);
    }
  }

  private mapMethodToAction(method: string, path: string): TypeActionAudit {
    const exactMatch = ACTION_MAP[path];
    if (exactMatch) return exactMatch;

    for (const [pattern, action] of Object.entries(ACTION_MAP)) {
      if (path.includes(pattern)) return action;
    }

    return METHOD_ACTION_MAP[method] ?? 'CREATION';
  }

  private extractEntityInfo(
    path: string,
    params: Record<string, string>,
  ): { entityType?: string; entityId?: string } {
    for (const [pattern, entityType] of Object.entries(ENTITY_PATTERNS)) {
      if (path.includes(pattern)) {
        return { entityType, entityId: params.id };
      }
    }
    return {};
  }
}
