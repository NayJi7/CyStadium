-- ─────────────────────────────────────────────────────────────────────────────
-- V3 : flag is_admin sur clients (gating de l'onglet Admin côté frontend).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
