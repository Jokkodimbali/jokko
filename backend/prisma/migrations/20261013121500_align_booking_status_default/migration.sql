-- Keep direct database inserts consistent with the Prisma default and the
-- reservation statuses understood by the API and Angular.
ALTER TABLE "bookings"
  ALTER COLUMN "statut" SET DEFAULT 'CONFIRMEE';
