/*
# Add get_anon_chat_messages RPC

Anon users can't SELECT from chat_messages (RLS requires auth).
This SECURITY DEFINER RPC allows them to fetch their messages via their anonymous_token.
*/

CREATE OR REPLACE FUNCTION public.get_anon_chat_messages(
  p_anonymous_token text
)
RETURNS TABLE (
  out_id uuid,
  out_conversation_id uuid,
  out_sender_role text,
  out_content text,
  out_is_read boolean,
  out_created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  IF p_anonymous_token IS NULL OR length(trim(p_anonymous_token)) < 10 THEN
    RAISE EXCEPTION 'Token invalid';
  END IF;

  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE anonymous_token = p_anonymous_token
  ORDER BY created_at DESC LIMIT 1;

  IF v_conv_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    m.id, m.conversation_id, m.sender_role, m.content, m.is_read, m.created_at
  FROM public.chat_messages m
  WHERE m.conversation_id = v_conv_id
  ORDER BY m.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_anon_chat_messages(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anon_chat_messages(text) TO anon, authenticated;
