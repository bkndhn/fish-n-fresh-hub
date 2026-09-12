-- ==============================================================================
-- Migration: 20260912164000_referral_program_toggle.sql
-- Description: Adds referral_program_enabled column to store_settings table.
--              Allows client admins to toggle Refer & Earn program on or off.
-- ==============================================================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS referral_program_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.store_settings.referral_program_enabled IS 'When false, referral rewards, invite codes, and UI sharing cards are completely hidden from customer view.';
