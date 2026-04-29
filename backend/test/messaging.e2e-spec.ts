import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { RoleUtilisateur, StatutKyc } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/core/http/api-exception.filter';
import { buildValidationException } from '../src/core/http/validation-exception.factory';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MessagingModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl = '';

  const uniqueSeed = randomUUID().replace(/-/g, '');
  const phoneSuffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 1000,
  )
    .toString()
    .padStart(3, '0')}`;
  const clientPhone = `+22174${phoneSuffix}`;
  const professionalPhone = `+22175${phoneSuffix}`;
  const otherClientPhone = `+22176${phoneSuffix}`;
  const clientPassword = `ClientPass${uniqueSeed.slice(0, 8)}!`;
  const professionalPassword = `ProPass${uniqueSeed.slice(0, 8)}!`;
  const otherClientPassword = `OtherPass${uniqueSeed.slice(0, 8)}!`;

  let clientToken = '';
  let professionalToken = '';
  let otherClientToken = '';
  let clientUserId = '';
  let professionalUserId = '';
  let professionalProfileId = '';
  let categoryId = '';
  let serviceId = '';
  let sharedReservationId = '';
  let sharedConversationId = '';

  type AuthResponse = {
    data?: {
      accessToken?: string;
      user?: {
        id?: string;
      };
    };
  };

  type ApiResponse<T> = {
    success: boolean;
    message?: string;
    errorCode?: string;
    data?: T;
  };

  type ConversationResponse = {
    id: string;
    clientUserId: string;
    professionalUserId: string;
    professionalProfileId: string | null;
    reservationId: string;
    lastMessageAt: string | null;
    createdAt: string;
    unreadCount: number;
    counterpart: {
      userId: string;
      professionalProfileId: string | null;
      name: string;
      avatarUrl: string | null;
    };
    lastMessage: {
      id: string;
      senderId: string;
      content: string | null;
      mediaUrl: string | null;
      createdAt: string;
    } | null;
  };

  type MessageResponse = {
    id: string;
    conversationId: string;
    senderId: string;
    content: string | null;
    mediaUrl: string | null;
    isRead: boolean;
    createdAt: string;
    sender: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };

  type ReservationResponse = {
    id: string;
    statut: string;
    professionnelId: string;
    serviceId: string;
    dateHeure: string;
    adresseClient: string;
    dureeMinutes: number;
    prixConvenu?: number | null;
  };

  async function registerUser(input: {
    phoneNumber: string;
    password: string;
    email: string;
    name: string;
  }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(input)
      .expect(201);

    return (response.body as AuthResponse).data?.user?.id ?? '';
  }

  async function login(phoneNumber: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password })
      .expect(200);

    return (response.body as AuthResponse).data?.accessToken ?? '';
  }

  function buildFutureIso(hoursAhead: number): string {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
  }

  async function createReservation(hoursAhead: number) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: buildFutureIso(hoursAhead),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
        notes: 'Reservation pour scenario messaging.',
      })
      .expect(201);

    return (response.body as ApiResponse<ReservationResponse>).data!;
  }

  async function createConversation(input: {
    reservationId: string;
    token?: string;
  }) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${input.token ?? clientToken}`)
      .send({
        reservationId: input.reservationId,
      })
      .expect(201);

    return (response.body as ApiResponse<ConversationResponse>).data!;
  }

  function connectSocket(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/socket`, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 5000,
      });

      const timeout = setTimeout(() => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        socket.close();
        reject(new Error('Timed out while connecting socket client'));
      }, 5000);

      const onConnect = () => {
        clearTimeout(timeout);
        socket.off('connect_error', onError);
        resolve(socket);
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.close();
        reject(error);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
  }

  function waitForSocketEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for socket event ${event}`));
      }, 5000);

      const handler = (payload: T) => {
        clearTimeout(timeout);
        resolve(payload);
      };

      socket.once(event, handler);
    });
  }

  async function pause(milliseconds: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        forbidUnknownValues: true,
        exceptionFactory: buildValidationException,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    prisma = app.get(PrismaService);

    clientUserId = await registerUser({
      phoneNumber: clientPhone,
      password: clientPassword,
      email: `client-${uniqueSeed}@jokko.sn`,
      name: 'Client Messaging',
    });
    professionalUserId = await registerUser({
      phoneNumber: professionalPhone,
      password: professionalPassword,
      email: `pro-${uniqueSeed}@jokko.sn`,
      name: 'Pro Messaging',
    });
    await registerUser({
      phoneNumber: otherClientPhone,
      password: otherClientPassword,
      email: `other-${uniqueSeed}@jokko.sn`,
      name: 'Other Client',
    });

    await prisma.utilisateur.update({
      where: { id: professionalUserId },
      data: { role: RoleUtilisateur.PRESTATAIRE },
    });

    professionalProfileId = randomUUID();
    categoryId = randomUUID();
    serviceId = randomUUID();

    await prisma.profilProfessionnel.create({
      data: {
        id: professionalProfileId,
        utilisateurId: professionalUserId,
        biographie: 'Prestataire messagerie',
        nomEntreprise: 'Jokko Chat Services',
        ville: 'Dakar',
        statutKyc: StatutKyc.VERIFIE,
      },
    });

    await prisma.categorie.create({
      data: {
        id: categoryId,
        nom: `Categorie Messaging ${uniqueSeed.slice(0, 8)}`,
        ordreTri: 1,
      },
    });

    await prisma.service.create({
      data: {
        id: serviceId,
        profilProfessionnelId: professionalProfileId,
        categorieId: categoryId,
        nom: 'Service messaging test',
        description:
          'Service de test pour les conversations liees a reservation',
        prix: 20000,
        typePrix: 'FIXE',
      },
    });

    clientToken = await login(clientPhone, clientPassword);
    professionalToken = await login(professionalPhone, professionalPassword);
    otherClientToken = await login(otherClientPhone, otherClientPassword);

    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        professionnelId: professionalProfileId,
        serviceId,
        dateHeure: buildFutureIso(20),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
        notes: 'Reservation racine pour le module messaging.',
      })
      .expect(201);

    sharedReservationId = (
      reservationResponse.body as ApiResponse<ReservationResponse>
    ).data!.id;

    sharedConversationId = (
      await createConversation({
        reservationId: sharedReservationId,
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /api/v1/conversations persists a reservation-linked conversation and its outbox event', async () => {
    const conversation = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const body = conversation.body as ApiResponse<ConversationResponse[]>;
    const sharedConversation = body.data?.find(
      (item) => item.id === sharedConversationId,
    );

    expect(sharedConversation).toBeTruthy();
    expect(sharedConversation?.reservationId).toBe(sharedReservationId);
    expect(sharedConversation?.clientUserId).toBe(clientUserId);
    expect(sharedConversation?.professionalUserId).toBe(professionalUserId);

    const persistedConversation = await prisma.conversation.findUnique({
      where: { id: sharedConversationId },
      select: {
        id: true,
        clientId: true,
        prestataireId: true,
        reservationId: true,
        dernierMessageLe: true,
      },
    });

    expect(persistedConversation).not.toBeNull();
    expect(persistedConversation?.reservationId).toBe(sharedReservationId);
    expect(persistedConversation?.clientId).toBe(clientUserId);
    expect(persistedConversation?.prestataireId).toBe(professionalUserId);
    expect(persistedConversation?.dernierMessageLe).toBeNull();

    const outboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'messaging.conversation.created',
        payload: {
          path: ['conversationId'],
          equals: sharedConversationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(outboxEvent).not.toBeNull();
    expect(
      (outboxEvent?.payload as { reservationId?: string }).reservationId,
    ).toBe(sharedReservationId);
  });

  it('POST /api/v1/conversations returns the same conversation for the same reservation and a distinct one for another reservation', async () => {
    const reservation = await createReservation(26);

    const firstConversation = await createConversation({
      reservationId: sharedReservationId,
    });
    const secondConversation = await createConversation({
      reservationId: reservation.id,
    });

    expect(firstConversation.id).toBe(sharedConversationId);
    expect(secondConversation.id).not.toBe(sharedConversationId);
    expect(secondConversation.reservationId).toBe(reservation.id);

    const matchingConversations = await prisma.conversation.findMany({
      where: {
        clientId: clientUserId,
        prestataireId: professionalUserId,
      },
      select: { id: true, reservationId: true },
    });

    expect(
      matchingConversations.filter((item) => item.id === firstConversation.id),
    ).toHaveLength(1);
    expect(
      matchingConversations.some(
        (item) =>
          item.id === secondConversation.id &&
          item.reservationId === reservation.id,
      ),
    ).toBe(true);
  });

  it('POST /api/v1/conversations rejects a reservation that does not match the conversation participants', async () => {
    const reservation = await createReservation(28);

    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({
        reservationId: reservation.id,
      })
      .expect(409);

    const body = response.body as ApiResponse<null>;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('MESSAGING_RESERVATION_PARTICIPANTS_MISMATCH');
  });

  it('POST /api/v1/conversations/:id/messages persists message, notification, outbox and conversation activity', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${sharedConversationId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        content: 'Bonjour, avez-vous bien recu mon adresse ?',
      })
      .expect(201);

    const body = response.body as ApiResponse<MessageResponse>;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Message envoye avec succes.');
    expect(body.data?.content).toBe(
      'Bonjour, avez-vous bien recu mon adresse ?',
    );

    const persistedMessage = await prisma.message.findUnique({
      where: { id: body.data!.id },
      select: {
        id: true,
        conversationId: true,
        expediteurId: true,
        contenu: true,
        estLu: true,
      },
    });

    expect(persistedMessage).not.toBeNull();
    expect(persistedMessage?.conversationId).toBe(sharedConversationId);
    expect(persistedMessage?.expediteurId).toBe(clientUserId);
    expect(persistedMessage?.contenu).toBe(
      'Bonjour, avez-vous bien recu mon adresse ?',
    );
    expect(persistedMessage?.estLu).toBe(false);

    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: sharedConversationId },
      select: {
        id: true,
        dernierMessageLe: true,
      },
    });

    expect(updatedConversation?.dernierMessageLe).not.toBeNull();

    const notification = await prisma.notification.findFirst({
      where: {
        utilisateurId: professionalUserId,
        type: 'NOUVEAU_MESSAGE',
        donnees: {
          path: ['conversationId'],
          equals: sharedConversationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(notification).not.toBeNull();
    expect(notification?.corps).toContain('Client Messaging');

    const outboxEvent = await prisma.evenementOutbox.findFirst({
      where: {
        typeEvenement: 'messaging.message.sent',
        payload: {
          path: ['conversationId'],
          equals: sharedConversationId,
        },
      },
      orderBy: { creeLe: 'desc' },
    });

    expect(outboxEvent).not.toBeNull();
    expect((outboxEvent?.payload as { messageId?: string }).messageId).toBe(
      body.data?.id,
    );
  });

  it('GET /api/v1/conversations lists the reservation-linked conversation for both participants', async () => {
    const clientList = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const clientBody = clientList.body as ApiResponse<ConversationResponse[]>;
    expect(clientBody.success).toBe(true);
    expect(
      clientBody.data?.some(
        (item) =>
          item.id === sharedConversationId &&
          item.reservationId === sharedReservationId,
      ),
    ).toBe(true);

    const professionalList = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const professionalBody = professionalList.body as ApiResponse<
      ConversationResponse[]
    >;
    expect(professionalBody.success).toBe(true);
    expect(
      professionalBody.data?.some(
        (item) =>
          item.id === sharedConversationId &&
          item.counterpart.userId === clientUserId,
      ),
    ).toBe(true);
  });

  it('GET /api/v1/conversations/:id/messages returns history and marks incoming messages as read for the professional', async () => {
    const messageResponse = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${sharedConversationId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        content: 'Pouvez-vous me confirmer votre heure darrivee ?',
      })
      .expect(201);

    const createdMessage = (
      messageResponse.body as ApiResponse<MessageResponse>
    ).data!;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${sharedConversationId}/messages`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);

    const body = response.body as ApiResponse<MessageResponse[]>;
    expect(body.success).toBe(true);
    expect(body.data?.some((message) => message.id === createdMessage.id)).toBe(
      true,
    );

    const updatedMessage = await prisma.message.findUnique({
      where: { id: createdMessage.id },
      select: {
        estLu: true,
      },
    });

    expect(updatedMessage?.estLu).toBe(true);
  });

  it('GET /api/v1/conversations/:id/messages denies access to unrelated users', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${sharedConversationId}/messages`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(404);

    const body = response.body as ApiResponse<null>;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('MESSAGING_NOT_FOUND');
  });

  it('WebSocket reservation -> conversation -> message delivers the live message to the joined recipient', async () => {
    const professionalSocket = await connectSocket(professionalToken);
    const clientSocket = await connectSocket(clientToken);

    try {
      professionalSocket.emit('conversation.join', {
        conversationId: sharedConversationId,
      });
      await pause(250);

      const liveMessagePromise = waitForSocketEvent<MessageResponse>(
        professionalSocket,
        'conversation.message.created',
      );
      clientSocket.emit('conversation.message.send', {
        conversationId: sharedConversationId,
        content: 'Message temps reel depuis le client.',
      });

      const liveMessage = await liveMessagePromise;
      expect(liveMessage.conversationId).toBe(sharedConversationId);
      expect(liveMessage.senderId).toBe(clientUserId);
      expect(liveMessage.content).toBe('Message temps reel depuis le client.');

      const persistedMessage = await prisma.message.findUnique({
        where: { id: liveMessage.id },
        select: {
          id: true,
          conversationId: true,
          expediteurId: true,
          contenu: true,
        },
      });

      expect(persistedMessage).not.toBeNull();
      expect(persistedMessage?.conversationId).toBe(sharedConversationId);
      expect(persistedMessage?.expediteurId).toBe(clientUserId);
      expect(persistedMessage?.contenu).toBe(
        'Message temps reel depuis le client.',
      );
    } finally {
      professionalSocket.close();
      clientSocket.close();
    }
  });

  it('WebSocket delivers a message to the connected recipient even before joining the conversation room', async () => {
    const reservation = await createReservation(40);
    const conversation = await createConversation({
      reservationId: reservation.id,
    });
    const professionalSocket = await connectSocket(professionalToken);

    try {
      const liveMessagePromise = waitForSocketEvent<MessageResponse>(
        professionalSocket,
        'conversation.message.created',
      );

      await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          content: 'Message live sans ouverture de room.',
        })
        .expect(201);

      const liveMessage = await liveMessagePromise;
      expect(liveMessage.conversationId).toBe(conversation.id);
      expect(liveMessage.content).toBe('Message live sans ouverture de room.');
    } finally {
      professionalSocket.close();
    }
  });

  it('WebSocket emits a read receipt when the recipient opens a conversation with unread messages', async () => {
    const reservation = await createReservation(42);
    const conversation = await createConversation({
      reservationId: reservation.id,
    });
    const clientSocket = await connectSocket(clientToken);
    const professionalSocket = await connectSocket(professionalToken);

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          content: 'Message a marquer comme lu.',
        })
        .expect(201);

      const readReceiptPromise = waitForSocketEvent<{
        conversationId: string;
        readByUserId: string;
        readAt: string;
      }>(clientSocket, 'conversation.messages.read');

      professionalSocket.emit('conversation.join', {
        conversationId: conversation.id,
      });

      const readReceipt = await readReceiptPromise;
      expect(readReceipt.conversationId).toBe(conversation.id);
      expect(readReceipt.readByUserId).toBe(professionalUserId);
      expect(readReceipt.readAt).toBeTruthy();
    } finally {
      clientSocket.close();
      professionalSocket.close();
    }
  });

  it('WebSocket emits typing updates to the connected recipient', async () => {
    const reservation = await createReservation(44);
    const conversation = await createConversation({
      reservationId: reservation.id,
    });
    const clientSocket = await connectSocket(clientToken);
    const professionalSocket = await connectSocket(professionalToken);

    try {
      const typingPromise = waitForSocketEvent<{
        conversationId: string;
        userId: string;
        isTyping: boolean;
        updatedAt: string;
      }>(professionalSocket, 'conversation.typing.updated');

      clientSocket.emit('conversation.typing', {
        conversationId: conversation.id,
        isTyping: true,
      });

      const typingPayload = await typingPromise;
      expect(typingPayload.conversationId).toBe(conversation.id);
      expect(typingPayload.userId).toBe(clientUserId);
      expect(typingPayload.isTyping).toBe(true);
      expect(typingPayload.updatedAt).toBeTruthy();
    } finally {
      clientSocket.close();
      professionalSocket.close();
    }
  });
});
