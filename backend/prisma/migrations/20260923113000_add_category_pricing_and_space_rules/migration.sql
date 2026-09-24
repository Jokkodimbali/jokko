CREATE TYPE "TypeEspaceProfessionnel" AS ENUM ('PRESTATAIRE', 'MEDECIN', 'QUINCAILLERIE', 'PHARMACIE');

ALTER TABLE "categories"
ADD COLUMN "price_type" "TypePrix" NOT NULL DEFAULT 'NEGOCIABLE',
ADD COLUMN "professional_space_type" "TypeEspaceProfessionnel" NOT NULL DEFAULT 'PRESTATAIRE';

ALTER TABLE "service_subcategories"
ADD COLUMN "professional_space_type" "TypeEspaceProfessionnel";

UPDATE "categories"
SET "professional_space_type" = 'MEDECIN'
WHERE lower("name") SIMILAR TO '%(medec|médec|sante|santé|consultation)%';

UPDATE "service_subcategories"
SET "professional_space_type" = 'PHARMACIE'
WHERE lower("name") LIKE '%pharmaci%';

UPDATE "service_subcategories"
SET "professional_space_type" = 'QUINCAILLERIE'
WHERE lower("name") LIKE '%quincailler%';
