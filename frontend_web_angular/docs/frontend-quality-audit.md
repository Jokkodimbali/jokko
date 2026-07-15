# Frontend Quality Audit

Ce document sert de garde-fou pour garder le frontend maintenable, evolutif et securise.

## Garde-fous automatises

- `npm run quality` analyse les fichiers sous `src/app`.
- `npm run lint` pointe vers le meme controle qualite.
- `npm run verify` execute maintenant `quality` avant `build`, tests unitaires et e2e.

Le controle signale:

- fichiers trop volumineux;
- usage de patterns sensibles (`innerHTML`, `bypassSecurityTrust`, stockage navigateur, `console`, `eval`, etc.);
- patterns sensibles non explicitement autorises.

## Dette legacy a reduire

Les fichiers suivants sont prioritaires car ils concentrent trop de responsabilites:

- `appointment-detail-page.component.ts`
- `doctor-space-page.component.ts`
- `service-proposal.component.ts`
- `messages-page.component.ts`
- `settings-page.component.ts`
- grands fichiers SCSS des pages `appointment-detail`, `doctor-space`, `service-proposal`, `settings`

## Decoupages deja effectues

- `appointment-detail-page.component.ts`: extraction du rendu PDF/HTML vers `appointment-document-renderer.service.ts`.
- `appointment-detail-page.component.ts`: extraction des templates facture, recu medical et ordonnance vers `appointment-document-builder.service.ts`.
- `appointment-detail-page.component.ts`: extraction du formatage dates, monnaie, calendrier et messages GPS vers `appointment-detail-format.service.ts`.
- `appointment-detail-page.component.ts`: extraction du parsing et nettoyage des ordonnances medicales vers `appointment-medical-prescription.service.ts`.
- `appointment-detail-page.component.ts`: extraction des helpers geographiques purs vers `appointment-geo.service.ts`.
- `appointment-detail-page.component.ts`: extraction des helpers de navigation et de synthese vocale vers `appointment-navigation.service.ts`.
- `appointment-detail-page.component.ts`: extraction du mapping des routes carte/tracking vers `appointment-route.service.ts`.
- `service-proposal.component.ts`: extraction du formatage montants, dates, ISO et troncature vers `service-proposal-format.service.ts`.
- `service-proposal.component.ts`: extraction du mapping et des labels de devis materiel vers `service-proposal-material-quote.service.ts`.
- `service-proposal.component.ts`: extraction des helpers colis, notes livraison, coordonnees et distance vers `service-proposal-parcel.service.ts`.
- `service-proposal.component.ts`: extraction des builders messages, notes et payloads de reservation vers `service-proposal-reservation-builder.service.ts`.
- `service-proposal.component.ts`: extraction des labels et regles pures de negociation/duree vers `service-proposal-state.service.ts`.
- `service-proposal.component.ts`: extraction des options paiement et labels UI vers `service-proposal-ui.service.ts`.
- `service-proposal.component.ts`: extraction des labels de prix, comparaisons et statuts de negociation vers `service-proposal-pricing-view.service.ts`.
- `service-proposal.component.html`: extraction de la carte de reservation/prestation acceptee vers `service-proposal-accepted-summary.component.*`.
- `service-proposal.component.scss`: extraction des styles colis, adresses et suggestions vers `service-proposal-parcel.component.scss`.
- `doctor-space-page.component.scss`: extraction des styles d'historique rendez-vous prestataire vers `styles/_doctor-space-provider-history.scss`.
- `styles/_doctor-space-agenda.scss`: extraction des styles "prochain client" vers `styles/_doctor-space-next-client.scss`.
  Le composant ne porte plus la manipulation DOM, `html2canvas` et `jsPDF`.

## Strategie de refactor

1. Extraire la logique metier en services/facades de domaine.
2. Extraire les view models en fonctions pures testables.
3. Decouper les gros templates en composants presentational.
4. Garder les composants page comme orchestrateurs minces.
5. Remplacer les duplications de navigation, validation et formatage par des utilitaires partages.
6. Refactorer par lots verifies avec `npm run quality` puis `npm run build`.

## Regles de conception

- KISS: une fonction fait une chose.
- DRY: pas de validation ou formatage copie entre pages.
- SOLID: les pages orchestrent, les services portent les cas d'usage, les composants affichent.
- DDD: chaque feature garde ses modeles, facades et regles dans son domaine.
- Event-driven: les flux temps reel et actions utilisateur restent explicites, typés et testables.
