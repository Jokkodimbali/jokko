ALTER TABLE "professional_profiles" ADD COLUMN "is_pharmacy" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "professional_profiles_is_pharmacy_kyc_status_idx" ON "professional_profiles"("is_pharmacy", "kyc_status");
CREATE INDEX "professional_profiles_location_gist_idx"
ON "professional_profiles" USING GIST ("localisation")
WHERE "localisation" IS NOT NULL;
