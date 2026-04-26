-- ─────────────────────────────────────────────────────────────────────────────
-- V2 : ajout colonnes auth (pseudo + hash bcrypt) à clients.
-- Aligne le schéma DB sur Tables.scala / SessionManager.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS username      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clients_username_uidx ON clients(username);
