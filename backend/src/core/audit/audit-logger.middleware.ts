import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { Prisma, type TypeActionAudit } from '@prisma/client';
import type { NextFunction, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest, RouteInfo } from './audit.types';
import { TECHNICAL_MESSAGES } from '../messages/technical-message.catalog';

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLoggerMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    res.on('finish', () => {
      void this.logAudit(req, res, Date.now() - startTime);
    });

    next();
  }

  private async logAudit(
    req: AuthenticatedRequest,
    res: Response,
    duration: number,
  ): Promise<void> {
    try {
      const userId = req.user?.sub;
      const route = req.route as RouteInfo | undefined;
      const normalizedPath = req.originalUrl.toLowerCase();
      const actionType = this.mapMethodToAction(req.method, normalizedPath);
      const entityInfo = this.extractEntityInfo(
        normalizedPath,
        req.params as Record<string, string>,
      );
      const userContext = await this.resolveUserContext(userId);
      const geoContext = this.extractGeoContext(req);

      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: userId,
          nomUtilisateur: userContext?.nom,
          typeAction: actionType,
          description: `${req.method} ${route?.path ?? req.path} - ${res.statusCode} (${duration}ms)`,
          entiteType: entityInfo.entityType,
          entiteId: entityInfo.entityId,
          adresseIp: req.ip ?? req.socket.remoteAddress,
          userAgent: this.normalizeHeaderValue(req.headers['user-agent']),
          latitude:
            geoContext.latitude === undefined
              ? undefined
              : new Prisma.Decimal(geoContext.latitude),
          longitude:
            geoContext.longitude === undefined
              ? undefined
              : new Prisma.Decimal(geoContext.longitude),
          localisationTexte: geoContext.localisationTexte,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.AUDIT_LOG_WRITE_FAILED(errorMessage),
      );
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
        const entityId =
          params.id && !params.id.startsWith(':') ? params.id : undefined;
        return {
          entityType,
          entityId: this.normalizeUuid(entityId),
        };
      }
    }
    return {};
  }

  private normalizeUuid(value: string | undefined): string | undefined {
    if (!value) return undefined;
    return UUID_PATTERN.test(value) ? value : undefined;
  }

  private async resolveUserContext(
    userId?: string,
  ): Promise<{ nom: string } | null> {
    if (!userId) {
      return null;
    }

    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { nom: true },
    });
  }

  private extractGeoContext(req: AuthenticatedRequest): {
    latitude?: number;
    longitude?: number;
    localisationTexte?: string;
  } {
    // The mobile app can send exact device coordinates when the user consented.
    const latitude = this.parseCoordinate(
      req.headers['x-user-latitude'],
      -90,
      90,
    );
    const longitude = this.parseCoordinate(
      req.headers['x-user-longitude'],
      -180,
      180,
    );
    const locationLabel = req.headers['x-user-location-label'];

    return {
      latitude,
      longitude,
      localisationTexte:
        typeof locationLabel === 'string' && locationLabel.trim().length > 0
          ? locationLabel.trim()
          : undefined,
    };
  }

  private parseCoordinate(
    value: unknown,
    min: number = Number.NEGATIVE_INFINITY,
    max: number = Number.POSITIVE_INFINITY,
  ): number | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      return undefined;
    }

    return parsed;
  }

  private normalizeHeaderValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return undefined;
  }
}
