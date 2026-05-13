-- Accepted negotiations are closed from a negotiation-editing perspective.
-- Only pending negotiations must block a new proposal for the same client/service.
DROP INDEX IF EXISTS "negotiations_active_client_service_unique_idx";

CREATE UNIQUE INDEX "negotiations_active_client_service_unique_idx"
ON "negotiations"("client_id", "service_id")
WHERE "statut" IN ('EN_ATTENTE_PRESTATAIRE', 'EN_ATTENTE_CLIENT');
