DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'TypeVehiculeProfessionnel'
  ) THEN
    CREATE TYPE "TypeVehiculeProfessionnel" AS ENUM (
      'MOTO_SCOOTER',
      'VOITURE',
      'CAMIONNETTE'
    );
  END IF;
END $$;

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "vehicle_type" "TypeVehiculeProfessionnel" NOT NULL DEFAULT 'VOITURE';
