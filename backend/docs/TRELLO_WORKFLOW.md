# Trello Workflow Backend

## Colonnes
- `To Do`: taches pretes a etre prises (spec claire, dependances connues).
- `Doing`: taches en cours de dev.
- `Done`: taches terminees et validees.

## Regle de passage
- `To Do -> Doing` seulement si:
  - endpoint et contraintes claires
  - dependances debloquees
- `Doing -> Done` seulement si:
  - code merge
  - tests unitaires et integration passent
  - monitoring/logs en place
  - documentation endpoint mise a jour

## WIP recommande
- Maximum 3 cartes en `Doing` en meme temps par developpeur.

## Priorisation
- Toujours traiter d'abord les cartes label `P0 Critique`.
- Eviter de commencer chat/tracking avant `bookings + payments + wallet`.

## Definition of Done rapide
- Endpoint implemente
- Validation DTO et auth/roles
- Tests green
- Erreurs gerees
- Observabilite minimale (logs + metric)
