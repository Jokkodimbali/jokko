# CAHIER DES CHARGES PROFESSIONNEL — PROJET JOKKO
**Version** : 3.0 | **Date** : Avril 2026 | **Statut** : Document Officiel de Référence

---

## HISTORIQUE DES RÉVISIONS

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | Mars 2026 | Équipe Jokko | Première version - Vision et fonctionnalités |
| 2.0 | Avril 2026 | Équipe Jokko | Ajout architecture technique, BDD, sécurité |
| 3.0 | Avril 2026 | Équipe Jokko | Version finale : User Stories, politique annulation/retrait, glossaire, corrections BDD |

---

## FICHE D'IDENTITÉ DU PROJET

| Champ | Détail |
|-------|--------|
| **Nom du Projet** | JOKKO |
| **Signification** | "Jokko" signifie "Contact / Lien" en Wolof |
| **Slogan** | *"Votre Expert, à Portée de Main"* |
| **Type** | Application Mobile Marketplace de Services B2C |
| **Marché cible** | Sénégal (Extension CEDEAO prévue Phase 2) |
| **Stack Technique** | Flutter + NestJS + PostgreSQL/PostGIS |
| **Paiements intégrés** | Wave SN, Orange Money SN, Carte Bancaire |
| **Langues** | Français + Wolof |
| **Plateformes cibles** | Android (prioritaire) + iOS |

---

## GLOSSAIRE DES TERMES

| Terme | Définition |
|-------|------------|
| **Escrow (Séquestre)** | Mécanisme par lequel l'argent du client est bloqué par Jokko et ne sera versé au Pro qu'à la validation de la prestation |
| **KYC** | "Know Your Customer" — Processus de vérification d'identité d'un professionnel via sa Carte Nationale d'Identité (CNI) |
| **PostGIS** | Extension de PostgreSQL permettant de stocker et d'interroger des données géographiques (coordonnées GPS, calculs de distance) |
| **OTP** | "One-Time Password" — Code à usage unique envoyé par SMS pour valider un numéro de téléphone |
| **JWT** | "JSON Web Token" — Jeton numérique sécurisé utilisé pour identifier un utilisateur connecté |
| **WebSocket** | Protocole de communication bidirectionnel permettant les échanges en temps réel (tchat, GPS live) |
| **Webhook** | URL secrète exposée par le serveur Jokko pour recevoir les confirmations de paiement de Wave/Orange Money |
| **FCM** | "Firebase Cloud Messaging" — Service Google pour envoyer des notifications push sur Android et iOS |
| **P0 / P1 / P2** | Niveaux de priorité : P0=Indispensable au lancement, P1=Important mais reportable, P2=Amélioration future |
| **GTM** | "Go-To-Market" — Plan stratégique de mise sur le marché d'un produit |
| **BCEAO** | Banque Centrale des États de l'Afrique de l'Ouest — Régulateur des transactions financières en zone UEMOA |
| **SLA** | "Service Level Agreement" — Engagement de niveau de qualité de service (ex: uptime, délai de réponse) |

---

## 1. CONTEXTE, VISION ET POSITIONNEMENT

### 1.1. Résumé Exécutif
JOKKO est une marketplace mobile qui connecte des clients sénégalais à des prestataires de services locaux vérifiés. La plateforme couvre tous les corps de métiers du quotidien — de l'artisanat à la santé — avec un système de réservation, de paiement sécurisé et de suivi GPS intégré. Elle s'impose comme le premier "Guichet Unique des Services" au Sénégal.

### 1.2. Analyse du Marché

| Indicateur | Donnée |
|------------|--------|
| Population du Sénégal | ~18 millions d'habitants (2024) |
| Taux de pénétration mobile | ~115% (plus de SIM que d'habitants) |
| Utilisateurs actifs Mobile Money | +8 millions (Wave + Orange Money) |
| Part de l'économie informelle | ~40% du PIB (artisans, prestataires sans visibilité) |
| Concurrent direct au Sénégal | Aucun (opportunité de premier entrant) |

### 1.3. Problèmes Identifiés
- **Confiance zéro** : Impossible de vérifier les qualifications d'un artisan trouvé "de bouche à oreille".
- **Opacité des tarifs** : Les prix sont souvent négociés oralement, source de conflits.
- **Fragmentation** : Aucune plateforme ne regroupe tous les types de service en un seul écosystème.
- **Sous-visibilité des artisans** : Des milliers de professionnels compétents n'ont aucune présence numérique.

### 1.4. Proposition de Valeur
- Pour le **Client** : Trouver l'artisan certifié le plus proche en moins de 2 minutes, avec garantie de paiement.
- Pour le **Professionnel** : Avoir une vitrine digitale gratuite et un flux régulier de clients.

---

## 2. ACTEURS ET PARTIES PRENANTES

| Acteur | Rôle | Responsabilités |
|--------|------|-----------------|
| **Client** | Consommateur | Rechercher, réserver, payer, noter un prestataire |
| **Professionnel** | Prestataire | Créer ses offres, gérer son agenda, exécuter les missions |
| **Administrateur Jokko** | Régulateur | Valider KYC, gérer litiges, configurer les commissions |
| **Wave / Orange Money** | Tiers financier | Traiter les paiements mobiles, confirmer les transactions via webhooks |
| **Firebase (Google)** | Infrastructure | Livraison des notifications push iOS/Android |

---

## 3. CATÉGORIES DE SERVICES

L'application comprendra au lancement les catégories suivantes (extensibles via le Back-Office Admin) :

| # | Catégorie | Exemples de Services |
|---|-----------|---------------------|
| 1 | 🏥 Santé & Médecine | Médecin généraliste, Infirmier, Sage-femme, Kiné |
| 2 | 🔧 Plomberie & Sanitaire | Débouchage, Fuite d'eau, Installation robinet |
| 3 | ⚡ Électricité | Panne électrique, Installation prise, Climatisation |
| 4 | 🚗 Mécanique Automobile | Diagnostic, Vidange, Crevaison, Remorquage |
| 5 | 💻 Informatique & Tech | Réparation PC, Récupération données, Réseau WiFi |
| 6 | 🍽️ Cuisine & Traiteur | Cuisine à domicile, Traiteur événement, Pâtisserie |
| 7 | 💇 Beauté & Bien-être | Coiffure, Maquillage, Massage, Esthétique |
| 8 | 🏗️ BTP & Rénovation | Maçonnerie, Peinture, Carrelage, Menuiserie |
| 9 | 🧹 Ménage & Services | Nettoyage, Repassage, Garde d'enfants, Jardinage |
| 10 | 📚 Cours & Formation | Cours particuliers, Soutien scolaire, Langue |
| 11 | 🚚 Transport & Livraison | Déménagement, Livraison colis, Transport VTC |
| 12 | 📸 Photo & Événement | Photographe, Animateur, DJ, Décoration |

---

## 4. USER STORIES (Cas d'utilisation)

### 4.1. Client

> **US-C01** | En tant que *client*, je veux *m'inscrire via mon numéro de téléphone* afin de *créer un compte sécurisé sans avoir besoin d'email*.
>
> **US-C02** | En tant que *client*, je veux *rechercher un plombier proche de ma position GPS* afin de *trouver rapidement quelqu'un disponible dans mon quartier*.
>
> **US-C03** | En tant que *client*, je veux *consulter le portfolio photo d'un artisan* afin de *m'assurer de la qualité de son travail avant de réserver*.
>
> **US-C04** | En tant que *client*, je veux *voir si le tarif est fixe ou négociable* afin de *savoir si je peux discuter le prix avant de confirmer*.
>
> **US-C05** | En tant que *client*, je veux *payer via Wave ou Orange Money* afin de *réserver sans avoir à sortir de l'argent liquide*.
>
> **US-C06** | En tant que *client*, je veux *suivre la position du pro sur une carte* afin de *savoir précisément quand il va arriver chez moi*.
>
> **US-C07** | En tant que *client*, je veux *valider la fin de la prestation* afin de *déclencher le paiement définitif vers l'artisan uniquement si je suis satisfait*.
>
> **US-C08** | En tant que *client*, je veux *laisser une note et un commentaire* afin de *aider les autres clients à choisir les meilleurs prestataires*.

### 4.2. Professionnel

> **US-P01** | En tant que *professionnel*, je veux *créer mon profil avec ma CNI* afin de *obtenir le badge "Vérifié" qui rassure les clients*.
>
> **US-P02** | En tant que *professionnel*, je veux *publier mes réalisations en photo* afin de *convaincre les clients potentiels de ma compétence*.
>
> **US-P03** | En tant que *professionnel*, je veux *définir mes horaires d'ouverture* afin de *ne recevoir des réservations que quand je suis disponible*.
>
> **US-P04** | En tant que *professionnel*, je veux *recevoir une notification immédiate pour chaque nouvelle réservation* afin de *ne jamais rater une mission*.
>
> **US-P05** | En tant que *professionnel*, je veux *retirer mes gains directement sur Wave ou Orange Money* afin de *accéder à mon argent rapidement*.

---

## 5. CAHIER DES CHARGES FONCTIONNEL

### 5.1. MODULE CLIENT

| # | Fonctionnalité | Description | Priorité | Critère d'Acceptation |
|---|----------------|-------------|----------|-----------------------|
| C01 | Inscription | Via OTP SMS ou Google Sign-In | P0 | Le compte est créé, le token JWT est retourné |
| C02 | Profil Client | Nom, photo, adresse, historique | P0 | Les données sont sauvegardées et affichées après rechargement |
| C03 | Recherche Géolocalisée | Par mot-clé ou catégorie, triée par distance | P0 | Les résultats affichés sont correctement triés du plus proche au plus loin |
| C04 | Fiche Professionnel | Bio, notes, badge KYC, portfolio, disponibilités | P0 | Toutes les informations s'affichent dans un délai < 2s |
| C05 | Détail Service | Titre, description, prix, type (Fixe/Négo) | P0 | Le type de tarif est clairement affiché avec une icône différenciée |
| C06 | Tchat | Messagerie texte + photo, temps réel | P1 | Un message envoyé apparaît chez le destinataire en < 1s |
| C07 | Réservation | Créneau, date, adresse, note | P0 | La réservation est visible dans le tableau de bord du Pro immédiatement |
| C08 | Paiement Escrow | Wave / Orange Money / Carte | P0 | L'argent est bloqué côté Jokko et le statut passe à PAID_ESCROW |
| C09 | Live Tracking | Carte avec position du Pro en temps réel | P1 | La position se met à jour sur la carte en moins de 5 secondes |
| C10 | Validation Fin | Le client valide la prestation | P0 | Les fonds sont débloqués vers le portefeuille du Pro |
| C11 | Notation | Note /5 + commentaire | P0 | La note moyenne du Pro est recalculée immédiatement |
| C12 | Litiges | Signalement + blocage du paiement | P1 | L'Admin est notifié et le paiement est mis en attente |
| C13 | Notifications Push | Via Firebase FCM | P0 | La notification apparaît en moins de 3s sur le téléphone |
| C14 | Historique & Factures | PDF téléchargeable | P1 | Le PDF généré contient toutes les données de la prestation |
| C15 | Parrainage | Code unique + cashback 1000 FCFA | P2 | Le cashback est crédité uniquement après la 1ère réservation du filleul |

### 5.2. MODULE PROFESSIONNEL

| # | Fonctionnalité | Description | Priorité | Critère d'Acceptation |
|---|----------------|-------------|----------|-----------------------|
| P01 | Inscription Pro | CNI + photo de profil + bio | P0 | Le statut KYC passe à PENDING et l'Admin est notifié |
| P02 | Statut KYC | Attente / Vérifié / Rejeté | P0 | Le Pro ne peut pas recevoir de réservations tant que kyc_status ≠ VERIFIED |
| P03 | Création Services | Titre, description, prix, type | P0 | Le service est visible sur la fiche Pro après création |
| P04 | Agenda | Jours et horaires d'ouverture | P0 | Une réservation hors créneaux est impossible côté client |
| P05 | Portfolio | Upload photos + description | P1 | Les photos sont visibles depuis la fiche Pro du client |
| P06 | Tableau de Bord | Revenus, réservations, note | P0 | Les statistiques se mettent à jour sans rechargement manuel |
| P07 | Gestion Demandes | Accepter / Refuser avec motif | P0 | Le client est notifié de la décision en temps réel |
| P08 | Activation GPS | Bouton "Je suis en route" | P1 | Le statut passe à ON_THE_WAY et le GPS se déclenche |
| P09 | Portefeuille | Gains séquestre / débloqués | P0 | Les montants sont exacts et cohérents avec les paiements reçus |
| P10 | Retrait | Vers Wave ou Orange Money | P0 | Le virement est exécuté et le solde mis à jour sous 24h |
| P11 | Tchat | Messagerie avec client | P1 | Identique au critère C06 |

### 5.3. MODULE ADMINISTRATEUR

| # | Fonctionnalité | Description |
|---|----------------|-------------|
| A01 | Dashboard Analytics | Utilisateurs actifs, CA, réservations en cours, litiges |
| A02 | Validation KYC | Visionner CNI, approuver ou rejeter avec motif de rejet |
| A03 | Gestion Catégories | Ajouter, modifier, désactiver des catégories |
| A04 | Gestion Litiges | Visualiser échanges, trancher, décider remboursement ou déblocage |
| A05 | Configuration Commission | Modifier le taux (%) de prélèvement par catégorie |
| A06 | Notifications de masse | Envoyer une alerte push à tous les clients ou tous les pros |
| A07 | Gestion Utilisateurs | Bloquer / Débloquer un compte, voir l'historique d'un utilisateur |

---

## 6. RÈGLES MÉTIER DÉTAILLÉES

### 6.1. Politique d'Annulation

| Moment d'annulation | Remboursement Client | Pénalité Pro |
|---------------------|----------------------|--------------|
| Annulation **avant** la confirmation du Pro | 100% remboursé | Aucune |
| Annulation par le client **24h avant** le R.V | 100% remboursé | Aucune |
| Annulation par le client **entre 2h et 24h avant** | 70% remboursé (30% retenu par Jokko) | Aucune |
| Annulation par le client **moins de 2h avant** | 50% remboursé | Aucune |
| Annulation par le **Pro** après confirmation | 100% remboursé au client | Pénalité de -1 point de réputation |
| **No-show Pro** (ne se présente pas) | 100% remboursé + 500 FCFA de compensation | Suspension temporaire du compte |

### 6.2. Politique de Retrait des Fonds (Professionnels)

- **Délai de déblocage** : Les fonds sont disponibles au retrait **24h après** la validation de la prestation par le client.
- **Montant minimum de retrait** : 2 000 FCFA.
- **Montant maximum de retrait** : 500 000 FCFA par transaction (limite Mobile Money BCEAO).
- **Délai de virement** : Le virement vers Wave ou Orange Money est exécuté en **moins de 2 heures ouvrées**.
- **Frais de retrait** : Gratuit jusqu'à 2 retraits par semaine. Au-delà : 1% par retrait supplémentaire.

### 6.3. Calcul de la Commission

```
Prix payé par le client          = 10 000 FCFA
Commission Jokko (10%)           =  1 000 FCFA
Montant net reverse au Pro       =  9 000 FCFA
```
> La commission par defaut est de 10% et reste configurable dans le Back-Office Admin selon la categorie.

### 6.4. Règles KYC

- Un Pro sans validation KYC peut créer son profil mais **ne peut pas apparaître dans les résultats de recherche**.
- En cas de rejet KYC, le Pro reçoit un motif détaillé et peut soumettre un nouveau document.
- La validation KYC doit être traitée par l'Admin dans un délai maximum de **48 heures ouvrées**.

### 6.5. Règles de Notation
- La note d'un Pro est calculée comme la **moyenne glissante** de tous ses avis.
- Un Pro en-dessous de **2.5/5** après 10 avis reçoit un avertissement de l'Admin.
- Un Pro en-dessous de **2/5** est automatiquement suspendu en attente de révision.

---

## 7. EXIGENCES NON-FONCTIONNELLES

| Critère | Exigence Mesurable | Justification |
|---------|-------------------|---------------|
| **Disponibilité** | 99.5% d'uptime/mois | Urgences 24h/24 (médecin, panne) |
| **Performance API** | 95% des requêtes < 300ms | Tolérance mobile très faible en Afrique |
| **Performance Recherche Géo** | Résultats en < 500ms pour 10 000 professionnels | Expérience fluide sur la fonctionnalité clé |
| **Scalabilité** | 10 000 connexions simultanées | Architecture prête pour la croissance virale |
| **Sécurité données** | Chiffrement AES-256 au repos, TLS 1.3 en transit | Données bancaires et personnelles sensibles |
| **Mode Offline** | Cache des 10 dernières recherches | Connexion 4G instable au Sénégal |
| **Démarrage App** | Cold start < 3 secondes | Taux d'abandon élevé au-delà |
| **Backup** | Sauvegarde BDD toutes les 6h | Protection contre perte de données de paiement |
| **Recovery (RTO)** | Restauration en < 2 heures en cas de panne | Minimiser l'impact business |

---

## 8. MODÉLISATION DE LA BASE DE DONNÉES

### 8.1. Tables et Champs (Version Corrigée)

**Table : `users`**
```sql
id             UUID          PRIMARY KEY DEFAULT gen_random_uuid()
phone_number   VARCHAR(20)   UNIQUE NOT NULL
name           VARCHAR(100)  NOT NULL
email          VARCHAR(150)  UNIQUE NULLABLE
password_hash  VARCHAR(255)  NULLABLE  -- NULL si connexion via Google OAuth
oauth_provider VARCHAR(50)   NULLABLE  -- 'GOOGLE', 'APPLE', etc.
oauth_id       VARCHAR(200)  NULLABLE  -- ID unique retourné par Google
role           VARCHAR(10)   NOT NULL DEFAULT 'CLIENT'  -- 'CLIENT', 'PRO', 'ADMIN'
avatar_url     VARCHAR(500)  NULLABLE
fcm_token      VARCHAR(500)  NULLABLE  -- Token Firebase pour les notifications push
is_active      BOOLEAN       NOT NULL DEFAULT true
created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
```

**Table : `professional_profiles`**
```sql
id              UUID           PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE
bio             TEXT           NULLABLE
company_name    VARCHAR(150)   NULLABLE
id_card_url     VARCHAR(500)   NULLABLE  -- Document CNI (KYC)
kyc_status      VARCHAR(10)    NOT NULL DEFAULT 'PENDING'  -- 'PENDING','VERIFIED','REJECTED'
kyc_reject_reason TEXT         NULLABLE  -- Motif en cas de rejet KYC
location        GEOGRAPHY(POINT, 4326)   -- PostGIS : coordonnées GPS du Pro
city            VARCHAR(100)   NULLABLE  -- Ex: Dakar, Thiès
global_rating   DECIMAL(2,1)   NOT NULL DEFAULT 0.0
total_reviews   INTEGER        NOT NULL DEFAULT 0
wallet_balance  DECIMAL(12,2)  NOT NULL DEFAULT 0.00  -- En FCFA
created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
```

**Table : `categories`**
```sql
id         UUID          PRIMARY KEY DEFAULT gen_random_uuid()
name       VARCHAR(100)  NOT NULL UNIQUE
icon_url   VARCHAR(500)  NULLABLE
sort_order SMALLINT      NOT NULL DEFAULT 0  -- Ordre d'affichage
is_active  BOOLEAN       NOT NULL DEFAULT true
```

**Table : `services`**
```sql
id              UUID           PRIMARY KEY DEFAULT gen_random_uuid()
professional_id UUID           NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE
category_id     UUID           NOT NULL REFERENCES categories(id)
name            VARCHAR(200)   NOT NULL
description     TEXT           NOT NULL  -- Description détaillée, obligatoire
price           DECIMAL(10,2)  NOT NULL
price_type      VARCHAR(12)    NOT NULL  -- 'FIXED' ou 'NEGOTIABLE'
is_available    BOOLEAN        NOT NULL DEFAULT true
created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP      NOT NULL DEFAULT NOW()
```

**Table : `availabilities`**
```sql
id              UUID       PRIMARY KEY DEFAULT gen_random_uuid()
professional_id UUID       NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE
day_of_week     SMALLINT   NOT NULL  -- 0=Lundi, 1=Mardi... 6=Dimanche
start_time      TIME       NOT NULL
end_time        TIME       NOT NULL
is_active       BOOLEAN    NOT NULL DEFAULT true
CONSTRAINT chk_time CHECK (end_time > start_time)
```

**Table : `portfolio_items`**
```sql
id              UUID          PRIMARY KEY DEFAULT gen_random_uuid()
professional_id UUID          NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE
title           VARCHAR(200)  NOT NULL
description     TEXT          NULLABLE
image_url       VARCHAR(500)  NOT NULL
created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
```

**Table : `bookings`**
```sql
id               UUID           PRIMARY KEY DEFAULT gen_random_uuid()
client_id        UUID           NOT NULL REFERENCES users(id)
service_id       UUID           NOT NULL REFERENCES services(id)
status           VARCHAR(15)    NOT NULL DEFAULT 'PENDING'
                                -- 'PENDING','CONFIRMED','PAID_ESCROW',
                                -- 'ON_THE_WAY','COMPLETED','CANCELLED','DISPUTED'
scheduled_at     TIMESTAMP      NOT NULL
client_address   TEXT           NOT NULL
client_notes     TEXT           NULLABLE  -- Note optionnelle du client
agreed_price     DECIMAL(10,2)  NULLABLE  -- Prix final (après négociation éventuelle)
cancel_reason    TEXT           NULLABLE
client_rating    SMALLINT       NULLABLE  -- 1 à 5
client_review    TEXT           NULLABLE
cancelled_at     TIMESTAMP      NULLABLE
completed_at     TIMESTAMP      NULLABLE
created_at       TIMESTAMP      NOT NULL DEFAULT NOW()
CONSTRAINT chk_rating CHECK (client_rating BETWEEN 1 AND 5)
```

**Table : `payments`**
```sql
id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid()
booking_id         UUID           NOT NULL UNIQUE REFERENCES bookings(id)
amount             DECIMAL(12,2)  NOT NULL  -- Montant total payé par le client (FCFA)
commission_amount  DECIMAL(12,2)  NOT NULL  -- Part Jokko
net_amount         DECIMAL(12,2)  NOT NULL  -- Montant net reversé au Pro
method             VARCHAR(15)    NOT NULL  -- 'WAVE', 'ORANGE_MONEY', 'CARD'
status             VARCHAR(10)    NOT NULL DEFAULT 'PENDING'
                                  -- 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'
provider_ref       VARCHAR(200)   NULLABLE  -- Référence de transaction Wave/OM
refund_reason      TEXT           NULLABLE
created_at         TIMESTAMP      NOT NULL DEFAULT NOW()
```

**Table : `conversations`**
```sql
id              UUID       PRIMARY KEY DEFAULT gen_random_uuid()
client_id       UUID       NOT NULL REFERENCES users(id)
professional_id UUID       NOT NULL REFERENCES users(id)
booking_id      UUID       NULLABLE REFERENCES bookings(id)
last_message_at TIMESTAMP  NULLABLE  -- Pour trier les conversations par activité
created_at      TIMESTAMP  NOT NULL DEFAULT NOW()
UNIQUE(client_id, professional_id)
```

**Table : `messages`**
```sql
id              UUID          PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE
sender_id       UUID          NOT NULL REFERENCES users(id)
content         TEXT          NULLABLE    -- NULL si c'est un envoi de photo uniquement
media_url       VARCHAR(500)  NULLABLE    -- URL vers AWS S3 si photo envoyée
is_read         BOOLEAN       NOT NULL DEFAULT false
created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
CONSTRAINT chk_content CHECK (content IS NOT NULL OR media_url IS NOT NULL)
```

**Table : `notifications`**
```sql
id         UUID          PRIMARY KEY DEFAULT gen_random_uuid()
user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE
type       VARCHAR(30)   NOT NULL
           -- 'NEW_BOOKING', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED',
           -- 'PRO_ON_THE_WAY', 'PAYMENT_RELEASED', 'NEW_MESSAGE',
           -- 'KYC_APPROVED', 'KYC_REJECTED', 'DISPUTE_RESOLVED'
title      VARCHAR(200)  NOT NULL
body       TEXT          NOT NULL
data       JSONB         NULLABLE  -- Données contextuelles (ex: booking_id)
is_read    BOOLEAN       NOT NULL DEFAULT false
created_at TIMESTAMP     NOT NULL DEFAULT NOW()
```

---

## 9. ARCHITECTURE TECHNIQUE

### 9.1. Stack Technologique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Mobile | Flutter 3.x (Dart) | Codebase unique iOS + Android, performances proches du natif |
| Backend API | NestJS 10.x (Node.js 20 LTS) | Architecture modulaire, WebSockets natifs, très bon écosystème |
| ORM | Prisma | Type-safe, migrations automatiques, excellent support PostgreSQL |
| Base de Données | PostgreSQL 16 + PostGIS 3.4 | Standard industriel pour le géospatial |
| Temps Réel | Socket.io + Redis 7 (Pub/Sub) | Scalable horizontalement pour le tchat et GPS live |
| Stockage Media | AWS S3 + CloudFront (CDN) | Stockage infini, livraison rapide des images via CDN |
| Notifications | Firebase FCM | Gratuit, fiable sur iOS et Android |
| SMS / OTP | Twilio ou Infobip | Livraison SMS en Afrique de l'Ouest fiable |
| Paiement | provider paiement ou provider paiement | Agrégateurs locaux supportant Wave + OM + Cartes au Sénégal |
| CI/CD | GitHub Actions | Automatisation tests + déploiements |
| Monitoring | Sentry (erreurs) + Grafana (métriques) | Vision temps réel sur la santé du système |
| Hébergement API | AWS EC2 (eu-west-1 / Ireland) | Latence Africa < 80ms depuis Dakar |

### 9.2. Environnements

| Environnement | Usage | URL |
|---------------|-------|-----|
| **Development** | Développement local | `localhost:3000` |
| **Staging** | Tests avant production | `api-staging.jokko.sn` |
| **Production** | Utilisateurs réels | `api.jokko.sn` |

### 9.3. Endpoints API Complets

**Auth**
- `POST /api/auth/register` — Inscription classique (phone + password)
- `POST /api/auth/login` — Connexion (retourne access_token + refresh_token)
- `POST /api/auth/google` — Connexion via Google (OAuth2)
- `POST /api/auth/otp/send` — Envoi d'un OTP SMS
- `POST /api/auth/otp/verify` — Vérification OTP + création compte
- `POST /api/auth/refresh` — Renouvellement du token JWT

**Utilisateurs**
- `GET /api/users/me` — Mon profil
- `PUT /api/users/me` — Mise à jour de mon profil
- `POST /api/users/me/avatar` — Upload photo de profil
- `DELETE /api/users/me` — Supprimer mon compte (RGPD)

**Professionnels**
- `GET /api/professionals?lat=&lng=&category=&query=&radius=` — Recherche géolocalisée
- `GET /api/professionals/:id` — Fiche complète d'un Pro
- `GET /api/professionals/:id/services` — Services du Pro
- `GET /api/professionals/:id/portfolio` — Portfolio du Pro
- `GET /api/professionals/:id/availabilities` — Agenda du Pro
- `GET /api/professionals/:id/reviews` — Avis sur le Pro
- `PUT /api/professionals/me` — Mise à jour profil pro
- `POST /api/professionals/me/kyc` — Soumettre documents KYC

**Services**
- `POST /api/services` — Créer un service
- `PUT /api/services/:id` — Modifier un service
- `DELETE /api/services/:id` — Désactiver un service

**Disponibilités**
- `GET /api/availabilities/me` — Mes horaires
- `PUT /api/availabilities` — Mettre à jour mes horaires (tableau de 7 jours)

**Portfolio**
- `POST /api/portfolio` — Ajouter une réalisation
- `DELETE /api/portfolio/:id` — Supprimer une réalisation

**Réservations**
- `POST /api/bookings` — Créer une réservation
- `GET /api/bookings` — Mes réservations (client ou pro selon le rôle)
- `GET /api/bookings/:id` — Détail d'une réservation
- `PATCH /api/bookings/:id/confirm` — Pro : Accepter
- `PATCH /api/bookings/:id/cancel` — Annuler (client ou pro)
- `PATCH /api/bookings/:id/on-the-way` — Pro : Je suis en route
- `PATCH /api/bookings/:id/complete` — Client : Valider la fin
- `POST /api/bookings/:id/dispute` — Signaler un problème

**Paiements**
- `POST /api/payments/initiate` — Initier un paiement
- `POST /api/payments/webhook/wave` — Webhook (interne, sécurisé par signature)
- `POST /api/payments/webhook/orange-money` — Webhook Orange Money
- `POST /api/payments/webhook/card` — Webhook Carte
- `POST /api/payments/withdraw` — Demander un retrait de son portefeuille
- `GET /api/payments/history` — Historique des transactions

**Messagerie**
- `GET /api/conversations` — Mes conversations
- `POST /api/conversations` — Initier une conversation
- `GET /api/conversations/:id/messages` — Historique des messages
- `WebSocket ws://api.jokko.sn/socket` — Tchat temps réel + GPS Live

**Notifications**
- `GET /api/notifications` — Mes notifications
- `PATCH /api/notifications/:id/read` — Marquer comme lue
- `PATCH /api/notifications/read-all` — Tout marquer comme lu

**Catégories**
- `GET /api/categories` — Liste des catégories actives

---

## 10. SÉCURITÉ ET CONFORMITÉ LÉGALE

### 10.1. Mesures Techniques
- Hachage des mots de passe avec **Argon2id** (résistant aux attaques GPU)
- Authentification **JWT** : Access Token 15 min + Refresh Token 30 jours (rotation automatique)
- **Rate Limiting** : 60 req/min sur les endpoints publics, 100 req/min sur les endpoints authentifiés
- **Validation des entrées** : Tous les corps de requête validés via `class-validator` NestJS
- **HTTPS obligatoire** : TLS 1.3 minimum, redirection automatique HTTP → HTTPS
- **Helmet.js** : Sécurisation des headers HTTP (CSP, X-Frame-Options, etc.)
- **Webhooks sécurisés** : Validation par signature HMAC-SHA256 de chaque webhook de paiement
- **Idempotence des paiements** : Chaque transaction a un `idempotency_key` pour éviter les doubles débits

### 10.2. Conformité Légale Sénégal
- **Loi 2008-12** sur la Protection des Données Personnelles (Commission des Données Personnelles — CDP)
- **Règlement BCEAO** sur la monnaie électronique et les transactions mobiles (Zone UEMOA)
- **CGU et Politique de Confidentialité** : Acceptation obligatoire à l'inscription, stockage de la date d'acceptation
- **Droit à l'effacement** : Endpoint `DELETE /api/users/me` anonymise les données personnelles
- **Minimisation des données** : Seules les données nécessaires au service sont collectées

---

## 11. STRATÉGIE DE TESTS

| Type | Outil | Couverture Cible | Quand |
|------|-------|-----------------|-------|
| Unitaires Backend | Jest | 80% du code métier | À chaque commit |
| Intégration API | Supertest + Jest | 100% des endpoints P0 | À chaque PR |
| E2E Mobile | Flutter Integration Test | Parcours principal Client + Pro | Avant chaque release |
| Performance | k6 | 2000 users simultanés sans dégradation | Avant mise en prod |
| Sécurité | OWASP ZAP + Snyk | OWASP Top 10 | Mensuel + avant release |
| Géospatial | Tests PostGIS | Précision distance < 10m | À chaque modification |

---

## 12. ANALYSE DES RISQUES

| # | Risque | Probabilité | Impact | Plan de Mitigation |
|---|--------|-------------|--------|--------------------|
| R01 | Faible adoption des artisans au lancement | 🔴 Élevée | 🔴 Critique | Recrutement terrain 2 mois avant, 150 pros formés avant le lancement |
| R02 | Fraude (faux professionnels, arnaques) | 🟠 Moyenne | 🔴 Critique | KYC obligatoire + Escrow + Support litiges réactif (< 24h) |
| R03 | Panne de l'API Wave/Orange Money | 🟠 Moyenne | 🔴 Critique | Retry automatique avec backoff exponentiel + alerting immédiat |
| R04 | Scalabilité insuffisante lors d'un pic viral | 🟡 Faible | 🟠 Élevé | Auto-scaling AWS + Redis dès le départ + tests k6 |
| R05 | Délai de développement (sous-estimation) | 🔴 Élevée | 🟠 Élevé | Planning conservateur sur 5 mois + buffer de 2 semaines par phase |
| R06 | Refus de l'App Store ou Play Store | 🟡 Faible | 🟠 Élevé | Suivre les guidelines Apple/Google dès la conception |
| R07 | Problème légal (régulation paiements) | 🟡 Faible | 🔴 Critique | Partenariat avec un agrégateur de paiement agréé BCEAO (provider paiement) |

---

## 13. STRATÉGIE MARKETING ET BUSINESS

### 13.1. Modèle de Monétisation

| Source | Mécanisme | Estimation Mensuelle (objectif Mois 6) |
|--------|-----------|----------------------------------------|
| Commission (10%) | Sur chaque transaction Escrow débloquée | 500 000 – 1 500 000 FCFA |
| Jokko Boost | Abonnement mensuel 5 000 – 15 000 FCFA | 150 000 – 500 000 FCFA |
| **Total estimé M6** | | **650 000 – 2 000 000 FCFA/mois** |

### 13.2. Plan Go-To-Market (GTM)

| Phase | Période | Actions |
|-------|---------|---------|
| **Pré-lancement** | Mois -2 à 0 | Recruter 150 Pros à Dakar. Sessions de formation terrain. Créer du contenu organique (TikTok, Instagram). |
| **Lancement** | Mois 1 | Lancement dans 3 quartiers (Plateau, Almadies, Sacré-Cœur). Influenceurs locaux. Flyers dans les marchés. |
| **Croissance** | Mois 2-3 | Parrainage (1000 FCFA/filleul). Campagnes SMS. Articles de presse (Dakarmatin, SenTV). |
| **Extension** | Mois 4-6 | Thiès, Saint-Louis, Ziguinchor. Partenariats B2B (Mairies, Syndicats d'artisans, Cliniques). |

---

## 14. INFRASTRUCTURE ET COÛTS

| Composant | Solution | Coût/Mois (FCFA) |
|-----------|----------|-----------------|
| Serveur API | AWS EC2 t3.medium | 60 000 |
| Base de données | AWS RDS PostgreSQL | 35 000 |
| Cache Redis | Redis Cloud 500MB | 12 000 |
| Stockage S3 | AWS S3 100GB + CloudFront | 8 000 |
| SMS/OTP | Twilio (1000 SMS/mois) | 18 000 |
| Monitoring | Sentry Pro + Grafana | 15 000 |
| Domaine + SSL | Route 53 + ACM | 3 000 |
| **Total/mois** | | **~151 000 FCFA** |

---

## 15. PLAN DE DÉVELOPPEMENT (5 MOIS)

| Phase | Semaines | Équipe | Livrables |
|-------|----------|--------|-----------|
| **0 - Setup** | S1-2 | Backend | Repos Git, CI/CD, BDD, environnements, structure NestJS modulaire |
| **1 - Core Backend** | S3-6 | Backend | Auth (OTP + Google), Profils, Catégories, Recherche géolocalisée (PostGIS), KYC Admin |
| **2 - Mobile V1** | S5-9 | Flutter | Onboarding, Home, Recherche, Fiche Pro, Portfolio, Calendrier disponibilités |
| **3 - Réservation & Paiements** | S9-12 | Full Stack | Booking complet, Notifications FCM, Intégration Wave/OM (provider paiement), Escrow logique |
| **4 - Temps Réel** | S12-15 | Backend + Flutter | Tchat WebSockets, Live Tracking GPS, Portefeuille Pro, Retrait de fonds |
| **5 - Tests & Sécurité** | S16-18 | QA + Dev | Tests E2E, k6 performance, OWASP audit, UX polish, multilingue Wolof |
| **6 - Beta Dakar** | S19-20 | Toute l'équipe | 50 pros + 200 clients bêta, correction bugs, soumission App/Play Store |

---

## SUPPORT CLIENT ET SLA

| Type de demande | Délai de réponse cible | Canal |
|-----------------|----------------------|-------|
| Litige paiement urgent | < 4 heures | WhatsApp Business + Email |
| Problème technique grave | < 8 heures | Email support@jokko.sn |
| Question générale | < 24 heures | Chat in-app ou Email |
| Validation KYC | < 48 heures ouvrées | Email automatique |

---

## 16. ANALYSE CONCURRENTIELLE

### 16.1. Concurrents Directs au Sénégal

Actuellement, **aucun concurrent direct** n'offre une plateforme unifiée multi-services au Sénégal. C'est une fenêtre d'opportunité stratégique majeure pour JOKKO d'être le premier entrant.

### 16.2. Concurrents Indirects

| Acteur | Type | Forces | Faiblesses vs JOKKO |
|--------|------|--------|---------------------|
| **Groupes WhatsApp de quartier** | Référencement informel | Gratuit, bouche à oreille | Pas de vérification, pas de paiement, pas de suivi |
| **Pages Facebook de pros** | Vitrine individuelle | Gratuit, présence sociale | Pas de réservation, pas de paiement intégré |
| **Jumia Services (Nigéria)** | Marketplace services | Marque reconnue | Non présent au Sénégal, peu adapté aux réalités locales |
| **Yandex/Yango Taxi** | Transport uniquement | Connu au Sénégal | Limité au transport, pas d'artisanat/santé |
| **Dakar Dem Dikk App** | Transport en commun | Application officielle | Hors scope services B2C |

### 16.3. Avantages Concurrentiels de JOKKO

| Avantage | Détail |
|----------|--------|
| **Premier entrant** | Aucun acteur ne couvre tous les services en un seul endroit |
| **Confiance garantie** | KYC + Badge Vérifié + Système Escrow = 3 niveaux de sécurité |
| **Adapté au marché local** | Mobile Money natif (Wave, OM), interface en Wolof, mode offline |
| **Double valeur** | Crée de la valeur simultanément pour les clients ET pour les artisans |
| **Effet réseau** | Plus il y a de pros, plus les clients viennent. Plus il y a de clients, plus les pros restent. |

---

## 17. RESSOURCES HUMAINES ET ÉQUIPE PROJET

### 17.1. Équipe Minimale Requise

| Rôle | Profil | Responsabilités | Statut |
|------|--------|-----------------|--------|
| **Chef de Projet / Product Owner** | 3+ ans expérience produit | Vision, priorisation backlog, coordination | Fondateur/CEO |
| **Développeur Backend Senior** | NestJS, PostgreSQL, Redis | Architecture API, BDD, WebSockets, paiements | À recruter |
| **Développeur Flutter** | Flutter 3.x, Dart, Google Maps | Application mobile iOS + Android | À recruter |
| **Designer UI/UX** | Figma, Prototypage | Maquettes, Design System, UX Research | À recruter |
| **Community Manager (terrain)** | Connaissance du marché dakarois | Recrutement des Pros, formation, support | À recruter |

### 17.2. Équipe Idéale (Phase de Croissance)

| Rôle | Ajout conseillé à partir de |
|------|---------------------------|
| Développeur Flutter Junior | Mois 3 (pour accélérer le mobile) |
| Développeur Backend Junior | Mois 4 (pour les fonctionnalités P1/P2) |
| Responsable Support Client | Mois 5 (avant le lancement bêta) |
| Data Analyst | Mois 7 (pour analyser les métriques de croissance) |

### 17.3. Conventions de Collaboration

- **Outil de gestion de projet** : Notion ou Linear (tickets, sprints, documentation)
- **Communication d'équipe** : Slack (séparé par canaux : #backend, #flutter, #design, #général)
- **Réunions** : Stand-up quotidien 15 min + Rétrospective hebdomadaire 1h
- **Revue de code** : Toute modification doit passer par une Pull Request approuvée par 1 autre développeur

---

## 18. CONVENTIONS DE DÉVELOPPEMENT

### 18.1. Stratégie Git (Branching)

```
main          ─── Branche de production (protégée, jamais de commit direct)
  └── staging ─── Branche de pré-production (tests finaux)
        └── develop ─── Branche d'intégration continue
              └── feature/nom-de-la-fonctionnalite  ─── Nouvelles fonctionnalités
              └── fix/nom-du-bug                    ─── Corrections de bugs
              └── hotfix/nom-du-bug-critique        ─── Correctifs urgents en prod
```

**Règles de commit** (format Conventional Commits) :
```
feat: ajout du système de géolocalisation PostGIS
fix: correction du calcul de commission sur les paiements Wave
chore: mise à jour des dépendances NestJS
test: ajout des tests unitaires du module Booking
docs: mise à jour du README de déploiement
```

### 18.2. Standards de Code

| Règle | Backend NestJS | Frontend Flutter |
|-------|----------------|-----------------|
| **Linter** | ESLint + Prettier | flutter analyze + dart format |
| **Nommage** | camelCase (variables), PascalCase (classes) | camelCase, PascalCase (widgets) |
| **Tests** | Obligatoires pour tout service métier | Obligatoires pour les widgets principaux |
| **API Response** | Format uniforme `{ data, message, statusCode }` | Gestion via un `ApiService` centralisé |
| **Gestion d'erreur** | Exception filters NestJS | Try/catch + SnackBar centralisé |
| **Documentation** | JSDoc sur chaque méthode publique | DartDoc sur chaque widget public |

### 18.3. Pipeline CI/CD (GitHub Actions)

```
[ Push sur une branche ] 
    → Lint + Formatage automatique
    → Tests unitaires (Jest / flutter test)
    → Build de vérification

[ Merge sur develop ]
    → Tests d'intégration complets
    → Déploiement automatique sur STAGING

[ Merge sur main ]
    → Tests E2E sur staging
    → Déploiement automatique sur PRODUCTION
    → Notification Slack "✅ Déploiement production réussi"
```

---

## 19. KPIs ET MÉTRIQUES DE SUCCÈS

### 19.1. KPIs Produit (Mesurés en continu)

| Métrique | Définition | Objectif Mois 3 | Objectif Mois 6 |
|----------|------------|-----------------|-----------------|
| **MAU** (Monthly Active Users) | Utilisateurs ayant ouvert l'app au moins 1x/mois | 1 000 | 5 000 |
| **Réservations/Mois** | Nombre de bookings confirmés | 200 | 1 000 |
| **Taux de Conversion** | % visiteurs qui passent à la réservation | 15% | 25% |
| **Taux de Complétion** | % réservations arrivant à COMPLETED | 85% | 92% |
| **NPS** (Satisfaction) | Score de recommandation |  > 40 | > 60 |
| **Délai Réponse Pro** | Temps moyen entre réservation et confirmation | < 30 min | < 15 min |
| **Note Moyenne Pros** | Moyenne des avis clients sur la plateforme | > 4.0 / 5 | > 4.3 / 5 |

### 19.2. KPIs Business

| Métrique | Objectif Mois 6 | Objectif An 1 |
|----------|-----------------|---------------|
| **GMV** (Valeur totale des transactions) | 15M FCFA/mois | 100M FCFA/mois |
| **Revenu Jokko** (Commission 10%) | 1M FCFA/mois | 7M FCFA/mois |
| **Pros actifs sur la plateforme** | 500 | 2 000 |
| **Villes couvertes** | 1 (Dakar) | 4 (Dakar, Thiès, SL, Zigui.) |

### 19.3. KPIs Techniques

| Métrique | Seuil d'alerte | Action si dépassé |
|----------|---------------|-------------------|
| Latence API P95 | > 300ms | Analyse et optimisation immédiate |
| Taux d'erreur API | > 1% | Incident déclaré, investigation Sentry |
| Crash Rate Flutter | > 0.5% | Hotfix prioritaire |
| Uptime mensuel | < 99.5% | Rapport post-mortem + plan de remédiation |

---

## 20. PROJECTIONS FINANCIÈRES (Année 1)

### 20.1. Hypothèses de Base

| Paramètre | Valeur |
|-----------|--------|
| Prix moyen d'une prestation | 12 000 FCFA |
| Taux de commission Jokko | 10% -> 1 200 FCFA/prestation |
| Croissance mensuelle des réservations | +30%/mois |

### 20.2. Projection des Revenus (12 mois)

| Mois | Réservations | GMV (FCFA) | Revenu Jokko (Commission 10%) |
|------|-------------|------------|-------------------|
| M1 (Bêta) | 50 | 600 000 | 42 000 |
| M2 | 150 | 1 800 000 | 126 000 |
| M3 | 300 | 3 600 000 | 252 000 |
| M4 | 500 | 6 000 000 | 420 000 |
| M5 | 750 | 9 000 000 | 630 000 |
| M6 | 1 100 | 13 200 000 | 924 000 |
| M7 | 1 500 | 18 000 000 | 1 260 000 |
| M8 | 2 000 | 24 000 000 | 1 680 000 |
| M9 | 2 600 | 31 200 000 | 2 184 000 |
| M10 | 3 300 | 39 600 000 | 2 772 000 |
| M11 | 4 200 | 50 400 000 | 3 528 000 |
| M12 | 5 500 | 66 000 000 | 4 620 000 |
| **Total An 1** | **21 950** | **263 400 000 FCFA** | **18 438 000 FCFA** (~28 000€) |

> ⚠️ Ces projections sont basées sur une adoption progressive réaliste. Elles ne prennent en compte que les commissions, pas le revenu "Jokko Boost".

---

## 21. DÉTAILS DES INTÉGRATIONS TIERCES

### 21.1. Paiements directs � Wave, Orange Money et Carte

Jokko integre directement les APIs Wave, Orange Money et carte bancaire via des adapters separes. Le backend ne depend pas d'un agregateur unique: chaque provider est isole derriere le port `PaymentGateway`, ce qui evite le couplage fort et permet de remplacer un provider sans impacter la logique metier.

| Etape | Action Technique |
|-------|-----------------|
| Initiation | Le backend selectionne l'adapter selon la methode: Wave, Orange Money ou Carte. |
| Redirection | L'utilisateur est redirige vers l'URL de paiement retournee par le provider choisi. |
| Webhook de confirmation | Le provider appelle `POST /api/v1/payments/webhook` avec reference, statut, signature et timestamp. |
| Validation | Le serveur Jokko verifie la signature HMAC, journalise le webhook et met a jour le paiement. |
| Escrow | Les fonds restent sous sequestre jusqu'a la validation de la prestation par le client. |

### 21.2. Géolocalisation — Google Maps Platform

| Service | Usage | Coût estimé |
|---------|-------|-------------|
| **Maps SDK for Flutter** | Afficher la carte dans l'app | Gratuit jusqu'à 28 000 appels/mois |
| **Geocoding API** | Convertir une adresse en coordonnées GPS | 5$/1000 requêtes |
| **Directions API** | Calculer l'itinéraire du Pro vers le client | 5$/1000 requêtes |

> Alternative gratuite : **OpenStreetMap + flutter_map** si le budget est limité au départ.

### 21.3. Notifications — Firebase Cloud Messaging (FCM)

- **Credentials** : Fichier `google-services.json` (Android) et `GoogleService-Info.plist` (iOS) à intégrer dans le projet Flutter.
- **Envoi depuis NestJS** : Via le SDK Firebase Admin. Chaque utilisateur aura son `fcm_token` stocké en BDD, mis à jour à chaque connexion.
- **Types de notifications** : Notifications en premier plan (pop-up), en arrière-plan (barre de statut), et "données" (silencieuses pour le GPS live).

### 21.4. SMS / OTP — Twilio

- **Endpoint utilisé** : `POST https://api.twilio.com/2010-04-01/Accounts/{ACsid}/Messages.json`
- **Couverture** : Tous les opérateurs au Sénégal (Orange, Free, Expresso).
- **Format OTP** : Code numérique à 6 chiffres, valide 5 minutes, 3 tentatives maximum avant blocage.

---

## 22. PLAN DE MAINTENANCE POST-LANCEMENT

### 22.1. Veille et Surveillance (Monitoring)

| Outil | Rôle | Fréquence de revue |
|-------|------|-------------------|
| **Sentry** | Capture des erreurs et crashs en temps réel | Quotidienne |
| **Grafana + Prometheus** | Métriques serveur (CPU, RAM, latence) | Hebdomadaire |
| **AWS CloudWatch** | Logs d'infrastructure (RDS, EC2) | En cas d'incident |
| **Firebase Crashlytics** | Crashs de l'application Flutter | Quotidienne |

### 22.2. Cycle de Mises à Jour

| Type | Fréquence | Description |
|------|-----------|-------------|
| **Patch** (bug critique) | Sous 24-48h | Hotfix direct sur `main` via branche `hotfix/` |
| **Mise à jour mineure** | Toutes les 2 semaines | Nouvelles fonctionnalités P1, améliorations UX |
| **Mise à jour majeure** | Tous les 2-3 mois | Nouvelles catégories, nouvelle ville, fonctionnalité P2 |

### 22.3. Procédure en Cas d'Incident (Runbook)

```
1. DÉTECTION   → Sentry / Grafana déclenche une alerte
2. TRIAGE      → Le développeur de garde évalue la sévérité (P0/P1/P2)
3. NOTIFICATION → Canal Slack #incidents alerté. Si P0 : CEO notifié immédiatement.
4. ANALYSE     → Consultation des logs (Sentry + CloudWatch), isolation du problème
5. CORRECTION  → Hotfix développé, testé sur staging, déployé en production
6. VALIDATION  → Vérification que l'incident est résolu, clôture de l'alerte
7. POST-MORTEM → Document analysant la cause racine et les actions préventives (sous 48h)
```

---

## 23. CHECKLIST COMPLÈTE PRÉ-DÉMARRAGE DU PROJET

> Ce checklist doit être intégralement complété **avant** d'écrire la première ligne de code.

### Administratif & Légal
- [ ] Création de la structure juridique de Jokko (SARL ou SAS au Sénégal)
- [ ] Dépôt de la marque "JOKKO" à l'OAPI (Organisation Africaine de la Propriété Intellectuelle)
- [ ] Ouverture d'un compte bancaire professionnel pour les transactions Escrow
- [ ] Rédaction des CGU et Politique de Confidentialité par un juriste
- [ ] Déclaration à la CDP (Commission des Données Personnelles du Sénégal)
- [ ] Contact et contractualisation avec provider paiement (agrégateur de paiement agréé BCEAO)

### Infrastructure & Environnements
- [ ] Achat du nom de domaine `jokko.sn` (ou `.com`) et configuration DNS
- [ ] Création des comptes AWS (API, RDS, S3, CloudFront)
- [ ] Création du compte Firebase (FCM + Crashlytics)
- [ ] Configuration des 3 environnements (Dev, Staging, Production)
- [ ] Mise en place du pipeline CI/CD (GitHub Actions)
- [ ] Configuration de Sentry pour le monitoring des erreurs
- [ ] Achat du compte Twilio pour les SMS OTP

### Équipe & Organisation
- [ ] Recrutement des 2 développeurs (Backend NestJS + Flutter)
- [ ] Recrutement du Designer UI/UX
- [ ] Création de l'organisation GitHub et invitation de l'équipe
- [ ] Création de l'espace Notion/Linear pour la gestion de projet
- [ ] Configuration du canal Slack d'équipe avec tous les membres

### Produit & Design
- [ ] Finalisation et validation des maquettes Figma par toute l'équipe
- [ ] Création du Design System (couleurs, typographie, composants)
- [ ] Validation de toutes les User Stories (US-C01 à US-P05) avec l'équipe
- [ ] Définition du MVP exact (fonctionnalités P0 uniquement pour le lancement bêta)

### Business & Terrain
- [ ] Début du recrutement terrain des 150 premiers professionnels à Dakar
- [ ] Préparation des supports de formation pour les Pros (vidéos tutoriels)
- [ ] Mise en place d'un canal WhatsApp Business pour le support client
- [ ] Identification des 3 influenceurs sénégalais pour le lancement
