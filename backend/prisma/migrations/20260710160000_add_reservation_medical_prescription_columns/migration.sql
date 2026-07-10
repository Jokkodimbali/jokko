ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "medical_prescription_acts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "medical_prescription_vaccines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "medical_prescription_treatments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
