# Tableau Centralise Des Messages HTTP

## 1. Objet
Ce document decrit comment les messages HTTP, les messages de validation, les messages techniques, les messages de notification et les textes Swagger sont centralises dans le backend Jokko.

Il doit refleter le code reel du projet. Il ne sert pas a dupliquer aveuglement tous les libelles du repository, mais a expliquer la structure de centralisation, les conventions de reponse et les familles de messages actuellement utilisees.

## 2. Sources de verite actuelles
Les catalogues de reference se trouvent dans `backend/src/core/messages/`.

| Fichier | Responsabilite |
|---|---|
| `app-message.catalog.ts` | Messages applicatifs HTTP exposes au frontend |
| `validation-message.catalog.ts` | Messages de validation DTO et pipe global |
| `technical-message.catalog.ts` | Messages techniques et logs repetitifs |
| `domain-message.catalog.ts` | Messages de domaine et erreurs metier structurees |
| `api-docs.messages.ts` | Textes Swagger, titres, summaries, descriptions, exemples |
| `reservation-notification.messages.ts` | Contenus de notification lies aux reservations |
| `payment-notification.messages.ts` | Contenus de notification lies aux paiements |
| `messaging-notification.messages.ts` | Contenus de notification lies a la messagerie |
| `dispute-notification.messages.ts` | Contenus de notification lies aux litiges |

Les points d'entree HTTP et les helpers associes se trouvent ensuite dans `backend/src/core/http/`.

| Fichier | Responsabilite |
|---|---|
| `app-messages.ts` | Point d'entree HTTP vers les catalogues |
| `app-http.exception.ts` | Construction des erreurs applicatives centralisees |
| `validation-exception.factory.ts` | Transformation standardisee des erreurs de validation |
| `api-exception.filter.ts` | Normalisation finale des erreurs HTTP |
| `http-status-codes.ts` | Constantes des statuts HTTP utilises par le backend |

## 3. Principe architectural
Dans Jokko, un texte visible par un client HTTP ne doit pas etre ecrit librement dans un controller ou un service si ce texte a une valeur reusable.

Les objectifs de cette centralisation sont les suivants :

- garder un langage uniforme entre modules
- rendre les modifications de libelles rapides et sures
- eviter les chaines en dur dispersees
- stabiliser les codes d'erreur consommes par Flutter, web et admin
- aligner Swagger, runtime HTTP, validation et notifications

## 4. Format des reponses HTTP
Le backend renvoie des enveloppes homogennes.

### 4.1 Reponse de succes

```json
{
  "success": true,
  "message": "Operation effectuee avec succes.",
  "data": {},
  "meta": {}
}
```

`message` et `meta` peuvent etre absents ou `null` selon le cas d'usage. Pour les listes paginees, `meta.pagination` est renseigne.

### 4.2 Reponse d'erreur

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_REQUEST_INVALID",
  "message": "Les donnees envoyees sont invalides.",
  "timestamp": "2026-04-24T10:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

## 5. Table des statuts HTTP centralises
Le projet centralise les familles de statuts dans `http-status-codes.ts`.

| Famille | Cle | Valeur |
|---|---|---:|
| `SUCCESS` | `OK` | `200` |
| `SUCCESS` | `CREATED` | `201` |
| `CLIENT_ERROR` | `BAD_REQUEST` | `400` |
| `CLIENT_ERROR` | `UNAUTHORIZED` | `401` |
| `CLIENT_ERROR` | `FORBIDDEN` | `403` |
| `CLIENT_ERROR` | `NOT_FOUND` | `404` |
| `CLIENT_ERROR` | `CONFLICT` | `409` |
| `CLIENT_ERROR` | `TOO_MANY_REQUESTS` | `429` |
| `SERVER_ERROR` | `INTERNAL_SERVER_ERROR` | `500` |
| `SERVER_ERROR` | `NOT_IMPLEMENTED` | `501` |

## 6. Prefixes fonctionnels actuellement presents
Les codes metier exposes suivent des prefixes coherents par domaine.

| Prefixe | Domaine |
|---|---|
| `AUTH_` | Authentification et sessions |
| `USERS_` | Profil utilisateur et administration utilisateur |
| `PROFESSIONALS_` | Profils professionnels, KYC, services, portfolio, disponibilites |
| `CATEGORIES_` | Categories publiques et admin |
| `SEARCH_` | Recherche geolocalisee |
| `RESERVATIONS_` | Reservations, transitions d'etat, avis client |
| `NEGOTIATIONS_` | Negociation de prix |
| `MESSAGING_` | Conversations et messages |
| `LIVE_TRACKING_` | Presence et tracking temps reel |
| `PAYMENTS_` | Paiements, escrow, retraits |
| `NOTIFICATIONS_` | Notifications in-app et token FCM |
| `DISPUTES_` | Litiges et decisions admin |
| `ADMIN_` | Dashboard et gouvernance transverse |
| `VALIDATION_` | Validation globale |
| `SYSTEM_` | Erreurs systeme |

## 7. Familles de messages par usage

### 7.1 Messages applicatifs HTTP
Ces messages sont ceux que les frontends voient le plus souvent dans les reponses de succes et d'erreur.

Exemples representatifs :

| Code | Usage |
|---|---|
| `AUTH_INVALID_CREDENTIALS` | Echec de connexion |
| `USERS_PROFILE_UPDATED` | Mise a jour du profil utilisateur |
| `PROFESSIONALS_KYC_APPROVED` | Validation KYC par l'admin |
| `CATEGORIES_CATEGORY_CREATED` | Creation d'une categorie |
| `RESERVATIONS_CREATED` | Creation d'une reservation |
| `NEGOTIATIONS_ACCEPTED` | Acceptation d'une negotiation |
| `MESSAGING_MESSAGE_SENT` | Envoi d'un message |
| `PAYMENTS_INITIATED` | Initiation d'un paiement |
| `NOTIFICATIONS_MARKED_AS_READ` | Notification marquee comme lue |
| `DISPUTES_RESOLVED` | Resolution d'un litige |

### 7.2 Messages de validation
Ces messages sont utilises par `class-validator` et le `ValidationPipe` global.

Ils couvrent notamment :

- telephone, email, mot de passe, OTP
- identifiants UUID
- dates ISO
- limites de pagination
- montants de paiement et de retrait
- motifs de litige
- champs KYC
- filtres admin
- coordonnees GPS et payloads live tracking

### 7.3 Messages techniques
Ces messages ne sont pas destines a etre exposes tels quels a l'utilisateur final. Ils servent surtout :

- aux logs d'infrastructure
- au diagnostic de provider email, SMS ou push
- aux scripts de seed et de maintenance
- aux problemes de sante base de donnees

### 7.4 Messages de notification
Les notifications sont elles aussi centralisees.

| Catalogue | Perimetre |
|---|---|
| `reservation-notification.messages.ts` | confirmation, annulation, paiement, ajustement de prix, en route, etc. |
| `payment-notification.messages.ts` | paiement confirme, escrow, wallet, retrait |
| `messaging-notification.messages.ts` | nouveau message, lecture, realtime |
| `dispute-notification.messages.ts` | ouverture de litige, prise en charge, resolution |

## 8. Relation entre runtime HTTP et Swagger
Swagger fait partie de la centralisation. Les summaries, tags, descriptions de params, descriptions de DTO et exemples de payloads passent par `api-docs.messages.ts` et `swagger-response.examples.ts`.

Le standard courant du projet repose sur :

- `ApiStandardSuccessResponse`
- `ApiStandardErrorResponse`
- `ApiSuccessEnvelopeSwaggerDto`
- `ApiErrorSwaggerDto`
- `PaginationSwaggerDto`

Cela garantit que la documentation interactive montre la meme enveloppe que le runtime HTTP.

## 9. Exemples d'erreurs metier importantes
Voici quelques cas qui structurent fortement le backend actuel.

| Domaine | Code representatif | Sens |
|---|---|---|
| Auth | `AUTH_ACCOUNT_INACTIVE` | Le compte a ete bloque par l'administration |
| Reservations | `RESERVATIONS_SELF_BOOKING_FORBIDDEN` | Un prestataire ne peut pas reserver son propre service |
| Reservations | `RESERVATIONS_PRICE_ADJUSTMENT_PAYMENT_ALREADY_EXISTS` | Ajustement de prix bloque apres paiement |
| Negotiations | `NEGOTIATIONS_ALREADY_CONVERTED` | Une negotiation ne peut pas etre reconvertie en reservation |
| Messaging | `MESSAGING_CONVERSATION_ACCESS_FORBIDDEN` | Acces interdit a une conversation |
| Payments | `PAYMENTS_ESCROW_STATUS_INVALID` | Transition escrow invalide |
| Disputes | `DISPUTES_ALREADY_EXISTS_FOR_BOOKING` | Un litige unique existe deja pour la reservation |

## 10. Regles d'usage obligatoires

- un controller ne doit pas fabriquer un message metier deja connu
- un DTO ne doit pas embarquer un texte libre si un message de validation existe deja
- un service ne doit pas lancer `throw new Error('...')` pour un cas metier visible
- un texte Swagger partage doit vivre dans `api-docs.messages.ts`
- un exemple de reponse partage doit vivre dans `swagger-response.examples.ts`

## 11. Comment faire evoluer ce referentiel
Lorsqu'un nouveau module est ajoute ou qu'un module existant change, la bonne demarche est :

1. ajouter ou mettre a jour les messages dans le bon catalogue
2. brancher ces messages dans le code runtime
3. aligner Swagger
4. mettre a jour ce document si une nouvelle famille ou une nouvelle convention apparait

Ce document ne remplace pas les catalogues du code. Il explique leur organisation et les conventions d'usage. Les catalogues TypeScript restent la source de verite la plus fine.

## 12. Etat actuel du backend couvert par cette centralisation
La centralisation couvre maintenant les modules suivants :

- auth
- users
- professionals
- categories
- search
- reservations
- negotiations
- messaging
- live-tracking
- payments
- notifications
- disputes
- admin
- sante

## 13. Conclusion
Le backend Jokko ne traite pas les messages comme un detail cosmetique. Les messages font partie du contrat d'API, de la qualite de developpement et de la stabilite produit.

Ce document doit rester strictement aligne avec les fichiers sous `src/core/messages/` et `src/core/http/`. Si un changement de comportement modifie la facon dont un message, un code HTTP ou un exemple Swagger est gere, ce document doit etre revu dans le meme mouvement.
