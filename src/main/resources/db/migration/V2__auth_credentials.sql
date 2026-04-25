-- ─────────────────────────────────────────────────────────────────────────────
-- CyStadium — Migration V2 : credentials utilisateurs
-- Ajoute pseudo unique + password hash sur la table clients.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS username      VARCHAR(40);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash VARCHAR(120);

UPDATE clients SET username = 'user_' || substr(id::text, 1, 8) WHERE username IS NULL;

ALTER TABLE clients ALTER COLUMN username SET NOT NULL;
ALTER TABLE clients ADD CONSTRAINT clients_username_unique UNIQUE (username);

CREATE INDEX IF NOT EXISTS idx_clients_username ON clients(username);
