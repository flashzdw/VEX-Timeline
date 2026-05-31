-- ============================================
-- VEX-Timeline: Storage Policies & Helper Functions
-- ============================================

-- ------------------------------------------
-- 1. Storage Bucket Policies for record-images
-- ------------------------------------------

-- Allow anyone to view images (public bucket)
CREATE POLICY "record_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'record-images');

-- Allow authenticated users to upload images
CREATE POLICY "record_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'record-images'
    AND auth.role() = 'authenticated'
  );

-- Allow users to update their own images (by owner column)
CREATE POLICY "record_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'record-images'
    AND owner = auth.uid()
  );

-- Allow users to delete their own images, or timeline owners to delete any image
CREATE POLICY "record_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'record-images'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.timelines t
        WHERE t.owner_id = auth.uid()
      )
    )
  );

-- ------------------------------------------
-- 2. Helper: generate_invite_code()
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;
