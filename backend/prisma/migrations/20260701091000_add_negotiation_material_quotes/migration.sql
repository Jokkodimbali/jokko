-- CreateEnum
CREATE TYPE "StatutDevisMateriel" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REFUSE');

-- CreateTable
CREATE TABLE "negotiation_material_quotes" (
    "id" UUID NOT NULL,
    "negotiation_id" UUID NOT NULL,
    "booking_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_by" "RoleNegociateur" NOT NULL,
    "designation" VARCHAR(180) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "statut" "StatutDevisMateriel" NOT NULL DEFAULT 'EN_ATTENTE',
    "client_validated_at" TIMESTAMP(3),
    "professional_validated_at" TIMESTAMP(3),
    "rejected_by" "RoleNegociateur",
    "pdf_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_material_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "negotiation_material_quotes_negotiation_id_statut_idx" ON "negotiation_material_quotes"("negotiation_id", "statut");

-- CreateIndex
CREATE INDEX "negotiation_material_quotes_booking_id_idx" ON "negotiation_material_quotes"("booking_id");

-- CreateIndex
CREATE INDEX "negotiation_material_quotes_created_by_user_id_created_at_idx" ON "negotiation_material_quotes"("created_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "negotiation_material_quotes" ADD CONSTRAINT "negotiation_material_quotes_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_material_quotes" ADD CONSTRAINT "negotiation_material_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_material_quotes" ADD CONSTRAINT "negotiation_material_quotes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
