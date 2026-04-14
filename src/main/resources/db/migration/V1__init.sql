-- ─────────────────────────────────────────────────────────────────────────────
-- CyStadium — Migration V1 : schéma initial
-- Appliqué sur Supabase (projet : upbrwrywaipbzdvrujhb, région : eu-west-3)
-- Ne pas modifier sans PR + validation des 3 équipes (label : breaking-contract)
-- ─────────────────────────────────────────────────────────────────────────────

-- Matchs
CREATE TABLE IF NOT EXISTS matches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team  VARCHAR(100) NOT NULL,
  away_team  VARCHAR(100) NOT NULL,
  match_date TIMESTAMP NOT NULL,
  stadium    VARCHAR(100) NOT NULL,
  status     VARCHAR(20) DEFAULT 'open'
             CHECK (status IN ('open','closed','cancelled'))
);

-- Zones (tarification par match)
CREATE TABLE IF NOT EXISTS zones (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  name     VARCHAR(20) NOT NULL CHECK (name IN ('VIP','Or','Standard','Populaire')),
  price    DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  capacity INT NOT NULL CHECK (capacity > 0)
);

-- Sièges individuels
CREATE TABLE IF NOT EXISTS seats (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  label   VARCHAR(10) NOT NULL,
  row     CHAR(1) NOT NULL,
  number  INT NOT NULL CHECK (number > 0),
  status  VARCHAR(20) DEFAULT 'free'
          CHECK (status IN ('free','reserved','confirmed','locked')),
  UNIQUE(zone_id, row, number)
);
CREATE INDEX IF NOT EXISTS idx_seats_zone_status ON seats(zone_id, status);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name  VARCHAR(100) NOT NULL
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);

-- Réservations
CREATE TABLE IF NOT EXISTS reservations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  match_id   UUID REFERENCES matches(id) ON DELETE RESTRICT,
  status     VARCHAR(20) DEFAULT 'pending'
             CHECK (status IN ('pending','paid','confirmed','cancelled')),
  total      DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reservations_client ON reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_reservations_match  ON reservations(match_id);

-- Sièges d'une réservation
CREATE TABLE IF NOT EXISTS reservation_seats (
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  seat_id        UUID REFERENCES seats(id) ON DELETE RESTRICT,
  PRIMARY KEY (reservation_id, seat_id)
);

-- Paiements
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  amount         DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status         VARCHAR(20) DEFAULT 'pending'
                 CHECK (status IN ('pending','success','failed','timeout')),
  created_at     TIMESTAMP DEFAULT NOW(),
  completed_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
