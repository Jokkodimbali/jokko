# Jokko — Référentiel fonctionnel complet de l'application

> Version auditée dans le code au 31 juillet 2026. Ce document décrit les fonctions réellement présentes dans le frontend Angular, le backend NestJS, le schéma Prisma et les scénarios E2E du dépôt. Il distingue les fonctions visibles dans l'interface, les capacités API et les règles conditionnelles.

## 1. Objet et périmètre

Jokko est une marketplace sénégalaise mettant en relation des clients avec des prestataires de services et des médecins. L'application couvre le cycle complet : découverte, choix du professionnel, réservation ou négociation, devis, paiement sécurisé, messagerie, déplacement et suivi GPS, réalisation, ordonnance éventuelle, avis, litige et administration.

Le périmètre audité comprend :

- le site public et le catalogue de services ;
- les comptes CLIENT, PRESTATAIRE, MEDECIN et ADMIN ;
- l'espace professionnel commun aux prestataires et médecins ;
- les fonctions médicales propres aux médecins et patients ;
- les réservations directes et issues d'une négociation ;
- la messagerie et les pièces jointes ;
- les paiements Wave, Orange Money et carte, le séquestre et le wallet ;
- le suivi en temps réel et les trois modes de déplacement ;
- les notifications, favoris, avis et litiges ;
- l'ensemble du tableau de bord administrateur.

## 2. Profils et principes d'accès

| Profil | Position dans l'application | Capacités principales |
|---|---|---|
| Visiteur non connecté | Public | Parcourir, rechercher et filtrer les services, consulter les profils, disponibilités, portfolio et avis, consulter les pages À propos et Contact, s'inscrire ou se connecter. |
| CLIENT | Demandeur d'un service/patient | Gérer son compte et sa fiche médicale, ajouter des favoris, négocier, réserver, payer, discuter, partager ou suivre une position selon le trajet, confirmer l'arrivée, consulter ses rendez-vous, ouvrir un litige et publier un avis. |
| PRESTATAIRE | Professionnel de service | Agir aussi comme client, créer son profil professionnel, soumettre son KYC, gérer services, tarifs, déplacements, disponibilités et portfolio, répondre aux négociations, gérer les rendez-vous clients, exécuter les prestations, suivre son wallet et retirer des fonds. |
| MEDECIN | Professionnel médical | Possède les capacités professionnelles pertinentes, un espace RDV patients, la validation de diplômes, l'accès autorisé aux fiches patients, la consultation, les actes médicaux et l'ordonnance. Il peut également agir comme client. |
| ADMIN | Gouvernance de la plateforme | Superviser indicateurs, KYC, diplômes, prestataires, utilisateurs, réservations, paiements, revenus, litiges, régions, catégories/sous-catégories, archives, trafic et notifications de masse. |

Règles transversales :

- une route protégée redirige un visiteur non connecté vers l'authentification ;
- un écran limité par rôle refuse un rôle non autorisé ;
- PRESTATAIRE et MEDECIN peuvent avoir deux contextes : client pour leurs propres achats et professionnel pour les prestations reçues ;
- la liste générale « Mes rendez-vous » utilise le contexte client, tandis que « RDV patients/clients » utilise le contexte professionnel ;
- un professionnel ne peut pas réserver son propre service ;
- les opérations sensibles vérifient aussi la participation réelle à la réservation, conversation, paiement ou litige côté backend ;
- les actions disponibles changent selon le statut métier, et pas seulement selon le profil.

## 3. Navigation et écrans

### 3.1 Routes publiques

- `/services` : accueil et catalogue de services ;
- `/services/:id` : profil détaillé d'un professionnel/prestataire ;
- `/medecine/:id` : profil détaillé d'un médecin ;
- `/medecine/:id/rendez-vous` : entrée du parcours de prise de rendez-vous médical ;
- `/contact` : contact ;
- `/a-propos` : présentation de Jokko ;
- `/faq` : redirection vers Contact ;
- `/auth/login`, `/auth/register`, `/auth/verify-otp` : authentification.

### 3.2 Routes authentifiées

- proposition/réservation d'un service ;
- favoris ;
- notifications ;
- litiges et détail d'un signalement ;
- paramètres du compte ;
- rendez-vous, détail, paiement et QR code ;
- messagerie ;
- espace professionnel/médecin selon le rôle.

### 3.3 Route administrateur

- `/admin`, accessible uniquement au rôle ADMIN.

## 4. Authentification et gestion de session

### 4.1 Inscription

L'utilisateur peut créer un compte avec ses informations personnelles, son téléphone sénégalais et un mot de passe. Le rôle demandé peut orienter l'expérience vers client, prestataire ou médecin. Les champs sont normalisés et validés. Un téléphone déjà utilisé, un format invalide ou des données obligatoires absentes provoquent un refus explicite.

### 4.2 OTP

- demander l'envoi d'un code OTP ;
- saisir et vérifier le code ;
- gérer un code invalide, expiré ou déjà consommé ;
- poursuivre l'authentification après validation.

### 4.3 Connexion

- connexion par téléphone et mot de passe ;
- connexion Google côté API ;
- refus en cas d'identifiants incorrects ou de compte bloqué ;
- récupération du profil courant après connexion ;
- conservation de l'URL de retour vers la page protégée demandée.

### 4.4 Cycle de session

- jeton d'accès et jeton de rafraîchissement ;
- renouvellement de session ;
- déconnexion avec invalidation de la session ;
- récupération de l'utilisateur connecté ;
- protection des appels API ;
- gestion de l'expiration ou de l'absence de session.

## 5. Catalogue, recherche et découverte

### 5.1 Catalogue public

Le catalogue affiche les professionnels actifs et leurs services, organisés par catégories et sous-catégories. Il propose des cartes avec identité, métier/service, localisation, tarification, note, image, mode de déplacement et état favori.

### 5.2 Recherche et filtres

Le visiteur ou utilisateur peut :

- rechercher par texte, service, catégorie ou professionnel ;
- utiliser des suggestions de catégories et de profils ;
- filtrer par ville, notamment Dakar, Thiès, Saint-Louis, Ziguinchor et Kaolack ;
- filtrer par type de professionnel/service ;
- filtrer par sous-catégorie ;
- filtrer par mode de déplacement ;
- utiliser une localisation pour une recherche de proximité lorsque disponible ;
- charger les résultats suivants par pagination ;
- réinitialiser une recherche ou un filtre ;
- voir un état vide, un chargement ou une erreur réseau.

Le professionnel connecté est exclu de ses propres résultats afin d'empêcher l'auto-réservation.

### 5.3 Profil professionnel public

Le profil peut présenter :

- nom, avatar, entreprise, spécialité et biographie ;
- ville/adresse et présence ;
- badge/statut de vérification ;
- services proposés, prix fixe ou négociable et durée ;
- modes de déplacement acceptés ;
- véhicule du professionnel lorsque pertinent ;
- disponibilités ;
- portfolio/réalisations ;
- expertises ;
- avis clients et note agrégée ;
- CTA pour réserver/proposer un service ;
- CTA pour envoyer un message ;
- ajout ou retrait des favoris si connecté.

## 6. Favoris

Un utilisateur authentifié peut :

- ajouter un professionnel aux favoris depuis une carte ou un profil ;
- retirer ce favori ;
- vérifier l'état favori d'un professionnel ;
- consulter la page regroupant ses professionnels favoris ;
- ouvrir leur profil depuis cette page ;
- voir un état vide si aucun favori n'existe.

Les actions nécessitant un compte demandent une connexion lorsqu'elles sont déclenchées depuis le catalogue public.

## 7. Profil personnel, santé et sécurité

### 7.1 Informations personnelles

- consulter nom, téléphone, e-mail, avatar, rôle et adresse ;
- modifier prénom/nom, e-mail et téléphone ;
- modifier l'adresse manuellement ou via sélection cartographique ;
- téléverser un avatar ou enregistrer une URL d'avatar ;
- voir les informations de ville/pays déduites de l'adresse.

### 7.2 Fiche médicale du client

Le client peut créer ou modifier :

- groupe sanguin et rhésus ;
- poids, taille et IMC ;
- médecin référent ;
- profession ;
- allergies ;
- pathologies/conditions ;
- traitements en cours ou passés.

Chaque traitement peut inclure nom, dosage, fréquence, début, fin et notes. Il peut être ajouté, modifié ou supprimé. L'utilisateur peut consulter un résumé et son historique médical/rendez-vous disponible.

### 7.3 Sécurité du compte

- changer le mot de passe existant ;
- créer un mot de passe si le compte provient d'un fournisseur externe ;
- consulter la partie sécurité/session ;
- supprimer définitivement/anonymiser le compte avec confirmation ;
- recevoir un message d'erreur si le mot de passe courant est incorrect ou si le nouveau mot de passe ne respecte pas les règles.

### 7.4 Moyens de paiement enregistrés

- enregistrer une carte de manière masquée ;
- enregistrer un numéro Wave ;
- modifier le libellé ou le moyen par défaut selon les données acceptées ;
- supprimer un moyen après confirmation ;
- masquer/révéler les informations sensibles affichables ;
- consulter les paiements récents, leur détail et leur statut de séquestre.

## 8. Création et gestion du profil professionnel

### 8.1 Profil professionnel

PRESTATAIRE ou MEDECIN peut :

- créer sa fiche professionnelle ;
- consulter et modifier entreprise, ville, biographie et informations métier ;
- renseigner des expertises ;
- ajouter ou retirer des expertises ;
- choisir son mode de déplacement ;
- choisir moto/scooter, voiture ou camionnette lorsque le mode l'exige ;
- sélectionner une adresse d'intervention sur la carte.

### 8.2 KYC et diplômes

- téléverser les documents professionnels ;
- soumettre le dossier KYC ;
- suivre le statut EN_ATTENTE, VERIFIE ou REJETE ;
- pour un médecin, téléverser diplômes/justificatifs ;
- suivre le statut EN_ATTENTE, AUTHENTIFIE ou REJETE d'un diplôme ;
- retirer un document lorsque l'action est autorisée ;
- voir le motif d'un rejet communiqué par l'administration.

### 8.3 Services ou motifs de consultation

Le professionnel peut :

- créer un service/motif ;
- choisir catégorie et sous-catégorie ;
- saisir nom, description, durée et temps de pause ;
- choisir prix fixe ou négociable ;
- saisir prix, unité et métadonnées de consultation ;
- choisir le mode de déplacement du service ;
- ajouter une image ;
- définir le service principal/motif obligatoire ;
- modifier un service ;
- désactiver/supprimer un service ;
- consulter la liste de ses services.

### 8.4 Portfolio

- téléverser une image/réalisation ;
- saisir titre et description ;
- prévisualiser avant envoi ;
- consulter les éléments publiés ;
- supprimer un élément.

### 8.5 Disponibilités

- activer ou désactiver chaque jour de la semaine ;
- ajouter plusieurs créneaux par jour ;
- modifier ou supprimer un créneau ;
- parcourir le calendrier par mois et année ;
- bloquer/débloquer des dates particulières dans l'interface ;
- visualiser les créneaux effectivement proposés à la réservation ;
- empêcher les créneaux invalides, passés, chevauchants ou indisponibles.

## 9. Proposition de service, réservation directe et choix d'adresse

### 9.1 Construction d'une demande

Depuis un profil/service, le client peut :

- choisir le service ou motif ;
- consulter prix, durée et conditions ;
- choisir date et créneau parmi les disponibilités ;
- définir l'adresse de départ/intervention/destination selon le mode ;
- utiliser la recherche d'adresse Google et les suggestions ;
- sélectionner un point sur la carte ;
- ajouter un commentaire ou besoin ;
- ouvrir un récapitulatif avant confirmation.

### 9.2 Prix fixe

Le client confirme les informations, crée directement une réservation et poursuit vers son détail ou le paiement. La création échoue si le créneau est devenu indisponible, si les données sont invalides ou si le client tente de réserver son propre profil.

### 9.3 Prix négociable

Le client ouvre une négociation avec montant proposé, date, durée, adresse et message éventuel. Une négociation active peut ensuite recevoir une contre-proposition.

### 9.4 Adresse et géolocalisation

- autocomplétion d'adresse ;
- géocodage d'une adresse ;
- géocodage inverse d'un point ;
- calcul d'itinéraire ;
- choix manuel sur carte si nécessaire ;
- repli vers l'adresse saisie lorsque le GPS du navigateur est refusé, indisponible ou incohérent.

## 10. Négociation et devis de matériel

### 10.1 États de négociation

| État | Signification et actions typiques |
|---|---|
| EN_ATTENTE_PRESTATAIRE | Le client vient de proposer ; le professionnel doit répondre. |
| EN_ATTENTE_CLIENT | Le professionnel a contre-proposé ; le client doit accepter, contrer ou refuser. |
| ACCEPTEE | Les parties ont accepté le prix/date ; conversion en réservation possible. |
| REFUSEE | L'une des parties a refusé ; aucune poursuite normale. |
| ANNULEE | L'initiateur/participant a annulé ; flux fermé. |
| CONVERTIE_EN_RESERVATION | Une réservation a été créée ; l'action continue sur le rendez-vous/paiement. |

### 10.2 Actions possibles

- créer une négociation ;
- consulter les négociations selon le contexte CLIENT ou PRESTATAIRE ;
- ouvrir le détail ;
- envoyer une contre-proposition de prix/date/durée ;
- accepter ;
- refuser avec motif ;
- annuler avec motif ;
- recevoir les mises à jour en temps réel ;
- convertir une négociation acceptée en réservation ;
- empêcher une double conversion ou une action par le mauvais participant.

### 10.3 Devis de matériel

Pour un service nécessitant des fournitures :

- le professionnel ajoute une ou plusieurs lignes de devis ;
- une ligne contient la désignation et les informations de montant/quantité prévues ;
- le client valide ou refuse chaque devis ;
- tant qu'un devis est EN_ATTENTE, l'acceptation finale du prix est bloquée ;
- après validation des lignes, le professionnel finalise le devis ;
- le système fournit l'état de préparation et, si disponible, une URL PDF ;
- un devis refusé doit être corrigé/remplacé avant finalisation ;
- sans devis matériel, le client peut accepter normalement la négociation.

## 11. Rendez-vous et agenda

### 11.1 Liste « Mes rendez-vous »

L'utilisateur peut :

- consulter ses réservations en contexte client ;
- voir ensemble rendez-vous et négociations ;
- basculer entre vue liste et calendrier ;
- trier les éléments par date, les plus récents en premier ;
- filtrer les éléments actifs et terminés ;
- ouvrir le détail, le paiement ou la négociation correspondante.

L'onglet terminé regroupe notamment TERMINEE, ANNULEE, NO_SHOW et LITIGE pour les réservations, ainsi que REFUSEE et ANNULEE pour les négociations.

### 11.2 Espace professionnel : rendez-vous clients/patients

- recevoir les nouvelles réservations et mises à jour sans rechargement ;
- consulter séparément les RDV patients pour le médecin ;
- consulter les négociations clients ;
- filtrer tout, en attente, attente client, confirmé ou fermé ;
- parcourir par mois ;
- ouvrir le rendez-vous ;
- actualisation temps réel avec repli périodique lorsque la socket ne suffit pas.

### 11.3 Agenda professionnel

- prochain client ;
- vues jour, semaine et mois ;
- navigation semaine précédente/suivante et retour à aujourd'hui ;
- zoom de la durée visuelle ;
- filtres tout, actifs, terminés, annulés et litiges ;
- période personnalisée ;
- ouverture du détail d'un événement ;
- affichage patient, service, horaire, durée, adresse et statut ;
- annulation motivée lorsqu'elle est encore autorisée.

## 12. Cycle de vie d'une réservation

| Statut | Description | Principales suites possibles |
|---|---|---|
| CONFIRMEE | Réservation créée/confirmée mais paiement à finaliser. | Payer, reprogrammer ou annuler selon règles. |
| PAYEE_SEQUESTRE | Paiement réussi, fonds verrouillés. | Démarrer le trajet approprié, signaler l'arrivée, démarrer la prestation. |
| EN_COURS | Prestation démarrée. | Terminer, renseigner ordonnance si médical, déclarer absence/litige selon contexte. |
| TERMINEE | Prestation achevée. | Avis client, libération du séquestre, litige encore possible selon règles. |
| ANNULEE | Réservation annulée. | Flux opérationnel fermé, remboursement selon paiement/règles. |
| NO_SHOW | Absence constatée. | Flux fermé, traitement financier ou litige. |
| LITIGE | Désaccord officiellement ouvert. | Instruction administrateur, remboursement/crédit/partage. |

Actions métier couvertes :

- confirmer une réservation ;
- annuler avec motif ;
- reprogrammer date/heure ;
- proposer un ajustement de prix ;
- accepter ou refuser l'ajustement côté client ;
- marquer comme payée via le flux autorisé ;
- démarrer la prestation ;
- terminer la prestation ;
- marquer le client absent ;
- enregistrer une ordonnance médicale ;
- publier un avis ;
- ouvrir un litige.

Un ajustement de prix suit AUCUN → EN_ATTENTE_CLIENT → ACCEPTE ou REFUSE. Tant que le client n'a pas accepté, le nouveau prix ne doit pas être considéré comme définitif.

## 13. Paiement, séquestre et wallet

### 13.1 Paiement client

Le client peut :

- ouvrir le résumé de paiement ;
- choisir Wave, Orange Money ou carte ;
- utiliser un moyen enregistré ;
- initier le paiement ;
- suivre un état en attente, succès ou échec ;
- revenir après le fournisseur de paiement ;
- voir la confirmation et la réservation passer à PAYEE_SEQUESTRE ;
- consulter le paiement et son historique.

### 13.2 Séquestre

| État | Effet |
|---|---|
| LOCKED | Fonds payés et immobilisés pendant la prestation. |
| RELEASED | Fonds libérés au professionnel après réalisation/validation. |
| DISPUTED | Fonds bloqués pendant un litige. |
| REFUNDED | Fonds remboursés au client. |

Le client ou acteur autorisé peut consulter le statut, demander/libérer le séquestre quand les règles le permettent ou le contester. Les webhooks de paiement sont protégés contre les doublons et les événements répétés.

### 13.3 Wallet professionnel

- consulter solde disponible, solde bloqué et mouvements ;
- consulter l'historique des transactions ;
- voir crédits séquestre, commissions, remboursements, ajustements et retraits ;
- demander un retrait par Wave, Orange Money ou coordonnées prévues ;
- suivre EN_ATTENTE, EN_COURS, TERMINE, ECHEC ou ANNULE ;
- empêcher un montant nul, négatif ou supérieur au disponible.

## 14. Messagerie temps réel

### 14.1 Conversations

- lister les conversations de l'utilisateur ;
- créer ou retrouver une conversation directe avec un professionnel ;
- lier une conversation à une réservation lorsqu'elle existe ;
- ouvrir la discussion depuis un profil, une négociation ou un rendez-vous ;
- éviter la duplication d'une conversation directe entre les mêmes participants ;
- afficher le dernier message, l'heure et les non-lus.

### 14.2 Messages

- charger l'historique avec pagination ;
- envoyer du texte ;
- recevoir les nouveaux messages via Socket.IO ;
- marquer/afficher l'état de lecture prévu par le modèle ;
- gérer chargement, envoi en cours, erreur et nouvelle tentative ;
- téléverser un média de conversation ;
- générer une URL de téléchargement sécurisée ;
- limiter type et taille du fichier selon les règles backend.

### 14.3 Règles particulières

- le bouton de négociation dans la messagerie n'apparaît que pour une conversation directe réellement nouvelle, sans message et sans réservation associée ;
- les conversations liées à une réservation conservent leurs cartes/actions de réservation ;
- un utilisateur extérieur à la conversation ne peut ni lire ni envoyer de message.

## 15. Suivi GPS et modes de déplacement

### 15.1 Principes communs

Le suivi est disponible sur une réservation payée et opérationnelle. Le voyageur partage sa position ; l'autre partie suit le déplacement. L'interface peut afficher : carte Google, départ, destination, itinéraire, distance, durée estimée, véhicule, position animée, instructions de navigation et recentrage.

La localisation conserve l'horodatage du capteur, ignore les échantillons régressifs ou physiquement aberrants, stabilise les petites variations et anime le marqueur/caméra. Si l'itinéraire devient obsolète parce que le GPS sort du tracé, il est recalculé depuis la vraie position.

### 15.2 PRESTATAIRE_SE_DEPLACE

1. Réservation PAYEE_SEQUESTRE.
2. Le professionnel démarre « Je suis en route » et partage sa position.
3. Le client voit le véhicule et l'itinéraire progresser.
4. Le professionnel confirme « Sur place ».
5. Les deux vues passent directement à l'arrivée et l'itinéraire est nettoyé.
6. Le professionnel démarre la prestation.
7. Il termine la prestation.

Cas alternatifs : GPS refusé, position hors Sénégal, perte temporaire du réseau, GPS hors route, actualisation impossible, follower ouvrant la page après le départ, arrivée reçue par socket ou par relecture API.

### 15.3 CLIENT_SE_DEPLACE

1. Le client est le voyageur et voit « Démarrer le trajet/Partager ma position ».
2. Le professionnel voit qu'il attend le client.
3. Le client partage son trajet vers le professionnel.
4. Le professionnel voit l'itinéraire et la position du client.
5. Le client confirme son arrivée.
6. Le professionnel peut alors démarrer la prestation.

La simple activation du partage ne signifie pas que le client est arrivé. L'arrivée du client ne doit pas démarrer automatiquement la prestation. Si le GPS est invalide, l'adresse de départ connue peut servir de repli.

### 15.4 TRANSPORT_COLIS

Le parcours différencie enlèvement et livraison :

1. trajet vers le point d'enlèvement ;
2. validation de l'enlèvement par QR code ;
3. trajet vers le point de dépôt ;
4. validation de la livraison par QR code ;
5. finalisation de la prestation.

Le système empêche de sauter un scan obligatoire, d'utiliser le mauvais type de QR, de rescanner une étape déjà validée ou de terminer avant le dépôt.

### 15.5 États fermés

TERMINEE, ANNULEE, NO_SHOW et LITIGE ferment la navigation active : arrêt du partage, suppression/figeage des actions de trajet, nettoyage de l'itinéraire, du véhicule et de la synthèse vocale.

## 16. QR codes

- afficher le QR d'enlèvement ou de dépôt selon le type demandé ;
- ouvrir la page en mode présentation ou scan ;
- valider le QR dans le contexte de la bonne réservation ;
- refuser un QR invalide, d'une autre réservation, du mauvais type ou déjà consommé ;
- revenir au détail de la réservation après validation.

## 17. Fonctions médicales

### 17.1 Prise de rendez-vous médical

- consulter un médecin, ses motifs, prix, disponibilités et avis ;
- choisir motif, créneau, déplacement et adresse ;
- créer puis payer le rendez-vous ;
- consulter le rendez-vous comme patient.

### 17.2 Espace médecin

- gérer profil, diplôme, services/motifs et disponibilités ;
- consulter RDV patients, négociations et agenda ;
- ouvrir le dossier du patient autorisé ;
- voir groupe sanguin, rhésus, allergies, pathologies et traitements ;
- rechercher/filtrer les patients et l'historique ;
- ajouter un acte médical et ses notes/document ;
- consulter l'historique complet disponible.

L'accès à la fiche d'un patient est limité au patient lui-même, à l'administrateur ou à un médecin réellement lié par une réservation autorisée.

### 17.3 Consultation et ordonnance

Pendant EN_COURS, le médecin dispose de son espace de consultation et peut renseigner :

- actes médicaux ;
- vaccins ;
- traitements/prescriptions ;
- notes utiles.

L'ordonnance enregistrée est persistée avec la réservation et doit être identique dans la vue médecin et la vue client. Le patient peut consulter/télécharger les informations prévues après la consultation. Une réservation non médicale ne doit pas exposer ces actions.

## 18. Avis et notation

Après une réservation TERMINEE :

- seul le client de la réservation voit « Publier mon avis » ;
- il choisit une note de 1 à 5 ;
- il saisit le commentaire requis par l'interface, limité à 500 caractères ;
- il confirme l'envoi ;
- une confirmation de succès est affichée ;
- le CTA disparaît après publication ;
- une deuxième publication est refusée ;
- la note et l'avis alimentent le profil public et la moyenne agrégée du professionnel.

Une réservation non terminée, annulée ou consultée par le professionnel ne peut pas recevoir cet avis client.

## 19. Notifications

### 19.1 Utilisateur

- lister ses notifications avec pagination ;
- voir le nombre non lu ;
- marquer une notification comme lue ;
- tout marquer comme lu ;
- enregistrer un token appareil/push ;
- ouvrir la ressource liée lorsqu'un contexte est fourni.

Événements couverts : nouvelle réservation, confirmation/annulation, paiement confirmé, ajustement de prix, professionnel en route, paiement libéré, nouveau message, KYC approuvé/rejeté, litige ouvert/résolu, réservation finalisée et annonce admin.

### 19.2 Communications externes

Les communications de réservation peuvent être tracées par EMAIL ou SMS avec les états EN_ATTENTE, ENVOYE, ECHEC ou CONFIGURATION_MANQUANTE. L'absence d'un fournisseur configuré est enregistrée sans masquer l'opération métier principale.

## 20. Litiges et preuves

### 20.1 Ouverture par un participant

- signaler une réservation admissible ;
- saisir motif et description ;
- passer la réservation à LITIGE ;
- placer le séquestre en DISPUTED lorsqu'un paiement est concerné ;
- consulter le dossier ;
- ajouter des preuves ;
- supprimer une preuve autorisée avant clôture ;
- suivre les messages et la décision.

Les preuves peuvent contenir les fichiers/métadonnées admis par l'API. Un tiers, un litige fermé ou une réservation non admissible est refusé.

### 20.2 États du litige

- OUVERT : créé et en attente de traitement ;
- EN_REVUE : pris en charge par l'administration ;
- RESOLU : décision appliquée ;
- REJETE : demande rejetée et dossier clos.

La priorité peut être BASSE, MOYENNE ou HAUTE.

### 20.3 Médiation

L'administrateur peut envoyer un message au CLIENT, au PRESTATAIRE ou à TOUS. À la résolution, il peut REMBOURSER_CLIENT, CREDITER_PRESTATAIRE ou PARTAGER les fonds. Une résolution répétée ou incohérente doit être refusée.

## 21. Administration

### 21.1 Vue d'ensemble

- indicateurs utilisateurs, réservations, KYC, litiges et revenus ;
- courbes de chiffre d'affaires ;
- catégories principales ;
- trafic sur sept jours ;
- activité récente.

### 21.2 Validations KYC

- lister et filtrer les dossiers ;
- ouvrir le détail et les justificatifs ;
- approuver ;
- rejeter avec motif ;
- notifier le professionnel.

### 21.3 Médecins et diplômes

- lister les justificatifs médicaux ;
- consulter le profil/diplôme ;
- certifier/authentifier ;
- rejeter avec motif.

### 21.4 Prestataires

- rechercher et lister les prestataires ;
- ouvrir le détail ;
- voir identité, KYC, services et activité ;
- activer ou désactiver un profil professionnel.

### 21.5 Utilisateurs

- rechercher par nom, téléphone ou e-mail ;
- filtrer et paginer ;
- ouvrir le détail ;
- consulter l'historique, rendez-vous client, paiements et retraits ;
- bloquer ou débloquer un compte avec confirmation.

### 21.6 Réservations

- lister avec recherche, statut et pagination ;
- consulter les statistiques ;
- ouvrir le détail complet client, professionnel, service, date, montant et statut.

### 21.7 Paiements et séquestre

- lister et filtrer les paiements ;
- consulter statistiques et détail ;
- rembourser avec motif ;
- lister les séquestres prêts à être libérés ;
- déclencher le traitement des libérations en attente ;
- consulter méthodes, commissions et états financiers.

### 21.8 Litiges

- lister, rechercher et filtrer ;
- consulter preuves, réservation, paiement et participants ;
- passer en revue ;
- communiquer avec une ou deux parties ;
- résoudre avec remboursement client, crédit prestataire ou partage ;
- rejeter avec justification.

### 21.9 Notifications de masse

- choisir une audience CLIENTS, PRESTATAIRES ou TOUS selon l'API ;
- saisir titre et message ;
- ajouter un contexte JSON optionnel ;
- prévisualiser/confirmer ;
- obtenir le nombre de destinataires touchés.

### 21.10 Trafic et analytics

- activité temps réel disponible ;
- utilisateurs connectés sur sept jours ;
- canaux actifs ;
- activité récente ;
- synthèse opérationnelle.

### 21.11 Chiffre d'affaires

- sélectionner une période ;
- voir brut, commission et net ;
- courbe d'évolution ;
- santé financière ;
- répartition par moyen de paiement ;
- prestataires contributeurs ;
- paiements récents avec pagination.

### 21.12 Régions du Sénégal

- consulter l'activité et les agrégats par région ;
- comparer couverture, utilisateurs, professionnels ou réservations exposés par le rapport.

### 21.13 Archives

- consulter les éléments clos, notamment litiges traités ;
- filtrer et ouvrir les informations archivées disponibles.

### 21.14 Structure des services

- consulter catégories, sous-catégories et services déclarés ;
- créer/modifier une catégorie ;
- activer ou désactiver une catégorie ;
- supprimer une catégorie lorsque les contraintes le permettent ;
- importer plusieurs catégories ;
- créer ou importer des sous-catégories ;
- affecter/désaffecter des sous-catégories à une catégorie ;
- sélectionner toutes/aucune dans une affectation ;
- supprimer une sous-catégorie non utilisée ;
- téléverser des images ;
- empêcher une suppression cassant des services existants sans traitement prévu.

## 22. Scénarios fonctionnels complets

### 22.1 Achat direct à prix fixe

Visiteur consulte → se connecte → choisit professionnel/service → date/adresse → confirme → réservation CONFIRMEE → paie → PAYEE_SEQUESTRE → voyageur démarre → arrivée → professionnel démarre → EN_COURS → termine → TERMINEE → séquestre libéré → client publie un avis.

Variantes : créneau pris entre-temps, paiement refusé, utilisateur annule, reprogrammation, client absent, ajustement de prix, litige avant libération.

### 22.2 Achat négocié

Client propose → EN_ATTENTE_PRESTATAIRE → professionnel contre-propose → EN_ATTENTE_CLIENT → client contre/valide/refuse → ACCEPTEE → conversion unique en réservation → paiement → prestation.

Variantes : annulation par un participant, refus, nouvelle proposition autorisée après clôture selon les contraintes, réception temps réel retardée avec rechargement périodique.

### 22.3 Négociation avec matériel

Négociation → professionnel saisit devis → client valide/refuse chaque ligne → acceptation du prix bloquée tant qu'une ligne est en attente → devis finalisé → prix accepté → réservation → paiement.

### 22.4 Médecin se déplaçant chez le patient

Patient réserve et paie → médecin partage sa route → patient suit → médecin arrive → consultation démarrée → fiche patient consultée → actes/vaccins/traitements enregistrés → ordonnance sauvegardée → consultation terminée → patient retrouve l'ordonnance et publie son avis.

### 22.5 Client se déplaçant chez le professionnel

Client paie → client démarre le partage → professionnel suit → client confirme l'arrivée → professionnel démarre seulement après l'arrivée → prestation terminée.

### 22.6 Transport de colis

Client renseigne enlèvement et dépôt → paiement → transporteur va à l'enlèvement → QR enlèvement validé → transport vers destination → QR dépôt validé → prestation terminée → paiement libéré.

### 22.7 Litige financier

Participant signale → réservation LITIGE → séquestre DISPUTED → preuves et échanges → admin met EN_REVUE → décide remboursement, crédit ou partage → transaction financière appliquée → dossier RESOLU ; ou rejet motivé → REJETE.

### 22.8 Compte professionnel en attente de validation

Création profil → ajout justificatifs/services → soumission KYC → EN_ATTENTE → admin approuve : VERIFIE et notification ; ou rejette : REJETE avec motif, correction et nouvelle soumission selon les règles disponibles.

## 23. Cas d'erreur et protections transversales

- données obligatoires manquantes ou mal formatées ;
- téléphone/e-mail déjà utilisé ;
- OTP invalide ou expiré ;
- session expirée, token absent ou rafraîchissement invalide ;
- rôle insuffisant ;
- utilisateur bloqué/inactif ;
- ressource inexistante ;
- tentative d'accès par un non-participant ;
- auto-réservation d'un professionnel ;
- créneau passé, indisponible ou réservé simultanément ;
- action incompatible avec le statut courant ;
- action répétée après succès ;
- contre-proposition par le mauvais acteur ;
- conversion multiple d'une négociation ;
- paiement dupliqué ou webhook répété ;
- montant incohérent, retrait supérieur au solde ;
- libération du séquestre pendant un litige ;
- avis avant fin ou second avis ;
- démarrage avant paiement ;
- démarrage prestataire avant arrivée du client lorsque le client se déplace ;
- QR invalide, mauvais type ou déjà consommé ;
- GPS refusé, trop ancien, régressif, aberrant ou hors itinéraire ;
- perte de socket : récupération par API/polling ;
- fichier trop lourd, type non autorisé ou stockage indisponible ;
- suppression d'une catégorie/sous-catégorie encore référencée ;
- litige déjà fermé ou résolution financière incohérente ;
- erreur réseau : état de chargement, message et possibilité de réessayer.

## 24. Temps réel, cohérence et traçabilité

- Socket.IO diffuse nouveaux messages, réservations, négociations et tracking ;
- les listes professionnelles disposent d'un repli par actualisation périodique ;
- les événements de création, paiement et changement de statut réactualisent les deux parties ;
- l'outbox fiabilise la diffusion des événements métier ;
- un journal d'audit trace les opérations HTTP et leur contexte ;
- les communications SMS/e-mail gardent leur propre statut ;
- les paiements et webhooks utilisent idempotence et références uniques ;
- les écritures financières passent par un registre de transactions du wallet.

## 25. Fonctions backend disponibles mais moins exposées dans l'interface

Le backend propose également :

- connexion Google ;
- token push/appareil ;
- configuration publique Google Maps ;
- géocodage, géocodage inverse et calcul d'itinéraire ;
- endpoint de santé ;
- consultation détaillée de présence professionnelle ;
- communications SMS/e-mail tracées ;
- traitement batch des séquestres prêts à être libérés ;
- téléchargement sécurisé des médias ;
- statistiques détaillées admin et historiques d'utilisateur.

Ces capacités sont réelles côté API même si certaines n'ont pas un bouton dédié dans tous les écrans web.

## 26. Fonctions non constatées comme complètes

Pour éviter de présenter une promesse future comme une fonction livrée, l'audit ne constate pas de module complet autonome pour :

- factures/documents comptables généralisés ;
- parrainage ;
- application mobile native distincte du web responsive ;
- gestion administrative complète des retraits avec écran dédié séparé ;
- appel audio/vidéo dans la messagerie.

Les uploads réellement présents concernent notamment avatar, justificatifs professionnels, portfolio, médias de conversation, preuves de litige et images de structure de services.

## 27. Matrice synthétique des droits

| Fonction | Visiteur | Client | Prestataire | Médecin | Admin |
|---|---:|---:|---:|---:|---:|
| Catalogue/recherche/profils | Oui | Oui | Oui | Oui | Oui |
| Favoris | Non | Oui | Oui en contexte utilisateur | Oui en contexte utilisateur | Selon compte |
| Réserver un autre professionnel | Non | Oui | Oui | Oui | Non prévu comme flux admin |
| Négocier comme client | Non | Oui | Oui | Oui | Non |
| Répondre comme professionnel | Non | Non | Oui | Oui | Non |
| Gérer services/disponibilités | Non | Non | Oui | Oui | Structure globale seulement |
| RDV clients/patients | Non | Ses RDV | RDV reçus | RDV patients | Supervision |
| Paiement client | Non | Oui | Oui comme client | Oui comme client | Supervision/remboursement |
| Wallet/retrait | Non | Non | Oui | Oui | Supervision financière |
| Tracking | Non | Participant | Participant | Participant | Pas de trajet opérationnel |
| Fiche médicale personnelle | Non | Oui | Oui comme patient | Oui comme patient | Accès administratif limité |
| Dossier médical d'un patient | Non | Le sien | Non | Si relation autorisée | Selon autorisation backend |
| Ordonnance | Non | Consultation | Non | Création/modification | Supervision indirecte |
| Litige | Non | Participant | Participant | Participant | Instruction/décision |
| Avis | Non | Après prestation | Comme client seulement | Comme client seulement | Non |
| Administration plateforme | Non | Non | Non | Non | Oui |

## 28. Sources de vérité utilisées pour cet inventaire

- routes Angular et gardes d'authentification/rôle ;
- composants et services de données des fonctionnalités Angular ;
- contrôleurs, DTO et services métier NestJS ;
- rôles, statuts, modèles et relations du schéma Prisma ;
- scénarios Playwright et tests E2E backend ;
- modules chargés par l'application.

Ce document doit être mis à jour dès qu'une route, un statut, une règle d'autorisation ou un parcours métier est ajouté ou supprimé.
