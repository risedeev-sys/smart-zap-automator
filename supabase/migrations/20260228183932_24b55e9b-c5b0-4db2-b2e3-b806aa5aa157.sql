
ALTER TABLE public.triggers
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_to_groups boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_contacts_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_case boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
