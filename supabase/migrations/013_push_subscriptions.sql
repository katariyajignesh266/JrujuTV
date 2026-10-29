-- Migration 013: push_subscriptions table for Web Push notifications
-- Parent-owned rows only (multi-device fan-out support)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,   -- browser push endpoint URL
  p256dh      TEXT        NOT NULL,           -- client public key (base64url)
  auth        TEXT        NOT NULL,           -- auth secret (base64url)
  user_agent  TEXT,                           -- optional device/browser label
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_parent_id_idx
  ON public.push_subscriptions(parent_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parent can insert their own subscription
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

-- Parent can read their own subscriptions
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = parent_id);

-- Parent can delete their own subscriptions (explicit disable)
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = parent_id);

-- Parent can update their own subscriptions (for resubscription via UI)
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = parent_id);

