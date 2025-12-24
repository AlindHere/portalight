-- Migration: Add access_type to secrets table
-- Allows distinguishing between read-only and write credentials

ALTER TABLE secrets ADD COLUMN IF NOT EXISTS access_type VARCHAR(10) DEFAULT 'write';
