INSERT INTO services (
  id,
  professional_id,
  category_id,
  name,
  description,
  price,
  price_type,
  duration_minutes,
  is_required,
  is_available,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  ps.professional_id,
  ps.category_id,
  c.name,
  CASE
    WHEN COUNT(sc.id) FILTER (WHERE sc.id IS NOT NULL) > 0
      THEN 'Service ' || c.name || '. Specialites: ' || string_agg(DISTINCT sc.name, ', ') || '.'
    ELSE 'Service ' || c.name || '.'
  END,
  0,
  'FIXE',
  30,
  false,
  true,
  NOW(),
  NOW()
FROM professional_specialties ps
INNER JOIN categories c ON c.id = ps.category_id
LEFT JOIN service_subcategories sc ON sc.id = ps.subcategory_id
WHERE NOT EXISTS (
  SELECT 1
  FROM services s
  WHERE s.professional_id = ps.professional_id
    AND s.category_id = ps.category_id
    AND s.is_available = true
)
GROUP BY ps.professional_id, ps.category_id, c.name;
