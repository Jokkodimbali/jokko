WITH ranked_assignments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY subcategory_id
      ORDER BY created_at ASC, id ASC
    ) AS assignment_rank
  FROM category_service_subcategories
)
DELETE FROM category_service_subcategories
WHERE id IN (
  SELECT id
  FROM ranked_assignments
  WHERE assignment_rank > 1
);

CREATE UNIQUE INDEX "category_service_subcategories_subcategory_id_key"
ON "category_service_subcategories"("subcategory_id");
