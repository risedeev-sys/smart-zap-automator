
-- Tabela whatsapp_instances
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instance_name)
);

-- RLS policies
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own instances"
  ON public.whatsapp_instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instances"
  ON public.whatsapp_instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instances"
  ON public.whatsapp_instances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances"
  ON public.whatsapp_instances FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policy for webhook updates (no auth context)
CREATE POLICY "Service role can update instances"
  ON public.whatsapp_instances FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can select instances"
  ON public.whatsapp_instances FOR SELECT
  USING (true);
