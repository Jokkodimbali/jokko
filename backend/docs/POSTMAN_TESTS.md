# Guide De Tests Postman

## 1. Objet
Ce document explique comment utiliser Postman avec le backend Jokko tel qu'il existe aujourd'hui.

Le dossier associe est :

- `backend/docs/collection_postman_test/jokko-api.postman_collection.json`
- `backend/docs/collection_postman_test/jokko-api.postman_environment.json`

## 2. Role de Postman dans ce projet
Postman est utile pour :

- tester rapidement les endpoints HTTP
- valider les scenarios de role `CLIENT`, `PRESTATAIRE`, `ADMIN`
- rejouer des payloads metier sans passer par l'application mobile
- verifier l'enveloppe HTTP standard

En revanche, Postman n'est pas l'outil principal pour :

- la messagerie Socket.IO
- le live tracking temps reel
- les webhooks provider complexes avec signature reelle

Pour ces cas, il faut privilegier :

- Swagger pour les endpoints HTTP
- les suites `*.e2e-spec.ts`
- un client Socket.IO dedie

## 3. Base URL locale
Par defaut :

`http://localhost:3000/api/v1`

Swagger local :

`http://localhost:3000/api/docs`

Swagger production Render :

`https://jokko-dimbali.onrender.com/api/docs`

API production Render :

`https://jokko-dimbali.onrender.com/api/v1`

## 4. Prerequis avant test

1. lancer le backend
2. verifier `GET /api/v1/sante`
3. disposer d'au moins un compte par role si vous voulez tester les routes protegees

Commandes utiles :

```bash
cd backend
npm.cmd run build
npm.cmd run start:dev
```

Ou via Docker :

```bash
cd backend
npm run docker:dev
```

## 5. Ordre de test recommande

### 5.1 Sante

- `GET /sante`

### 5.2 Authentification

- `POST /auth/otp/send`
- `POST /auth/otp/verify`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### 5.3 Utilisateur courant

- `GET /users/me`
- `PATCH /users/me`
- `PATCH /users/me/avatar`
- `GET /users/me/history`
- `DELETE /users/me`

### 5.4 Administration utilisateur

- `GET /admin/users`
- `GET /admin/users/:userId`
- `GET /admin/users/:userId/history`
- `PATCH /admin/users/:userId/block`
- `PATCH /admin/users/:userId/unblock`

### 5.5 Professionnels

- `POST /professionals/profile`
- `GET /professionals/me`
- `PATCH /professionals/me`
- `PATCH /professionals/me/kyc/submit`
- `POST /professionals/me/services`
- `PATCH /professionals/me/services/:serviceId`
- `DELETE /professionals/me/services/:serviceId`
- `POST /professionals/me/portfolio`
- `DELETE /professionals/me/portfolio/:itemId`
- `POST /professionals/me/availabilities`
- `DELETE /professionals/me/availabilities/:availabilityId`
- `GET /professionals`
- `GET /professionals/:professionalId`
- `GET /professionals/:professionalId/services`
- `GET /professionals/:professionalId/portfolio`
- `GET /professionals/:professionalId/availabilities`
- `GET /professionals/:professionalId/reviews`

### 5.6 Administration KYC

- `GET /admin/kyc`
- `GET /admin/kyc/:professionalId`
- `PATCH /admin/kyc/:professionalId/approve`
- `PATCH /admin/kyc/:professionalId/reject`

### 5.7 Categories

- `GET /categories`
- `POST /admin/categories`
- `PATCH /admin/categories/:categoryId`
- `PATCH /admin/categories/:categoryId/disable`

### 5.8 Search

- `GET /search/professionals`

### 5.9 Negotiations

- `POST /negotiations`
- `GET /negotiations`
- `GET /negotiations/:negotiationId`
- `PATCH /negotiations/:negotiationId/counter`
- `PATCH /negotiations/:negotiationId/accept`
- `PATCH /negotiations/:negotiationId/reject`
- `PATCH /negotiations/:negotiationId/cancel`

### 5.10 Reservations

- `POST /reservations`
- `POST /reservations/from-negotiation`
- `GET /reservations/my`
- `GET /reservations/:reservationId`
- `PATCH /reservations/:reservationId/confirm`
- `PATCH /reservations/:reservationId/cancel`
- `PATCH /reservations/:reservationId/reschedule`
- `PATCH /reservations/:reservationId/price-adjustment/propose`
- `PATCH /reservations/:reservationId/price-adjustment/accept`
- `PATCH /reservations/:reservationId/price-adjustment/reject`
- `PATCH /reservations/:reservationId/complete`
- `PATCH /reservations/:reservationId/review`
- `PATCH /reservations/:reservationId/no-show`
- `PATCH /reservations/:reservationId/start`
- `PATCH /reservations/:reservationId/dispute`

### 5.11 Messaging HTTP

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/messages`

### 5.12 Live Tracking HTTP

- `PATCH /reservations/:reservationId/on-the-way`
- `GET /reservations/:reservationId/live-tracking`
- `GET /professionals/:professionalId/presence`

### 5.13 Payments

- `POST /payments/initiate`
- `POST /payments/webhook`
- `GET /payments/history`
- `GET /payments/:paymentId`
- `POST /payments/withdraw`
- `GET /payments/withdrawals`
- `PATCH /payments/:paymentId/escrow/release`
- `PATCH /payments/:paymentId/escrow/dispute`
- `GET /payments/:paymentId/escrow/status`

### 5.14 Notifications

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `PATCH /notifications/read-all`
- `POST /notifications/device-token`

### 5.15 Litiges Admin

- `GET /admin/disputes`
- `GET /admin/disputes/:disputeId`
- `PATCH /admin/disputes/:disputeId/in-review`
- `PATCH /admin/disputes/:disputeId/resolve`
- `PATCH /admin/disputes/:disputeId/reject`

### 5.16 Paiements Admin

- `GET /admin/payments`
- `GET /admin/payments/statistics`
- `GET /admin/payments/:paymentId`
- `POST /admin/payments/:paymentId/refund`
- `GET /admin/payments/escrow/pending`
- `POST /admin/payments/escrow/process-pending`

### 5.17 Reservations Admin

- `GET /admin/reservations`
- `GET /admin/reservations/:reservationId`
- `GET /admin/reservations/statistics`

### 5.18 Dashboard Admin

- `GET /admin/dashboard`

### 5.19 Notifications Admin

- `POST /admin/notifications/broadcast`

## 6. Jeux de donnees de test conseilles

### 6.1 Client

```json
{
  "phoneNumber": "+221770000001",
  "name": "Client Jokko Test",
  "email": "client.test@jokko.sn",
  "password": "ClientTest123!"
}
```

### 6.2 Prestataire

```json
{
  "phoneNumber": "+221770000002",
  "name": "Prestataire Jokko Test",
  "email": "pro.test@jokko.sn",
  "password": "ProTest123!"
}
```

### 6.3 Profil professionnel

```json
{
  "bio": "Plombier professionnel disponible a Dakar.",
  "companyName": "Jokko Services",
  "city": "Dakar"
}
```

### 6.4 KYC

```json
{
  "idCardUrl": "https://cdn.jokko.sn/kyc/demo-recto.png",
  "idCardUrlVerso": "https://cdn.jokko.sn/kyc/demo-verso.png"
}
```

### 6.5 Service

```json
{
  "categoryId": "750e8400-e29b-41d4-a716-446655440002",
  "name": "Depannage plomberie",
  "description": "Intervention rapide a domicile",
  "price": 15000,
  "priceType": "FIXE"
}
```

### 6.6 Reservation

```json
{
  "professionalId": "850e8400-e29b-41d4-a716-446655440003",
  "serviceId": "960e8400-e29b-41d4-a716-446655440031",
  "dateTime": "2026-05-01T10:30:00.000Z",
  "address": "Dakar Plateau, Avenue Pompidou",
  "durationMinutes": 60,
  "notes": "Merci de venir avec le materiel necessaire."
}
```

### 6.7 Negotiation

```json
{
  "serviceId": "960e8400-e29b-41d4-a716-446655440031",
  "proposedAmount": 14000,
  "message": "Je peux confirmer rapidement si le tarif est ajuste."
}
```

### 6.8 Message

```json
{
  "content": "Je suis en route vers votre adresse.",
  "mediaUrl": null
}
```

### 6.9 Paiement

```json
{
  "bookingId": "650e8400-e29b-41d4-a716-446655440001",
  "method": "WAVE"
}
```

### 6.10 Broadcast admin

```json
{
  "target": "CLIENT",
  "title": "Maintenance planifiee",
  "body": "Une maintenance courte est prevue ce soir.",
  "data": {
    "kind": "maintenance"
  }
}
```

## 7. Variables utiles a conserver dans Postman

- `baseUrl`
- `accessToken`
- `refreshToken`
- `userId`
- `professionalId`
- `categoryId`
- `serviceId`
- `negotiationId`
- `reservationId`
- `conversationId`
- `messageId`
- `paymentId`
- `notificationId`
- `disputeId`
- `availabilityId`
- `portfolioItemId`

## 8. Regles pratiques de test

- utiliser un compte `ADMIN` distinct pour les routes admin
- utiliser `Idempotency-Key` sur l'initiation de paiement
- tester les transitions de reservation dans l'ordre logique
- tester les routes messaging HTTP avant les flux Socket.IO
- utiliser Swagger comme source la plus complete pour les exemples de payloads

## 9. Ce que la collection Postman ne couvre pas parfaitement

La collection HTTP ne remplace pas :

- les tests E2E Jest
- les sockets `messaging.gateway.ts`
- les sockets `live-tracking.gateway.ts`
- les envois reels fournisseurs email, SMS et push

## 10. Reference complementaire

Pour les payloads les plus a jour et les exemples d'enveloppes de reponse, la reference principale reste Swagger :

`http://localhost:3000/api/docs`

Le guide Swagger local et production est documente ici :

`backend/docs/SWAGGER_TESTS.md`

Postman est ici un complement pratique de verification manuelle, pas la source de verite unique de l'API.
