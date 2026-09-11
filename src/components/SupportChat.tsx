import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type ChatMessage, type ChatReason, CHAT_REASON_LABELS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, X, Send, Loader2, ChevronDown, Circle, Star } from 'lucide-react';

type ReasonOption = { value: ChatReason; label: string };

const REASONS: ReasonOption[] = [
  { value: 'platform_account', label: 'Platformă sau cont' },
  { value: 'subject_question', label: 'Întrebare legată de materie' },
  { value: 'suggestion_feedback', label: 'Sugestie sau feedback' },
  { value: 'other', label: 'Alt motiv' },
];

const ANON_TOKEN_KEY = 'bsm_chat_anon_token';
const CLOSED_MESSAGE = 'Această conversație a fost închisă. Sperăm că informațiile oferite ți-au fost de ajutor. Îți mulțumim că ai discutat cu noi!';

export default function SupportChat() {
  const { session, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [anonToken, setAnonToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [convStatus, setConvStatus] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(true);

  // Form state
  const [reason, setReason] = useState<ChatReason | ''>('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAuthenticated = !!session && profile?.role !== 'admin';
  const isClosed = convStatus === 'closed';

  // Load existing conversation on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadAuthenticatedConversation();
    } else {
      loadAnonConversation();
    }
  }, [isAuthenticated]);

  const loadAuthenticatedConversation = async () => {
    const { data, error: rpcError } = await supabase.rpc('get_my_chat_conversation');
    if (rpcError) return;
    if (data && (data as unknown[]).length > 0) {
      const conv = (data as unknown as { out_id: string; out_unread_count: number; out_status: string; out_rating: number | null })[0];
      setConversationId(conv.out_id);
      setUnreadCount(conv.out_unread_count);
      setConvStatus(conv.out_status);
      setRating(conv.out_rating);
    }
  };

  const loadAnonConversation = async () => {
    const token = localStorage.getItem(ANON_TOKEN_KEY);
    if (!token) return;
    setAnonToken(token);
    const { data, error: rpcError } = await supabase.rpc('get_anon_chat_conversation', {
      p_anonymous_token: token,
    });
    if (rpcError) return;
    if (data && (data as unknown[]).length > 0) {
      const conv = (data as unknown as { out_id: string; out_unread_count: number; out_status: string; out_rating: number | null })[0];
      setConversationId(conv.out_id);
      setUnreadCount(conv.out_unread_count);
      setConvStatus(conv.out_status);
      setRating(conv.out_rating);
    }
  };

  // Load messages when conversationId changes
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (msgError) {
      // For anonymous users, direct table access won't work — use an RPC approach
      // We'll fetch messages via a simpler method
      return;
    }
    setMessages((data || []) as ChatMessage[]);
  }, [conversationId]);

  // For anonymous users, load messages via SECURITY DEFINER RPC (RLS blocks direct SELECT)
  const loadAnonMessages = useCallback(async () => {
    if (!conversationId || !anonToken) return;
    const { data, error: rpcError } = await supabase.rpc('get_anon_chat_messages', {
      p_anonymous_token: anonToken,
    });
    if (rpcError) return;
    const msgs = (data || []) as unknown as {
      out_id: string; out_conversation_id: string; out_sender_role: 'user' | 'admin';
      out_content: string; out_is_read: boolean; out_created_at: string;
    }[];
    setMessages(msgs.map((m) => ({
      id: m.out_id,
      conversation_id: m.out_conversation_id,
      sender_id: '',
      sender_role: m.out_sender_role,
      content: m.out_content,
      is_read: m.out_is_read,
      created_at: m.out_created_at,
    })));
  }, [conversationId, anonToken]);

  useEffect(() => {
    if (conversationId) {
      if (isAuthenticated) {
        loadMessages();
      } else {
        loadAnonMessages();
      }
    }
  }, [conversationId, isAuthenticated, loadMessages, loadAnonMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_role === 'admin' && isOpen) {
            if (isAuthenticated && conversationId) {
              supabase.rpc('mark_chat_messages_read', { p_conversation_id: conversationId });
            } else if (anonToken) {
              supabase.rpc('mark_anon_messages_read', { p_anonymous_token: anonToken });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string; rating: number | null };
          setConvStatus(updated.status);
          setRating(updated.rating);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, isOpen, isAuthenticated, anonToken]);

  // Mark messages read when chat opens
  useEffect(() => {
    if (isOpen && conversationId) {
      setUnreadCount(0);
      if (isAuthenticated) {
        supabase.rpc('mark_chat_messages_read', { p_conversation_id: conversationId });
      } else if (anonToken) {
        supabase.rpc('mark_anon_messages_read', { p_anonymous_token: anonToken });
      }
    }
  }, [isOpen, conversationId, isAuthenticated, anonToken]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll unread count when chat is closed
  useEffect(() => {
    if (isOpen || !conversationId) return;
    const interval = setInterval(async () => {
      if (isAuthenticated) {
        const { data } = await supabase.rpc('get_my_chat_conversation');
        if (data && (data as unknown[]).length > 0) {
          const conv = (data as unknown as { out_unread_count: number })[0];
          setUnreadCount(conv.out_unread_count);
        }
      } else if (anonToken) {
        const { data } = await supabase.rpc('get_anon_chat_conversation', { p_anonymous_token: anonToken });
        if (data && (data as unknown[]).length > 0) {
          const conv = (data as unknown as { out_unread_count: number })[0];
          setUnreadCount(conv.out_unread_count);
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, conversationId, isAuthenticated, anonToken]);

  // Show button for: authenticated non-admins OR unauthenticated visitors
  if (isAuthenticated) {
    // Show for students
  } else if (!session) {
    // Show for anonymous visitors
  } else {
    // Admin — don't show
    return null;
  }

  const handleStartConversation = async () => {
    setFormError(null);
    if (!reason) {
      setFormError('Selectează un motiv.');
      return;
    }
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setFormError('Descrierea trebuie să aibă cel puțin 10 caractere.');
      return;
    }
    if (trimmed.length > 1000) {
      setFormError('Descrierea nu poate depăși 1000 de caractere.');
      return;
    }

    setStarting(true);
    try {
      if (isAuthenticated) {
        const { data, error: rpcError } = await supabase.rpc('start_chat_conversation', {
          p_reason: reason,
          p_description: trimmed,
        });
        if (rpcError) throw rpcError;
        const convId = data as string;
        setConversationId(convId);
        setConvStatus('new');
        setUnreadCount(0);
        const { error: msgError } = await supabase.rpc('send_chat_message', {
          p_conversation_id: convId,
          p_content: trimmed,
        });
        if (msgError) throw msgError;
        await loadMessages();
      } else {
        // Anonymous
        const { data, error: rpcError } = await supabase.rpc('start_anon_chat_conversation', {
          p_reason: reason,
          p_description: trimmed,
        });
        if (rpcError) throw rpcError;
        const result = (data as unknown as { out_id: string; out_anonymous_token: string }[])[0];
        const convId = result.out_id;
        const token = result.out_anonymous_token;
        localStorage.setItem(ANON_TOKEN_KEY, token);
        setAnonToken(token);
        setConversationId(convId);
        setConvStatus('new');
        setUnreadCount(0);
        const { error: msgError } = await supabase.rpc('send_anon_chat_message', {
          p_anonymous_token: token,
          p_content: trimmed,
        });
        if (msgError) throw msgError;
        await loadAnonMessages();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Eroare la pornirea conversației.');
    }
    setStarting(false);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || sending || isClosed) return;

    setSending(true);
    setError(null);
    try {
      if (isAuthenticated) {
        const { error: rpcError } = await supabase.rpc('send_chat_message', {
          p_conversation_id: conversationId,
          p_content: trimmed,
        });
        if (rpcError) throw rpcError;
        await loadMessages();
      } else if (anonToken) {
        const { error: rpcError } = await supabase.rpc('send_anon_chat_message', {
          p_anonymous_token: anonToken,
          p_content: trimmed,
        });
        if (rpcError) throw rpcError;
        await loadAnonMessages();
      }
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la trimiterea mesajului.');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRate = async (star: number) => {
    if (!conversationId || ratingLoading) return;
    setRatingLoading(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('rate_chat_conversation', {
        p_conversation_id: conversationId,
        p_rating: star,
      });
      if (rpcError) throw rpcError;
      setRating(star);
      setRatingSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la salvarea evaluării.');
    }
    setRatingLoading(false);
  };

  const canSendForm = reason && description.trim().length >= 10 && description.trim().length <= 1000;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95"
          aria-label="Asistență"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[380px]">
          <div className="flex max-h-[65vh] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:max-h-[520px] animate-[slideUp_0.2s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-stone-900">Echipa Biletul Spre Medicină</span>
                  <span className="flex items-center gap-1 text-[11px] text-stone-500">
                    {adminOnline ? (
                      <><Circle size={7} className="fill-green-500 text-green-500" /> Online</>
                    ) : (
                      <><Circle size={7} className="fill-stone-300 text-stone-300" /> Offline</>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Body */}
            {conversationId ? (
              isClosed ? (
                <ClosedConversationView
                  rating={rating}
                  hoverRating={hoverRating}
                  setHoverRating={setHoverRating}
                  onRate={handleRate}
                  ratingSaved={ratingSaved}
                  ratingLoading={ratingLoading}
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                />
              ) : (
                <ChatView
                  messages={messages}
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                  sending={sending}
                  error={error}
                  messagesEndRef={messagesEndRef}
                  textareaRef={textareaRef}
                  isAnonymous={!isAuthenticated}
                />
              )
            ) : (
              <StartConversationForm
                reasons={REASONS}
                reason={reason}
                setReason={setReason}
                description={description}
                setDescription={setDescription}
                formError={formError}
                starting={starting}
                canSend={canSendForm}
                onStart={handleStartConversation}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Start Conversation Form ─────────────────────────────────────────────

function StartConversationForm({
  reason, setReason, description, setDescription,
  formError, starting, canSend, onStart,
}: {
  reasons: ReasonOption[];
  reason: ChatReason | '';
  setReason: (r: ChatReason | '') => void;
  description: string;
  setDescription: (d: string) => void;
  formError: string | null;
  starting: boolean;
  canSend: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-stone-700">Motivul conversației</label>
        <select
          className="input text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value as ChatReason)}
        >
          <option value="">Selectează un motiv</option>
          <option value="platform_account">Platformă sau cont</option>
          <option value="subject_question">Întrebare legată de materie</option>
          <option value="suggestion_feedback">Sugestie sau feedback</option>
          <option value="other">Alt motiv</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-stone-700">Descrie pe scurt problema</label>
        <textarea
          className="input min-h-[80px] text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrie problema ta în cel puțin 10 caractere..."
          maxLength={1000}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-stone-400">
          <span>Min. 10 · Max. 1000 caractere</span>
          <span>{description.trim().length}</span>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {formError}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={!canSend || starting}
        className="btn-primary w-full text-sm"
      >
        {starting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        Începe conversația
      </button>
    </div>
  );
}

// ── Chat View ───────────────────────────────────────────────────────────

function ChatView({
  messages, input, setInput, onSend, onKeyDown, sending, error, messagesEndRef, textareaRef,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isAnonymous: boolean;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: '200px' }}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-stone-400">
            Conversația a început. Un administrator va răspunde în curând.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isMine = msg.sender_role === 'user';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md bg-stone-100 text-stone-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{escapeHtml(msg.content)}</p>
                    <span className={`mt-0.5 block text-[10px] ${isMine ? 'text-brand-200' : 'text-stone-400'}`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-stone-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            className="input min-h-[40px] flex-1 resize-none text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Scrie un mesaj..."
            rows={1}
            maxLength={2000}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-all hover:bg-brand-700 disabled:opacity-40"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-stone-400">Enter pentru trimitere · Shift+Enter pentru rând nou</p>
      </div>
    </>
  );
}

// ── Closed Conversation View ────────────────────────────────────────────

function ClosedConversationView({
  rating, hoverRating, setHoverRating, onRate, ratingSaved, ratingLoading, messages, messagesEndRef,
}: {
  rating: number | null;
  hoverRating: number;
  setHoverRating: (n: number) => void;
  onRate: (star: number) => void;
  ratingSaved: boolean;
  ratingLoading: boolean;
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: '150px', maxHeight: '300px' }}>
        {messages.length > 0 && (
          <div className="space-y-2 mb-3">
            {messages.map((msg) => {
              const isMine = msg.sender_role === 'user';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md bg-stone-100 text-stone-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{escapeHtml(msg.content)}</p>
                    <span className={`mt-0.5 block text-[10px] ${isMine ? 'text-brand-200' : 'text-stone-400'}`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-stone-100 p-4">
        <p className="text-sm text-stone-600 mb-3">{CLOSED_MESSAGE}</p>

        <div>
          <p className="mb-2 text-xs font-semibold text-stone-700">Cum a fost experiența ta?</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = (hoverRating || rating || 0) >= star;
              return (
                <button
                  key={star}
                  onClick={() => onRate(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={ratingLoading}
                  className="rounded-lg p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  aria-label={`${star} din 5 stele`}
                >
                  <Star
                    size={24}
                    className={isFilled ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}
                  />
                </button>
              );
            })}
            {ratingLoading && <Loader2 size={16} className="animate-spin text-stone-400 ml-1" />}
          </div>
          {ratingSaved && (
            <p className="mt-2 text-xs font-medium text-green-600">Mulțumim pentru feedback!</p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}
