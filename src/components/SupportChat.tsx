import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type ChatMessage, type ChatReason, CHAT_REASON_LABELS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, X, Send, Loader2, ChevronDown, Circle } from 'lucide-react';

type ReasonOption = { value: ChatReason; label: string };

const REASONS: ReasonOption[] = [
  { value: 'platform_account', label: 'Platformă sau cont' },
  { value: 'subject_question', label: 'Întrebare legată de materie' },
  { value: 'technical_issue', label: 'Problemă tehnică' },
  { value: 'subscription_payment', label: 'Abonament sau plată' },
  { value: 'suggestion_feedback', label: 'Sugestie sau feedback' },
  { value: 'other', label: 'Alt motiv' },
];

export default function SupportChat() {
  const { session, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminOnline, setAdminOnline] = useState(true);

  // Form state
  const [reason, setReason] = useState<ChatReason | ''>('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing conversation on mount
  const loadExistingConversation = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data, error: rpcError } = await supabase.rpc('get_my_chat_conversation');
    if (rpcError) {
      console.error('get_my_chat_conversation error:', rpcError);
      return;
    }
    if (data && (data as unknown[]).length > 0) {
      const conv = (data as unknown as { out_id: string; out_unread_count: number })[0];
      setConversationId(conv.out_id);
      setUnreadCount(conv.out_unread_count);
    }
  }, [session]);

  useEffect(() => {
    loadExistingConversation();
  }, [loadExistingConversation]);

  // Load messages when conversationId changes
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (msgError) {
      console.error('load messages error:', msgError);
      return;
    }
    setMessages((data || []) as ChatMessage[]);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

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
          // If message is from admin and chat is open, mark as read
          if (newMsg.sender_role === 'admin' && isOpen) {
            supabase.rpc('mark_chat_messages_read', { p_conversation_id: conversationId });
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
          const updated = payload.new as { status: string };
          if (updated.status === 'closed') {
            setConversationId(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, isOpen]);

  // Mark messages read when chat opens
  useEffect(() => {
    if (isOpen && conversationId) {
      setUnreadCount(0);
      supabase.rpc('mark_chat_messages_read', { p_conversation_id: conversationId });
    }
  }, [isOpen, conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll unread count when chat is closed
  useEffect(() => {
    if (isOpen || !conversationId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc('get_my_chat_conversation');
      if (data && (data as unknown[]).length > 0) {
        const conv = (data as unknown as { out_unread_count: number })[0];
        setUnreadCount(conv.out_unread_count);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, conversationId]);

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
      const { data, error: rpcError } = await supabase.rpc('start_chat_conversation', {
        p_reason: reason,
        p_description: trimmed,
      });
      if (rpcError) throw rpcError;
      const convId = data as string;
      setConversationId(convId);
      setUnreadCount(0);
      // Send the initial message as the description
      const { error: msgError } = await supabase.rpc('send_chat_message', {
        p_conversation_id: convId,
        p_content: trimmed,
      });
      if (msgError) throw msgError;
      await loadMessages();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Eroare la pornirea conversației.');
    }
    setStarting(false);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || sending) return;

    setSending(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('send_chat_message', {
        p_conversation_id: conversationId,
        p_content: trimmed,
      });
      if (rpcError) throw rpcError;
      setInput('');
      await loadMessages();
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

  const canSendForm = reason && description.trim().length >= 10 && description.trim().length <= 1000;

  if (!session || profile?.role === 'admin') return null;

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
                  <span className="text-sm font-bold text-stone-900">Asistență</span>
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
              />
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
  reasons, reason, setReason, description, setDescription,
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
        <div className="space-y-1.5">
          {reasons.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                reason === r.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
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
              const isMine = msg.sender_id === myId;
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

// ── Helpers ─────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

export { CHAT_REASON_LABELS };
