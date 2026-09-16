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
import { checkRateLimit, recordRateLimitAttempt } from "@/lib/rateLimiter";
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
    a: "🐟 All our seafood is morning dock catch procured directly from Kasimedu & coastal harbours at 6:00 AM, stored strictly on chemical-free crushed ice at 0–4°C.",
  },
  {
    q: "Can I choose my cutting style?",
    a: "🔪 Yes! For every fish, you can choose Curry Cut, Fry Slices (Steaks), Whole Cleaned with Head, or Boneless Fillets at zero extra charge.",
  },
  {
    q: "How does live delivery tracking work?",
    a: "📍 You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.",
  },
  {
    q: "What is Express Delivery time?",
    a: "⚡ Express deliveries arrive within 30–45 minutes in our active service zones! You can also pick morning (7 AM–10 AM) or evening (4 PM–8 PM) slots at checkout.",
  },
  {
    q: "Can I order via WhatsApp?",
    a: "💬 Yes! Tap the WhatsApp button above or message +91 98430 61919 with live location autofill, instant bill calculation, and custom cut notes.",
  },
  {
    q: "What payment methods are supported?",
    a: "💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD) at your doorstep.",
  },
];

export function getAutoReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("cut") || t.includes("style") || t.includes("clean") || t.includes("slice") || t.includes("fillet") || t.includes("curry") || t.includes("steak") || t.includes("piece")) {
    return "🔪 Yes! For every fish, you can choose Curry Cut, Fry Slices (Steaks), Whole Cleaned with Head, or Boneless Fillets at zero extra charge.";
  }
  if (t.includes("fresh") || t.includes("catch") || t.includes("today") || t.includes("harbour") || t.includes("harbor") || /\bice\b/.test(t) || t.includes("chemical")) {
    return "🐟 All our seafood is 100% morning dock catch procured directly from Kasimedu & coastal harbours at 6:00 AM, stored strictly on chemical-free crushed ice at 0–4°C.";
  }
  if (t.includes("track") || t.includes("pin") || t.includes("rider") || t.includes("gps") || t.includes("where is") || t.includes("location") || t.includes("nav")) {
    return "📍 You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.";
  }
  if (t.includes("express") || t.includes("fast") || t.includes("timing") || t.includes("slot") || t.includes("delivery time") || t.includes("quick") || t.includes("how long")) {
    return "⚡ Express deliveries arrive within 30–45 minutes in our service zones! You can also pick morning (7 AM–10 AM) or evening (4 PM–8 PM) slots at checkout.";
  }
  if (t.includes("whatsapp") || /\bwa\b/.test(t) || t.includes("phone") || t.includes("call") || t.includes("contact") || t.includes("number")) {
    return "💬 You can also order directly via WhatsApp or speak to our desk at +91 98430 61919 with live location autofill & custom cut preferences!";
  }
  if (t.includes("pay") || t.includes("payment") || t.includes("cod") || t.includes("cash") || t.includes("upi") || t.includes("gpay") || t.includes("phonepe") || t.includes("card")) {
    return "💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD).";
  }
  if (t.includes("refund") || t.includes("return") || t.includes("bad") || t.includes("smell") || t.includes("spoil") || t.includes("cancel") || t.includes("guarantee")) {
    return "🛡️ We offer a 100% Freshness Guarantee! If you are ever unhappy with freshness, notify us within 2 hours of delivery for an instant refund or replacement.";
  }
  if (t.includes("price") || t.includes("rate") || t.includes("cost") || t.includes("offer") || t.includes("discount")) {
    return "🏷️ Our prices are updated daily based on harbor landing rates to give you wholesale-direct prices. Check our Catalog for today's special deals!";
  }
  return "🙏 Thank you for contacting Fish N Fresh! Our counter desk has received your note. For immediate telephone assistance, tap the WhatsApp / Call button at the top or dial +91 98430 61919.";
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-greeting",
      conversation_id: "desk",
      sender_type: "bot",
      sender_name: "Fish N Fresh Desk",
      message: "Vanakkam! 👋 Welcome to Fish N Fresh. Tap any quick question below for instant answers or send us a message!",
      created_at: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isStarted, setIsStarted] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-fill customer info if logged in or stored locally
  useEffect(() => {
    const savedName = localStorage.getItem("fnf_name") || user?.user_metadata?.["name"] || "";
    const savedPhone = localStorage.getItem("fnf_phone") || "";
    if (savedName) setGuestName(savedName);
    if (savedPhone) setGuestPhone(savedPhone);
    setIsStarted(true);
  }, [user]);

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  }, [messages, isOpen, isTyping]);

  // Initialize or fetch conversation from Supabase if logged in
  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const currentUserId = user.id;

    async function initConversation() {
      try {
        const phone = guestPhone.trim() || user?.email || "9843061919";
        const name = guestName.trim() || (user?.user_metadata?.["name"] as string) || "Customer";

        // Find existing open conversation for this signed-in customer
        const { data: convs } = await customSupabase
          .from("support_conversations")
          .select("id")
          .eq("customer_id", currentUserId)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(1);

        let convId = convs?.[0]?.id;

        if (!convId) {
          const { data: newConv, error: createErr } = await customSupabase
            .from("support_conversations")
            .insert({
              customer_id: currentUserId,
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
            await customSupabase.from("support_messages").insert({
              conversation_id: convId,
              sender_type: "staff",
              sender_name: "Fish N Fresh Desk",
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

          if (msgs && msgs.length > 0) {
            setMessages(msgs as ChatMessage[]);
          }
        }
      } catch (err) {
        console.warn("Support chat initialization notice:", err);
      }
    }

    initConversation();

    return () => {
      active = false;
    };
  }, [user?.id]);

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

  const handleSelectFaq = async (faq: { q: string; a: string }) => {
    const userMsgText = faq.q;
    const botReplyText = faq.a;

    const clientUserMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      conversation_id: conversationId || "desk",
      sender_type: "customer",
      sender_name: guestName || (user?.user_metadata?.["name"] as string) || "You",
      message: userMsgText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, clientUserMsg]);
    setIsTyping(true);

    setTimeout(async () => {
      const clientBotMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        conversation_id: conversationId || "desk",
        sender_type: "bot",
        sender_name: "Fish N Fresh Desk",
        message: botReplyText,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, clientBotMsg]);
      setIsTyping(false);
      playOrderNotificationSound("status");

      if (conversationId) {
        try {
          await customSupabase.from("support_messages").insert([
            {
              conversation_id: conversationId,
              sender_type: "customer",
              sender_name: guestName || "Customer",
              sender_id: user?.id || null,
              message: userMsgText,
            },
            {
              conversation_id: conversationId,
              sender_type: "bot",
              sender_name: "Fish N Fresh Desk",
              sender_id: null,
              message: botReplyText,
            },
          ]);
          await customSupabase
            .from("support_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        } catch {
          // silent fallback
        }
      }
    }, 350);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const rlCheck = checkRateLimit("support_chat", user?.id || conversationId || "guest");
    if (!rlCheck.allowed) {
      toast.error(rlCheck.errorMessage || "Too many messages. Please slow down.");
      return;
    }
    recordRateLimitAttempt("support_chat", user?.id || conversationId || "guest");

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const clientMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      conversation_id: conversationId || "desk",
      sender_type: "customer",
      sender_name: guestName || (user?.user_metadata?.["name"] as string) || "You",
      message: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, clientMsg]);
    setIsTyping(true);

    const botReplyText = getAutoReply(text);

    setTimeout(async () => {
      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        conversation_id: conversationId || "desk",
        sender_type: "bot",
        sender_name: "Fish N Fresh Desk",
        message: botReplyText,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      setSending(false);
      playOrderNotificationSound("status");

      if (conversationId) {
        try {
          await customSupabase.from("support_messages").insert([
            {
              conversation_id: conversationId,
              sender_type: "customer",
              sender_name: guestName || "Customer",
              sender_id: user?.id || null,
              message: text,
            },
            {
              conversation_id: conversationId,
              sender_type: "bot",
              sender_name: "Fish N Fresh Desk",
              sender_id: null,
              message: botReplyText,
            },
          ]);

          await customSupabase
            .from("support_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        } catch {
          // silent fallback
        }
      }
    }, 450);
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
          <div className="bg-primary px-4 py-3 text-primary-foreground flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="size-4.5" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Fish N Fresh Desk
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                </p>
                <p className="text-[10px] text-primary-foreground/80">Instant AI reply &bull; Live human support</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href="https://wa.me/919843061919?text=Hello%20Fish%20N%20Fresh%2C%20I%20have%20an%20inquiry"
                target="_blank"
                rel="noopener noreferrer"
                className="size-7 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition shadow-2xs"
                title="Chat directly on WhatsApp"
              >
                <MessageSquare className="size-3.5" />
              </a>
              <a
                href="tel:+919843061919"
                className="size-7 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center text-primary-foreground transition shadow-2xs"
                title="Call Support Desk"
              >
                <Phone className="size-3.5" />
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Guest notice banner */}
          {!user?.id && (
            <div className="bg-muted/40 text-muted-foreground text-[10px] py-1 px-3 text-center border-b border-border/40">
              Guest Mode &bull;{" "}
              <a href="/auth" className="text-primary underline font-medium">
                Sign in
              </a>{" "}
              to save conversation history
            </div>
          )}

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

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card border border-border/60 w-fit px-3 py-1.5 rounded-full shadow-2xs animate-pulse">
                <Bot className="size-3 text-primary animate-bounce" />
                <span>Fish N Fresh Desk is typing answer...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Instant Questions Pills: 1-Tap applies immediately and auto-replies */}
          <div className="border-t border-border/40 px-3 py-2 bg-card overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
            {INSTANT_FAQS.map((faq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectFaq(faq)}
                disabled={isTyping}
                className="shrink-0 text-[10px] font-semibold rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-primary hover:bg-primary hover:text-primary-foreground transition active:scale-95 shadow-2xs disabled:opacity-50"
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
              placeholder="Ask a question about seafood, delivery, cuts..."
              className="h-9 text-xs rounded-xl flex-1"
              disabled={isTyping}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputText.trim() || sending || isTyping}
              className="size-9 rounded-xl shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
