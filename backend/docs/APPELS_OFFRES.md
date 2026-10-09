# Appels d’offres client et prestataire

La rubrique **Appels d’offres** est accessible depuis la navigation des clients et des
prestataires, à l’adresse `/appels-offres`. Les médecins et les catégories médicales
ne participent pas aux appels d’offres.

## Parcours

Le client choisit un métier du catalogue existant, décrit son besoin, sélectionne
une adresse sur le composant de carte existant (recherche ou géolocalisation),
une date éventuelle et un prix en FCFA. Le rayon de diffusion est de 25 km. Il publie sa demande, consulte
les réponses, refuse une offre ou choisit un prestataire. Tant que la demande
est ouverte, il peut l’annuler ou la relancer avec un nouveau prix ; cette relance
remplace les réponses précédentes.

La recherche propose directement les catégories et métiers actifs du catalogue
prestataire dès deux caractères. Les résultats sont navigables au clavier. Les
champs de date et d’heure sont toujours visibles ; leur saisie planifie
l’intervention, tandis que des champs vides signifient « Dès que possible ».
Une fois le métier et l'adresse localisée choisis, le bandeau affiche le nombre
réel de prestataires éligibles et leurs premiers avatars via `GET /tenders/preview`.

Les professionnels invités voient la demande dans leur espace et reçoivent une
notification. Ils choisissent un de leurs services éligibles, acceptent le prix
ou proposent un autre montant. Ils peuvent ignorer une nouvelle invitation.
Après publication, l'écran client affiche les invitations et les réponses réelles :
prix accepté, contre-offres, service proposé, note, nombre d'avis et distance.
Le délai d'arrivée et le nombre de prestataires ayant ouvert la demande ne sont
pas affichés, car ces mesures ne sont pas disponibles dans l'API.
Une offre sélectionnée devient une négociation acceptée dans le module existant.
Le client finalise ensuite la réservation et le paiement depuis le parcours
habituel ; la sélection seule ne crée ni paiement ni réservation confirmée.

## Réutilisation et règles

- `SearchQueryService` assure la recherche géographique, les catégories et
  spécialités, la visibilité et les profils vérifiés. Les invitations concernent
  les services où le professionnel se déplace, à 25 km au maximum de l'adresse
  d'intervention. Toutes les pages de résultats sont parcourues ; les profils sans
  distance calculable et les boutiques sont exclus.
- La barre de recherche, le catalogue, la carte, les notifications et le domaine
  de négociation sont réutilisés. L’ajustement du prix est un composant partagé
  entre le client et le professionnel. Si Google Maps n'est pas disponible,
  la carte de secours Leaflet permet aussi de choisir l'adresse en cliquant.
- L’API contrôle les rôles, l’appartenance de chaque demande, les services
  éligibles et les révisions. Un professionnel ne reçoit que sa propre réponse,
  jamais les offres concurrentes. La sélection est transactionnelle : une seule
  offre peut être retenue, même lors de clics concurrents. Un prix différent de
  celui envoyé par le client entraîne un conflit à confirmer après actualisation.
- Les événements déclenchent les notifications existantes avec un lien vers la
  demande. Chaque notification enregistrée est émise sur le canal temps réel du
  destinataire. Un échec de notification est journalisé ; les demandes restent
  consultables dans leur espace. Le navigateur actualise aussi la page toutes les
  cinq secondes si la connexion temps réel est interrompue. Les requêtes de liste
  et de détail des appels d'offres contournent le cache HTTP pour afficher les
  nouvelles réponses dès leur réception.
- Aucun délai d’arrivée, compteur de visiteurs ou paiement simulé du prototype
  n’est repris. Il n’y a pas d’expiration automatique des demandes ouvertes.

## Installation

Après configuration de la base cible, depuis `backend/` :

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

La migration `20261008150000_tender_requests` ajoute `Tender`, `TenderResponse`,
leurs statuts, index et relations. Elle a été appliquée sur la base Neon configurée
dans `backend/.env` le 8 octobre 2026. `prisma migrate status` confirme que les
81 migrations sont à jour. Elle avait aussi été vérifiée sur une base isolée.

Sur une base entièrement vide, la chaîne historique bloque actuellement sur
`20260421170000_harden_payments_financial_core` (`escrowStatus` absent). Ce problème
antérieur n’a pas été modifié : pour la validation isolée, le schéma Prisma avant
cette fonctionnalité a servi de base, puis la nouvelle migration a été appliquée.
Ne pas utiliser ce contournement pour réinitialiser une base contenant des données.

## Vérifications

- Tests Jest dans `src/tenders` : validation, correspondance avec la recherche,
  création d’une négociation acceptée et tests HTTP sur PostgreSQL/PostGIS réel.
  Les tests d’intégration vérifient les accès, les révisions, la relance,
  l’annulation, le prix changé et la sélection concurrente. L’identité HTTP et
  l’envoi externe des notifications sont remplacés par des doublures de test.
- `tenders.integration.spec.ts` est désactivé sans `TEST_TENDERS_DATABASE_URL`.
  Il n’accepte que la base dédiée `127.0.0.1:15439/jokko_tenders_test` et nettoie
  ses propres données. Il ne doit pas pointer sur une base utilisateur.
- Depuis `frontend_web_angular/`, `npx playwright test -c playwright.tenders.config.ts`
  vérifie publication, contre-offre et lien de finalisation sur ordinateur et mobile,
  avec contrôle des erreurs JavaScript et débordements. Ces tests utilisent une
  API simulée : ils ne valident pas un paiement, un SMS ou une notification push réels.
  `E2E_CHROME_PATH` permet de choisir le navigateur installé.
- Le contrôle global `npm run quality` reste bloqué par des règles préexistantes
  dans les modules factures administrateur, détail de rendez-vous et messages.
