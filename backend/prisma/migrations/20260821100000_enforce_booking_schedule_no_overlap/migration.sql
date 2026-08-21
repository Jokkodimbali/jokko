-- The application already serializes bookings per professional. This trigger
-- makes the same invariant durable for every database writer as well.
-- Existing records are deliberately left untouched; only new/changed slots are
-- rejected when they overlap an active booking for the same professional.
CREATE OR REPLACE FUNCTION "prevent_booking_schedule_overlap"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."statut" IN ('ANNULEE', 'TERMINEE', 'NO_SHOW') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW."professional_id"::text), 0);

  IF EXISTS (
    SELECT 1
    FROM "bookings" AS existing_booking
    WHERE existing_booking."professional_id" = NEW."professional_id"
      AND existing_booking."id" <> NEW."id"
      AND existing_booking."statut" NOT IN ('ANNULEE', 'TERMINEE', 'NO_SHOW')
      AND existing_booking."date_time" <
        NEW."date_time" + (NEW."duration_minutes" * INTERVAL '1 minute')
      AND NEW."date_time" <
        existing_booking."date_time" +
          (existing_booking."duration_minutes" * INTERVAL '1 minute')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      CONSTRAINT = 'bookings_professional_schedule_no_overlap',
      MESSAGE = 'A professional cannot have overlapping active bookings.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "bookings_prevent_schedule_overlap" ON "bookings";

CREATE TRIGGER "bookings_prevent_schedule_overlap"
BEFORE INSERT OR UPDATE OF "professional_id", "date_time", "duration_minutes", "statut"
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "prevent_booking_schedule_overlap"();
