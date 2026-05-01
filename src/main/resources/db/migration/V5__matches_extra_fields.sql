-- V5 : champs supplémentaires sur matches (ville, phase, mise en avant)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS city      VARCHAR(100);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage     VARCHAR(50);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS highlight BOOLEAN NOT NULL DEFAULT false;
