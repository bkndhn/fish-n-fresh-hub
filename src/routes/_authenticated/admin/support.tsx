import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  RefreshCw,
  Zap,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { settingsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Live Customer Support Desk | Fish N Fresh Admin" },
      { name: "description", content: "Real-time customer support desk and messaging console." },
    ],
  }),
  component: AdminSupportPage,
});

interface Conversation {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  status: "open" | "in_progress" | "resolved";
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "admin" | "staff" | "bot";
  sender_id?: string;
  sender_name: string;
  message: string;
  created_at: string;
}

const CANNED_RESPONSES = [
  "Your seafood order is packed on ice and currently out for priority delivery!",
  "Today's fresh sea catch arrived at 7:00 AM. Cutting styles include Curry Cut, Fry Cut, and Cleaned Fillet.",
  "We sincerely apologize for the delay. Our store manager is personally tracking your package.",
  "Your refund has been approved and processed. It will reflect in your original payment method shortly.",
];

export function AdminSupportPage() {
  const { user } = useSessionUser();
  const { data: settings } = useQuery(settingsQuery);
  const qc = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "resolved">("open");
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Query conversations
  const { data: conversations = [], refetch: refetchConvs } = useQuery<Conversation[]>({
    queryKey: ["admin", "support-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations" as any)
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) return [];
      return (data as any) || [];
    },
    refetchInterval: 4000,
  });

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.customer_name?.toLowerCase().includes(q) ||
        c.customer_phone?.includes(q)
      );
    }
    return true;
  });

  // Default select first conversation if none selected
  useEffect(() => {
    if (!activeConvId && filteredConversations.length > 0) {
      setActiveConvId(filteredConversations[0]?.id ?? null);
    }
  }, [filteredConversations, activeConvId]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Query messages for active conversation
  const { data: activeMessages = [] } = useQuery<Message[]>({
    queryKey: ["admin", "support-messages", activeConvId],
    queryFn: async () => {
      if (!activeConvId) return [];
      const { data, error } = await supabase
        .from("support_messages" as any)
        .select("*")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });

      if (error) return [];
      return (data as any) || [];
    },
    enabled: Boolean(activeConvId),
    refetchInterval: 3000,
  });

  // Scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  // Reply mutation
  const sendReply = useMutation({
    mutationFn: async (text: string) => {
      if (!activeConvId || !text.trim()) return;

      const staffName =
        (user?.user_metadata?.["full_name"] as string) || (user?.email?.split("@")[0]) || "Store Staff";

      const { error } = await supabase.from("support_messages" as any).insert({
        conversation_id: activeConvId,
        sender_type: "staff",
        sender_id: user?.id || null,
        sender_name: staffName,
        message: text.trim(),
      } as any);

      if (error) throw error;

      // Update conversation status to in_progress & last_message_at
      await supabase
        .from("support_conversations" as any)
        .update({
          last_message_at: new Date().toISOString(),
          status: activeConv?.status === "open" ? "in_progress" : activeConv?.status,
        } as any)
        .eq("id", activeConvId);
    },
    onSuccess: () => {
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["admin", "support-messages", activeConvId] });
      qc.invalidateQueries({ queryKey: ["admin", "support-conversations"] });
    },
    onError: () => toast.error("Failed to send message"),
  });

  // Update conversation status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "in_progress" | "resolved" }) => {
      const { error } = await supabase
        .from("support_conversations" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Conversation marked ${variables.status}`);
      qc.invalidateQueries({ queryKey: ["admin", "support-conversations"] });
    },
    onError: () => toast.error("Could not update status"),
  });

  const openCount = conversations.filter((c) => c.status === "open").length;

  return (
    <AdminShell title="Live Customer Support Desk" allow={["admin", "staff"]}>
      {/* Top Banner / Stats */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Real-Time Customer Messaging Desk</h2>
            <p className="text-xs text-muted-foreground">
              Reply to live customer inquiries, order delivery questions, and fish cut customization requests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {openCount} Open Questions
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchConvs()}
            className="rounded-xl h-8 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Main Split Console Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[720px] max-h-[82vh]">
        {/* Left Column: Conversations List */}
        <div className="rounded-2xl border border-border/80 bg-card flex flex-col overflow-hidden shadow-sm">
          {/* Filter Bar */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers by name or phone..."
                className="rounded-xl pl-8 h-8 text-xs bg-muted/30"
              />
            </div>

            <div className="flex items-center gap-1">
              {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filter === s ? "default" : "ghost"}
                  className="rounded-lg h-7 text-[11px] font-semibold capitalize flex-1"
                  onClick={() => setFilter(s)}
                >
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>

          {/* List of Conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {filteredConversations.map((c) => {
              const isSelected = c.id === activeConvId;
              const dateStr = new Date(c.last_message_at || c.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-l-primary"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground truncate">
                      {c.customer_name || "Shopper"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                    <span>{c.customer_phone || "-"}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-extrabold uppercase py-0 px-1.5 ${
                        c.status === "open"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : c.status === "in_progress"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              );
            })}

            {filteredConversations.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No conversations found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Messages & Reply Box */}
        <div className="md:col-span-2 rounded-2xl border border-border/80 bg-card flex flex-col overflow-hidden shadow-sm">
          {activeConv ? (
            <>
              {/* Conversation Header */}
              <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                    <User className="size-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      {activeConv.customer_name || "Shopper"}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>Phone: {activeConv.customer_phone || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp Speed Link */}
                  {activeConv.customer_phone && activeConv.customer_phone.replace(/\D/g, "").length >= 10 && (
                    <a
                      href={`https://wa.me/${activeConv.customer_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center gap-1"
                    >
                      <WhatsAppIcon className="size-3.5" /> WhatsApp
                    </a>
                  )}

                  {/* Phone Call Link */}
                  {activeConv.customer_phone && (
                    <a
                      href={`tel:${activeConv.customer_phone}`}
                      className="rounded-xl border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted/40 transition flex items-center gap-1"
                    >
                      <Phone className="size-3" /> Call
                    </a>
                  )}

                  {/* Status Toggle */}
                  {activeConv.status !== "resolved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: activeConv.id, status: "resolved" })}
                      className="rounded-xl h-7 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <CheckCircle2 className="size-3.5 mr-1" /> Mark Resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: activeConv.id, status: "open" })}
                      className="rounded-xl h-7 text-xs font-semibold"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10 text-xs">
                {activeMessages.map((m) => {
                  const isStaff = m.sender_type === "staff" || m.sender_type === "admin";
                  const isBot = m.sender_type === "bot";

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
                        {isStaff
                          ? `You (${m.sender_name})`
                          : isBot
                          ? "Automated Assistant"
                          : `${m.sender_name} (Customer)`}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isStaff
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : isBot
                            ? "bg-sky-500/10 text-sky-950 dark:text-sky-100 border border-sky-500/20 rounded-tl-xs"
                            : "bg-card text-foreground border border-border/80 shadow-2xs rounded-tl-xs"
                        }`}
                      >
                        {m.message}
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned Quick Responses */}
              <div className="px-3 pt-2 border-t border-border/60 bg-muted/20">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                    <Zap className="size-3 inline mr-0.5 text-amber-500" /> Canned:
                  </span>
                  {CANNED_RESPONSES.map((resp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReplyText(resp)}
                      className="rounded-lg border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 whitespace-nowrap transition"
                    >
                      {resp.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyText.trim()) sendReply.mutate(replyText);
                }}
                className="p-3 border-t border-border flex items-center gap-2 bg-background"
              >
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a response to the customer..."
                  className="rounded-xl h-10 text-xs bg-muted/30"
                />
                <Button
                  type="submit"
                  disabled={!replyText.trim() || sendReply.isPending}
                  className="rounded-xl h-10 px-4 font-semibold text-xs gap-1"
                >
                  <Send className="size-3.5" /> Reply
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="size-10 mb-2 text-primary/30" />
              <p className="font-semibold text-foreground">No conversation selected</p>
              <p className="text-xs">Select a customer from the left list to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
export default AdminSupportPage;
