ALTER TABLE "negotiations"
  ADD COLUMN "proposed_datetime" TIMESTAMP(3),
  ADD COLUMN "proposed_client_address" VARCHAR(180),
  ADD COLUMN "proposed_duration_minutes" INTEGER;
