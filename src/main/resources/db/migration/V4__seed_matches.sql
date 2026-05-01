-- V4 : données initiales Coupe du Monde 2026
-- 5 matchs, 4 zones/match, 5 rangs x 4 sièges = 20 sièges/zone = 400 sièges au total

INSERT INTO matches (id, home_team, away_team, match_date, stadium, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'France',    'Brésil',     '2026-06-14 20:00:00', 'MetLife Stadium',   'open'),
  ('a1000000-0000-0000-0000-000000000002', 'Espagne',   'Allemagne',  '2026-06-18 20:00:00', 'AT&T Stadium',      'open'),
  ('a1000000-0000-0000-0000-000000000003', 'Argentine', 'Portugal',   '2026-06-22 20:00:00', 'SoFi Stadium',      'open'),
  ('a1000000-0000-0000-0000-000000000004', 'Maroc',     'Angleterre', '2026-06-26 17:00:00', 'Levi''s Stadium',   'open'),
  ('a1000000-0000-0000-0000-000000000005', 'Pays-Bas',  'Italie',     '2026-06-30 20:00:00', 'Hard Rock Stadium', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO zones (id, match_id, name, price, capacity)
SELECT
  gen_random_uuid(),
  m.id,
  z.name,
  z.price,
  z.capacity
FROM matches m
CROSS JOIN (VALUES
  ('VIP',       500.00, 100),
  ('Or',        250.00, 200),
  ('Standard',  100.00, 400),
  ('Populaire',  50.00, 800)
) AS z(name, price, capacity)
WHERE m.id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005'
)
ON CONFLICT DO NOTHING;

INSERT INTO seats (id, zone_id, label, row, number, status)
SELECT
  gen_random_uuid(),
  z.id,
  z.name || '-' || rows.r || '-' || lpad(nums.n::text, 3, '0'),
  rows.r,
  nums.n,
  'free'
FROM zones z
CROSS JOIN (VALUES ('A'),('B'),('C'),('D'),('E')) AS rows(r)
CROSS JOIN (VALUES (1),(2),(3),(4)) AS nums(n)
WHERE z.match_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005'
)
ON CONFLICT DO NOTHING;
