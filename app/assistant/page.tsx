"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { vnd, money, fmtDate } from "@/lib/format";

type Hotel = {
  hotelId: string; offerId: string; name: string; image?: string; address?: string; city?: string;
  rateName?: string; price: number; currency: string; rating?: number; starRating?: number;
  facilities?: string[]; boardName?: string; refundable?: boolean;
  checkIn: string; checkOut: string; guests: number;
  offerToken?: string;
};
type Msg = {
  role: "user" | "assistant"; content: string;
  suggestedRoomIds?: string[]; suggestedHotels?: Hotel[];
  quickReplies?: string[];
};
type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Msg[];
};
type Room = {
  id: string; name: string; type: string; capacity: number; basePrice: number; view: string; image: string;
};

const STARTERS = [
  "Cặp đôi đi trăng mật 3 đêm, gợi ý phòng & gói",
  "Gia đình 2 người lớn + 2 trẻ em đi 4 ngày",
  "Chính sách huỷ phòng và trẻ em thế nào?",
  "Có nhận thú cưng không?",
];
const LEGACY_CHAT_STORAGE_KEY = "an-lanh-chat-history-v1";
const CONVERSATIONS_STORAGE_KEY = "an-lanh-chat-conversations-v1";
const ACTIVE_CONVERSATION_KEY = "an-lanh-active-conversation-v1";
const INITIAL_MESSAGES: Msg[] = [
  {
    role: "assistant",
    content: "Xin chào! Mình là Lành, trợ lý du lịch của An Lành Bay 👋 Hôm nay mình có thể giúp gì cho bạn?",
  },
];

function newConversation(messages: Msg[] = INITIAL_MESSAGES): Conversation {
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "Cuộc trò chuyện mới",
    createdAt: now,
    updatedAt: now,
    messages: messages.map((message) => ({ ...message })),
  };
}

function conversationTitle(messages: Msg[]): string {
  const firstQuestion = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstQuestion) return "Cuộc trò chuyện mới";
  return firstQuestion.length > 38 ? `${firstQuestion.slice(0, 38).trim()}…` : firstQuestion;
}

function validMessages(value: unknown): value is Msg[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(
    (item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
  );
}

function validConversations(value: unknown): value is Conversation[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(
    (item) => item && typeof item.id === "string" && typeof item.title === "string"
      && typeof item.createdAt === "string" && typeof item.updatedAt === "string" && validMessages(item.messages)
  );
}

function AssistantInner() {
  const params = useSearchParams();
  const initialQ = params.get("q") || "";
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MESSAGES);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Room> = {};
        for (const r of d.rooms) map[r.id] = r;
        setRooms(map);
      });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (validConversations(parsed)) {
        const requestedActiveId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
        const active = parsed.find((item) => item.id === requestedActiveId) || parsed[0];
        setConversations(parsed);
        setActiveConversationId(active.id);
        setMessages(active.messages);
      } else {
        const legacySaved = sessionStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
        const legacyMessages = legacySaved ? JSON.parse(legacySaved) : null;
        const conversation = newConversation(validMessages(legacyMessages) ? legacyMessages : INITIAL_MESSAGES);
        conversation.title = conversationTitle(conversation.messages);
        setConversations([conversation]);
        setActiveConversationId(conversation.id);
        setMessages(conversation.messages);
      }
    } catch {
      const conversation = newConversation();
      setConversations([conversation]);
      setActiveConversationId(conversation.id);
      setMessages(conversation.messages);
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady || !activeConversationId) return;
    setConversations((current) => current.map((conversation) => conversation.id === activeConversationId
      ? {
          ...conversation,
          title: conversationTitle(messages),
          updatedAt: new Date().toISOString(),
          messages: messages.slice(-50),
        }
      : conversation
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20));
  }, [messages, activeConversationId, historyReady]);

  useEffect(() => {
    if (!historyReady || conversations.length === 0) return;
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
    } catch (error) {
      console.warn("Không thể lưu lịch sử trò chuyện:", error);
    }
  }, [conversations, activeConversationId, historyReady]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading) return;
      const next: Msg[] = [...messages, { role: "user", content: t }];
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-30).map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi");
        setMode(data.mode);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply,
            suggestedRoomIds: data.suggestedRoomIds,
            suggestedHotels: data.suggestedHotels,
            quickReplies: data.quickReplies,
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Xin lỗi, có lỗi khi kết nối. Bạn thử lại giúp mình nhé." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  useEffect(() => {
    if (historyReady && initialQ && !sentInitial.current) {
      sentInitial.current = true;
      send(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, historyReady]);

  function createNewConversation() {
    if (loading) return;
    const conversation = newConversation();
    setConversations((current) => [conversation, ...current].slice(0, 20));
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setInput("");
    setMode("");
  }

  function openConversation(conversation: Conversation) {
    if (loading || conversation.id === activeConversationId) return;
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setInput("");
    setMode("");
  }

  return (
    <div className="container-px py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="eyebrow">Concierge AI</span>
          <h1 className="font-display text-3xl mt-1">Trò chuyện với Lành</h1>
        </div>
        {mode && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-teal/8 text-teal-600">
            {mode === "demo" ? "demo mode" : `LLM: ${mode}`}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="card p-3 lg:h-[64vh] lg:min-h-[440px]">
          <button
            type="button"
            onClick={createNewConversation}
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="text-lg leading-none">＋</span>
            Cuộc trò chuyện mới
          </button>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(64vh-76px)] lg:space-y-1 lg:overflow-y-auto lg:pb-0">
            {conversations.map((conversation) => {
              const active = conversation.id === activeConversationId;
              return (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => openConversation(conversation)}
                  disabled={loading}
                  className={`min-w-[190px] rounded-xl px-3 py-2.5 text-left transition lg:block lg:w-full lg:min-w-0 ${
                    active ? "bg-teal/10 text-teal" : "text-ink/65 hover:bg-teal/5 hover:text-ink"
                  } disabled:opacity-50`}
                >
                  <span className="block truncate text-sm font-medium">{conversation.title}</span>
                  <span className="mt-0.5 block text-[10px] text-ink/40">
                    {new Date(conversation.updatedAt).toLocaleDateString("vi-VN")}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

      <div className="card flex flex-col h-[64vh] min-h-[440px] min-w-0">
        <div className="chat-scroll flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-sunset/20 text-ink rounded-tr-sm whitespace-pre-wrap"
                      : "bg-teal/8 text-ink rounded-tl-sm"
                  }`}
                >
                  {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                </div>
              </div>
              {m.suggestedHotels && m.suggestedHotels.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {m.suggestedHotels.map((h) => {
                    const nights = Math.max(
                      1,
                      Math.round((+new Date(h.checkOut) - +new Date(h.checkIn)) / 86400000)
                    );
                    const qs = new URLSearchParams({
                      hotelId: h.hotelId, offerId: h.offerId, name: h.name, room: h.rateName || "",
                      checkIn: h.checkIn, checkOut: h.checkOut, guests: String(h.guests),
                      price: String(h.price), currency: h.currency,
                    });
                    if (h.offerToken) qs.set("offerToken", h.offerToken);
                    return (
                      <Link
                        key={h.offerId}
                        href={`/hotels/detail?${qs.toString()}`}
                        className="rounded-xl border border-teal/15 bg-white/80 overflow-hidden hover:border-teal/40 transition"
                      >
                        {h.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.image} alt={h.name} className="h-28 w-full object-cover" />
                        ) : (
                          <div className="h-28 w-full bg-gradient-to-br from-teal to-jade" />
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm truncate">{h.name}</div>
                            {typeof h.starRating === "number" && h.starRating > 0 && (
                              <span className="shrink-0 text-[10px] text-sunset">★ {h.starRating}</span>
                            )}
                          </div>
                          {h.address && (
                            <div className="text-xs text-ink/55 truncate">📍 {h.address}{h.city ? `, ${h.city}` : ""}</div>
                          )}
                          {h.rateName && (
                            <div className="mt-1 truncate text-[11px] font-medium text-ink/70">🛏️ {h.rateName}</div>
                          )}
                          {(h.boardName || h.refundable) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {h.boardName && <span className="rounded-full bg-sunset/15 px-2 py-0.5 text-[10px] text-ink/65">🍽️ {h.boardName}</span>}
                              {h.refundable && <span className="rounded-full bg-jade/10 px-2 py-0.5 text-[10px] text-jade">✓ Hoàn huỷ được</span>}
                            </div>
                          )}
                          {h.facilities && h.facilities.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {h.facilities.slice(0, 4).map((facility) => (
                                <span key={facility} className="rounded-full bg-teal/7 px-2 py-0.5 text-[10px] text-teal">
                                  {facility}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-[11px] text-ink/45 mt-0.5">
                            {fmtDate(h.checkIn)} → {fmtDate(h.checkOut)} · {h.guests} khách
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="font-mono text-xs text-teal">
                              {money(Math.round(h.price / nights), h.currency)}/đêm
                            </span>
                            {typeof h.rating === "number" && h.rating > 0 && (
                              <span className="text-[11px] text-jade">⭐ {h.rating.toFixed(1)}/10</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10px] text-ink/45">
                            Tổng {money(h.price, h.currency)} cho {nights} đêm
                          </div>
                          <span className="mt-2 inline-block btn-gold text-xs px-3 py-1.5">Chi tiết</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              {m.suggestedRoomIds && m.suggestedRoomIds.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {m.suggestedRoomIds.map((id) => {
                    const r = rooms[id];
                    if (!r) return null;
                    return (
                      <div key={id} className="rounded-xl border border-teal/15 bg-white/80 p-3 flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-teal to-jade text-xl">
                          {r.image}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{r.name}</div>
                          <div className="text-xs text-ink/55">{r.view} · tối đa {r.capacity} khách</div>
                          <div className="font-mono text-xs text-teal mt-0.5">{vnd(r.basePrice)}/đêm</div>
                        </div>
                        <Link href={`/bookings?room=${r.id}`} className="btn-gold text-xs px-3 py-1.5 shrink-0">
                          Đặt
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
              {m.role === "assistant" && m.quickReplies && m.quickReplies.length > 0 && i === messages.length - 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => send(reply)}
                      disabled={loading}
                      className="text-xs rounded-full border border-teal/20 bg-white/80 px-3 py-1.5 text-teal hover:border-teal hover:bg-teal/5 transition disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-teal/8 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="inline-flex gap-1">
                  <Dot /> <Dot d={150} /> <Dot d={300} />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs rounded-full border border-teal/15 px-3 py-1.5 text-ink/60 hover:border-teal hover:text-teal transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-teal/10 p-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Nhập câu hỏi của bạn…"
            className="field flex-1 border-0 focus:ring-0 bg-transparent"
            disabled={loading}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary disabled:opacity-50">
            Gửi
          </button>
        </div>
      </div>
      </div>

      <p className="text-xs text-ink/45 mt-3 lg:ml-[276px]">
        Lưu ý: trợ lý không xử lý thông tin thẻ. Khi thanh toán, bạn tự nhập trên cổng an toàn của ngân hàng.
      </p>
    </div>
  );
}

// Render markdown nhẹ: **đậm**, `###` tiêu đề, gạch đầu dòng "- ".
// Đủ cho định dạng trợ lý trả về, không cần thêm thư viện.
function inline(text: string, kp: string) {
  // Tách **đậm** và [chữ](link)
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <strong key={kp + i} className="font-semibold text-ink">
          {inline(p.slice(2, -2), `${kp}${i}-strong-`)}
        </strong>
      );
    }
    const lm = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) {
      return (
        <Link key={kp + i} href={lm[2]} className="font-medium text-teal underline hover:text-jade">
          {lm[1]}
        </Link>
      );
    }
    return <span key={kp + i}>{p}</span>;
  });
}

function Markdown({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  let k = 0;
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={`ul${k++}`} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((it, i) => <li key={i}>{inline(it, `li${k}-${i}-`)}</li>)}
        </ul>
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      blocks.push(
        <p key={`h${k++}`} className="mb-1 mt-3 font-display text-base text-teal first:mt-0">
          {inline(line.replace(/^#{1,6}\s+/, ""), `h${k}-`)}
        </p>
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push(<p key={`p${k++}`} className="my-1">{inline(line, `p${k}-`)}</p>);
    }
  }
  flush();
  return <div>{blocks}</div>;
}

function Dot({ d = 0 }: { d?: number }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-teal/50 inline-block animate-bounce"
      style={{ animationDelay: `${d}ms` }}
    />
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="container-px py-16 text-center text-ink/50">Đang tải trợ lý…</div>}>
      <AssistantInner />
    </Suspense>
  );
}
