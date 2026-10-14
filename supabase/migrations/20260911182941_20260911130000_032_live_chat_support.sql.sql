/*
# Live Chat Support System

1. New Tables
- `chat_conversations` — one per user, stores reason, description, status, admin assignment
- `chat_messages` — messages within a conversation

2. Security (RLS)
- Users see only their own conversations; admins see all
- Server-side validation on all inputs

3. RPCs (all SECURITY DEFINER, search_path = public)
- start_chat_conversation, send_chat_message, mark_chat_messages_read
- get_my_chat_conversation, admin_get_chat_conversations, admin_update_conversation_status

4. Realtime — tables added to supabase_realtime publication
*/

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'platform_account',
    'subject_question',
    'technical_issue',
    'subscription_payment',
    'suggestion_feedback',
    'other'
  )),
  description text NOT NULL CHECK (length(trim(description)) >= 10 AND length(description) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'ongoing', 'closed')),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conv_updated ON public.chat_conversations(updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conv_active_user
  ON public.chat_conversations(user_id)
  WHERE status != 'closed';

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'admin')),
  content text NOT NULL CHECK (length(trim(content)) >= 1 AND length(content) <= 2000),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msg_unread ON public.chat_messages(conversation_id, is_read) WHERE is_read = false;

-- ============================================================================
-- 2. RLS POLICIES — chat_conversations
-- ============================================================================

DROP POLICY IF EXISTS "select_own_conversations" ON public.chat_conversations;
CREATE POLICY "select_own_conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_conversation" ON public.chat_conversations;
CREATE POLICY "insert_own_conversation" ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_conversation" ON public.chat_conversations;
CREATE POLICY "update_conversation" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- 3. RLS POLICIES — chat_messages
-- ============================================================================

DROP POLICY IF EXISTS "select_conversation_messages" ON public.chat_messages;
CREATE POLICY "select_conversation_messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "insert_conversation_message" ON public.chat_messages;
CREATE POLICY "insert_conversation_message" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = chat_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.is_admin())
      )
    )
  );

DROP POLICY IF EXISTS "update_message_read" ON public.chat_messages;
CREATE POLICY "update_message_read" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.is_admin())
    )
  );

-- ============================================================================
-- 4. RPC: start_chat_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_chat_conversation(
  p_reason text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  IF p_reason NOT IN ('platform_account','subject_question','technical_issue','subscription_payment','suggestion_feedback','other') THEN
    RAISE EXCEPTION 'Motiv invalid';
  END IF;

  IF length(trim(p_description)) < 10 OR length(p_description) > 1000 THEN
    RAISE EXCEPTION 'Descrierea trebuie să aibă între 10 și 1000 de caractere';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.chat_conversations
  WHERE user_id = auth.uid() AND status != 'closed'
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.chat_conversations
    SET reason = p_reason, description = p_description, status = 'ongoing', updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.chat_conversations (user_id, reason, description, status)
  VALUES (auth.uid(), p_reason, p_description, 'new')
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_chat_conversation(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_chat_conversation(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_chat_conversation(text, text) TO authenticated;

-- ============================================================================
-- 5. RPC: send_chat_message
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg_id uuid;
  v_is_admin boolean;
  v_sender_role text;
  v_conv_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  IF length(trim(p_content)) < 1 OR length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Mesajul trebuie să aibă între 1 și 2000 de caractere';
  END IF;

  SELECT public.is_admin() INTO v_is_admin;
  v_sender_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END;

  SELECT user_id INTO v_conv_user_id
  FROM public.chat_conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Conversația nu există'; END IF;

  IF NOT v_is_admin AND v_conv_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Nu ai acces la această conversație';
  END IF;

  IF EXISTS (SELECT 1 FROM public.chat_conversations WHERE id = p_conversation_id AND status = 'closed') THEN
    RAISE EXCEPTION 'Conversația este închisă';
  END IF;

  IF v_is_admin THEN
    UPDATE public.chat_conversations
    SET status = CASE WHEN status = 'new' THEN 'ongoing' ELSE status END,
        admin_id = COALESCE(admin_id, auth.uid()),
        updated_at = now()
    WHERE id = p_conversation_id;
  ELSE
    UPDATE public.chat_conversations
    SET updated_at = now()
    WHERE id = p_conversation_id;
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_id, sender_role, content)
  VALUES (p_conversation_id, auth.uid(), v_sender_role, p_content)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;

-- ============================================================================
-- 6. RPC: mark_chat_messages_read
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_chat_messages_read(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_conv_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  SELECT public.is_admin() INTO v_is_admin;
  SELECT user_id INTO v_conv_user_id FROM public.chat_conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Conversația nu există'; END IF;
  IF NOT v_is_admin AND v_conv_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Nu ai acces la această conversație';
  END IF;

  IF v_is_admin THEN
    UPDATE public.chat_messages SET is_read = true
    WHERE conversation_id = p_conversation_id AND sender_role = 'user' AND is_read = false;
  ELSE
    UPDATE public.chat_messages SET is_read = true
    WHERE conversation_id = p_conversation_id AND sender_role = 'admin' AND is_read = false;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_chat_messages_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_chat_messages_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_messages_read(uuid) TO authenticated;

-- ============================================================================
-- 7. RPC: get_my_chat_conversation (for users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_chat_conversation()
RETURNS TABLE (
  out_id uuid,
  out_reason text,
  out_description text,
  out_status text,
  out_created_at timestamptz,
  out_updated_at timestamptz,
  out_last_message text,
  out_last_message_at timestamptz,
  out_unread_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_last_msg text;
  v_last_msg_at timestamptz;
  v_unread bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE user_id = auth.uid() AND status != 'closed'
  ORDER BY created_at DESC LIMIT 1;

  IF v_conv_id IS NULL THEN RETURN; END IF;

  SELECT content, created_at INTO v_last_msg, v_last_msg_at
  FROM public.chat_messages WHERE conversation_id = v_conv_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT COUNT(*) INTO v_unread
  FROM public.chat_messages
  WHERE conversation_id = v_conv_id AND sender_role = 'admin' AND is_read = false;

  RETURN QUERY
  SELECT
    c.id, c.reason, c.description, c.status, c.created_at, c.updated_at,
    COALESCE(v_last_msg, ''), COALESCE(v_last_msg_at, c.updated_at), COALESCE(v_unread, 0)
  FROM public.chat_conversations c WHERE c.id = v_conv_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_chat_conversation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_chat_conversation() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_conversation() TO authenticated;

-- ============================================================================
-- 8. RPC: admin_get_chat_conversations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_chat_conversations()
RETURNS TABLE (
  out_id uuid,
  out_user_id uuid,
  out_user_name text,
  out_user_email text,
  out_reason text,
  out_description text,
  out_status text,
  out_admin_id uuid,
  out_created_at timestamptz,
  out_updated_at timestamptz,
  out_last_message text,
  out_last_message_at timestamptz,
  out_unread_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot accesa conversațiile'; END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    p.full_name,
    p.email,
    c.reason,
    c.description,
    c.status,
    c.admin_id,
    c.created_at,
    c.updated_at,
    COALESCE(
      (SELECT content FROM public.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
      ''
    ),
    COALESCE(
      (SELECT created_at FROM public.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
      c.updated_at
    ),
    COALESCE(
      (SELECT COUNT(*) FROM public.chat_messages WHERE conversation_id = c.id AND sender_role = 'user' AND is_read = false),
      0
    )
  FROM public.chat_conversations c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  ORDER BY
    (CASE WHEN c.status = 'closed' THEN 1 ELSE 0 END),
    (SELECT COUNT(*) FROM public.chat_messages WHERE conversation_id = c.id AND sender_role = 'user' AND is_read = false) DESC,
    c.updated_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_chat_conversations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_chat_conversations() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_chat_conversations() TO authenticated;

-- ============================================================================
-- 9. RPC: admin_update_conversation_status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_conversation_status(
  p_conversation_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot schimba statusul'; END IF;

  IF p_status NOT IN ('new', 'ongoing', 'closed') THEN
    RAISE EXCEPTION 'Status invalid';
  END IF;

  UPDATE public.chat_conversations
  SET status = p_status, updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_conversation_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_conversation_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_conversation_status(uuid, text) TO authenticated;

-- ============================================================================
-- 10. Add realtime publication for chat tables
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
