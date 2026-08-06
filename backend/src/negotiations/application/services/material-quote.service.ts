import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  RoleNegociateur,
  StatutDevisMateriel,
  TypeNotification,
} from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateMaterialQuoteInput } from '../models/material-quote-input';

const MATERIAL_QUOTE_SELECT = {
  id: true,
  negotiationId: true,
  reservationId: true,
  creeParId: true,
  creePar: true,
  designation: true,
  prixUnitaire: true,
  quantite: true,
  statut: true,
  valideClientLe: true,
  validePrestataireLe: true,
  refusePar: true,
  pdfUrl: true,
  creeLe: true,
  misAJourLe: true,
} as const;

type MaterialQuoteRecord = Prisma.DevisMaterielNegotiationGetPayload<{
  select: typeof MATERIAL_QUOTE_SELECT;
}>;

@Injectable()
export class MaterialQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listForNegotiation(requestUser: AuthUser, negotiationId: string) {
    await this.getAuthorizedNegotiation(requestUser, negotiationId);
    const quotes = await this.prisma.devisMaterielNegotiation.findMany({
      where: { negotiationId },
      orderBy: { creeLe: 'asc' },
      select: MATERIAL_QUOTE_SELECT,
    });
    return quotes.map((quote) => this.toView(quote));
  }

  async createForNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    dto: CreateMaterialQuoteInput,
  ) {
    const { actor, negotiation } = await this.getAuthorizedNegotiation(
      requestUser,
      negotiationId,
    );
    if (actor !== 'PRESTATAIRE') {
      throw new BadRequestException(
        'Le devis materiel doit etre renseigne par le prestataire.',
      );
    }

    const quote = await this.prisma.devisMaterielNegotiation.create({
      data: {
        negotiationId,
        creeParId: requestUser.sub,
        creePar: RoleNegociateur.PRESTATAIRE,
        designation: dto.designation.trim(),
        prixUnitaire: Math.trunc(Number(dto.unitPrice)),
        quantite: Math.max(1, Math.trunc(Number(dto.quantity))),
      },
      select: MATERIAL_QUOTE_SELECT,
    });

    await this.notifyQuoteChanged({
      negotiation,
      actor,
      title: 'Nouveau devis materiel',
      body: `${this.actorLabel(actor)} a ajoute ${quote.designation} au devis materiel.`,
    });

    return this.toView(quote);
  }

  async approveQuote(
    requestUser: AuthUser,
    negotiationId: string,
    quoteId: string,
  ) {
    const { actor, negotiation } = await this.getAuthorizedNegotiation(
      requestUser,
      negotiationId,
    );
    await this.ensureQuoteBelongsToNegotiation(negotiationId, quoteId);
    if (actor !== 'CLIENT') {
      throw new BadRequestException(
        'Seul le client peut valider le devis materiel.',
      );
    }

    const now = new Date();
    const quote = await this.prisma.devisMaterielNegotiation.update({
      where: { id: quoteId },
      data: {
        statut: StatutDevisMateriel.VALIDE,
        valideClientLe: now,
      },
      select: MATERIAL_QUOTE_SELECT,
    });

    await this.notifyQuoteChanged({
      negotiation,
      actor,
      title: 'Devis materiel valide',
      body: `${this.actorLabel(actor)} a valide ${quote.designation}.`,
    });

    return this.toView(quote);
  }

  async rejectQuote(
    requestUser: AuthUser,
    negotiationId: string,
    quoteId: string,
  ) {
    const { actor, negotiation } = await this.getAuthorizedNegotiation(
      requestUser,
      negotiationId,
    );
    await this.ensureQuoteBelongsToNegotiation(negotiationId, quoteId);
    if (actor !== 'CLIENT') {
      throw new BadRequestException(
        'Seul le client peut refuser le devis materiel.',
      );
    }

    const quote = await this.prisma.devisMaterielNegotiation.update({
      where: { id: quoteId },
      data: {
        statut: StatutDevisMateriel.REFUSE,
        refusePar: RoleNegociateur.CLIENT,
      },
      select: MATERIAL_QUOTE_SELECT,
    });

    await this.notifyQuoteChanged({
      negotiation,
      actor,
      title: 'Devis materiel refuse',
      body: `${this.actorLabel(actor)} a refuse ${quote.designation}.`,
    });

    return this.toView(quote);
  }

  async finalizeForReservation(
    requestUser: AuthUser,
    negotiationId: string,
    reservationId: string,
  ) {
    const { negotiation } = await this.getAuthorizedNegotiation(
      requestUser,
      negotiationId,
    );
    if (
      negotiation.reservationId &&
      negotiation.reservationId !== reservationId
    ) {
      throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
    }

    const quotes = await this.prisma.devisMaterielNegotiation.findMany({
      where: { negotiationId },
      orderBy: { creeLe: 'asc' },
      select: MATERIAL_QUOTE_SELECT,
    });
    if (quotes.length === 0) {
      return { ready: true, quoteCount: 0, pdfUrl: null };
    }
    if (quotes.some((quote) => quote.statut === 'EN_ATTENTE')) {
      throw new BadRequestException(
        'Le devis materiel doit etre valide ou refuse avant de finaliser la reservation.',
      );
    }
    const validQuotes = quotes.filter((quote) => quote.statut === 'VALIDE');
    if (validQuotes.length === 0) {
      return { ready: true, quoteCount: 0, pdfUrl: null };
    }

    const pdfUrl = `/api/v1/negotiations/${negotiationId}/material-quotes.pdf`;
    const total = validQuotes.reduce(
      (sum, quote) => sum + Number(quote.prixUnitaire) * quote.quantite,
      0,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.devisMaterielNegotiation.updateMany({
        where: { negotiationId, statut: StatutDevisMateriel.VALIDE },
        data: { reservationId, pdfUrl },
      });

      const reservationConversation = await tx.conversation.findUnique({
        where: { reservationId },
      });
      const participantConversation = reservationConversation
        ? null
        : await tx.conversation.findFirst({
            where: {
              clientId: negotiation.clientId,
              prestataireId: negotiation.professionnel.utilisateurId,
            },
            orderBy: [{ dernierMessageLe: 'desc' }, { creeLe: 'desc' }],
          });
      const conversation =
        reservationConversation ??
        (participantConversation
          ? participantConversation.reservationId
            ? participantConversation
            : await tx.conversation.update({
                where: { id: participantConversation.id },
                data: { reservationId },
              })
          : await tx.conversation.create({
              data: {
                reservationId,
                clientId: negotiation.clientId,
                prestataireId: negotiation.professionnel.utilisateurId,
              },
            }));

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          expediteurId: requestUser.sub,
          contenu: this.buildFinalMessage(validQuotes, total),
          urlMedia: pdfUrl,
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { dernierMessageLe: new Date() },
      });
    });

    await this.notificationsService.createManyInAppNotifications([
      {
        userId: negotiation.clientId,
        type: TypeNotification.AJUSTEMENT_PRIX_ACCEPTE,
        title: 'Devis materiel finalise',
        body: 'Le devis materiel valide est disponible dans la discussion.',
        data: { negotiationId, reservationId, pdfUrl },
      },
      {
        userId: negotiation.professionnel.utilisateurId,
        type: TypeNotification.AJUSTEMENT_PRIX_ACCEPTE,
        title: 'Devis materiel finalise',
        body: 'Le devis materiel valide est disponible dans la discussion.',
        data: { negotiationId, reservationId, pdfUrl },
      },
    ]);

    return { ready: true, quoteCount: validQuotes.length, pdfUrl };
  }

  async buildPdfBuffer(requestUser: AuthUser, negotiationId: string) {
    const { negotiation } = await this.getAuthorizedNegotiation(
      requestUser,
      negotiationId,
    );
    const quotes = await this.prisma.devisMaterielNegotiation.findMany({
      where: { negotiationId },
      orderBy: { creeLe: 'asc' },
      select: MATERIAL_QUOTE_SELECT,
    });
    const validQuotes = quotes.filter((quote) => quote.statut === 'VALIDE');
    const total = validQuotes.reduce(
      (sum, quote) => sum + Number(quote.prixUnitaire) * quote.quantite,
      0,
    );
    return this.createInvoicePdf({
      negotiation,
      quotes: validQuotes,
      total,
    });
  }

  private async getAuthorizedNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
  ) {
    const negotiation = await this.prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        client: { select: { id: true, nom: true } },
        professionnel: {
          select: {
            id: true,
            utilisateurId: true,
            nomEntreprise: true,
            utilisateur: { select: { nom: true } },
          },
        },
        service: { select: { nom: true } },
      },
    });
    if (!negotiation) {
      throw appHttpException('NEGOTIATIONS_NOT_FOUND');
    }
    if (negotiation.clientId === requestUser.sub) {
      return { negotiation, actor: 'CLIENT' as const };
    }
    if (requestUser.role === 'PRESTATAIRE' || requestUser.role === 'MEDECIN') {
      const profile = await this.prisma.profilProfessionnel.findUnique({
        where: { utilisateurId: requestUser.sub },
        select: { id: true },
      });
      if (profile?.id === negotiation.professionnelId) {
        return { negotiation, actor: 'PRESTATAIRE' as const };
      }
    }
    throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
  }

  private async ensureQuoteBelongsToNegotiation(
    negotiationId: string,
    quoteId: string,
  ) {
    const quote = await this.prisma.devisMaterielNegotiation.findFirst({
      where: { id: quoteId, negotiationId },
      select: { id: true },
    });
    if (!quote) {
      throw appHttpException('NEGOTIATIONS_NOT_FOUND');
    }
  }

  private async notifyQuoteChanged(params: {
    negotiation: Awaited<
      ReturnType<MaterialQuoteService['getAuthorizedNegotiation']>
    >['negotiation'];
    actor: 'CLIENT' | 'PRESTATAIRE';
    title: string;
    body: string;
  }) {
    const recipientId =
      params.actor === 'CLIENT'
        ? params.negotiation.professionnel.utilisateurId
        : params.negotiation.clientId;
    await this.notificationsService.createInAppNotification({
      userId: recipientId,
      type: TypeNotification.AJUSTEMENT_PRIX_PROPOSE,
      title: params.title,
      body: params.body,
      data: {
        negotiationId: params.negotiation.id,
        serviceId: params.negotiation.serviceId,
      },
    });
  }

  private actorLabel(actor: 'CLIENT' | 'PRESTATAIRE'): string {
    return actor === 'CLIENT' ? 'Le client' : 'Le prestataire';
  }

  private toView(quote: MaterialQuoteRecord) {
    return {
      id: quote.id,
      negotiationId: quote.negotiationId,
      reservationId: quote.reservationId,
      createdByUserId: quote.creeParId,
      createdBy: quote.creePar,
      designation: quote.designation,
      unitPrice: Number(quote.prixUnitaire),
      quantity: quote.quantite,
      status: quote.statut,
      clientValidatedAt: quote.valideClientLe,
      providerValidatedAt: quote.validePrestataireLe,
      rejectedBy: quote.refusePar,
      pdfUrl: quote.pdfUrl,
      createdAt: quote.creeLe,
      updatedAt: quote.misAJourLe,
    };
  }

  private buildFinalMessage(
    quotes: MaterialQuoteRecord[],
    total: number,
  ): string {
    return [
      'Devis materiel finalise',
      '',
      'Le devis materiel valide est joint a ce message au format PDF.',
      `Nombre d'articles valides : ${quotes.length}`,
      `Total materiel : ${this.formatAmount(total)} FCFA`,
      '',
      'Vous pouvez consulter le document joint pour voir le detail des articles, les quantites et les prix.',
    ].join('\n');
  }

  private createInvoicePdf(params: {
    negotiation: Awaited<
      ReturnType<MaterialQuoteService['getAuthorizedNegotiation']>
    >['negotiation'];
    quotes: MaterialQuoteRecord[];
    total: number;
  }): Buffer {
    const pageWidth = 595;
    const margin = 42;
    const tableTop = 430;
    const rowHeight = 30;
    const visibleQuotes = params.quotes.slice(0, 10);
    const providerName =
      params.negotiation.professionnel.nomEntreprise ||
      params.negotiation.professionnel.utilisateur.nom;
    const invoiceRef = `DM-${params.negotiation.id.slice(0, 8).toUpperCase()}`;
    const createdAt = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
    const reservationRef =
      params.negotiation.reservationId ||
      'Reservation en cours de finalisation';

    const ops: string[] = [
      '1 1 1 rg 0 0 595 842 re f',
      '0.12 0.38 0.18 rg 0 760 595 82 re f',
      '1 1 1 rg',
      this.pdfText('JOKKO DIMBALI', margin, 802, 18, 'F2'),
      this.pdfText('DEVIS MATERIEL', margin, 777, 26, 'F2'),
      this.pdfText(
        'Document joint a la reservation finalisee',
        margin,
        762,
        10,
        'F1',
      ),
      '0.94 0.98 0.94 rg 392 776 145 38 re f',
      '0.12 0.38 0.18 rg',
      this.pdfText(invoiceRef, 408, 799, 13, 'F2'),
      this.pdfText(`Date : ${createdAt}`, 408, 783, 10, 'F1'),

      '0.96 0.97 0.96 rg 42 666 238 70 re f',
      '0.96 0.97 0.96 rg 315 666 238 70 re f',
      '0.12 0.38 0.18 rg',
      this.pdfText('CLIENT', 58, 710, 10, 'F2'),
      this.pdfText('PRESTATAIRE', 331, 710, 10, 'F2'),
      '0.05 0.07 0.10 rg',
      this.pdfText(
        this.truncatePdfText(params.negotiation.client.nom, 42),
        58,
        688,
        13,
        'F1',
      ),
      this.pdfText(this.truncatePdfText(providerName, 42), 331, 688, 13, 'F1'),

      '0.99 0.99 0.98 rg 42 574 511 62 re f',
      '0.12 0.38 0.18 rg',
      this.pdfText('PRESTATION', 58, 612, 10, 'F2'),
      this.pdfText('REFERENCE RESERVATION', 315, 612, 10, 'F2'),
      '0.05 0.07 0.10 rg',
      this.pdfText(
        this.truncatePdfText(params.negotiation.service.nom, 40),
        58,
        590,
        12,
        'F1',
      ),
      this.pdfText(this.truncatePdfText(reservationRef, 38), 315, 590, 9, 'F1'),

      '0.12 0.38 0.18 rg',
      this.pdfText('DETAIL DES ARTICLES VALIDES', margin, 526, 13, 'F2'),
      '0.05 0.07 0.10 rg 42 480 511 32 re f',
      '1 1 1 rg',
      this.pdfText('Designation', 58, 492, 10, 'F2'),
      this.pdfTextRight('Prix unitaire', 382, 492, 10, 'F2'),
      this.pdfTextRight('Qte', 430, 492, 10, 'F2'),
      this.pdfTextRight('Total', 535, 492, 10, 'F2'),
    ];

    visibleQuotes.forEach((quote, index) => {
      const y = tableTop - index * rowHeight;
      const amount = Number(quote.prixUnitaire) * quote.quantite;
      ops.push(index % 2 === 0 ? '1 1 1 rg' : '0.985 0.99 0.985 rg');
      ops.push(`42 ${y} 511 ${rowHeight} re f`);
      ops.push('0.88 0.90 0.88 rg 42 ' + y + ' 511 0.5 re f');
      ops.push('0.05 0.07 0.10 rg');
      ops.push(
        this.pdfText(
          this.truncatePdfText(quote.designation, 34),
          58,
          y + 11,
          10,
          'F1',
        ),
      );
      ops.push(
        this.pdfTextRight(
          `${this.formatPdfAmount(Number(quote.prixUnitaire))} FCFA`,
          382,
          y + 11,
          10,
          'F1',
        ),
      );
      ops.push(
        this.pdfTextRight(String(quote.quantite), 430, y + 11, 10, 'F1'),
      );
      ops.push(
        this.pdfTextRight(
          `${this.formatPdfAmount(amount)} FCFA`,
          535,
          y + 11,
          10,
          'F1',
        ),
      );
    });

    const totalBoxY = tableTop - visibleQuotes.length * rowHeight - 58;
    if (params.quotes.length > visibleQuotes.length) {
      ops.push('0.42 0.45 0.50 rg');
      ops.push(
        this.pdfText(
          `${params.quotes.length - visibleQuotes.length} article(s) supplementaire(s) non affiche(s) sur cette page.`,
          margin,
          totalBoxY + 44,
          9,
          'F1',
        ),
      );
    }
    ops.push('0.93 0.98 0.93 rg');
    ops.push(`315 ${totalBoxY} 238 54 re f`);
    ops.push('0.12 0.38 0.18 rg');
    ops.push(`315 ${totalBoxY + 50} 238 4 re f`);
    ops.push('0.05 0.07 0.10 rg');
    ops.push(this.pdfText('TOTAL MATERIEL', 335, totalBoxY + 25, 11, 'F2'));
    ops.push(
      this.pdfTextRight(
        `${this.formatPdfAmount(params.total)} FCFA`,
        535,
        totalBoxY + 25,
        15,
        'F2',
      ),
    );
    ops.push('0.96 0.97 0.96 rg 42 118 511 52 re f');
    ops.push('0.05 0.07 0.10 rg');
    ops.push(this.pdfText('Validation client', 58, 148, 10, 'F2'));
    ops.push(
      this.pdfText(
        'Les articles ci-dessus ont ete valides avant la finalisation de la reservation.',
        58,
        132,
        9,
        'F1',
      ),
    );
    ops.push('0.42 0.45 0.50 rg');
    ops.push(
      this.pdfText(
        'Document genere automatiquement par Jokko Dimbali.',
        margin,
        76,
        9,
        'F1',
      ),
    );
    ops.push(this.pdfTextRight(invoiceRef, 553, 76, 9, 'F1'));

    const stream = ops.join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >> endobj`,
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
      '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
    ];
    let body = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(body));
      body += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(body);
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    body += offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
      .join('');
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(body);
  }

  private pdfText(
    text: string,
    x: number,
    y: number,
    size: number,
    font: 'F1' | 'F2',
  ): string {
    return `BT /${font} ${size} Tf ${x} ${y} Td (${this.escapePdfText(text)}) Tj ET`;
  }

  private pdfTextRight(
    text: string,
    rightX: number,
    y: number,
    size: number,
    font: 'F1' | 'F2',
  ): string {
    const estimatedWidth = this.estimatePdfTextWidth(text, size, font);
    return this.pdfText(
      text,
      Math.max(42, rightX - estimatedWidth),
      y,
      size,
      font,
    );
  }

  private estimatePdfTextWidth(
    text: string,
    size: number,
    font: 'F1' | 'F2',
  ): number {
    const weight = font === 'F2' ? 0.58 : 0.52;
    return this.escapePdfText(text).length * size * weight;
  }

  private escapePdfText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[()\\]/g, '\\$&');
  }

  private truncatePdfText(value: string, maxLength: number): string {
    const normalized = value.trim();
    return normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
      : normalized;
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
      value || 0,
    );
  }

  private formatPdfAmount(value: number): string {
    const amount = Math.trunc(Number.isFinite(value) ? value : 0);
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
}
