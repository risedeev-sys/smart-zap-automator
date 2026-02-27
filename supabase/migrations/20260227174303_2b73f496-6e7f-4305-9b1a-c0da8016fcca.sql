
-- Add favorite column to funnels
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;

-- Create funnel_items table
CREATE TABLE public.funnel_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  asset_id UUID NOT NULL,
  delay_min INTEGER NOT NULL DEFAULT 0,
  delay_sec INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for funnel_items
ALTER TABLE public.funnel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own funnel_items" ON public.funnel_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funnel_items" ON public.funnel_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funnel_items" ON public.funnel_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own funnel_items" ON public.funnel_items FOR DELETE USING (auth.uid() = user_id);
