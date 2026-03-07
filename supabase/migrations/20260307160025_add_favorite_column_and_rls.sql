-- Migration: add_favorite_column_and_rls
-- Purpose: Add favorite column to assets tables and fix Storage RLS policies for multi-tenant isolation.
-- Protocol: RiseZap Architect Protocol V1

-- 1. Add favorite column to audios, medias, and documents
ALTER TABLE public.audios ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;
ALTER TABLE public.medias ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;

-- 2. Storage RLS Cleanup and Enforcement
-- Drop any legacy rules mapping 'private/' paths which were conflicting
DROP POLICY IF EXISTS "Give users authenticated access to folder 1bqp9qb_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1bqp9qb_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1bqp9qb_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1bqp9qb_3" ON storage.objects;

-- Ensure the bucket exists and is public (or private, depending on setup)
-- Note: the 'assets' bucket usually allows authenticated uploads to user-specific folders
-- The following policies ensure standard multi-tenant isolation per UID folder limit.

-- Allow authenticated users to upload files to their own folder inside 'assets'
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files (and public link if the bucket is public)
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
