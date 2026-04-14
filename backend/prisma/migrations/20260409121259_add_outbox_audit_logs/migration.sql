-- CreateEnum
CREATE TYPE "StatutEvenement" AS ENUM ('EN_ATTENTE', 'TRAITE', 'ECHEC');

-- CreateEnum
CREATE TYPE "TypeActionAudit" AS ENUM ('CONNEXION', 'DECONNEXION', 'CREATION', 'MODIFICATION', 'SUPPRESSION', 'PAIEMENT', 'KYC_SOUMISSION', 'KYC_APPROBATION', 'KYC_REJET', 'RESERVATION_CREATION', 'RESERVATION_CONFIRMATION', 'RESERVATION_ANNULATION', 'LITIGE_OUVERTURE', 'LITIGE_RESOLUTION', 'RETRAIT');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "status" "StatutEvenement" NOT NULL DEFAULT 'EN_ATTENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action_type" "TypeActionAudit" NOT NULL,
    "description" TEXT NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_created_at_idx" ON "audit_logs"("action_type", "created_at");
