DO $$ BEGIN
  CREATE TYPE "TypeConsultationMedicale" AS ENUM ('CONSULTATION', 'TELECONSULTATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "consultation_type" "TypeConsultationMedicale" NOT NULL DEFAULT 'CONSULTATION';
