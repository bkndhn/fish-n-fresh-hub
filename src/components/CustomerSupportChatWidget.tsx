import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles, Phone, ShieldCheck, Minimize2 } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { playOrderNotificationSound } from "@/lib/realtime";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "staff" | "system" | "bot";
  sender_name: string;
  message: string;
  created_at: string;
}

type CustomDB = Database & {
  public: {
    Tables: Database["public"]["Tables"] & {
      support_conversations: {
        Row: { id: string; customer_id: string | null; customer_name: string; customer_phone: string; subject: string; status: string; last_message_at: string; };
        Insert: { id?: string; customer_id?: string | null; customer_name: string; customer_phone: string; subject: string; status: string; last_message_at: string; };
        Update: { id?: string; customer_id?: string | null; customer_name?: string; customer_phone?: string; subject?: string; status?: string; last_message_at?: string; };
      };
      support_messages: {
        Row: { id: string; conversation_id: string; sender_type: string; sender_name: string; sender_id?: string | null; message: string; created_at: string; };
        Insert: { id?: string; conversation_id: string; sender_type: string; sender_name: string; sender_id?: string | null; message: string; created_at?: string; };
        Update: { id?: string; conversation_id?: string; sender_type?: string; sender_name?: string; sender_id?: string | null; message?: string; created_at?: string; };
      };
    };
  };
};

const customSupabase = supabase as unknown as SupabaseClient<CustomDB>;

const INSTANT_FAQS = [
  {
    q: "How fresh is today's seafood?",
    a: "All our seafood is morning dock catch procured directly from Kasimedu & coastal harbours at 6:00 AM, stored strictly on chemical-free crushed ice at 0–4°C.",
  },
  {
    q: "Can I choose my cutting style?",
    a: "Yes! For every fish, you can choose Curry Cut, Fry Slices (Steaks), Whole Cleaned with Head, or Boneless Fillets at zero extra charge.",
  },
  {
    q: "How does delivery tracking work?",
    a: "You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.",
  },
];

export function CustomerSupportChatWidget() {
  const { user } = useSessionUser();
  const { items } = useCart();
  const location = useLocation();

  const isCartVisible =
    items.length > 0 &&
    location.pathname !== "/cart" &&
    location.pathname !== "/checkout" &&
    !location.pathname.startsWith("/admin");

  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-fill customer info if logged in or stored locally
  useEffect(() => {
    const savedName = localStorage.getItem("fnf_name") || user?.user_metadata?.["name"] || "";
    const savedPhone = localStorage.getItem("fnf_phone") || "";
    if (savedName) setGuestName(savedName);
    if (savedPhone) setGuestPhone(savedPhone);
    if (user?.id || savedName) {
      setIsStarted(true);
    }
  }, [user]);

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isStarted) return;

    let active = true;

    async function initConversation() {
      try {
        const phone = guestPhone.trim() || user?.email || "9843061919";
        const name = guestName.trim() || (user?.user_metadata?.["name"] as string) || "Guest Shopper";

        // Find existing open conversation
        const { data: convs } = await customSupabase
          .from("support_conversations")
          .select("id")
          .eq("customer_phone", phone)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(1);

        let convId = convs?.[0]?.id;

        if (!convId) {
          const { data: newConv, error: createErr } = await customSupabase
            .from("support_conversations")
            .insert({
              customer_id: user?.id || null,
              customer_name: name,
              customer_phone: phone,
              subject: "Storefront Live In-App Chat",
              status: "open",
              last_message_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!createErr && newConv) {
            convId = newConv.id;
            // Welcome system message
            await customSupabase.from("support_messages").insert({
              conversation_id: convId,
              sender_type: "staff",
              sender_name: "Fish N Fresh Support",
              message: `Vanakkam ${name}! 👋 How can we assist you with your fresh seafood order today?`,
            });
          }
        }

        if (active && convId) {
          setConversationId(convId);

          // Fetch messages
          const { data: msgs } = await customSupabase
            .from("support_messages")
            .select("*")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: true });

          if (msgs) setMessages(msgs as ChatMessage[]);
        }
      } catch (err) {
        console.warn("Support chat initialization notice:", err);
      }
    }

    initConversation();

    return () => {
      active = false;
    };
  }, [isStarted, user?.id]);

  // Real-time WebSocket subscription to support_messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`support-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_type !== "customer") {
            playOrderNotificationSound("status");
            if (!isOpen) {
              setUnreadCount((c) => c + 1);
              toast.info(`New message from ${newMsg.sender_name}: "${newMsg.message.slice(0, 40)}..."`);
            }
          }
        }
      )
      .subscribe();

    // Reliable background poll heartbeat (every 3s when chat is open)
    const interval = setInterval(async () => {
      if (!conversationId || !isOpen) return;
      try {
        const { data: latestMsgs } = await customSupabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (latestMsgs && latestMsgs.length > 0) {
          const typedMsgs = latestMsgs as ChatMessage[];
          setMessages((prev) => {
            if (typedMsgs.length > prev.length) {
              const last = typedMsgs[typedMsgs.length - 1];
              if (last && last.sender_type !== "customer" && !prev.some((m) => m.id === last.id)) {
                playOrderNotificationSound("status");
              }
              return typedMsgs;
            }
            return prev;
          });
        }
      } catch {
        // silent heartbeat ignore
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !conversationId) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const clientMsg: ChatMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: conversationId,
      sender_type: "customer",
      sender_name: guestName || "You",
      message: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, clientMsg]);

    try {
      await customSupabase.from("support_messages").insert({
        conversation_id: conversationId,
        sender_type: "customer",
        sender_name: guestName || "Customer",
        sender_id: user?.id || null,
        message: text,
      });

      await customSupabase
        .from("support_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (err) {
      console.warn("Failed to send support message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error("Please enter your name and phone number to begin.");
      return;
    }
    localStorage.setItem("fnf_name", guestName.trim());
    localStorage.setItem("fnf_phone", guestPhone.trim());
    setIsStarted(true);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        className={`fixed z-40 right-4 sm:right-6 transition-all duration-300 ${
          isCartVisible ? "bottom-38 sm:bottom-24" : "bottom-20 sm:bottom-6"
        }`}
      >
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 group"
            title="Chat with Customer Support"
          >
            <MessageSquare className="size-5" />
            <span className="hidden sm:inline font-bold text-xs">Live Support</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-96 rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col h-[520px] max-h-[82vh] animate-in slide-in-from-bottom-5 transition-all duration-300 ${
            isCartVisible ? "bottom-38 sm:bottom-24" : "bottom-20 sm:bottom-6"
          }`}
        >
          {/* Header */}
          <div className="bg-primary px-4 py-3.5 text-primary-foreground flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="size-4.5" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Fish N Fresh Desk
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                </p>
                <p className="text-[10px] text-primary-foreground/80">Typical reply in &lt; 2 minutes</p>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Body */}
          {!isStarted ? (
            <form onSubmit={handleStartChat} className="p-5 space-y-4 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-1">
                <div className="mx-auto size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <MessageSquare className="size-6" />
                </div>
                <h3 className="font-bold text-base text-foreground">Welcome to Fish N Fresh Support</h3>
                <p className="text-xs text-muted-foreground">
                  Enter your contact details to connect with our counter team in real time.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Your Name</label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="h-9 text-xs rounded-xl mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Phone Number</label>
                  <Input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="e.g. 9843061919"
                    className="h-9 text-xs rounded-xl mt-1"
                    required
                  />
                </div>

                <Button type="submit" className="w-full rounded-xl h-9 text-xs font-bold shadow-xs">
                  Start Live Chat
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-muted/15 text-xs">
                {messages.map((m) => {
                  const isUser = m.sender_type === "customer";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <span className="text-[10px] text-muted-foreground mb-0.5 px-1 font-medium">
                        {isUser ? "You" : m.sender_name}
                      </span>
                      <div
                        className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-xs shadow-2xs leading-relaxed ${
                          isUser
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-card border border-border text-foreground rounded-bl-none"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Instant Questions Pills */}
              <div className="border-t border-border/40 px-3 py-1.5 bg-card overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
                {INSTANT_FAQS.map((faq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(faq.q);
                    }}
                    className="shrink-0 text-[10px] rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
                  >
                    {faq.q}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 border-t border-border/70 bg-card flex items-center gap-2"
              >
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message or question..."
                  className="h-9 text-xs rounded-xl flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputText.trim() || sending}
                  className="size-9 rounded-xl shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
