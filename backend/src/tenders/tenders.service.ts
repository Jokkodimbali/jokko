import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenderStatus } from '@prisma/client';
import type { AuthUser } from '../auth/security/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTenderDto,
  TenderPreviewDto,
  RepublishTenderDto,
  RespondTenderDto,
} from './tenders.dto';
import { TenderMatchingService } from './tender-matching.service';
import { TenderNotificationsService } from './tender-notifications.service';
import { acceptedTenderNegotiation } from './tender-negotiation';

const include = {
  client: { select: { nom: true, urlAvatar: true } },
  category: { select: { nom: true } },
  subCategory: { select: { nom: true } },
  responses: {
    orderBy: { offeredAt: 'desc' as const },
    include: {
      professional: {
        select: {
          utilisateurId: true,
          nomEntreprise: true,
          noteGlobale: true,
          nombreAvis: true,
          utilisateur: { select: { nom: true, urlAvatar: true } },
          services: {
            where: { estDisponible: true },
            select: { id: true, nom: true },
          },
        },
      },
      negotiation: { select: { id: true, reservationId: true, statut: true } },
    },
  },
} satisfies Prisma.TenderInclude;
type TenderRecord = Prisma.TenderGetPayload<{ include: typeof include }>;

@Injectable()
export class TendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: TenderMatchingService,
    private readonly notifications: TenderNotificationsService,
  ) {}

  async preview(user: AuthUser, input: TenderPreviewDto) {
    this.assertClient(user);
    const recipients = await this.matching.findRecipients(user.sub, {
      ...input,
      radiusKm: 25,
    } as CreateTenderDto);
    return {
      count: recipients.length,
      avatars: recipients.slice(0, 4).map((person) => ({
        name: person.name,
        avatarUrl: person.avatarUrl,
      })),
    };
  }

  async create(user: AuthUser, input: CreateTenderDto) {
    this.assertClient(user);
    if (
      input.scheduledAt &&
      new Date(input.scheduledAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException('Choisissez une date future.');
    }
    const category = await this.prisma.categorie.findFirst({
      where: {
        id: input.categoryId,
        estActive: true,
        typeEspace: 'PRESTATAIRE',
        ...(input.subCategoryId
          ? {
              sousCategories: {
                some: {
                  sousCategorieId: input.subCategoryId,
                  sousCategorie: {
                    estActive: true,
                    OR: [{ typeEspace: null }, { typeEspace: 'PRESTATAIRE' }],
                  },
                },
              },
            }
          : {}),
      },
    });
    if (!category)
      throw new BadRequestException(
        'Choisissez un métier valide dans le catalogue.',
      );
    const recipients = await this.matching.findRecipients(user.sub, input);
    if (recipients.length === 0) {
      throw new BadRequestException(
        'Aucun prestataire correspondant à ce métier n’est disponible dans un rayon de 25 km. Choisissez une autre adresse ou un autre métier.',
      );
    }
    const tender = await this.prisma.tender.create({
      data: {
        ...input,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        clientId: user.sub,
        responses: {
          create: recipients.map((person) => ({
            professionalId: person.id,
            eligibleServiceIds: person.services.map((service) => service.id),
            distanceKm: person.distanceKm,
          })),
        },
      },
      include,
    });
    await this.notifications.send(
      tender.id,
      recipients.map((person) => person.userId),
      'Nouvel appel d’offres à proximité',
      `${category.nom} : un client propose ${input.proposedPrice.toLocaleString('fr-FR')} FCFA.`,
    );
    return this.toView(tender, user);
  }

  async list(user: AuthUser, page: number, answeredOnly = false) {
    const where: Prisma.TenderWhereInput =
      user.role === 'CLIENT'
        ? {
            clientId: user.sub,
            status: { not: 'CANCELLED' },
            ...(answeredOnly
              ? { responses: { some: { status: { in: ['OFFERED', 'SELECTED'] } } } }
              : {}),
          }
        : {
            status: { not: 'CANCELLED' },
            responses: { some: { professional: { utilisateurId: user.sub } } },
          };
    this.assertParticipantRole(user);
    const [items, total] = await Promise.all([
      this.prisma.tender.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.prisma.tender.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toView(item, user)),
      total,
      page,
      limit: 20,
    };
  }

  async detail(user: AuthUser, id: string) {
    const tender = await this.authorized(user, id);
    return this.toView(tender, user);
  }

  async republish(user: AuthUser, id: string, input: RepublishTenderDto) {
    this.assertClient(user);
    const tender = await this.authorized(user, id);
    if (tender.scheduledAt && tender.scheduledAt.getTime() <= Date.now())
      throw new BadRequestException(
        'La date prévue est passée. Créez une nouvelle demande.',
      );
    const recipients = await this.matching.findRecipients(user.sub, {
      categoryId: tender.categoryId,
      subCategoryId: tender.subCategoryId ?? undefined,
      description: tender.description,
      address: tender.address,
      latitude: tender.latitude,
      longitude: tender.longitude,
      radiusKm: tender.radiusKm,
      proposedPrice: input.proposedPrice,
    });
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id, input.revision, user.sub);
      await tx.tender.update({
        where: { id },
        data: {
          proposedPrice: input.proposedPrice,
          revision: { increment: 1 },
        },
      });
      await tx.tenderResponse.updateMany({
        where: { tenderId: id },
        data: { status: 'NOT_SELECTED' },
      });
      for (const person of recipients) {
        const data = {
          eligibleServiceIds: person.services.map((service) => service.id),
          distanceKm: person.distanceKm,
          status: 'INVITED' as const,
          amount: null,
          serviceId: null,
          message: null,
          offeredAt: null,
        };
        await tx.tenderResponse.upsert({
          where: {
            tenderId_professionalId: {
              tenderId: id,
              professionalId: person.id,
            },
          },
          create: { ...data, tenderId: id, professionalId: person.id },
          update: data,
        });
      }
    });
    await this.notifications.send(
      id,
      recipients.map((person) => person.userId),
      'Appel d’offres relancé',
      `Le client propose maintenant ${input.proposedPrice.toLocaleString('fr-FR')} FCFA. Les réponses précédentes sont remplacées.`,
    );
    return this.detail(user, id);
  }

  async cancel(user: AuthUser, id: string, revision: number) {
    this.assertClient(user);
    const tender = await this.authorized(user, id);
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id, revision, user.sub);
      await tx.tender.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.tenderResponse.updateMany({
        where: { tenderId: id },
        data: { status: 'NOT_SELECTED' },
      });
    });
    await this.notifications.send(
      id,
      tender.responses.map((response) => response.professional.utilisateurId),
      'Appel d’offres annulé',
      'Le client a annulé sa demande.',
    );
    return this.detail(user, id);
  }

  async respond(user: AuthUser, id: string, input: RespondTenderDto) {
    this.assertProfessional(user);
    const tender = await this.authorized(user, id);
    const invitation = tender.responses.find(
      (response) => response.professional.utilisateurId === user.sub,
    )!;
    if (!invitation.eligibleServiceIds.includes(input.serviceId))
      throw new ForbiddenException(
        'Ce service ne correspond pas à cette demande.',
      );
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id, input.revision);
      await this.assertAvailableService(
        tx,
        input.serviceId,
        invitation.professionalId,
      );
      const result = await tx.tenderResponse.updateMany({
        where: { id: invitation.id, status: { in: ['INVITED', 'OFFERED', 'REJECTED'] } },
        data: {
          serviceId: input.serviceId,
          amount: input.amount,
          message: input.message ?? null,
          status: 'OFFERED',
          offeredAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException(
          'Cette demande n’attend plus votre réponse.',
        );
    });
    await this.notifications.send(
      id,
      [tender.clientId],
      'Nouvelle réponse à votre appel d’offres',
      `Un prestataire propose ${input.amount.toLocaleString('fr-FR')} FCFA. Consultez son offre.`,
    );
    return this.detail(user, id);
  }

  async ignore(user: AuthUser, id: string, revision: number) {
    this.assertProfessional(user);
    const tender = await this.authorized(user, id);
    const invitation = tender.responses.find(
      (response) => response.professional.utilisateurId === user.sub,
    )!;
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id, revision);
      await tx.tenderResponse.updateMany({
        where: { id: invitation.id, status: 'INVITED' },
        data: { status: 'IGNORED' },
      });
    });
    return this.detail(user, id);
  }

  async reject(
    user: AuthUser,
    id: string,
    responseId: string,
    revision: number,
  ) {
    this.assertClient(user);
    const tender = await this.authorized(user, id);
    const response = tender.responses.find((item) => item.id === responseId);
    if (!response) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id, revision, user.sub);
      const changed = await tx.tenderResponse.updateMany({
        where: { id: responseId, tenderId: id, status: 'OFFERED' },
        data: { status: 'REJECTED' },
      });
      if (!changed.count)
        throw new ConflictException('Cette offre n’est plus disponible.');
    });
    await this.notifications.send(
      id,
      [response.professional.utilisateurId],
      'Offre non retenue',
      'Le client n’a pas retenu votre proposition.',
    );
    return this.detail(user, id);
  }

  async select(
    user: AuthUser,
    id: string,
    responseId: string,
    revision: number,
    amount: number,
  ) {
    this.assertClient(user);
    await this.authorized(user, id);
    await this.prisma.$transaction(async (tx) => {
      // All mutations lock the same request row. Only one provider can be selected.
      const existing = await tx.tenderResponse.findUnique({
        where: { id: responseId },
      });
      if (
        existing?.tenderId === id &&
        existing.status === 'SELECTED' &&
        existing.negotiationId
      )
        return;
      await this.lockOpen(tx, id, revision, user.sub);
      const tender = await tx.tender.findUniqueOrThrow({ where: { id } });
      const response = await tx.tenderResponse.findFirst({
        where: { id: responseId, tenderId: id, status: 'OFFERED' },
      });
      if (!response?.serviceId || response.amount === null)
        throw new ConflictException('Cette offre n’est plus disponible.');
      if (Number(response.amount) !== amount)
        throw new ConflictException(
          'Le prix de cette offre a changé. Consultez le nouveau montant avant de confirmer.',
        );
      await this.assertAvailableService(
        tx,
        response.serviceId,
        response.professionalId,
      );
      const negotiation = await tx.negotiation.create({
        data: acceptedTenderNegotiation(tender, response),
      });
      await tx.tenderResponse.updateMany({
        where: { tenderId: id, id: { not: responseId } },
        data: { status: 'NOT_SELECTED' },
      });
      await tx.tenderResponse.update({
        where: { id: responseId },
        data: { status: 'SELECTED', negotiationId: negotiation.id },
      });
      await tx.tender.update({ where: { id }, data: { status: 'SELECTED' } });
    });
    const tender = await this.authorized(user, id);
    const chosen = tender.responses.find(
      (response) => response.id === responseId,
    )!;
    await this.notifications.send(
      id,
      [chosen.professional.utilisateurId],
      'Votre offre a été acceptée',
      'Le client peut maintenant finaliser la réservation et le paiement.',
    );
    return this.toView(tender, user);
  }

  private async lockOpen(
    tx: Prisma.TransactionClient,
    id: string,
    revision: number,
    clientId?: string,
  ) {
    const result = await tx.tender.updateMany({
      where: {
        id,
        status: TenderStatus.OPEN,
        revision,
        ...(clientId ? { clientId } : {}),
      },
      data: { updatedAt: new Date() },
    });
    if (!result.count)
      throw new ConflictException(
        'La demande a changé ou est clôturée. Actualisez la page.',
      );
  }

  private async assertAvailableService(
    tx: Prisma.TransactionClient,
    id: string,
    professionalId: string,
  ) {
    const service = await tx.service.findFirst({
      where: {
        id,
        profilProfessionnelId: professionalId,
        estDisponible: true,
        modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
        profilProfessionnel: {
          statutKyc: 'VERIFIE',
          utilisateur: { estActif: true },
        },
      },
      select: { id: true },
    });
    if (!service)
      throw new BadRequestException(
        'Ce service ou ce prestataire n’est plus disponible.',
      );
  }

  private async authorized(user: AuthUser, id: string) {
    this.assertParticipantRole(user);
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include,
    });
    if (!tender) throw new NotFoundException('Appel d’offres introuvable.');
    if (
      tender.clientId !== user.sub &&
      !tender.responses.some(
        (response) => response.professional.utilisateurId === user.sub,
      )
    )
      throw new ForbiddenException();
    return tender;
  }
  private assertParticipantRole(user: AuthUser) {
    if (!['CLIENT', 'PRESTATAIRE'].includes(user.role))
      throw new ForbiddenException();
  }
  private assertClient(user: AuthUser) {
    if (user.role !== 'CLIENT') throw new ForbiddenException();
  }
  private assertProfessional(user: AuthUser) {
    if (user.role !== 'PRESTATAIRE') throw new ForbiddenException();
  }

  private toView(tender: TenderRecord, user: AuthUser) {
    const isClient = tender.clientId === user.sub;
    const responses = tender.responses.filter(
      (response) =>
        isClient || response.professional.utilisateurId === user.sub,
    );
    return {
      id: tender.id,
      categoryId: tender.categoryId,
      subCategoryId: tender.subCategoryId,
      job: tender.subCategory?.nom ?? tender.category.nom,
      description: tender.description,
      address: tender.address,
      latitude: tender.latitude,
      longitude: tender.longitude,
      radiusKm: tender.radiusKm,
      proposedPrice: Number(tender.proposedPrice),
      scheduledAt: tender.scheduledAt,
      status: tender.status,
      revision: tender.revision,
      createdAt: tender.createdAt,
      clientName: tender.client.nom,
      clientAvatarUrl: tender.client.urlAvatar,
      invitedCount: isClient
        ? tender.responses.filter(
            (response) => response.status !== 'NOT_SELECTED',
          ).length
        : undefined,
      responses: responses.map((response) => ({
        id: response.id,
        professionalId: response.professionalId,
        name:
          response.professional.nomEntreprise ||
          response.professional.utilisateur.nom,
        avatarUrl: response.professional.utilisateur.urlAvatar,
        rating: Number(response.professional.noteGlobale),
        reviewCount: response.professional.nombreAvis,
        distanceKm: response.distanceKm,
        amount: response.amount === null ? null : Number(response.amount),
        message: response.message,
        status: response.status,
        offeredAt: response.offeredAt,
        serviceId: response.serviceId,
        serviceName:
          response.professional.services.find(
            (service) => service.id === response.serviceId,
          )?.nom ?? null,
        negotiationId: response.negotiationId,
        reservationId: response.negotiation?.reservationId ?? null,
        services: !isClient
          ? response.professional.services
              .filter((service) =>
                response.eligibleServiceIds.includes(service.id),
              )
              .map((service) => ({ id: service.id, name: service.nom }))
          : [],
      })),
    };
  }
}
