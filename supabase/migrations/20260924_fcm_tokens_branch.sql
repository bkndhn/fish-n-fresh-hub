-- Add branch_id to fcm_tokens for branch-scoped notifications
ALTER TABLE public.fcm_tokens ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fcm_tokens_role_idx ON public.fcm_tokens(role);
CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS fcm_tokens_branch_id_idx ON public.fcm_tokens(branch_id);
