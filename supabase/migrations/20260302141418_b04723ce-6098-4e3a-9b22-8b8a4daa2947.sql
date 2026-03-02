ALTER TABLE public.medias ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;