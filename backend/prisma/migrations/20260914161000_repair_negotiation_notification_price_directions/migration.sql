-- Recover the direction of negotiation price notifications from the immutable
-- offer history. This also overwrites an incorrect legacy priceDirection.
WITH notification_prices AS (
  SELECT
    notification.id,
    (notification.data->>'negotiationId')::uuid AS negotiation_id,
    NULLIF(
      REPLACE(
        REGEXP_REPLACE(notification.data->>'proposedAmount', '[^0-9,.-]', '', 'g'),
        ',',
        '.'
      ),
      ''
    )::numeric AS proposed_amount,
    notification.created_at
  FROM notifications AS notification
  WHERE notification.type = 'AJUSTEMENT_PRIX_PROPOSE'
    AND notification.data->>'negotiationId' IS NOT NULL
    AND notification.data->>'proposedAmount' IS NOT NULL
),
matched_offers AS (
  SELECT
    notification_price.id AS notification_id,
    notification_price.proposed_amount,
    matched_offer.id AS offer_id,
    matched_offer.created_at AS offer_created_at,
    negotiation.service_id
  FROM notification_prices AS notification_price
  JOIN negotiations AS negotiation
    ON negotiation.id = notification_price.negotiation_id
  JOIN LATERAL (
    SELECT offer.id, offer.created_at
    FROM negotiation_offers AS offer
    WHERE offer.negotiation_id = notification_price.negotiation_id
      AND offer.montant = notification_price.proposed_amount
    ORDER BY ABS(EXTRACT(EPOCH FROM (notification_price.created_at - offer.created_at))), offer.created_at DESC
    LIMIT 1
  ) AS matched_offer ON true
),
directions AS (
  SELECT
    matched_offer.notification_id,
    matched_offer.proposed_amount,
    COALESCE(previous_offer.montant, service.price) AS previous_amount
  FROM matched_offers AS matched_offer
  JOIN services AS service ON service.id = matched_offer.service_id
  LEFT JOIN LATERAL (
    SELECT offer.montant
    FROM negotiation_offers AS offer
    WHERE offer.negotiation_id = (
      SELECT notification_price.negotiation_id
      FROM notification_prices AS notification_price
      WHERE notification_price.id = matched_offer.notification_id
    )
      AND (offer.created_at, offer.id) < (matched_offer.offer_created_at, matched_offer.offer_id)
    ORDER BY offer.created_at DESC, offer.id DESC
    LIMIT 1
  ) AS previous_offer ON true
)
UPDATE notifications AS notification
SET data = COALESCE(notification.data, '{}'::jsonb) || JSONB_BUILD_OBJECT(
  'previousAmount', direction.previous_amount,
  'priceDirection',
  CASE
    WHEN direction.proposed_amount < direction.previous_amount THEN 'DOWN'
    ELSE 'UP'
  END
)
FROM directions AS direction
WHERE notification.id = direction.notification_id
  AND direction.previous_amount IS NOT NULL
  AND direction.proposed_amount <> direction.previous_amount;
