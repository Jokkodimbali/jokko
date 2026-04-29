-- Nettoyer les anciennes conversations non rattachees a une reservation.
DELETE FROM messages
WHERE conversation_id IN (
  SELECT id
  FROM conversations
  WHERE booking_id IS NULL
);

DELETE FROM conversations
WHERE booking_id IS NULL;

-- Dedoublonner par reservation si des donnees historiques existent deja.
WITH ranked_conversations AS (
  SELECT
    id,
    booking_id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM conversations
  WHERE booking_id IS NOT NULL
)
DELETE FROM messages
WHERE conversation_id IN (
  SELECT id
  FROM ranked_conversations
  WHERE row_number > 1
);

WITH ranked_conversations AS (
  SELECT
    id,
    booking_id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM conversations
  WHERE booking_id IS NOT NULL
)
DELETE FROM conversations
WHERE id IN (
  SELECT id
  FROM ranked_conversations
  WHERE row_number > 1
);

DROP INDEX IF EXISTS conversations_client_id_professional_id_key;
ALTER TABLE conversations
  ALTER COLUMN booking_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_booking_id_key
  ON conversations (booking_id);
CREATE INDEX IF NOT EXISTS conversations_client_id_professional_id_idx
  ON conversations (client_id, professional_id);
