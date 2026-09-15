-- Older support messages were stored without `messages.dispute_id`.
-- A support message sent by the administrator shares its identifier with the
-- corresponding row in `dispute_messages`. Apply that dispute to the support
-- message and to subsequent replies in the same private conversation, until a
-- newer support message establishes another dispute context.
UPDATE "messages" AS reply
SET "dispute_id" = (
  SELECT dispute_message."dispute_id"
  FROM "messages" AS support_message
  INNER JOIN "dispute_messages" AS dispute_message
    ON dispute_message."id" = support_message."id"
  WHERE support_message."conversation_id" = reply."conversation_id"
    AND support_message."created_at" <= reply."created_at"
  ORDER BY support_message."created_at" DESC, support_message."id" DESC
  LIMIT 1
)
WHERE reply."dispute_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "messages" AS support_message
    INNER JOIN "dispute_messages" AS dispute_message
      ON dispute_message."id" = support_message."id"
    WHERE support_message."conversation_id" = reply."conversation_id"
      AND support_message."created_at" <= reply."created_at"
  );
