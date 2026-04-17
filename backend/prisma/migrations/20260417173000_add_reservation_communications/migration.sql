-- CreateEnum
CREATE TYPE "CanalCommunication" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "StatutCommunication" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC', 'CONFIGURATION_MANQUANTE');

-- CreateTable
CREATE TABLE "reservation_communications" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "CanalCommunication" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT NOT NULL,
    "provider" VARCHAR(100),
    "provider_message_id" VARCHAR(255),
    "status" "StatutCommunication" NOT NULL DEFAULT 'EN_ATTENTE',
    "error" TEXT,
    "metadata" JSONB,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_communications_booking_id_channel_idx" ON "reservation_communications"("booking_id", "channel");

-- CreateIndex
CREATE INDEX "reservation_communications_user_id_created_at_idx" ON "reservation_communications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "reservation_communications_status_created_at_idx" ON "reservation_communications"("status", "created_at");

-- AddForeignKey
ALTER TABLE "reservation_communications"
ADD CONSTRAINT "reservation_communications_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_communications"
ADD CONSTRAINT "reservation_communications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
