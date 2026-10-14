# Paiements et remboursements réels

## Wave

Configurer `PAYMENT_GATEWAY_MODE=external`, `WAVE_API_KEY` et une origine HTTPS pour le frontend. `WAVE_API_BASE_URL` vaut `https://api.wave.com` par défaut. Si Wave a activé la signature des requêtes pour le compte marchand, renseigner `WAVE_API_SIGNING_SECRET`.

La réservation crée une session Checkout Wave. Le retour du navigateur déclenche une vérification du checkout auprès de Wave avant de marquer la réservation payée. Le remboursement utilise `POST /v1/checkout/sessions/:id/refund` et ne marque la transaction remboursée qu'après une réponse HTTP 200. Wave rembourse le **montant total** de la session sur le moyen de paiement d'origine. La base de données Jokko n'est pas un portefeuille d'argent : elle conserve l'état, la référence et la notification, mais ne crédite pas elle-même un solde Wave.

Le parcours de retour du navigateur est actuellement nécessaire pour confirmer le paiement dans l'application. Il faut encore intégrer un webhook Wave natif signé avant de considérer les paiements sans retour navigateur comme totalement automatisés. Ne pas utiliser le webhook JSON générique de Jokko comme webhook Wave : les formats et signatures diffèrent.

## Orange Money

L'API marchande et ses opérations de remboursement dépendent du contrat et du pays. Une clé seule ne permet pas de déduire l'URL, le format et les règles de remboursement. Orange Money reste donc indisponible tant que `ORANGE_MONEY_GATEWAY_CONTRACT` ne vaut pas `compatible`. Cette valeur signifie qu'un **middleware marchand HTTPS** fournit les trois endpoints JSON de Jokko (`/payments/initiate`, `/payments/:reference/verify`, `/payments/refund`) avec accusé de remboursement réel, contrôle du montant et idempotence. Elle ne signifie pas que l'API Orange directe accepte ce contrat. Il faut le document contractuel du marchand pour implémenter l'adaptateur Orange direct et ses tests.

## Vérification avant mise en service

Utiliser une transaction autorisée avec le compte marchand de test, puis contrôler le débit, le remboursement chez le fournisseur, la référence et la notification dans Jokko. Les tests unitaires et les builds ne déplacent aucun fonds et ne démontrent pas un crédit réel. Ne pas mettre les clés dans le dépôt ni dans une conversation.

Références : [Wave Checkout](https://docs.wave.com/checkout) ; [Orange Money Web Payment](https://developer.orange.com/apis/om-webpay).
