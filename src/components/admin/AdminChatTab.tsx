import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type ChatMessage, type AdminChatConversationRPC, CHAT_REASON_LABELS, CHAT_STATUS_LABELS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Search, Send, Loader2, MessageSquare, X, CheckCircle2, Star, Trash2,
} from 'lucide-react';

type ConversationWithProfile = AdminChatConversationRPC;

export default function AdminChatTab() {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('admin_get_chat_conversations');
    if (rpcError) {
      console.error('admin_get_chat_conversations error:', rpcError);
      setLoading(false);
      return;
    }
    setConversations((data || []) as unknown as ConversationWithProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime: listen for new conversations and message updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => loadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  const filtered = conversations.filter((c) => {
    if (reasonFilter !== 'all' && c.out_reason !== reasonFilter) return false;
    if (statusFilter !== 'all' && c.out_status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const name = c.out_user_name || '';
      const email = c.out_user_email || '';
      if (!name.toLowerCase().includes(s) && !email.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const selected = conversations.find((c) => c.out_id === selectedId) || null;

  const handleStatusChange = async (convId: string, status: 'new' | 'ongoing' | 'closed') => {
    await supabase.rpc('admin_update_conversation_status', {
      p_conversation_id: convId,
      p_status: status,
    });
    loadConversations();
  };

  const handleDelete = async (convId: string) => {
    setDeleteError(null);
    setDeleteSuccess(null);
    if (!confirm('Sigur dorești să ștergi această conversație? Mesajele și evaluarea asociată vor fi șterse definitiv.')) return;

    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_chat_conversation', {
        p_conversation_id: convId,
      });
      if (rpcError) throw rpcError;
      setSelectedId(null);
      setDeleteSuccess('Conversația a fost ștearsă.');
      loadConversations();
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Eroare la ștergerea conversației.');
      setTimeout(() => setDeleteError(null), 5000);
    }
  };

  return (
    <div>
      {/* Success/error notifications */}
      {deleteSuccess && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          {deleteSuccess}
        </div>
      )}
      {deleteError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {deleteError}
        </div>
      )}

      <div className="flex h-[calc(100vh-220px)] gap-4 overflow-hidden">
        {/* Left column: conversation list */}
        <div className="flex w-full flex-col rounded-2xl border border-stone-200 bg-white sm:w-[340px] sm:flex-shrink-0">
          {/* Search + filters */}
          <div className="border-b border-stone-100 p-3">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className="input pl-9 text-sm"
                placeholder="Caută după nume sau e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="input flex-1 text-xs"
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
              >
                <option value="all">Toate motivele</option>
                {Object.entries(CHAT_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                className="input flex-1 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Toate statusurile</option>
                <option value="new">Nouă</option>
                <option value="ongoing">În desfășurare</option>
                <option value="closed">Închisă</option>
              </select>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-stone-400">Se încarcă...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-400">Nu există conversații.</p>
            ) : (
              filtered.map((c) => (
                <ConversationListItem
                  key={c.out_id}
                  conv={c}
                  isSelected={c.out_id === selectedId}
                  onClick={() => setSelectedId(c.out_id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column: messages */}
        <div className="hidden flex-1 rounded-2xl border border-stone-200 bg-white sm:flex sm:flex-col">
          {selected ? (
            <ChatDetail
              conv={selected}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onConversationsChanged={loadConversations}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare size={40} className="mx-auto mb-3 text-stone-300" />
                <p className="text-sm text-stone-400">Selectează o conversație pentru a vedea mesajele.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Conversation List Item ──────────────────────────────────────────────

function ConversationListItem({
  conv, isSelected, onClick,
}: {
  conv: ConversationWithProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasUnread = conv.out_unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-stone-50 px-3 py-3 text-left transition-colors ${
        isSelected ? 'bg-brand-50' : hasUnread ? 'bg-amber-50/50 hover:bg-stone-50' : 'hover:bg-stone-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-stone-900">
              {conv.out_is_anonymous ? 'Vizitator neautentificat' : (conv.out_user_name || 'Fără nume')}
            </span>
            {conv.out_is_anonymous && (
              <span className="badge bg-stone-100 text-stone-500 text-[9px] px-1 py-0">Fără cont</span>
            )}
            {hasUnread && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {conv.out_unread_count}
              </span>
            )}
          </div>
          {!conv.out_is_anonymous && (
            <p className="truncate text-xs text-stone-500">{conv.out_user_email || ''}</p>
          )}
          <span className="mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
            {CHAT_REASON_LABELS[conv.out_reason] || conv.out_reason}
          </span>
          {conv.out_rating && (
            <span className="mt-1 ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              {conv.out_rating}
            </span>
          )}
        </div>
        <span className={`badge flex-shrink-0 text-[10px] ${
          conv.out_status === 'new' ? 'bg-blue-100 text-blue-700'
          : conv.out_status === 'ongoing' ? 'bg-green-100 text-green-700'
          : 'bg-stone-100 text-stone-500'
        }`}>
          {CHAT_STATUS_LABELS[conv.out_status]}
        </span>
      </div>
      {conv.out_last_message && (
        <p className="mt-1 truncate text-xs text-stone-500">
          {conv.out_last_message}
        </p>
      )}
      <p className="mt-0.5 text-[10px] text-stone-400">
        {formatRelative(conv.out_last_message_at || conv.out_updated_at)}
      </p>
    </button>
  );
}

// ── Chat Detail (right column) ──────────────────────────────────────────

function ChatDetail({
  conv, onStatusChange, onDelete, onConversationsChanged,
}: {
  conv: ConversationWithProfile;
  onStatusChange: (id: string, status: 'new' | 'ongoing' | 'closed') => void;
  onDelete: (id: string) => void;
  onConversationsChanged: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    const { data, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conv.out_id)
      .order('created_at', { ascending: true });
    if (msgError) {
      setLoading(false);
      return;
    }
    setMessages((data || []) as ChatMessage[]);
    setLoading(false);
  }, [conv.out_id]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
    supabase.rpc('mark_chat_messages_read', { p_conversation_id: conv.out_id });
    onConversationsChanged();
  }, [conv.out_id, loadMessages, onConversationsChanged]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`admin-chat:${conv.out_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conv.out_id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          supabase.rpc('mark_chat_messages_read', { p_conversation_id: conv.out_id });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conv.out_id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('send_chat_message', {
        p_conversation_id: conv.out_id,
        p_content: trimmed,
      });
      if (rpcError) throw rpcError;
      setInput('');
      await loadMessages();
      onConversationsChanged();
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

  const handleDeleteClick = async () => {
    setDeleting(true);
    await onDelete(conv.out_id);
    setDeleting(false);
  };

  const isClosed = conv.out_status === 'closed';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-stone-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-stone-900">
                {conv.out_is_anonymous ? 'Vizitator neautentificat' : (conv.out_user_name || 'Fără nume')}
              </h3>
              {conv.out_is_anonymous && (
                <span className="badge bg-stone-100 text-stone-500 text-[10px]">Fără cont</span>
              )}
            </div>
            {!conv.out_is_anonymous && (
              <p className="text-xs text-stone-500">{conv.out_user_email || ''}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge bg-stone-100 text-stone-600 text-[10px]">
                {CHAT_REASON_LABELS[conv.out_reason] || conv.out_reason}
              </span>
              <span className={`badge text-[10px] ${
                conv.out_status === 'new' ? 'bg-blue-100 text-blue-700'
                : conv.out_status === 'ongoing' ? 'bg-green-100 text-green-700'
                : 'bg-stone-100 text-stone-500'
              }`}>
                {CHAT_STATUS_LABELS[conv.out_status]}
              </span>
              {conv.out_rating && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  {conv.out_rating} din 5
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <select
              className="input text-xs py-1.5"
              value={conv.out_status}
              onChange={(e) => onStatusChange(conv.out_id, e.target.value as 'new' | 'ongoing' | 'closed')}
              disabled={isClosed}
            >
              <option value="new">Nouă</option>
              <option value="ongoing">În desfășurare</option>
              <option value="closed">Închisă</option>
            </select>
            {!isClosed && (
              <button
                onClick={() => onStatusChange(conv.out_id, 'closed')}
                className="btn-ghost text-xs text-red-600 hover:bg-red-50"
              >
                <X size={14} /> Închide
              </button>
            )}
            {isClosed && (
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                className="btn-ghost text-xs text-red-600 hover:bg-red-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Șterge
              </button>
            )}
          </div>
        </div>

        {/* Initial description */}
        <div className="mt-3 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Descrierea inițială</p>
          <p className="mt-1 text-xs text-stone-700">{conv.out_description}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-center text-sm text-stone-400">Se încarcă...</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">Nu există mesaje încă.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isMine = msg.sender_role === 'admin';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
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

      {/* Input or closed message */}
      {isClosed ? (
        <div className="border-t border-stone-100 p-4">
          <p className="flex items-center justify-center gap-2 text-sm text-stone-400">
            <CheckCircle2 size={16} /> Această conversație este închisă.
          </p>
        </div>
      ) : (
        <div className="border-t border-stone-100 p-3">
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="input min-h-[40px] flex-1 resize-none text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrie un răspuns..."
              rows={1}
              maxLength={2000}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-all hover:bg-brand-700 disabled:opacity-40"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-stone-400">Enter pentru trimitere · Shift+Enter pentru rând nou</p>
        </div>
      )}
    </div>
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

function formatRelative(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'acum câteva secunde';
  if (diffMin < 60) return `acum ${diffMin} min`;
  if (diffHour < 24) return `acum ${diffHour} h`;
  if (diffDay === 1) return 'ieri';
  if (diffDay < 7) return `acum ${diffDay} zile`;
  return then.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}
