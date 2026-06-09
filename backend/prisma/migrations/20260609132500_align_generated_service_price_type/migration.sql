UPDATE services s
SET price_type = CASE
  WHEN u.role = 'MEDECIN' THEN 'FIXE'::"TypePrix"
  ELSE 'NEGOCIABLE'::"TypePrix"
END
FROM professional_profiles pp
INNER JOIN users u ON u.id = pp.user_id
WHERE s.professional_id = pp.id
  AND s.price = 0
  AND s.duration_minutes = 30
  AND s.is_required = false
  AND s.description LIKE 'Service %.%';
