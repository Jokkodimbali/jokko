# Cahier Des Charges Jokko - Reference Produit Et Backend

## 1. Objet du document
Ce document sert de reference fonctionnelle et technique pour le backend Jokko.

Il ne reprend pas une vision abstraite ou future de la plateforme. Il decrit :

- le produit vise
- les modules backend reellement implementes
- les fonctionnalites admin actuellement disponibles
- les fonctionnalites encore hors scope backend

## 2. Identite du projet

| Champ | Valeur |
|---|---|
| Nom | Jokko |
| Positionnement | Marketplace de services |
| Cible | Senegal en priorite |
| Backend | NestJS + Prisma + PostgreSQL |
| Temps reel | Socket.IO |
| Paiements | Wave, Orange Money, carte via adapters |
| Notifications | In-app, push, branchements email/SMS |

## 3. Vision produit
Jokko connecte des clients et des prestataires verifies autour d'un cycle de service complet :

1. recherche d'un professionnel
2. consultation de sa fiche
3. reservation ou negotiation
4. discussion en temps reel
5. paiement avec escrow
6. suivi prestataire
7. realisation de la prestation
8. avis client
9. gestion admin des litiges, paiements et KYC

## 4. Acteurs

| Acteur | Role |
|---|---|
| Client | recherche, reserve, discute, paie, note |
| Prestataire | publie ses services, gere ses reservations, discute, se deplace, recoit les paiements |
| Administrateur | gouverne la plateforme, valide le KYC, gere categories, utilisateurs, litiges, paiements, dashboard |

## 5. Perimetre backend actuellement implemente

### 5.1 Modules implementes

| Module | Statut |
|---|---|
| Auth | Implemente |
| Users | Implemente |
| Professionals | Implemente |
| Categories | Implemente |
| Search | Implemente |
| Reservations | Implemente |
| Negotiations | Implemente |
| Messaging | Implemente |
| Live Tracking | Implemente |
| Payments | Implemente |
| Notifications | Implemente |
| Reviews | Implemente via reservations/professionals |
| Disputes | Implemente |
| Admin | Implemente |
| Sante | Implemente |

### 5.2 Modules encore manquants

| Module | Statut actuel |
|---|---|
| Upload media reel | Non implemente |
| Documents / factures | Non implemente |
| Parrainage | Non implemente |

## 6. Fonctionnalites client actuellement supportees

### 6.1 Authentification

- inscription
- connexion mot de passe
- OTP
- Google login
- refresh token
- logout

### 6.2 Profil et historique

- lecture du profil
- mise a jour
- avatar par URL
- historique personnel
- anonymisation de compte

### 6.3 Recherche et consultation

- recherche geolocalisee
- filtres par ville, categorie, texte
- consultation des profils pro verifies
- consultation services
- consultation portfolio
- consultation disponibilites
- consultation avis

### 6.4 Reservation

- creation de reservation
- reprogrammation
- annulation
- confirmation
- demarrage
- completion
- no-show
- ouverture de litige

### 6.5 Negociation

- ouverture d'une negotiation
- contre-proposition
- acceptation
- rejet
- annulation
- conversion en reservation

### 6.6 Messagerie

- conversation liee a une reservation
- envoi de message
- lecture de l'historique
- temps reel Socket.IO

### 6.7 Paiement

- initiation de paiement
- escrow
- statut escrow
- contestation

### 6.8 Live tracking

- activation "je suis en route"
- lecture du tracking d'une reservation
- lecture de la presence d'un prestataire
- diffusion temps reel des positions

### 6.9 Avis

- note sur 5
- commentaire optionnel
- recalcul de la note agregree du prestataire

### 6.10 Notifications

- notifications in-app
- lecture / marquage lu
- enregistrement token FCM

## 7. Fonctionnalites prestataire actuellement supportees

- creation de profil professionnel
- soumission KYC
- creation, mise a jour et desactivation de service
- gestion portfolio
- gestion disponibilites
- reception des reservations
- negociation
- messagerie
- tracking temps reel
- retraits

## 8. Fonctionnalites administrateur actuellement supportees

### 8.1 Dashboard

- volume utilisateurs
- reservations actives
- litiges
- revenus et commissions

### 8.2 KYC

- listing des dossiers
- detail d'un dossier
- approbation
- rejet motive

### 8.3 Categories

- creation
- mise a jour
- desactivation
- taux de commission par categorie

### 8.4 Utilisateurs

- listing
- detail
- historique
- blocage
- deblocage

### 8.5 Paiements

- listing
- detail
- statistiques
- remboursement
- paiements en attente d'escrow release
- traitement des releases escrow en attente

### 8.6 Reservations

- listing
- detail
- statistiques

### 8.7 Litiges

- listing
- detail
- prise en charge
- resolution
- rejet

### 8.8 Notifications de masse

- diffusion vers clients
- diffusion vers prestataires
- diffusion globale

## 9. Flux metier majeurs actuellement couverts

### 9.1 Flux standard

1. auth
2. recherche
3. fiche pro
4. reservation
5. discussion
6. paiement
7. notification
8. suivi prestataire
9. completion
10. avis

### 9.2 Flux avec negociation

1. auth
2. ouverture negotiation
3. contre-proposition
4. acceptation
5. conversion reservation
6. paiement
7. prestation

### 9.3 Flux litige

1. reservation ou paiement en conflit
2. ouverture du litige
3. gel ou maintien de l'escrow
4. instruction admin
5. resolution ou rejet

## 10. Surface API HTTP actuelle
Le backend expose actuellement des endpoints sur :

- `auth`
- `users`
- `admin/users`
- `professionals`
- `admin/kyc`
- `categories`
- `admin/categories`
- `search`
- `negotiations`
- `reservations`
- `admin/reservations`
- `conversations`
- `payments`
- `admin/payments`
- `notifications`
- `admin/notifications`
- `admin/disputes`
- `admin/dashboard`
- `sante`

La documentation interactive de reference est :

`/api/docs`

## 11. Temps reel actuellement implemente
Les capacites temps reel actuelles sont :

- messagerie reservation -> conversation -> message
- lecture temps reel
- typing indicator
- tracking GPS reservation
- presence prestataire

Le backend ne fournit pas encore un module de media upload reel pour ces flux.

## 12. Regles metier importantes actuellement appliquees

### 12.1 Reservation

- un prestataire ne peut pas reserver son propre service
- un service non disponible ne peut pas etre reserve
- un service negotiable peut exiger un passage par negotiation

### 12.2 Paiement

- les paiements sont lies a une reservation
- l'escrow suit un cycle d'etat controle
- l'idempotence protege l'initiation

### 12.3 Avis

- seule une reservation terminee peut recevoir un avis
- un seul avis client par reservation

### 12.4 Messaging

- une conversation est liee a une reservation
- une reservation correspond a une conversation
- seuls les participants peuvent lire ou ecrire

### 12.5 Live tracking

- le suivi "en route" est rattache a une reservation
- le suivi ne reste pas ouvert indefiniment : il est ferme selon les transitions metier

### 12.6 Administration

- seules les routes admin acceptent le role `ADMIN`
- un compte bloque ne doit plus se reconnecter normalement

## 13. Exigences non fonctionnelles backend
Le backend actuel vise :

- API uniforme
- messages centralises
- DTOs valides
- architecture modulaire
- faible couplage
- Swagger exploitable
- ecriture transactionnelle sur les flux critiques
- traces auditables

## 14. Documentation et sources de verite
Les documents de reference associes sont :

- `ARCHITECTURE_PROFESSIONNELLE.md`
- `STANDARDS_MODULES_BACKEND.md`
- `TABLEAU_MESSAGES_HTTP.md`
- `POSTMAN_TESTS.md`
- Swagger `/api/docs`

La source de verite la plus fine reste le code sous `backend/src/`.

## 15. Limites fonctionnelles actuelles
Le backend n'implemente pas encore completement :

- upload fichier/media reel
- generation de factures/documents
- parrainage et cashback

Ces points doivent etre traites comme le backlog backend restant.

## 16. Conclusion
Le backend Jokko couvre deja le coeur metier d'une marketplace de services moderne :

- comptes
- recherche
- reservation
- negociation
- discussion
- paiement
- notification
- suivi
- avis
- administration

Le prochain cycle de travail backend doit maintenant se concentrer sur les briques manquantes de niveau plateforme, pas sur les fondations deja posees.
