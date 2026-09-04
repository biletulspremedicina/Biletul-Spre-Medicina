/*
# Fix infinite recursion in profiles SELECT policy
# The previous policy queried profiles inside a profiles policy → infinite recursion
# Use the existing is_admin() SECURITY DEFINER function instead
*/

DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;

CREATE POLICY "select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin()
  );
