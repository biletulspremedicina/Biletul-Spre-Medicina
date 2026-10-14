/*
# Chat updates: anonymous support, rating, simplified reasons, delete closed

1. Schema changes: user_id nullable, anonymous_token, rating, simplified reasons
2. New RPCs: anon chat, rating, delete closed, associate anon
3. Updated RPCs: get_my_chat_conversation (add rating), admin_get_chat_conversations (add rating + is_anonymous)
*/

-- ============================================================================
-- 1. SCHEMA CHANGES
-- ============================================================================

ALTER TABLE public.chat_conversations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS anonymous_token text;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS rating integer CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS rating_created_at timestamptz;

ALTER TABLE public.chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_reason_check;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_reason_check
  CHECK (reason IN ('platform_account', 'subject_question', 'suggestion_feedback', 'other'));

ALTER TABLE public.chat_conversations ALTER COLUMN user_id DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conv_anon_token ON public.chat_conversations(anonymous_token) WHERE anonymous_token IS NOT NULL;

-- Update unique index for active conversations to handle NULL user_id
DROP INDEX IF EXISTS idx_chat_conv_active_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conv_active_user
  ON public.chat_conversations(user_id)
  WHERE status != 'closed' AND user_id IS NOT NULL;

-- ============================================================================
-- 2. DROP functions with changed signatures
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_my_chat_conversation();
DROP FUNCTION IF EXISTS public.admin_get_chat_conversations();

-- ============================================================================
-- 3. UPDATE start_chat_conversation (reason list)
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

  IF p_reason NOT IN ('platform_account','subject_question','suggestion_feedback','other') THEN
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
-- 4. NEW RPC: start_anon_chat_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_anon_chat_conversation(
  p_reason text,
  p_description text
)
RETURNS TABLE (out_id uuid, out_anonymous_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_token text;
BEGIN
  IF p_reason NOT IN ('platform_account','subject_question','suggestion_feedback','other') THEN
    RAISE EXCEPTION 'Motiv invalid';
  END IF;

  IF length(trim(p_description)) < 10 OR length(p_description) > 1000 THEN
    RAISE EXCEPTION 'Descrierea trebuie să aibă între 10 și 1000 de caractere';
  END IF;

  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;

  INSERT INTO public.chat_conversations (user_id, reason, description, status, anonymous_token)
  VALUES (NULL, p_reason, p_description, 'new', v_token)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.start_anon_chat_conversation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_anon_chat_conversation(text, text) TO anon, authenticated;

-- ============================================================================
-- 5. NEW RPC: get_anon_chat_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_anon_chat_conversation(
  p_anonymous_token text
)
RETURNS TABLE (
  out_id uuid,
  out_reason text,
  out_description text,
  out_status text,
  out_created_at timestamptz,
  out_updated_at timestamptz,
  out_last_message text,
  out_last_message_at timestamptz,
  out_unread_count bigint,
  out_rating integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_last_msg text;
  v_last_msg_at timestamptz;
  v_unread bigint;
  v_rating integer;
BEGIN
  IF p_anonymous_token IS NULL OR length(trim(p_anonymous_token)) < 10 THEN
    RAISE EXCEPTION 'Token invalid';
  END IF;

  SELECT id, rating INTO v_conv_id, v_rating
  FROM public.chat_conversations
  WHERE anonymous_token = p_anonymous_token
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
    COALESCE(v_last_msg, ''), COALESCE(v_last_msg_at, c.updated_at), COALESCE(v_unread, 0),
    v_rating
  FROM public.chat_conversations c WHERE c.id = v_conv_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_anon_chat_conversation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anon_chat_conversation(text) TO anon, authenticated;

-- ============================================================================
-- 6. NEW RPC: send_anon_chat_message
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_anon_chat_message(
  p_anonymous_token text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg_id uuid;
  v_conv_id uuid;
BEGIN
  IF p_anonymous_token IS NULL OR length(trim(p_anonymous_token)) < 10 THEN
    RAISE EXCEPTION 'Token invalid';
  END IF;

  IF length(trim(p_content)) < 1 OR length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Mesajul trebuie să aibă între 1 și 2000 de caractere';
  END IF;

  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE anonymous_token = p_anonymous_token AND status != 'closed'
  ORDER BY created_at DESC LIMIT 1;

  IF v_conv_id IS NULL THEN RAISE EXCEPTION 'Conversația nu există sau este închisă'; END IF;

  UPDATE public.chat_conversations SET updated_at = now() WHERE id = v_conv_id;

  INSERT INTO public.chat_messages (conversation_id, sender_id, sender_role, content)
  VALUES (v_conv_id, '00000000-0000-0000-0000-000000000000'::uuid, 'user', p_content)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_anon_chat_message(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_anon_chat_message(text, text) TO anon, authenticated;

-- ============================================================================
-- 7. NEW RPC: mark_anon_messages_read
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_anon_messages_read(
  p_anonymous_token text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  IF p_anonymous_token IS NULL THEN RETURN; END IF;

  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE anonymous_token = p_anonymous_token
  ORDER BY created_at DESC LIMIT 1;

  IF v_conv_id IS NULL THEN RETURN; END IF;

  UPDATE public.chat_messages SET is_read = true
  WHERE conversation_id = v_conv_id AND sender_role = 'admin' AND is_read = false;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_anon_messages_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_anon_messages_read(text) TO anon, authenticated;

-- ============================================================================
-- 8. NEW RPC: rate_chat_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rate_chat_conversation(
  p_conversation_id uuid,
  p_rating integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv record;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating invalid (1-5)';
  END IF;

  SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversația nu există'; END IF;

  IF v_conv.status != 'closed' THEN
    RAISE EXCEPTION 'Poți evalua doar conversațiile închise';
  END IF;

  IF v_conv.user_id IS NOT NULL THEN
    IF auth.uid() IS NULL OR auth.uid() != v_conv.user_id THEN
      RAISE EXCEPTION 'Nu ai acces la această conversație';
    END IF;
  END IF;

  UPDATE public.chat_conversations
  SET rating = p_rating, rating_created_at = now()
  WHERE id = p_conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_chat_conversation(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_chat_conversation(uuid, integer) TO anon, authenticated;

-- ============================================================================
-- 9. RECREATE get_my_chat_conversation (add rating)
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
  out_unread_count bigint,
  out_rating integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_last_msg text;
  v_last_msg_at timestamptz;
  v_unread bigint;
  v_rating integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;

  SELECT id, rating INTO v_conv_id, v_rating
  FROM public.chat_conversations
  WHERE user_id = auth.uid() AND status != 'closed'
  ORDER BY created_at DESC LIMIT 1;

  IF v_conv_id IS NULL THEN
    SELECT id, rating INTO v_conv_id, v_rating
    FROM public.chat_conversations
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC LIMIT 1;
  END IF;

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
    COALESCE(v_last_msg, ''), COALESCE(v_last_msg_at, c.updated_at), COALESCE(v_unread, 0),
    v_rating
  FROM public.chat_conversations c WHERE c.id = v_conv_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_chat_conversation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_chat_conversation() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_conversation() TO authenticated;

-- ============================================================================
-- 10. RECREATE admin_get_chat_conversations (add rating + is_anonymous)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_chat_conversations()
RETURNS TABLE (
  out_id uuid,
  out_user_id uuid,
  out_user_name text,
  out_user_email text,
  out_is_anonymous boolean,
  out_reason text,
  out_description text,
  out_status text,
  out_admin_id uuid,
  out_created_at timestamptz,
  out_updated_at timestamptz,
  out_last_message text,
  out_last_message_at timestamptz,
  out_unread_count bigint,
  out_rating integer
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
    (c.user_id IS NULL),
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
    ),
    c.rating
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
-- 11. NEW RPC: admin_delete_chat_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_chat_conversation(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_status text;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Doar administratorii pot șterge conversații'; END IF;

  SELECT status INTO v_status FROM public.chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversația nu există'; END IF;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'Doar conversațiile închise pot fi șterse'; END IF;

  DELETE FROM public.chat_conversations WHERE id = p_conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_chat_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_chat_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_chat_conversation(uuid) TO authenticated;

-- ============================================================================
-- 12. NEW RPC: associate_anon_conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.associate_anon_conversation(
  p_anonymous_token text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_existing_active uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  IF p_anonymous_token IS NULL THEN RETURN; END IF;

  SELECT * INTO v_conv FROM public.chat_conversations
  WHERE anonymous_token = p_anonymous_token AND user_id IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT id INTO v_existing_active
  FROM public.chat_conversations
  WHERE user_id = auth.uid() AND status != 'closed'
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing_active IS NOT NULL THEN
    IF v_conv.status = 'closed' THEN
      UPDATE public.chat_conversations
      SET user_id = auth.uid(), anonymous_token = NULL
      WHERE id = v_conv.id;
    END IF;
    RETURN;
  END IF;

  UPDATE public.chat_conversations
  SET user_id = auth.uid(), anonymous_token = NULL
  WHERE id = v_conv.id;
END;
$$;
REVOKE ALL ON FUNCTION public.associate_anon_conversation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.associate_anon_conversation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.associate_anon_conversation(text) TO authenticated;
