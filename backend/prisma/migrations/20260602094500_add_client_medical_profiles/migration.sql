CREATE TABLE "client_medical_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "blood_group" VARCHAR(8),
    "rhesus" VARCHAR(20),
    "weight_kg" DECIMAL(5,2),
    "height_cm" SMALLINT,
    "reference_doctor_name" VARCHAR(120),
    "profession" VARCHAR(120),
    "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "medical_conditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_medical_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_medical_treatments" (
    "id" UUID NOT NULL,
    "medical_profile_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "dosage" VARCHAR(120),
    "frequency" VARCHAR(120),
    "started_at" DATE,
    "ended_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_medical_treatments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_medical_profiles_user_id_key" ON "client_medical_profiles"("user_id");
CREATE INDEX "client_medical_treatments_medical_profile_id_created_at_idx" ON "client_medical_treatments"("medical_profile_id", "created_at");

ALTER TABLE "client_medical_profiles"
    ADD CONSTRAINT "client_medical_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_medical_treatments"
    ADD CONSTRAINT "client_medical_treatments_medical_profile_id_fkey"
    FOREIGN KEY ("medical_profile_id") REFERENCES "client_medical_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
