CREATE TABLE public.whatsapp_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own logs" ON public.whatsapp_message_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert logs" ON public.whatsapp_message_logs
  FOR INSERT WITH CHECK (true);
