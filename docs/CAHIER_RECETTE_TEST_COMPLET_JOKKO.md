# Jokko — Cahier de recette et liste exhaustive des tests

## 1. But du document

Ce cahier sert à tester entièrement l'application Jokko et à produire une réponse factuelle à trois questions :

1. Qu'est-ce qui fonctionne ?
2. Qu'est-ce qui échoue ?
3. Qu'est-ce qui n'a pas pu être testé, et pourquoi ?

Chaque test doit être exécuté avec les préconditions indiquées, sur le frontend et l'API lorsque cela s'applique. Pour le temps réel, la vérification doit se faire dans deux sessions séparées : une session client et une session professionnel.

## 4. Comptes et données nécessaires

Préparer sans toucher aux données réelles de production :

- un visiteur non connecté ;
- un CLIENT actif avec téléphone/mot de passe ;
- un second CLIENT pour vérifier l'isolation des données ;
- un PRESTATAIRE actif, profil KYC vérifié, services fixe et négociable ;
- un second PRESTATAIRE pour les contrôles d'accès ;
- un MEDECIN actif avec diplôme authentifié et motifs de consultation ;
- un MEDECIN en attente et un rejeté ;
- un ADMIN ;
- un utilisateur bloqué ;
- services couvrant les trois modes de déplacement ;
- créneaux passés, futurs, disponibles et déjà occupés ;
- réservations dans chacun des statuts CONFIRMEE, PAYEE_SEQUESTRE, EN_COURS, TERMINEE, ANNULEE, NO_SHOW et LITIGE ;
- négociations dans chacun des six statuts ;
- paiements EN_ATTENTE, SUCCES, ECHEC et REMBOURSE ;
- séquestres LOCKED, RELEASED, DISPUTED et REFUNDED ;
- litiges OUVERT, EN_REVUE, RESOLU et REJETE ;
- fichiers valides et invalides pour chaque upload ;
- deux navigateurs ou profils de navigateur pour le temps réel ;
- téléphones réels pour la validation finale GPS.

Ne jamais créer de données de test dans la production sans autorisation explicite. Vérifier d'abord les données disponibles.

## 6. Routes, navigation et accès

- [ ] `NAV-001` — Ouvrir `/services` sans connexion → catalogue visible.
- [ ] `NAV-002` — Ouvrir un profil service public → profil visible sans erreur.
- [ ] `NAV-003` — Ouvrir un profil médecin public → profil visible.
- [ ] `NAV-004` — Ouvrir Contact et À propos → contenu visible et liens fonctionnels.
- [ ] `NAV-005` — Ouvrir `/faq` → redirection vers Contact.
- [ ] `NAV-006` — Ouvrir `/` → redirection vers Services.
- [ ] `NAV-007` — Ouvrir une route protégée non connecté → redirection connexion avec retour mémorisé.
- [ ] `NAV-008` — Se connecter après la redirection → retour à la route initiale.
- [ ] `NAV-009` — CLIENT tente `/admin` → accès refusé/redirection sans affichage admin.
- [ ] `NAV-010` — PRESTATAIRE tente une route médecin uniquement → accès refusé.
- [ ] `NAV-011` — CLIENT tente l'espace professionnel → accès refusé.
- [ ] `NAV-012` — PRESTATAIRE ouvre son espace → page adaptée prestataire.
- [ ] `NAV-013` — MEDECIN ouvre son espace → sections médecin et patients disponibles.
- [ ] `NAV-014` — ADMIN ouvre `/admin` → tableau de bord visible.
- [ ] `NAV-015` — Ouvrir une URL inconnue → comportement 404/redirection maîtrisé, pas de page blanche.
- [ ] `NAV-016` — Utiliser précédent/suivant navigateur sur les modales et pages → état cohérent.
- [ ] `NAV-017` — Actualiser chaque route authentifiée → session conservée ou reconnexion propre.
- [ ] `NAV-018` — Tester tous les liens navbar/footer/menu → destination correcte, aucun lien mort.

## 7. Inscription, OTP, connexion et session

- [ ] `AUTH-001` — Inscrire un CLIENT avec données valides → compte créé et suite prévue proposée.
- [ ] `AUTH-002` — Inscrire un PRESTATAIRE valide → rôle et parcours professionnel corrects.
- [ ] `AUTH-003` — Inscrire un MEDECIN valide → rôle et parcours médical corrects.
- [ ] `AUTH-004` — Soumettre le formulaire vide → validations champ par champ, aucun appel invalide.
- [ ] `AUTH-005` — Téléphone sénégalais valide dans différents formats → normalisation identique.
- [ ] `AUTH-006` — Téléphone invalide/étranger non admis → refus explicite.
- [ ] `AUTH-007` — Téléphone déjà inscrit → conflit explicite, aucun doublon.
- [ ] `AUTH-008` — E-mail invalide → validation.
- [ ] `AUTH-009` — Mot de passe trop faible → règles affichées et refus.
- [ ] `AUTH-010` — Confirmation différente → refus local.
- [ ] `AUTH-011` — Demander un OTP valide → code envoyé/réponse attendue.
- [ ] `AUTH-012` — Redemander l'OTP trop vite → limitation conforme.
- [ ] `AUTH-013` — Vérifier OTP correct → authentification réussie.
- [ ] `AUTH-014` — OTP incorrect → refus sans consommation du bon code.
- [ ] `AUTH-015` — OTP expiré → refus et possibilité de renvoi.
- [ ] `AUTH-016` — Réutiliser OTP consommé → refus.
- [ ] `AUTH-017` — Connexion téléphone/mot de passe valides pour chaque rôle → session et rôle corrects.
- [ ] `AUTH-018` — Mot de passe incorrect → message sans révéler l'existence sensible du compte.
- [ ] `AUTH-019` — Compte inconnu → refus propre.
- [ ] `AUTH-020` — Compte bloqué → connexion refusée.
- [ ] `AUTH-021` — Connexion Google avec jeton valide → compte/session correcte.
- [ ] `AUTH-022` — Jeton Google invalide → refus.
- [ ] `AUTH-023` — Rafraîchir un access token expiré → nouveau token utilisable.
- [ ] `AUTH-024` — Refresh token invalide/expiré → session nettoyée et reconnexion demandée.
- [ ] `AUTH-025` — Déconnexion → tokens supprimés et routes protégées inaccessibles.
- [ ] `AUTH-026` — Réutiliser un refresh token après logout → refus.
- [ ] `AUTH-027` — Deux sessions du même compte → comportement conforme à la politique de sessions.
- [ ] `AUTH-028` — Envoyer des requêtes sans token/avec token altéré → 401, aucune donnée.
- [ ] `AUTH-029` — Dépasser les limites de fréquence auth → limitation contrôlée.

## 8. Catalogue, catégories et recherche

- [ ] `CAT-001` — Charger les catégories actives → ordre, icônes et libellés corrects.
- [ ] `CAT-002` — Charger la structure catégories/sous-catégories → relations exactes.
- [ ] `CAT-003` — Une catégorie désactivée n'est plus proposée publiquement.
- [ ] `CAT-004` — Charger les professionnels paginés → pas de doublon entre pages.
- [ ] `CAT-005` — Rechercher par nom de service → résultats pertinents.
- [ ] `CAT-006` — Rechercher par nom de professionnel → bonne fiche proposée.
- [ ] `CAT-007` — Rechercher par catégorie → résultats de cette catégorie.
- [ ] `CAT-008` — Rechercher sans résultat → état vide utile.
- [ ] `CAT-009` — Recherche avec accents, casse et espaces → normalisation correcte.
- [ ] `CAT-010` — Suggestions pendant la saisie → résultats attachés à la barre, sans saut visuel.
- [ ] `CAT-011` — Cliquer une suggestion catégorie → filtre exact appliqué.
- [ ] `CAT-012` — Cliquer une suggestion professionnel → bon profil ouvert.
- [ ] `CAT-013` — Filtrer chaque ville disponible → résultats cohérents.
- [ ] `CAT-014` — Filtrer chaque sous-catégorie → résultats cohérents.
- [ ] `CAT-015` — Filtrer PRESTATAIRE_SE_DEPLACE → services compatibles uniquement.
- [ ] `CAT-016` — Filtrer CLIENT_SE_DEPLACE → services compatibles uniquement.
- [ ] `CAT-017` — Filtrer TRANSPORT_COLIS → services colis uniquement.
- [ ] `CAT-018` — Combiner texte, ville, catégorie et déplacement → intersection correcte.
- [ ] `CAT-019` — Réinitialiser les filtres → catalogue initial restauré.
- [ ] `CAT-020` — Autoriser la géolocalisation → proximité/position correctement utilisée.
- [ ] `CAT-021` — Refuser la géolocalisation → recherche manuelle toujours utilisable.
- [ ] `CAT-022` — Professionnel connecté consulte le catalogue → son propre profil exclu des choix réservables.
- [ ] `CAT-023` — API lente → skeleton/chargement sans page cassée.
- [ ] `CAT-024` — API en erreur → message et nouvelle tentative.

## 9. Profil public, avis publics et présence

- [ ] `PROPUB-001` — Ouvrir un profil vérifié → identité, badge et données exactes.
- [ ] `PROPUB-002` — Ouvrir un profil inactif/non vérifié par URL → non exposé ou état conforme.
- [ ] `PROPUB-003` — Afficher tous les services, prix, durée et type de prix.
- [ ] `PROPUB-004` — Afficher les trois modes de déplacement avec le bon libellé/image.
- [ ] `PROPUB-005` — Afficher véhicule uniquement lorsque pertinent.
- [ ] `PROPUB-006` — Afficher disponibilités réelles sans créneau passé.
- [ ] `PROPUB-007` — Afficher portfolio avec images accessibles.
- [ ] `PROPUB-008` — Afficher expertises sans doublon.
- [ ] `PROPUB-009` — Afficher avis, pagination et moyenne cohérente.
- [ ] `PROPUB-010` — Profil sans avatar/portfolio/avis → fallbacks propres.
- [ ] `PROPUB-011` — Présence en ligne/hors ligne/en route/prestation → libellé cohérent.
- [ ] `PROPUB-012` — CTA Réserver ouvre le bon service/professionnel.
- [ ] `PROPUB-013` — CTA Message connecté ouvre/crée la bonne conversation.
- [ ] `PROPUB-014` — CTA nécessitant un compte, visiteur → connexion puis retour.

## 10. Favoris

- [ ] `FAV-001` — Ajouter un professionnel depuis le catalogue → icône et API mis à jour.
- [ ] `FAV-002` — Retirer depuis le catalogue → disparition de l'état favori.
- [ ] `FAV-003` — Ajouter/retirer depuis le profil → synchronisation avec catalogue.
- [ ] `FAV-004` — Recharger la page → favori persistant.
- [ ] `FAV-005` — Page Favoris liste uniquement les favoris du compte.
- [ ] `FAV-006` — Deux comptes ont des favoris isolés.
- [ ] `FAV-007` — Aucun favori → état vide et CTA utile.
- [ ] `FAV-008` — Ajouter deux fois → pas de doublon.
- [ ] `FAV-009` — Retirer un favori inexistant → réponse idempotente ou erreur maîtrisée.
- [ ] `FAV-010` — Visiteur clique favori → connexion requise, aucune écriture anonyme.

## 11. Profil personnel, avatar et adresse

- [ ] `USR-001` — Charger `/settings` pour chaque rôle → bonnes sections et données.
- [ ] `USR-002` — Modifier prénom/nom → persistance après reconnexion.
- [ ] `USR-003` — Modifier e-mail valide → persistance.
- [ ] `USR-004` — Modifier téléphone valide → normalisation et contrainte d'unicité.
- [ ] `USR-005` — Tenter téléphone déjà utilisé → refus sans écraser le profil.
- [ ] `USR-006` — Modifier adresse par texte → persistance.
- [ ] `USR-007` — Choisir adresse sur carte → texte et coordonnées cohérents.
- [ ] `USR-008` — Annuler l'édition → données précédentes conservées.
- [ ] `USR-009` — Upload avatar image valide → aperçu, URL publique et persistance.
- [ ] `USR-010` — Upload type invalide → refus.
- [ ] `USR-011` — Upload trop lourd → refus explicite.
- [ ] `USR-012` — Échec stockage → ancien avatar conservé.
- [ ] `USR-013` — Avatar absent/cassé → initiales/fallback.
- [ ] `USR-014` — Lire l'historique personnel → événements du bon utilisateur.
- [ ] `USR-015` — Un autre utilisateur tente de lire/modifier ce profil par API → 403/404.

## 12. Fiche médicale personnelle et traitements

- [ ] `MEDP-001` — Client sans fiche ouvre Santé → état vide guidé.
- [ ] `MEDP-002` — Créer fiche avec toutes les données valides → persistance.
- [ ] `MEDP-003` — Mettre à jour groupe sanguin/rhésus → valeurs correctes.
- [ ] `MEDP-004` — Mettre à jour poids/taille → IMC calculé cohérent.
- [ ] `MEDP-005` — Ajouter allergies et conditions multiples → listes normalisées.
- [ ] `MEDP-006` — Champs numériques hors limites → refus.
- [ ] `MEDP-007` — Ajouter traitement complet → visible dans la fiche.
- [ ] `MEDP-008` — Ajouter traitement minimal valide → accepté.
- [ ] `MEDP-009` — Modifier dosage/fréquence/dates → persistance.
- [ ] `MEDP-010` — Date de fin antérieure au début → refus.
- [ ] `MEDP-011` — Supprimer traitement avec confirmation → disparition.
- [ ] `MEDP-012` — Annuler suppression → traitement conservé.
- [ ] `MEDP-013` — Second client tente d'accéder à la fiche → refus.
- [ ] `MEDP-014` — Prestataire non médecin tente la fiche d'un client → refus.
- [ ] `MEDP-015` — Médecin sans relation de réservation tente la fiche → refus.
- [ ] `MEDP-016` — Médecin lié à un patient autorisé accède → données exactes.

## 13. Mot de passe, moyens de paiement et suppression de compte

- [ ] `SEC-001` — Changer mot de passe avec ancien correct → nouveau fonctionne, ancien refusé.
- [ ] `SEC-002` — Ancien mot de passe incorrect → aucun changement.
- [ ] `SEC-003` — Nouveau mot de passe faible → refus.
- [ ] `SEC-004` — Compte externe sans mot de passe crée un mot de passe → connexion locale possible.
- [ ] `SEC-005` — Ajouter carte valide → valeur masquée, aucune donnée sensible en clair.
- [ ] `SEC-006` — Ajouter carte invalide/expirée → refus.
- [ ] `SEC-007` — Ajouter numéro Wave valide → moyen visible et masqué.
- [ ] `SEC-008` — Ajouter numéro Wave invalide → refus.
- [ ] `SEC-009` — Modifier un moyen → données mises à jour.
- [ ] `SEC-010` — Supprimer un moyen → disparition après confirmation.
- [ ] `SEC-011` — Accéder au moyen d'un autre utilisateur par ID → refus.
- [ ] `SEC-012` — Afficher/masquer les valeurs sensibles → aucune fuite complète.
- [ ] `SEC-013` — Demander suppression du compte puis annuler → compte intact.
- [ ] `SEC-014` — Confirmer suppression/anonymisation → connexion impossible et données traitées selon politique.
- [ ] `SEC-015` — Vérifier conservation légale des transactions/audits après anonymisation.

## 14. Profil professionnel, KYC et diplômes

- [ ] `PRO-001` — PRESTATAIRE crée un profil valide → profil lié au bon utilisateur.
- [ ] `PRO-002` — MEDECIN crée un profil valide → données médicales attendues.
- [ ] `PRO-003` — CLIENT appelle création profil pro sans rôle → refus.
- [ ] `PRO-004` — Créer un second profil pour le même utilisateur → refus/déduplication.
- [ ] `PRO-005` — Modifier entreprise, ville et biographie → persistance publique.
- [ ] `PRO-006` — Sauvegarde vide → aucune écriture inutile ni perte.
- [ ] `PRO-007` — Ajouter expertise → visible une seule fois.
- [ ] `PRO-008` — Ajouter expertise en doublon/casse différente → pas de doublon.
- [ ] `PRO-009` — Retirer expertise → profil mis à jour.
- [ ] `PRO-010` — Choisir PRESTATAIRE_SE_DEPLACE et véhicule → persistance.
- [ ] `PRO-011` — Choisir CLIENT_SE_DEPLACE → pas de véhicule exigé à tort.
- [ ] `PRO-012` — Choisir TRANSPORT_COLIS → véhicule requis/affiché selon règle.
- [ ] `PRO-013` — Sélectionner adresse d'intervention sur carte → coordonnées correctes.
- [ ] `KYC-001` — Upload justificatif valide → document listé.
- [ ] `KYC-002` — Upload type/taille invalide → refus.
- [ ] `KYC-003` — Soumettre dossier complet → EN_ATTENTE.
- [ ] `KYC-004` — Soumettre dossier incomplet → champs/documents manquants signalés.
- [ ] `KYC-005` — Admin approuve → VERIFIE sur API, UI et notification.
- [ ] `KYC-006` — Admin rejette avec motif → REJETE et motif visible.
- [ ] `KYC-007` — Rejet sans motif obligatoire → refus.
- [ ] `KYC-008` — Non-admin appelle validation → refus.
- [ ] `KYC-009` — Médecin upload diplôme valide → EN_ATTENTE.
- [ ] `KYC-010` — Admin authentifie diplôme → AUTHENTIFIE.
- [ ] `KYC-011` — Admin rejette diplôme → REJETE avec motif.
- [ ] `KYC-012` — Supprimer un document autorisé → disparition et stockage cohérent.

## 15. Services, motifs, portfolio et disponibilités

- [ ] `SRV-001` — Créer service à prix FIXE avec tous les champs → visible.
- [ ] `SRV-002` — Créer service NEGOCIABLE → parcours négociation proposé.
- [ ] `SRV-003` — Créer motif médical → visible sur profil médecin.
- [ ] `SRV-004` — Champ obligatoire absent → refus précis.
- [ ] `SRV-005` — Prix négatif/nul non permis → refus.
- [ ] `SRV-006` — Durée inférieure au minimum → refus.
- [ ] `SRV-007` — Temps de pause invalide → refus.
- [ ] `SRV-008` — Catégorie/sous-catégorie incohérente → refus.
- [ ] `SRV-009` — Modifier nom, prix, durée, mode et image → public synchronisé.
- [ ] `SRV-010` — Supprimer/désactiver un service sans réservation future → succès.
- [ ] `SRV-011` — Supprimer service référencé par réservations → historique préservé.
- [ ] `SRV-012` — Modifier le service d'un autre pro par ID → refus.
- [ ] `PORT-001` — Ajouter portfolio image/titre/description → visible publiquement.
- [ ] `PORT-002` — Annuler avant upload → aucune création.
- [ ] `PORT-003` — Type/taille invalide → refus.
- [ ] `PORT-004` — Supprimer élément propre → disparition.
- [ ] `PORT-005` — Supprimer élément d'un autre professionnel → refus.
- [ ] `AVL-001` — Activer chaque jour et ajouter un créneau valide → disponibilité publique.
- [ ] `AVL-002` — Ajouter plusieurs créneaux non chevauchants → tous visibles.
- [ ] `AVL-003` — Ajouter créneaux chevauchants → refus.
- [ ] `AVL-004` — Heure fin avant début → refus.
- [ ] `AVL-005` — Modifier un créneau → réservation propose la nouvelle plage.
- [ ] `AVL-006` — Supprimer un créneau → plus proposé.
- [ ] `AVL-007` — Désactiver un jour → aucun créneau proposé ce jour.
- [ ] `AVL-008` — Date passée → jamais réservable.
- [ ] `AVL-009` — Bloquer une date exceptionnelle → aucun slot ce jour.
- [ ] `AVL-010` — Deux clients demandent le même dernier créneau → une seule réservation réussit.

## 16. Proposition, adresse et réservation directe

- [ ] `BOOK-001` — Ouvrir proposition depuis un service fixe → bonnes données dynamiques.
- [ ] `BOOK-002` — Changer de service dans la modale → prix/durée actualisés.
- [ ] `BOOK-003` — Choisir date puis slot disponible → sélection conservée.
- [ ] `BOOK-004` — Choisir slot passé/indisponible → impossible.
- [ ] `BOOK-005` — Rechercher adresse valide → suggestions Google affichées.
- [ ] `BOOK-006` — Choisir suggestion → texte et coordonnées exacts.
- [ ] `BOOK-007` — Choisir point sur carte → géocodage inverse cohérent.
- [ ] `BOOK-008` — Refuser GPS → saisie/adresse manuelle utilisable.
- [ ] `BOOK-009` — API Maps indisponible → message et saisie de repli.
- [ ] `BOOK-010` — PRESTATAIRE_SE_DEPLACE demande adresse client → champs corrects.
- [ ] `BOOK-011` — CLIENT_SE_DEPLACE utilise adresse professionnelle → destination correcte.
- [ ] `BOOK-012` — TRANSPORT_COLIS exige départ et destination distincts.
- [ ] `BOOK-013` — Afficher le résumé → professionnel, service, date, adresse, durée et prix exacts.
- [ ] `BOOK-014` — Créer réservation fixe valide → CONFIRMEE et visible des deux côtés.
- [ ] `BOOK-015` — Double clic confirmation → une seule réservation.
- [ ] `BOOK-016` — Auto-réservation du professionnel → refus métier.
- [ ] `BOOK-017` — Création avec service inactif → refus.
- [ ] `BOOK-018` — Création avec professionnel inactif → refus.
- [ ] `BOOK-019` — Créneau pris entre sélection et validation → conflit explicite.
- [ ] `BOOK-020` — Utilisateur non connecté soumet → connexion puis données restaurées si prévu.

## 17. Négociations et contre-propositions

- [ ] `NEG-001` — Client crée négociation valide → EN_ATTENTE_PRESTATAIRE.
- [ ] `NEG-002` — Professionnel reçoit sans rechargement → carte créée côté pro.
- [ ] `NEG-003` — Client voit la négociation dans son contexte CLIENT.
- [ ] `NEG-004` — Professionnel contre-propose → EN_ATTENTE_CLIENT et valeurs exactes.
- [ ] `NEG-005` — Client reçoit contre-offre en temps réel.
- [ ] `NEG-006` — Client contre-propose à son tour → EN_ATTENTE_PRESTATAIRE.
- [ ] `NEG-007` — Mauvais acteur contre-propose pendant son propre état d'attente → refus.
- [ ] `NEG-008` — Client accepte contre-offre → ACCEPTEE.
- [ ] `NEG-009` — Professionnel accepte offre client → ACCEPTEE.
- [ ] `NEG-010` — Participant refuse avec motif → REFUSEE et motif conservé.
- [ ] `NEG-011` — Participant annule avec motif → ANNULEE.
- [ ] `NEG-012` — Tiers lit/modifie négociation → refus.
- [ ] `NEG-013` — Action sur négociation fermée → conflit/refus.
- [ ] `NEG-014` — Convertir ACCEPTEE → réservation créée, statut CONVERTIE_EN_RESERVATION.
- [ ] `NEG-015` — Convertir avant acceptation → refus.
- [ ] `NEG-016` — Convertir deux fois/double clic → une seule réservation.
- [ ] `NEG-017` — Payload de conversion reprend service, client, pro, date, durée, adresse et prix acceptés.
- [ ] `NEG-018` — Nouvelle négociation après clôture conforme aux règles d'unicité.
- [ ] `NEG-019` — Perte socket → polling/rechargement récupère le nouvel état.
- [ ] `NEG-020` — Tri et filtres pro : tout/en attente/attente client/confirmé/fermé exacts.

## 18. Devis de matériel

- [ ] `QUOTE-001` — Professionnel crée une ligne valide → EN_ATTENTE.
- [ ] `QUOTE-002` — Client voit le devis avec montants exacts.
- [ ] `QUOTE-003` — Client approuve → VALIDE.
- [ ] `QUOTE-004` — Client refuse → REFUSE.
- [ ] `QUOTE-005` — Professionnel ne peut pas approuver à la place du client.
- [ ] `QUOTE-006` — Tiers ne peut pas lire/modifier le devis.
- [ ] `QUOTE-007` — Acceptation du prix bloquée pendant le chargement du devis.
- [ ] `QUOTE-008` — Acceptation bloquée tant qu'une ligne est EN_ATTENTE.
- [ ] `QUOTE-009` — Finalisation refusée avec ligne en attente/refusée non corrigée.
- [ ] `QUOTE-010` — Finaliser toutes lignes validées → ready vrai et PDF/état cohérent.
- [ ] `QUOTE-011` — Télécharger PDF → fichier lisible, données et total exacts.
- [ ] `QUOTE-012` — Négociation sans devis → acceptation non bloquée.
- [ ] `QUOTE-013` — Ajouter/modifier après finalisation → refus ou versionnement conforme.

## 19. Listes rendez-vous, filtres et agenda

- [ ] `APPL-001` — CLIENT voit uniquement ses réservations client.
- [ ] `APPL-002` — PRESTATAIRE dans navbar voit ses achats comme client, pas ses RDV reçus.
- [ ] `APPL-003` — MEDECIN dans navbar voit ses achats comme client.
- [ ] `APPL-004` — Espace pro voit uniquement les réservations où il est prestataire.
- [ ] `APPL-005` — RDV patients médecin n'affiche que ses patients.
- [ ] `APPL-006` — Liste et calendrier contiennent les mêmes éléments.
- [ ] `APPL-007` — Tri décroissant par date ; dates invalides à la fin.
- [ ] `APPL-008` — Onglet actif exclut les états fermés prévus.
- [ ] `APPL-009` — Onglet terminé contient TERMINEE, ANNULEE, NO_SHOW, LITIGE et négociations fermées.
- [ ] `APPL-010` — Nouvelle réservation apparaît en temps réel chez le pro.
- [ ] `APPL-011` — Paiement/finalisation met la carte à jour sans rechargement.
- [ ] `AGEN-001` — Prochain client correspond au prochain RDV admissible.
- [ ] `AGEN-002` — Vues jour/semaine/mois affichent les mêmes événements pertinents.
- [ ] `AGEN-003` — Navigation précédent/suivant/aujourd'hui change la bonne période.
- [ ] `AGEN-004` — Filtres ALL/ACTIVE/DONE/CANCELLED/DISPUTE exacts.
- [ ] `AGEN-005` — Période personnalisée inclut bornes correctement.
- [ ] `AGEN-006` — Ouvrir événement → détail exact client/service/date/durée/adresse/statut.
- [ ] `AGEN-007` — Annuler RDV admissible avec motif → deux côtés synchronisés.
- [ ] `AGEN-008` — Annuler RDV non admissible → bouton désactivé/refus API.
- [ ] `AGEN-009` — Agenda vide → état clair.
- [ ] `AGEN-010` — Zoom visuel ne change pas les données métier.

## 20. Transitions de réservation

- [ ] `RES-001` — Création valide produit CONFIRMEE.
- [ ] `RES-002` — Paiement réussi produit PAYEE_SEQUESTRE.
- [ ] `RES-003` — Démarrage autorisé produit EN_COURS.
- [ ] `RES-004` — Fin autorisée produit TERMINEE.
- [ ] `RES-005` — Annulation autorisée produit ANNULEE avec motif.
- [ ] `RES-006` — Absence autorisée produit NO_SHOW.
- [ ] `RES-007` — Ouverture litige produit LITIGE.
- [ ] `RES-008` — Confirmer une réservation déjà confirmée → idempotence/refus maîtrisé.
- [ ] `RES-009` — Démarrer avant paiement → refus.
- [ ] `RES-010` — Terminer avant démarrage → refus.
- [ ] `RES-011` — Modifier une réservation fermée → refus.
- [ ] `RES-012` — Tiers change le statut → refus.
- [ ] `RES-013` — Client tente une action réservée au professionnel → refus.
- [ ] `RES-014` — Professionnel tente une action client → refus.
- [ ] `RES-015` — Reprogrammer CONFIRMEE vers slot libre → date mise à jour des deux côtés.
- [ ] `RES-016` — Reprogrammer vers slot occupé/passé → refus.
- [ ] `RES-017` — Annulation avant paiement → statut et notifications exacts.
- [ ] `RES-018` — Annulation après paiement → séquestre/remboursement conforme.
- [ ] `RES-019` — Double requête concurrente de transition → un seul état final valide.
- [ ] `RES-020` — Historique/audit retrace chaque transition et acteur.

## 21. Ajustement de prix

- [ ] `PRICE-001` — Professionnel propose montant valide → EN_ATTENTE_CLIENT.
- [ ] `PRICE-002` — Client reçoit notification et nouveau montant proposé.
- [ ] `PRICE-003` — Client accepte → ACCEPTE et prix final mis à jour.
- [ ] `PRICE-004` — Client refuse → REFUSE et ancien prix conservé.
- [ ] `PRICE-005` — Tiers ou professionnel accepte à la place du client → refus.
- [ ] `PRICE-006` — Nouveau montant nul/négatif/incohérent → refus.
- [ ] `PRICE-007` — Ajustement sur réservation fermée → refus.
- [ ] `PRICE-008` — Paiement utilise uniquement le prix accepté.

## 22. Paiements, webhooks et séquestre

- [ ] `PAY-001` — Résumé affiche réservation, prix et bénéficiaire exacts.
- [ ] `PAY-002` — Initier Wave → référence unique et redirection/réponse attendue.
- [ ] `PAY-003` — Initier Orange Money → référence unique.
- [ ] `PAY-004` — Initier carte → flux sécurisé attendu.
- [ ] `PAY-005` — Utiliser moyen enregistré du bon utilisateur.
- [ ] `PAY-006` — Montant envoyé par client altéré → backend utilise/refuse selon montant serveur.
- [ ] `PAY-007` — Paiement SUCCES → réservation PAYEE_SEQUESTRE et escrow LOCKED.
- [ ] `PAY-008` — Paiement ECHEC → réservation non payée et nouvelle tentative possible.
- [ ] `PAY-009` — Paiement EN_ATTENTE → UI ne déclare pas succès prématurément.
- [ ] `PAY-010` — Double clic initiation → pas de double débit.
- [ ] `PAY-011` — Webhook signé valide → traité une seule fois.
- [ ] `PAY-012` — Même webhook rejoué → ignoré/idempotent.
- [ ] `PAY-013` — Signature webhook invalide → refus sans transition.
- [ ] `PAY-014` — Webhook montant/référence incohérent → ECHEC/IGNORE et alerte.
- [ ] `PAY-015` — Consulter historique → uniquement paiements autorisés.
- [ ] `PAY-016` — Consulter détail d'un autre utilisateur → refus.
- [ ] `ESC-001` — Après paiement, escrow LOCKED et fonds non retirables.
- [ ] `ESC-002` — Après prestation admissible, libération → RELEASED et wallet crédité.
- [ ] `ESC-003` — Libérer deux fois → aucun double crédit.
- [ ] `ESC-004` — Ouvrir litige → DISPUTED et libération bloquée.
- [ ] `ESC-005` — Résolution remboursement → REFUNDED et transaction exacte.
- [ ] `ESC-006` — Résolution crédit pro → RELEASED et commission cohérente.
- [ ] `ESC-007` — Résolution partage → débits/crédits totalisent le montant initial.

## 23. Wallet et retraits

- [ ] `WAL-001` — Solde disponible + bloqué correspond au registre de transactions.
- [ ] `WAL-002` — Historique affiche crédits, retraits, remboursements, commissions, ajustements.
- [ ] `WAL-003` — Demander retrait Wave valide inférieur au solde → EN_ATTENTE.
- [ ] `WAL-004` — Demander retrait Orange Money valide → EN_ATTENTE.
- [ ] `WAL-005` — Montant nul/négatif → refus.
- [ ] `WAL-006` — Montant supérieur au disponible → refus.
- [ ] `WAL-007` — Double soumission → une seule demande/réservation de fonds.
- [ ] `WAL-008` — Suivre EN_ATTENTE → EN_COURS → TERMINE.
- [ ] `WAL-009` — Retrait ECHEC restitue les fonds disponibles.
- [ ] `WAL-010` — Retrait ANNULE restitue les fonds.
- [ ] `WAL-011` — Client sans wallet pro tente retrait → refus.
- [ ] `WAL-012` — Un pro consulte le wallet d'un autre → refus.

## 24. Conversations, messages et médias

- [ ] `MSG-001` — Créer conversation depuis profil → bons participants, une conversation.
- [ ] `MSG-002` — Réouvrir le même contact → conversation existante, pas de doublon.
- [ ] `MSG-003` — Créer conversation depuis négociation → lien/participants corrects.
- [ ] `MSG-004` — Ouvrir conversation de réservation → carte réservation correcte.
- [ ] `MSG-005` — Lister conversations → dernier message, ordre et non-lus corrects.
- [ ] `MSG-006` — Envoyer texte client → visible immédiatement et reçu côté pro.
- [ ] `MSG-007` — Envoyer texte pro → reçu côté client sans rechargement.
- [ ] `MSG-008` — Message vide/espaces → non envoyé.
- [ ] `MSG-009` — Message à longueur maximale → accepté ; au-delà → refus.
- [ ] `MSG-010` — Historique paginé → ordre correct, aucun doublon/manquant.
- [ ] `MSG-011` — Reconnexion socket → messages manqués récupérés.
- [ ] `MSG-012` — Perte réseau pendant envoi → état erreur et pas de faux succès.
- [ ] `MSG-013` — Nouvelle tentative → un seul message final.
- [ ] `MSG-014` — Tiers lit/envoie dans la conversation → refus.
- [ ] `MSG-015` — Upload image valide → aperçu et téléchargement.
- [ ] `MSG-016` — Upload document autorisé → téléchargement sécurisé.
- [ ] `MSG-017` — Type interdit/taille excessive → refus.
- [ ] `MSG-018` — URL de téléchargement expirée/altérée → refus.
- [ ] `MSG-019` — Média persiste après reconnexion/redéploiement selon stockage prévu.
- [ ] `MSG-020` — Conversation directe neuve sans message/réservation → bouton négocier visible.
- [ ] `MSG-021` — Dès qu'un message existe → bouton de nouvelle négociation vide masqué.
- [ ] `MSG-022` — Conversation avec réservation → widgets réservation conservés, bouton vide masqué.
- [ ] `MSG-023` — Deux onglets envoient simultanément → ordre stable et IDs uniques.

## 25. Notifications et communications

- [ ] `NOTIF-001` — Nouvelle réservation génère notification au professionnel.
- [ ] `NOTIF-002` — Confirmation/annulation notifie la bonne partie.
- [ ] `NOTIF-003` — Paiement confirmé notifie sans doublon.
- [ ] `NOTIF-004` — Ajustement proposé/accepté/refusé notifie le bon acteur.
- [ ] `NOTIF-005` — Voyageur en route notifie l'observateur.
- [ ] `NOTIF-006` — Nouveau message notifie le destinataire, pas l'expéditeur.
- [ ] `NOTIF-007` — KYC approuvé/rejeté notifie le professionnel.
- [ ] `NOTIF-008` — Litige ouvert/résolu notifie les participants.
- [ ] `NOTIF-009` — Réservation finalisée/paiement libéré notifie les parties prévues.
- [ ] `NOTIF-010` — Lister paginé → ordre, total et non-lus corrects.
- [ ] `NOTIF-011` — Marquer une notification lue → compteur mis à jour.
- [ ] `NOTIF-012` — Tout marquer lu → compteur zéro.
- [ ] `NOTIF-013` — Marquer notification d'autrui par ID → refus.
- [ ] `NOTIF-014` — Enregistrer token appareil valide → succès/déduplication.
- [ ] `NOTIF-015` — Token invalide → refus.
- [ ] `COM-001` — SMS configuré → trace ENVOYE ou ECHEC réel.
- [ ] `COM-002` — E-mail configuré → trace ENVOYE ou ECHEC réel.
- [ ] `COM-003` — Fournisseur absent → CONFIGURATION_MANQUANTE sans annuler l'opération métier.

## 26. Tracking commun et synchronisation temps réel

- [ ] `TRK-001` — CONFIRMEE non payée → aucune navigation active.
- [ ] `TRK-002` — PAYEE_SEQUESTRE → actions conformes au rôle et mode.
- [ ] `TRK-003` — Tiers consulte tracking → refus.
- [ ] `TRK-004` — Position publiée → horodatage source conservé.
- [ ] `TRK-005` — Position plus ancienne que la précédente → ignorée.
- [ ] `TRK-006` — Saut physiquement impossible → rejeté, marqueur stable.
- [ ] `TRK-007` — Petits mouvements réels → animation fluide, sans téléportation.
- [ ] `TRK-008` — Changement de cap passant par le nord → rotation courte et stable.
- [ ] `TRK-009` — GPS hors itinéraire → route recalculée depuis position réelle.
- [ ] `TRK-010` — GPS refusé → message/repli adresse.
- [ ] `TRK-011` — GPS indisponible temporairement → dernière position utile conservée.
- [ ] `TRK-012` — Réseau coupé puis revenu → reprise sans trajet dupliqué.
- [ ] `TRK-013` — Observateur ouvre après départ → état courant récupéré par API.
- [ ] `TRK-014` — Événement socket arrivée → acteur et observateur synchronisés.
- [ ] `TRK-015` — Relecture API après socket manquée → même état final.
- [ ] `TRK-016` — Recentrage garde véhicule/voyageur visible.
- [ ] `TRK-017` — Interaction manuelle carte puis suivi → comportement de reprise conforme.
- [ ] `TRK-018` — Instructions, distance et durée se mettent à jour.
- [ ] `TRK-019` — Commandes direction N/E/S/O fonctionnent sans déplacer les actions principales.
- [ ] `TRK-020` — TERMINEE/ANNULEE/NO_SHOW/LITIGE arrêtent carte active, véhicule et voix.

## 27. Mode PRESTATAIRE_SE_DEPLACE

- [ ] `TRKP-001` — Client ne voit pas le bouton réservé au professionnel.
- [ ] `TRKP-002` — Pro payé démarre « en route » → EN_ROUTE et partage actif.
- [ ] `TRKP-003` — Client voit véhicule, route et progression.
- [ ] `TRKP-004` — Pro publie positions successives → client voit mouvement fluide.
- [ ] `TRKP-005` — Pro confirme « Sur place » → arrivée immédiate des deux côtés.
- [ ] `TRKP-006` — Après arrivée, route/destination nettoyées des deux côtés.
- [ ] `TRKP-007` — Démarrage prestation autorisé selon règle métier sans fausse contrainte générique.
- [ ] `TRKP-008` — Démarrer avant paiement → refus.
- [ ] `TRKP-009` — Marquer client absent uniquement quand autorisé.
- [ ] `TRKP-010` — Terminer après démarrage → TERMINEE et tracking fermé.

## 28. Mode CLIENT_SE_DEPLACE

- [ ] `TRKC-001` — Client payé voit « Démarrer le trajet/Partager ma position ».
- [ ] `TRKC-002` — Professionnel voit « attente du client » avant départ.
- [ ] `TRKC-003` — Client démarre avec GPS Dakar valide → route vers adresse pro.
- [ ] `TRKC-004` — GPS navigateur hors Sénégal → départ repli adresse, route utilisable.
- [ ] `TRKC-005` — Professionnel voit trajet client une fois en route.
- [ ] `TRKC-006` — Professionnel ne peut pas démarrer avant arrivée client.
- [ ] `TRKC-007` — Client confirme arrivée → état visible des deux côtés.
- [ ] `TRKC-008` — Arrivée client ne démarre pas automatiquement la prestation.
- [ ] `TRKC-009` — Après arrivée, professionnel peut démarrer.
- [ ] `TRKC-010` — Démarrage possible même si rafraîchissement de route échoue après arrivée confirmée.
- [ ] `TRKC-011` — Partager la position seul ne vaut jamais arrivée.
- [ ] `TRKC-012` — Destination utilisée est bien l'adresse professionnelle, pas celle du client.

## 29. Transport de colis et QR codes

- [ ] `PAR-001` — Réservation colis affiche enlèvement, dépôt, colis et véhicule exacts.
- [ ] `PAR-002` — Transporteur démarre vers enlèvement → première route active.
- [ ] `PAR-003` — Tenter démarrage vers dépôt avant enlèvement → refus.
- [ ] `PAR-004` — Générer QR enlèvement → contient réservation/type attendus.
- [ ] `PAR-005` — Scanner QR enlèvement valide → enlèvement validé une fois.
- [ ] `PAR-006` — Scanner QR dépôt à l'étape enlèvement → refus.
- [ ] `PAR-007` — Scanner QR d'une autre réservation → refus.
- [ ] `PAR-008` — Rescanner QR enlèvement consommé → refus/idempotence.
- [ ] `PAR-009` — Après enlèvement, route bascule vers dépôt.
- [ ] `PAR-010` — Générer/scanner QR dépôt valide → dépôt validé.
- [ ] `PAR-011` — Terminer avant dépôt → refus.
- [ ] `PAR-012` — Terminer après dépôt → TERMINEE.
- [ ] `PAR-013` — Caméra refusée → saisie/alternative prévue utilisable.
- [ ] `PAR-014` — QR illisible/altéré → message clair, aucun statut modifié.

## 30. Consultation médicale, dossier patient et ordonnance

- [ ] `MED-001` — Patient réserve motif médical fixe → données médecin/motif correctes.
- [ ] `MED-002` — Médecin voit le RDV dans « RDV patients » sans rechargement.
- [ ] `MED-003` — Médecin ouvre patient lié → fiche médicale autorisée.
- [ ] `MED-004` — Médecin ouvre autre patient non lié → refus.
- [ ] `MED-005` — Pendant PAYEE_SEQUESTRE avant démarrage → actions consultation non prématurées.
- [ ] `MED-006` — Démarrer consultation → EN_COURS et workbench médical.
- [ ] `MED-007` — Ajouter acte médical → sauvegarde sans modifier à tort le statut opérationnel.
- [ ] `MED-008` — Ajouter vaccin → persistance sans redémarrer la prestation.
- [ ] `MED-009` — Ajouter traitement/prescription → persistance.
- [ ] `MED-010` — Autosauvegarde lente puis refresh réservation → aucune donnée écrasée.
- [ ] `MED-011` — Saisies invalides/vides → validation.
- [ ] `MED-012` — Ajouter document d'acte valide → accessible au bon patient.
- [ ] `MED-013` — Document invalide/trop lourd → refus.
- [ ] `MED-014` — Terminer consultation → TERMINEE, ordonnance conservée.
- [ ] `MED-015` — Vue client affiche mêmes actes/vaccins/traitements que vue médecin.
- [ ] `MED-016` — Télécharger ordonnance → document lisible et données exactes.
- [ ] `MED-017` — Consultation non médicale → aucune action ordonnance.
- [ ] `MED-018` — Historique médical filtre patients, mois et spécialités correctement.
- [ ] `MED-019` — Ajouter acte depuis dossier patient → historique mis à jour.
- [ ] `MED-020` — Deux médecins ne voient que leurs patients autorisés.

## 31. Avis

- [ ] `REV-001` — Client voit CTA uniquement sur sa réservation TERMINEE non notée.
- [ ] `REV-002` — Professionnel ne voit pas CTA client.
- [ ] `REV-003` — Réservation non terminée/annulée → CTA absent.
- [ ] `REV-004` — Ouvrir modale → note et commentaire initialement cohérents.
- [ ] `REV-005` — Soumettre note 1 à 5 avec commentaire valide → succès.
- [ ] `REV-006` — Aucune note → bouton désactivé/refus.
- [ ] `REV-007` — Commentaire requis vide → refus interface.
- [ ] `REV-008` — Commentaire supérieur à 500 caractères → refus/limite.
- [ ] `REV-009` — Après succès, CTA disparaît et profil public affiche l'avis.
- [ ] `REV-010` — Moyenne du professionnel recalculée exactement.
- [ ] `REV-011` — Deuxième avis sur même réservation → refus.
- [ ] `REV-012` — Tiers note une réservation → refus.

## 32. Litiges, preuves et médiation

- [ ] `DIS-001` — Participant ouvre litige sur réservation admissible → OUVERT et réservation LITIGE.
- [ ] `DIS-002` — Motif/description obligatoires manquants → refus.
- [ ] `DIS-003` — Tiers ouvre/consulte → refus.
- [ ] `DIS-004` — Réservation annulée non admissible → refus.
- [ ] `DIS-005` — Ouvrir second litige identique → pas de doublon.
- [ ] `DIS-006` — Paiement concerné passe DISPUTED.
- [ ] `DIS-007` — Ajouter preuve valide → visible participant/admin.
- [ ] `DIS-008` — Ajouter type/taille invalide → refus.
- [ ] `DIS-009` — Supprimer sa preuve avant clôture → succès.
- [ ] `DIS-010` — Supprimer preuve d'autrui → refus.
- [ ] `DIS-011` — Ajouter/supprimer après clôture → refus.
- [ ] `DIS-012` — Admin passe OUVERT → EN_REVUE.
- [ ] `DIS-013` — Admin envoie message CLIENT uniquement → seul destinataire prévu le voit.
- [ ] `DIS-014` — Message PRESTATAIRE uniquement → bon destinataire.
- [ ] `DIS-015` — Message TOUS → deux parties le voient.
- [ ] `DIS-016` — Admin résout REMBOURSER_CLIENT → fonds et statuts exacts.
- [ ] `DIS-017` — Admin résout CREDITER_PRESTATAIRE → fonds exacts.
- [ ] `DIS-018` — Admin résout PARTAGER → somme exacte, aucun centime perdu/dupliqué.
- [ ] `DIS-019` — Admin rejette avec motif → REJETE et notification.
- [ ] `DIS-020` — Non-admin appelle endpoints admin litiges → refus.
- [ ] `DIS-021` — Résoudre/rejeter deux fois → refus/idempotence financière.

## 33. Administration — vue globale et gouvernance

- [ ] `ADM-001` — Dashboard charge tous les KPI sans erreur.
- [ ] `ADM-002` — Totaux dashboard correspondent aux listes/API sources.
- [ ] `ADM-003` — Courbes et activité récente utilisent les bonnes périodes.
- [ ] `ADM-004` — Tous les onglets admin sont accessibles par URL/query et menu.
- [ ] `ADM-005` — Non-admin ne reçoit aucune donnée admin par API.
- [ ] `ADMU-001` — Rechercher utilisateurs par nom/téléphone/e-mail.
- [ ] `ADMU-002` — Filtrer/paginer sans doublon.
- [ ] `ADMU-003` — Détail utilisateur affiche profil, RDV, paiements, retraits et historique exacts.
- [ ] `ADMU-004` — Bloquer utilisateur → session/connexion refusée selon politique.
- [ ] `ADMU-005` — Débloquer → connexion rétablie.
- [ ] `ADMU-006` — Bloquer/débloquer avec ID inconnu ou état déjà appliqué → réponse maîtrisée.
- [ ] `ADMPRO-001` — Lister/rechercher prestataires → totaux exacts.
- [ ] `ADMPRO-002` — Ouvrir détail → KYC, services et activité exacts.
- [ ] `ADMPRO-003` — Désactiver prestataire → profil/services retirés du public.
- [ ] `ADMPRO-004` — Réactiver → retour public conforme.
- [ ] `ADMRES-001` — Lister/filtrer chaque statut réservation.
- [ ] `ADMRES-002` — Statistiques égales aux données listées.
- [ ] `ADMRES-003` — Détail affiche client, pro, service, prix, paiement et statuts exacts.
- [ ] `ADMPAY-001` — Lister/filtrer/paginer paiements.
- [ ] `ADMPAY-002` — Statistiques financières concordent avec transactions.
- [ ] `ADMPAY-003` — Ouvrir détail paiement → références et escrow exacts.
- [ ] `ADMPAY-004` — Rembourser avec motif → statut REMBOURSE, escrow REFUNDED, ledger exact.
- [ ] `ADMPAY-005` — Remboursement double ou supérieur → refus.
- [ ] `ADMPAY-006` — Lister escrow en attente de libération → uniquement admissibles.
- [ ] `ADMPAY-007` — Traitement batch → chaque item traité une fois, erreurs isolées.

## 34. Administration — structure, diffusion et rapports

- [ ] `STR-001` — Charger catégories/sous-catégories/services déclarés et totaux.
- [ ] `STR-002` — Créer catégorie valide → publique si active.
- [ ] `STR-003` — Créer catégorie en doublon → refus/déduplication.
- [ ] `STR-004` — Modifier nom, icône, commission → persistance.
- [ ] `STR-005` — Désactiver/réactiver catégorie → visibilité publique correcte.
- [ ] `STR-006` — Import catégories valides → nombre exact créé.
- [ ] `STR-007` — Import mélange valide/invalide → rapport clair et atomicité conforme.
- [ ] `STR-008` — Créer/importer sous-catégories → relations exactes.
- [ ] `STR-009` — Affecter/désaffecter plusieurs sous-catégories → structure exacte.
- [ ] `STR-010` — Supprimer sous-catégorie non utilisée → succès.
- [ ] `STR-011` — Supprimer sous-catégorie/catégorie utilisée → historique protégé/refus clair.
- [ ] `STR-012` — Upload image valide/invalide → succès/refus attendu.
- [ ] `BCAST-001` — Diffuser annonce CLIENTS → uniquement clients ciblés.
- [ ] `BCAST-002` — Diffuser PRESTATAIRES → prestataires/médecins selon règle définie.
- [ ] `BCAST-003` — Diffuser TOUS → tous comptes actifs ciblés une fois.
- [ ] `BCAST-004` — Titre/message vide ou trop long → refus.
- [ ] `BCAST-005` — JSON contexte valide/invalide → accepté/refus explicite.
- [ ] `BCAST-006` — Double clic envoi → pas de double diffusion.
- [ ] `RPT-001` — Trafic 7 jours correspond aux données et fuseau horaire.
- [ ] `RPT-002` — Canaux actifs et activité récente cohérents.
- [ ] `RPT-003` — Chiffre d'affaires par période : brut, commission, net exacts.
- [ ] `RPT-004` — Répartition moyens paiement totalise 100 %/montant global.
- [ ] `RPT-005` — Prestataires contributeurs et paiements récents exacts.
- [ ] `RPT-006` — Pagination paiements récents sans doublon.
- [ ] `RPT-007` — Rapport régions couvre les régions attendues et totaux concordants.
- [ ] `RPT-008` — Archives contiennent uniquement dossiers clos attendus.
## 37. Responsive, navigateurs et accessibilité

Tester au minimum 320 px, 390 px, 768 px et 1440 px sur les routes publiques et authentifiées.

- [ ] `UI-001` — Aucune page ne déborde horizontalement à chaque largeur.
- [ ] `UI-002` — Navbar, menu et modales restent accessibles.
- [ ] `UI-003` — Catalogue, filtres et suggestions restent utilisables au tactile.
- [ ] `UI-004` — Profil, proposition et calendrier restent lisibles.
- [ ] `UI-005` — Favoris reste utilisable à 320 px.
- [ ] `UI-006` — Messages : liste, conversation, composer et clavier mobile utilisables.
- [ ] `UI-007` — Rendez-vous et paiement restent lisibles sans bouton coupé.
- [ ] `UI-008` — Tracking garde carte et actions visibles ; panneau direction ne recouvre pas l'essentiel.
- [ ] `UI-009` — Agenda professionnel se réorganise sans compression inutilisable.
- [ ] `UI-010` — Historique patient/professionnel reste navigable sur mobile.
- [ ] `UI-011` — Admin testé sur desktop, puis comportement minimal tablette/mobile documenté.
- [ ] `UI-012` — Chrome/Edge/Firefox/Safari compatibles selon matrice supportée.
- [ ] `A11Y-001` — Navigation clavier sur liens, boutons, formulaires et modales.
- [ ] `A11Y-002` — Focus visible et piégé/restauré dans les modales.
- [ ] `A11Y-003` — Labels, noms accessibles et messages d'erreur reliés aux champs.
- [ ] `A11Y-004` — Contraste des textes, statuts et boutons suffisant.
- [ ] `A11Y-005` — Images utiles ont texte alternatif ; décoratives ignorées.
- [ ] `A11Y-006` — Zoom 200 % sans perte d'action/contenu.
- [ ] `A11Y-007` — Lecteur d'écran annonce chargements, erreurs et succès importants.

## 39. Parcours bout en bout obligatoires

- [ ] `E2E-001` — Client → service fixe → réservation → paiement Wave → prestataire se déplace → termine → avis.
- [ ] `E2E-002` — Client → prix négociable → contre-offre pro → acceptation → conversion → carte → prestation.
- [ ] `E2E-003` — Négociation avec devis matériel → validation lignes → finalisation → réservation.
- [ ] `E2E-004` — Client se déplace → partage GPS client → arrivée → démarrage pro → fin.
- [ ] `E2E-005` — Prestataire se déplace → partage GPS pro → suivi client → arrivée synchronisée → fin.
- [ ] `E2E-006` — Transport colis → enlèvement QR → dépôt QR → fin → escrow libéré.
- [ ] `E2E-007` — Patient → médecin → paiement → consultation → actes/ordonnance → avis.
- [ ] `E2E-008` — Réservation payée → litige → preuves → médiation admin → remboursement client.
- [ ] `E2E-009` — Réservation payée → litige → crédit professionnel.
- [ ] `E2E-010` — Création prestataire → KYC → approbation admin → publication service → première réservation.
- [ ] `E2E-011` — Création médecin → diplôme authentifié → motif → disponibilité → RDV patient.
- [ ] `E2E-012` — Message depuis profil → conversation temps réel → réservation liée sans duplication.
- [ ] `E2E-013` — Paiement échoué puis réussi → une réservation, un débit, un escrow.
- [ ] `E2E-014` — Annulation après paiement → traitement financier et notifications cohérents.
- [ ] `E2E-015` — Client absent → NO_SHOW → tracking fermé → traitement visible admin.