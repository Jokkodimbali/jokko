# TABLEAU TRELLO - WORKFLOW ET TÂCHES DU PROJET JOKKO

Ce document représente l'organisation complète du projet au format "Tickets". Il contient toutes les tâches à accomplir (Backend + Base de données + Infra), classées par priorités, avec les contraintes techniques obligatoires.

---

## 🏷️ 1. ÉTIQUETTES (LABELS) À CONFIGURER
- 🔴 `P0 (Critique)` : Bloque l'application ou l'architecture (priorité maximale).
- 🟠 `P1 (Important)` : Fonctionnalités métiers principales (MVP).
- 🔵 `P2 (Secondaire)` : Améliorations, notifications non urgentes.
- 🟢 `Backend` / 📱 `Frontend` / ⚙️ `DevOps` / 🛡️ `Securité`

## 🗂️ 2. COLONNES (WORKFLOW)
1. **Backlog (Idées et tâches futures)**
2. **À Faire (To Do - Sprint Actuel)**
3. **En Cours (Doing)** (WIP Limit : Max 3 par développeur)
4. **En Revue (Code Review / QA)**
5. **Terminé (Done)**

---

## 🛠️ 3. DÉFINITION OF DONE (DoD) - RÈGLES FIXES
*Un ticket ne peut passer dans la colonne "Terminé" que si :*
- [ ] Le code compile sans erreur (`npm run build`).
- [ ] Les contraintes techniques du ticket sont respectées.
- [ ] 100% de la logique métier est validée par des tests unitaires (`npm run test`).
- [ ] Les inputs sont typés et validés (`class-validator` / `class-transformer`).
- [ ] La documentation Swagger est mise à jour (Décorateurs `@Api...`).
- [ ] La Pull Request a été validée par un pair.
- [ ] L'observabilité (logs Sentry/Winston) est ajoutée si nécessaire.

---

## 📝 4. LISTE DES TICKETS (PRODUCT BACKLOG)

### EPIC 1 : INFRASTRUCTURE & AUTHENTIFICATION (Fondations)

**Ticket 1.1 : Setup Projet & Base de Données**
- **Étiquettes :** `P0 (Critique)`, `Backend`, `DevOps`
- **Description :** Initialiser NestJS et connecter Prisma à Neon PostgreSQL.
- **Contraintes Techniques :**
  - Activer l'extension `PostGIS` pour la géolocalisation.
  - Structurer l'architecture logicielle proprement (Clean Architecture ou MVC modulaire).
- **Checklist :**
  - [ ] Déploiement du schéma Prisma complet (User, Profile, Booking, Message...).
  - [ ] Configuration du `.env` avec validation dynamique (Joi/Zod).

**Ticket 1.2 : S'enregistrer et s'authentifier (Clients / Pros)**
- **Étiquettes :** `P0 (Critique)`, `Backend`, `Securité`
- **Description :** Inscription avec hachage (bcrypt) et authentification par Token.
- **Contraintes Techniques :**
  - Utilisation de `Passport-JWT`.
  - Mot de passe haché par `bcryptjs` (salt rounds: 10).
  - Gestion stricte de `RoleGuard` (Admin, Client, Pro).
- **Checklist :**
  - [ ] `POST /auth/register`
  - [ ] `POST /auth/login` (Génère le JWT)
  - [ ] Décorateur `@CurrentUser()` créé.

### EPIC 2 : PROFILS & SERVICES MOBILES

**Ticket 2.1 : Profil Professionnel & KYC**
- **Étiquettes :** `P1 (Important)`, `Backend`
- **Description :** Permettre aux pros de renseigner leur bio, pièce d'identité et position.
- **Contraintes Techniques :**
  - Sauvegarde de position `latitude/longitude` convertie en postGIS Point `geometry(Point, 4326)`.
- **Checklist :**
  - [ ] `POST /profiles/pro` (Création profil)
  - [ ] `PATCH /profiles/pro/location` (Mise à jour GPS)
  - [ ] Enregistrement du statut KYC (PENDING par défaut).

**Ticket 2.2 : Gestion des Catégories et des Services**
- **Étiquettes :** `P1 (Important)`, `Backend`
- **Description :** Le pro peut créer des services avec des tarifs (Fixe / Négociable).
- **Contraintes Techniques :**
  - Le prix doit être un type `Decimal` précis (pas un Float brut) pour éviter les arrondis d'argent.
- **Checklist :**
  - [ ] `POST /services` (Avec vérification `PriceType` FIXE ou NEGOTIABLE).
  - [ ] `GET /services` (Filtre par géographie et par catégorie).

### EPIC 3 : SYSTÈME DE RÉSERVATION & ESCROW (Le Cœur)

**Ticket 3.1 : Création d'une Réservation (Booking)**
- **Étiquettes :** `P0 (Critique)`, `Backend`
- **Description :** Le client réserve un service d'un Pro pour une date spécifique.
- **Contraintes Techniques :**
  - Assurer la gestion transactionnelle : Une réservation ne doit pas pouvoir écraser un créneau déjà pris (Isolation de transaction Prisma).
- **Checklist :**
  - [ ] `POST /bookings` avec adresse du client et notes.
  - [ ] Vérification du statut de la réservation (Passe en PENDING).

**Ticket 3.2 : Intégration PayDunya & Escrow (Séquestre)**
- **Étiquettes :** `P0 (Critique)`, `Backend`, `Securité`
- **Description :** Le client paie via Wave/Mobile Money. L'argent est bloqué (Escrow) jusqu'à satisfaction.
- **Contraintes Techniques :**
  - Traitement du `Webhook` PayDunya avec vérification stricte de signature cryptographique HMAC.
  - Le `Wallet` du professionnel n'est mis à jour QUE si le booking passe à `COMPLETED`.
- **Checklist :**
  - [ ] `POST /payments/initiate` (Génère lien de paiement)
  - [ ] `POST /payments/webhook` (Validation du retour Webhook Wave/OM)
  - [ ] Calcul automatique de la commission (7%) pour Jokko.

### EPIC 4 : TEMPS RÉEL (WebSockets)

**Ticket 4.1 : Tchat Instantané (Clients <-> Pros)**
- **Étiquettes :** `P1 (Important)`, `Backend`
- **Description :** Les utilisateurs peuvent discuter en temps réel dans une Inbox.
- **Contraintes Techniques :**
  - Utilisation de `socket.io` via `@nestjs/websockets`.
  - Authentification requise sur le socket (validation du JWT lors du handshake).
- **Checklist :**
  - [ ] Implémenter le Socket Gateway `ChatGateway`.
  - [ ] Sauvegarder les messages en base (Prisma `Message`).
  - [ ] Émission `newMessage` aux clients connectés.

**Ticket 4.2 : Tracking GPS en Direct**
- **Étiquettes :** `P2 (Secondaire)`, `Backend`
- **Description :** Le client voit la position du Pro arriver chez lui (style Uber).
- **Contraintes Techniques :**
  - Les pings de localisation ne doivent pas surcharger la BDD. Utiliser idéalement Redis ou émettre sans persistance, avec persistance partielle (toutes les X minutes).
- **Checklist :**
  - [ ] Écoute de l'évènement `proLocationUpdate`.
  - [ ] Diffusion à la room `booking_ID`.

### EPIC 5 : NOTIFICATIONS & SÉCURITÉ

**Ticket 5.1 : Notifications Push (Firebase FCM)**
- **Étiquettes :** `P1 (Important)`, `Backend`
- **Description :** Alerter le téléphone de l'utilisateur (ex: "Le professionnel est arrivé !").
- **Contraintes Techniques :**
  - Exécution en arrière-plan (File d'attente Asynchrone / BullMQ si possible, ou events NestJS). Ne doit pas ralentir la requête API principale.
- **Checklist :**
  - [ ] Brancher Firebase Admin SDK.
  - [ ] Gérer l'entité de Notification Prisma.

---

## 📈 RÈGLES DE VALIDATION RAPIDE
- Les tickets de **l'Epic 1 et 3** (Auth et Paiement) doivent être la priorité absolue avant de s'attaquer aux WebSockets (Epic 4).
- Ne commencez aucun ticket sans comprendre la logique métier contenue dans les documents de spécification (`cahier_des_charges_jokko.md`).
