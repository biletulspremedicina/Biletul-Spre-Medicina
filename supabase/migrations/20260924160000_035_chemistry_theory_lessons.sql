/*
  Lecții teoretice de chimie, complet separate de banca de grile.
  Administratorii gestionează lecțiile și blocurile, iar elevii văd doar lecțiile publicate.
*/

CREATE TABLE IF NOT EXISTS public.chemistry_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemistry_lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.chemistry_lessons(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('heading', 'subheading', 'paragraph', 'list', 'note', 'formula', 'image')),
  content text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  image_url text NOT NULL DEFAULT '',
  image_alt text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  note_style text NOT NULL DEFAULT 'info' CHECK (note_style IN ('info', 'important', 'example')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chemistry_lessons_position
  ON public.chemistry_lessons(position, created_at);
CREATE INDEX IF NOT EXISTS idx_chemistry_blocks_lesson_position
  ON public.chemistry_lesson_blocks(lesson_id, position, created_at);

ALTER TABLE public.chemistry_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemistry_lesson_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_chemistry_lessons" ON public.chemistry_lessons;
CREATE POLICY "admin_all_chemistry_lessons" ON public.chemistry_lessons
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_select_published_chemistry_lessons" ON public.chemistry_lessons;
CREATE POLICY "student_select_published_chemistry_lessons" ON public.chemistry_lessons
  FOR SELECT TO authenticated USING (is_published = true);

DROP POLICY IF EXISTS "admin_all_chemistry_blocks" ON public.chemistry_lesson_blocks;
CREATE POLICY "admin_all_chemistry_blocks" ON public.chemistry_lesson_blocks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_select_published_chemistry_blocks" ON public.chemistry_lesson_blocks;
CREATE POLICY "student_select_published_chemistry_blocks" ON public.chemistry_lesson_blocks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chemistry_lessons lesson
      WHERE lesson.id = chemistry_lesson_blocks.lesson_id
        AND lesson.is_published = true
    )
  );

-- Spațiu public doar pentru imaginile introduse în lecțiile de chimie.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chemistry-lessons',
  'chemistry-lessons',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "admin_manage_chemistry_lesson_images" ON storage.objects;
CREATE POLICY "admin_manage_chemistry_lesson_images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'chemistry-lessons' AND public.is_admin())
  WITH CHECK (bucket_id = 'chemistry-lessons' AND public.is_admin());

DROP POLICY IF EXISTS "authenticated_read_chemistry_lesson_images" ON storage.objects;
CREATE POLICY "authenticated_read_chemistry_lesson_images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'chemistry-lessons');

