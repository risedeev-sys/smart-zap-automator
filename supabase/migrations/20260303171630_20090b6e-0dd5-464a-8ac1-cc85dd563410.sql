-- Clean up orphan/duplicate audio records, keeping only the one the user actually sees
DELETE FROM public.audios
WHERE id NOT IN ('0e922bb6-8df1-4207-9298-684ea3b01aa6');