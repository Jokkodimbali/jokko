-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('OPEN', 'SELECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenderResponseStatus" AS ENUM ('INVITED', 'IGNORED', 'OFFERED', 'REJECTED', 'SELECTED', 'NOT_SELECTED');

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "subCategoryId" UUID,
    "description" VARCHAR(2000) NOT NULL,
    "address" VARCHAR(180) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 25,
    "proposedPrice" DECIMAL(10,2) NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "TenderStatus" NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_responses" (
    "id" UUID NOT NULL,
    "tenderId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "serviceId" UUID,
    "negotiationId" UUID,
    "eligibleServiceIds" UUID[],
    "distanceKm" DOUBLE PRECISION,
    "amount" DECIMAL(10,2),
    "message" VARCHAR(1000),
    "status" "TenderResponseStatus" NOT NULL DEFAULT 'INVITED',
    "offeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenders_clientId_createdAt_idx" ON "tenders"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tender_responses_negotiationId_key" ON "tender_responses"("negotiationId");

-- CreateIndex
CREATE INDEX "tender_responses_professionalId_status_updatedAt_idx" ON "tender_responses"("professionalId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tender_responses_tenderId_professionalId_key" ON "tender_responses"("tenderId", "professionalId");

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "service_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_responses" ADD CONSTRAINT "tender_responses_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_responses" ADD CONSTRAINT "tender_responses_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_responses" ADD CONSTRAINT "tender_responses_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_responses" ADD CONSTRAINT "tender_responses_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negotiations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

