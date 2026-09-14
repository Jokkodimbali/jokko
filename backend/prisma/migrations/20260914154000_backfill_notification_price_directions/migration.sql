-- Preserve the direction of historical price adjustments for a consistent UI.
WITH price_adjustments AS (
  SELECT
    id,
    NULLIF(
      REPLACE(
        REGEXP_REPLACE(
          COALESCE(
            data->>'currentPrice',
            data->>'currentAmount',
            data->>'oldPrice',
            data->>'oldAmount',
            data->>'previousPrice',
            data->>'previousAmount',
            data->>'initialPrice',
            data->>'initialAmount',
            data->>'referencePrice',
            data->>'referenceAmount',
            data->>'prixActuel',
            data->>'montantActuel',
            data->>'montantCourant',
            data->>'prixConvenu',
            data->>'prixInitial',
            ''
          ),
          '[^0-9,.-]',
          '',
          'g'
        ),
        ',',
        '.'
      ),
      ''
    )::numeric AS current_amount,
    NULLIF(
      REPLACE(
        REGEXP_REPLACE(
          COALESCE(
            data->>'proposedPrice',
            data->>'proposedAmount',
            data->>'newPrice',
            data->>'newAmount',
            data->>'nouveauPrix',
            data->>'nouveauMontant',
            data->>'montantPropose',
            data->>'prixAjustementPropose',
            ''
          ),
          '[^0-9,.-]',
          '',
          'g'
        ),
        ',',
        '.'
      ),
      ''
    )::numeric AS proposed_amount
  FROM notifications
  WHERE type = 'AJUSTEMENT_PRIX_PROPOSE'
)
UPDATE notifications AS notification
SET data = COALESCE(notification.data, '{}'::jsonb) || JSONB_BUILD_OBJECT(
  'priceDirection',
  CASE
    WHEN adjustment.proposed_amount > adjustment.current_amount THEN 'UP'
    WHEN adjustment.proposed_amount < adjustment.current_amount THEN 'DOWN'
    ELSE COALESCE(notification.data->>'priceDirection', 'UP')
  END
)
FROM price_adjustments AS adjustment
WHERE notification.id = adjustment.id
  AND adjustment.current_amount IS NOT NULL
  AND adjustment.proposed_amount IS NOT NULL;
