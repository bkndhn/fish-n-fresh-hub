import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Phone,
  HelpCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { settingsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";
import { useLocation } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";

interface Message {
  id: string;
  sender_type: "customer" | "admin" | "staff" | "bot";
  sender_name: string;
  message: string;
  created_at: string;
}

const FAQ_PROMPTS = [
  "When will today's fresh sea catch arrive?",
  "How do I choose custom fish cutting style?",
  "Where is my active delivery order?",
  "Can I pay via UPI QR upon delivery?",
];

export function CustomerSupportChatWidget() {
  const { user } = useSessionUser();
  const { data: settings } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const { items } = useCart();
  const location = useLocation();

  const isCartVisible =
    items.length > 0 &&
    location.pathname !== "/cart" &&
    location.pathname !== "/checkout" &&
    !location.pathname.startsWith("/admin");

  const isChatEnabled = (settings as any)?.feature_live_chat_enabled !== false;

  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto populate user details
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName((user.user_metadata?.["full_name"] as string) || "Customer");
      if (!customerPhone) setCustomerPhone((user.user_metadata?.["phone"] as string) || (user.phone as string) || "");
    } else {
      const savedPhone = localStorage.getItem("fnf_phone");
      if (savedPhone && !customerPhone) setCustomerPhone(savedPhone);
    }
  }, [user]);

  // Find or init conversation for this user/phone
  useEffect(() => {
    if (!isOpen) return;

    async function initConversation() {
      const phone = customerPhone || user?.phone || localStorage.getItem("fnf_phone") || "Guest";
      const name = customerName || (user?.user_metadata?.["full_name"] as string) || "Guest Shopper";

      try {
        // Try finding existing open or in-progress conversation
        const query = supabase
          .from("support_conversations" as any)
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1);

        if (user?.id) {
          query.eq("customer_id", user.id);
        } else if (phone !== "Guest") {
          query.eq("customer_phone", phone);
        }

        const { data: existing } = await query;

        if (existing && existing.length > 0) {
          setConversationId((existing[0] as any).id);
        } else {
          // Create new conversation
          const { data: created, error } = await supabase
            .from("support_conversations" as any)
            .insert({
              customer_id: user?.id || null,
              customer_name: name,
              customer_phone: phone,
              status: "open",
            } as any)
            .select("id")
            .single();

          if (!error && created) {
            setConversationId((created as any).id);

            // Send initial bot greeting
            await supabase.from("support_messages" as any).insert({
              conversation_id: (created as any).id,
              sender_type: "bot",
              sender_name: "Fish N Fresh Assistant",
              message:
                "Hello! Welcome to Fish N Fresh Hub. How can we help you today? Ask any questions about today's fresh harbor catches, cutting styles, or active deliveries.",
            } as any);
          }
        }
      } catch (err) {
        console.warn("Support conversation init exception:", err);
      }
    }

    initConversation();
  }, [isOpen, customerPhone, customerName, user]);

  // Query messages for active conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["support-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("support_messages" as any)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) return [];
      return (data as any) || [];
    },
    enabled: Boolean(conversationId && isOpen),
    refetchInterval: isOpen ? 3500 : false,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!conversationId || !text.trim()) return;

      const userDisplayName = customerName || (user?.user_metadata?.["full_name"] as string) || "Customer";

      const { error } = await supabase.from("support_messages" as any).insert({
        conversation_id: conversationId,
        sender_type: "customer",
        sender_id: user?.id || null,
        sender_name: userDisplayName,
        message: text.trim(),
      } as any);

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from("support_conversations" as any)
        .update({
          last_message_at: new Date().toISOString(),
          status: "open",
        } as any)
        .eq("id", conversationId);
    },
    onSuccess: () => {
      setNewMessage("");
      qc.invalidateQueries({ queryKey: ["support-messages", conversationId] });
    },
    onError: () => toast.error("Could not send message. Please try WhatsApp support."),
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || sendMutation.isPending) return;
    sendMutation.mutate(newMessage);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMutation.mutate(prompt);
  };

  if (!isChatEnabled) return null;

  const supportPhone = (settings?.support_phone || settings?.whatsapp_number || "919843061919").replace(/\D/g, "");
  const waUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Hi Fish N Fresh, I have a question about my order/seafood.`
  )}`;

  return (
    <>
      {/* Floating Launcher Button */}
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isCartVisible
            ? "bottom-38 right-4 sm:bottom-24 sm:right-6"
            : "bottom-20 right-4 sm:bottom-6 sm:right-6"
        }`}
      >
        {!isOpen && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setHasUnread(false);
            }}
            className="group relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-300 hover:scale-105 hover:bg-primary/95 focus:outline-hidden focus:ring-4 focus:ring-primary/20"
            aria-label="Open Live Customer Support"
          >
            <MessageCircle className="size-6 transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex size-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
            </span>
          </button>
        )}
      </div>

      {/* Slide-Up / Floating Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 mx-auto max-w-sm overflow-hidden rounded-3xl border border-border/80 bg-background shadow-2xl transition-all duration-300 ${
            isCartVisible
              ? "inset-x-3 bottom-38 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-96"
              : "inset-x-3 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="relative flex size-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs">
                <Sparkles className="size-5" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border border-primary" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  Live Customer Desk
                </div>
                <div className="text-[11px] text-primary-foreground/80 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                  Harbour Store Manager Online
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl p-2 text-primary-foreground/80 hover:bg-white/10 hover:text-white transition"
                title="Chat directly on WhatsApp"
              >
                <WhatsAppIcon className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-primary-foreground/80 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Quick Actions / Store Guarantee Header */}
          <div className="flex items-center justify-between bg-muted/40 px-4 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              100% Sea-Fresh Guarantee
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-primary" /> Avg Reply: ~2 mins
            </span>
          </div>

          {/* Message Stream */}
          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-muted/10 text-xs">
            {messages.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="size-5" />
                </div>
                <p className="font-semibold text-foreground">Starting conversation...</p>
                <p className="text-[11px] text-muted-foreground px-4">
                  Send a message below or pick a quick question.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isCustomer = m.sender_type === "customer";
                const isBot = m.sender_type === "bot";

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                  >
                    <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
                      {isCustomer ? "You" : isBot ? "Fish N Fresh Assistant" : `${m.sender_name} (Store Team)`}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isCustomer
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : isBot
                          ? "bg-sky-500/10 text-sky-950 dark:text-sky-100 border border-sky-500/20 rounded-tl-xs"
                          : "bg-card text-foreground border border-border/70 shadow-2xs rounded-tl-xs"
                      }`}
                    >
                      {m.message}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}

            {/* Quick Prompt Suggestions */}
            {messages.length <= 2 && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Quick Questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FAQ_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleQuickPrompt(prompt)}
                      className="rounded-xl border border-primary/20 bg-background/80 px-2.5 py-1 text-[11px] text-foreground hover:border-primary hover:bg-primary/5 transition text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-border bg-background">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask our fishmongers anything..."
                className="rounded-2xl h-10 text-xs pl-3 pr-2 bg-muted/30 focus-visible:ring-primary"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="size-10 rounded-2xl shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Send className="size-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 px-1 text-[10px] text-muted-foreground">
              <span>Need urgent voice call?</span>
              <a
                href={`tel:${supportPhone}`}
                className="font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <Phone className="size-3" /> Call Manager ({supportPhone})
              </a>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
