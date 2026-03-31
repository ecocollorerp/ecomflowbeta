-- Migração: adicionar suporte a foto de usuário (avatar)
-- Data: 2026-03-31

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_base64 TEXT;
