-- Reconcile simulated/web-confirmed payments with paid booking states.
-- Older web flows marked the booking as paid but left the payment row pending,
-- which hid escrow funds from professional wallets.
UPDATE "payments" AS payment
SET
  "statut" = 'SUCCES',
  "processed_at" = COALESCE(payment."processed_at", payment."updated_at", payment."created_at"),
  "updated_at" = NOW()
FROM "bookings" AS booking
WHERE payment."booking_id" = booking."id"
  AND payment."statut" = 'EN_ATTENTE'
  AND payment."escrowStatus" = 'LOCKED'
  AND booking."statut" IN ('PAYEE_SEQUESTRE', 'EN_COURS', 'TERMINEE', 'LITIGE');
