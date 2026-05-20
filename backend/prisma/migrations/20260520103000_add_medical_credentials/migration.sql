CREATE TYPE "StatutDiplomeMedical" AS ENUM ('EN_ATTENTE', 'AUTHENTIFIE', 'REJETE');

CREATE TABLE "medical_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "institution" VARCHAR(180) NOT NULL,
  "graduation_year" VARCHAR(20),
  "reference_number" VARCHAR(80),
  "document_url" VARCHAR(500),
  "status" "StatutDiplomeMedical" NOT NULL DEFAULT 'EN_ATTENTE',
  "verification_note" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "medical_credentials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_credentials_professional_id_status_idx" ON "medical_credentials"("professional_id", "status");
CREATE INDEX "medical_credentials_status_created_at_idx" ON "medical_credentials"("status", "created_at");

ALTER TABLE "medical_credentials"
  ADD CONSTRAINT "medical_credentials_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
