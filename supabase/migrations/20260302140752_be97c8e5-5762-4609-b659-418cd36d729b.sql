CREATE TABLE public.whatsapp_incoming_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  remote_jid text NOT NULL,
  sender_name text DEFAULT '',
  message_text text DEFAULT '',
  is_group boolean DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_incoming_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own incoming messages"
  ON public.whatsapp_incoming_messages
  FOR SELECT
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_incoming_messages;