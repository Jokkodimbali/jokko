-- Keep one WhatsApp-style thread per client/professional pair.
-- Existing duplicate conversations are folded into a canonical conversation
-- before adding the database-level uniqueness guard.

WITH ranked_conversations AS (
  SELECT
    id,
    client_id,
    professional_id,
    booking_id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, professional_id
      ORDER BY COALESCE(last_message_at, created_at) DESC, created_at ASC, id ASC
    ) AS row_number
  FROM conversations
),
conversation_merge AS (
  SELECT
    duplicate.id AS duplicate_id,
    canonical.id AS canonical_id
  FROM ranked_conversations duplicate
  JOIN ranked_conversations canonical
    ON canonical.client_id = duplicate.client_id
   AND canonical.professional_id = duplicate.professional_id
   AND canonical.row_number = 1
  WHERE duplicate.row_number > 1
),
canonical_booking AS (
  SELECT DISTINCT ON (canonical.id)
    canonical.id AS canonical_id,
    duplicate.booking_id
  FROM ranked_conversations canonical
  JOIN ranked_conversations duplicate
    ON duplicate.client_id = canonical.client_id
   AND duplicate.professional_id = canonical.professional_id
   AND duplicate.booking_id IS NOT NULL
  WHERE canonical.row_number = 1
  ORDER BY canonical.id, duplicate.row_number ASC
),
updated_messages AS (
  UPDATE messages message
  SET conversation_id = conversation_merge.canonical_id
  FROM conversation_merge
  WHERE message.conversation_id = conversation_merge.duplicate_id
  RETURNING message.id
),
updated_notifications AS (
  UPDATE notifications notification
  SET data = jsonb_set(
    notification.data::jsonb,
    '{conversationId}',
    to_jsonb(conversation_merge.canonical_id::text),
    false
  )
  FROM conversation_merge
  WHERE notification.data IS NOT NULL
    AND notification.data::jsonb ->> 'conversationId' = conversation_merge.duplicate_id::text
  RETURNING notification.id
),
deleted_duplicates AS (
  DELETE FROM conversations conversation
  USING conversation_merge
  WHERE conversation.id = conversation_merge.duplicate_id
  RETURNING conversation.id
)
UPDATE conversations canonical
SET
  booking_id = COALESCE(canonical.booking_id, canonical_booking.booking_id),
  last_message_at = latest_message.last_message_at
FROM canonical_booking
LEFT JOIN LATERAL (
  SELECT MAX(created_at) AS last_message_at
  FROM messages
  WHERE conversation_id = canonical_booking.canonical_id
) latest_message ON true
WHERE canonical.id = canonical_booking.canonical_id;

UPDATE conversations conversation
SET last_message_at = latest_message.last_message_at
FROM (
  SELECT conversation_id, MAX(created_at) AS last_message_at
  FROM messages
  GROUP BY conversation_id
) latest_message
WHERE conversation.id = latest_message.conversation_id;

CREATE UNIQUE INDEX conversations_client_professional_unique
ON conversations (client_id, professional_id);
