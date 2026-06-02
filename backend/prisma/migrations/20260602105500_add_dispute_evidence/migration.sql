CREATE TABLE "dispute_evidence" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "uploader_user_id" UUID NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_evidence_dispute_id_created_at_idx" ON "dispute_evidence"("dispute_id", "created_at");
CREATE INDEX "dispute_evidence_uploader_user_id_created_at_idx" ON "dispute_evidence"("uploader_user_id", "created_at");

ALTER TABLE "dispute_evidence"
ADD CONSTRAINT "dispute_evidence_dispute_id_fkey"
FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_evidence"
ADD CONSTRAINT "dispute_evidence_uploader_user_id_fkey"
FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
