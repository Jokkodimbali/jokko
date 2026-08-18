import { NegotiationCommandService } from './negotiation-command.service';

describe('NegotiationCommandService notifications', () => {
  const client = {
    sub: 'client-user',
    role: 'CLIENT',
    phoneNumber: '+221770000001',
  } as never;
  const provider = {
    sub: 'provider-user',
    role: 'PRESTATAIRE',
    phoneNumber: '+221770000002',
  } as never;

  const serviceView = {
    id: 'service-1',
    profilProfessionnelId: 'profile-1',
    nom: 'Reparation voiture',
    estDisponible: true,
    typePrix: 'NEGOCIABLE',
  };
  const professionalView = {
    id: 'profile-1',
    utilisateurId: 'provider-user',
    nomEntreprise: 'Garage Jokko',
    utilisateur: {
      id: 'provider-user',
      nom: 'Antoine',
      urlAvatar: '/antoine.jpg',
    },
  };

  function negotiationView(
    status: 'EN_ATTENTE_PRESTATAIRE' | 'EN_ATTENTE_CLIENT',
    amount = 15000,
  ) {
    return {
      id: 'negotiation-1',
      clientId: 'client-user',
      professionnelId: 'profile-1',
      serviceId: 'service-1',
      statut: status,
      montantInitial: 12000,
      montantCourant: amount,
      montantAccepte: null,
      dernierProposePar:
        status === 'EN_ATTENTE_CLIENT' ? 'PRESTATAIRE' : 'CLIENT',
      messageCourant: null,
      dateHeureProposee: null,
      adresseClientProposee: null,
      dureeMinutesProposee: null,
      raisonCloture: null,
      reservationId: null,
      creeLe: new Date('2026-08-17T09:00:00Z'),
      misAJourLe: new Date('2026-08-17T09:00:00Z'),
      propositions: [],
      client: {
        id: 'client-user',
        nom: 'Awa',
        adresse: null,
        urlAvatar: '/awa.jpg',
      },
      service: { id: 'service-1', nom: 'Reparation voiture', prix: 12000 },
      professionnel: professionalView,
    };
  }

  function setup(current = negotiationView('EN_ATTENTE_PRESTATAIRE')) {
    const negotiationsRepository = {
      createIfNoActive: jest.fn(),
      findById: jest.fn().mockResolvedValue(current),
      update: jest
        .fn()
        .mockImplementation(async (input) => ({ ...current, ...input })),
    };
    const professionalsRepository = {
      getServiceById: jest.fn().mockResolvedValue(serviceView),
      findVerifiedById: jest.fn().mockResolvedValue(professionalView),
      findByUserId: jest.fn().mockResolvedValue(professionalView),
    };
    const eventBus = { publier: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      createInAppNotification: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      devisMaterielNegotiation: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new NegotiationCommandService(
      negotiationsRepository as never,
      professionalsRepository as never,
      eventBus as never,
      notifications as never,
      prisma as never,
    );
    return { service, negotiationsRepository, notifications };
  }

  it('notifie le prestataire lors de l offre initiale avec les identifiants de redirection', async () => {
    const test = setup();
    test.negotiationsRepository.createIfNoActive.mockImplementation(
      async (input) => ({
        ...negotiationView('EN_ATTENTE_PRESTATAIRE', input.montantCourant),
        id: input.id,
      }),
    );

    const created = await test.service.createNegotiation(client, {
      serviceId: 'service-1',
      proposedAmount: 12500,
    });

    expect(test.notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user',
        type: 'AJUSTEMENT_PRIX_PROPOSE',
        data: expect.objectContaining({
          negotiationId: created.id,
          serviceId: 'service-1',
          proposedAmount: 12500,
        }),
      }),
    );
  });

  it('notifie le client lors de la contre-offre du prestataire', async () => {
    const test = setup(negotiationView('EN_ATTENTE_PRESTATAIRE'));

    await test.service.counterNegotiation(provider, 'negotiation-1', {
      proposedAmount: 17500,
    });

    expect(test.notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'client-user',
        type: 'AJUSTEMENT_PRIX_PROPOSE',
        title: 'Nouvelle contre-offre',
        data: expect.objectContaining({
          negotiationId: 'negotiation-1',
          serviceId: 'service-1',
        }),
      }),
    );
  });

  it('notifie le prestataire lors de la contre-offre du client', async () => {
    const test = setup(negotiationView('EN_ATTENTE_CLIENT'));

    await test.service.counterNegotiation(client, 'negotiation-1', {
      proposedAmount: 14500,
    });

    expect(test.notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user',
        type: 'AJUSTEMENT_PRIX_PROPOSE',
        data: expect.objectContaining({ proposedAmount: 14500 }),
      }),
    );
  });

  it('notifie l autre participant lors de l acceptation', async () => {
    const test = setup(negotiationView('EN_ATTENTE_CLIENT', 17500));

    await test.service.acceptNegotiation(client, 'negotiation-1');

    expect(test.notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user',
        type: 'AJUSTEMENT_PRIX_ACCEPTE',
        title: 'Offre acceptee',
        data: expect.objectContaining({
          negotiationId: 'negotiation-1',
          serviceId: 'service-1',
          proposedAmount: 17500,
        }),
      }),
    );
  });
});
