
// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { Message } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  SendIcon,
  Loader2,
  User,
  Sparkles,
  Zap,
  Users,
  Package,
  CreditCard,
  BarChart2,
  PlusCircle,
  ShoppingBag,
  StopCircle,
  Pin,
  Search,
} from "lucide-react";

// Removed global QUICK_ACTIONS

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMessageText(m: Message): string {
  if (m.parts && m.parts.length > 0) {
    const txt = (m.parts as any[])
      .filter((p) => p.type === "text" && p.text?.trim())
      .map((p) => p.text)
      .join("");
    if (txt) return txt;
  }
  if (m.content && String(m.content).trim()) return String(m.content);
  return "";
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatInline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

// Detects a GitHub-flavored Markdown pipe table (header row + '|---|---|'
// separator row) at the start of a text block and renders it as a real
// <table>, since the model is instructed to return list-style data this way.
function renderMarkdownTable(block: string): string | null {
  const lines = block.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;

  const splitRow = (line: string) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const isSeparatorRow = (line: string) =>
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

  if (!lines[0].includes("|") || !isSeparatorRow(lines[1])) return null;

  const headers = splitRow(lines[0]);
  const rows = lines.slice(2).filter((l) => l.includes("|")).map(splitRow);
  if (rows.length === 0) return null;

  const thead = `<thead><tr>${headers
    .map((h) => `<th class="px-3 py-1.5 text-left font-semibold border-b border-border/60 bg-background/60 whitespace-nowrap">${formatInline(h)}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${rows
    .map(
      (r) =>
        `<tr class="even:bg-background/40">${r
          .map((c) => `<td class="px-3 py-1.5 border-b border-border/30">${formatInline(c)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody>`;

  return `<div class="overflow-x-auto my-1.5 rounded-lg border border-border/50" style="white-space:normal"><table class="w-full text-xs border-collapse">${thead}${tbody}</table></div>`;
}

function renderHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => renderMarkdownTable(block) ?? formatInline(block))
    .join("\n\n");
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AiChatInterface() {
  const locale = useLocale();
  const t = useTranslations('aiChat');
  const router = useRouter();

  const QUICK_ACTIONS = [
    {
      icon: Users,
      label: t('quickActions.allCustomers.label'),
      message: t('quickActions.allCustomers.message'),
      color: "text-blue-500",
      bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
    },
    {
      icon: Package,
      label: t('quickActions.allProducts.label'),
      message: t('quickActions.allProducts.message'),
      color: "text-orange-500",
      bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
    },
    {
      icon: BarChart2,
      label: t('quickActions.totalCustomers.label'),
      message: t('quickActions.totalCustomers.message'),
      color: "text-pink-500",
      bg: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20",
    },
    {
      icon: ShoppingBag,
      label: t('quickActions.totalProducts.label'),
      message: t('quickActions.totalProducts.message'),
      color: "text-purple-500",
      bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
    },
    {
      icon: CreditCard,
      label: t('quickActions.recentTransactions.label'),
      message: t('quickActions.recentTransactions.message'),
      color: "text-green-500",
      bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/20",
    },
    {
      icon: Search,
      label: t('quickActions.searchCustomer.label'),
      message: t('quickActions.searchCustomer.message'),
      color: "text-indigo-500",
      bg: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20",
    },
    {
      icon: Package,
      label: t('quickActions.bestSellers.label'),
      message: t('quickActions.bestSellers.message'),
      color: "text-blue-500",
      bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
    },
    {
      icon: BarChart2,
      label: t('quickActions.todaySales.label'),
      message: t('quickActions.todaySales.message'),
      color: "text-green-500",
      bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/20",
    },
    {
      icon: ShoppingBag,
      label: t('quickActions.lowStock.label'),
      message: t('quickActions.lowStock.message'),
      color: "text-orange-500",
      bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
    },
    {
      icon: CreditCard,
      label: t('quickActions.pendingPayments.label'),
      message: t('quickActions.pendingPayments.message'),
      color: "text-red-500",
      bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20",
    },
    {
      icon: Users,
      label: t('quickActions.manageShop.label'),
      message: t('quickActions.manageShop.message'),
      color: "text-indigo-500",
      bg: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20",
    },
    {
      icon: Sparkles,
      label: t('quickActions.salesSummary.label'),
      message: t('quickActions.salesSummary.message'),
      color: "text-purple-500",
      bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
    },
  ];

  const chatHelpers = useChat({
    api: `/${locale}/api/chat`,
    onFinish: () => {
      import("@/lib/sync/sync-engine").then(({ SyncEngine }) => {
        SyncEngine.pullInitialData().catch(console.error);
        
        // Refresh the Next.js page so data changes (like product updates) show up instantly
        router.refresh();
      });
    },
  }) as any;

  const { messages, status, stop, error, sendMessage } = chatHelpers;

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // NOTE: Backend now runs tool-call + final-text generation in a single
  // request (stopWhen: stepCountIs(5) in the API route), so no client-side
  // "hidden continue" hack is needed anymore. Removing it also fixes the
  // loader/stop-button state getting stuck.

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      sendMessage({ role: "user", parts: [{ type: "text", text }] });
      setInput("");
    },
    [sendMessage, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendText(input);
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] w-full max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto shadow-md border-border/50 overflow-hidden">
      {/* ── Header ── */}
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-3 pt-4 px-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="bg-primary/15 p-2.5 rounded-xl ring-2 ring-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-background" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-1.5">
              {t('title')}
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {t('beta')}
              </span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 text-muted-foreground/80">
              {t('subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* ── Messages ── */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-background min-h-0">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex flex-col items-center justify-start h-full pt-6 pb-4 space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-background">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-foreground">
                {t('welcomeTitle')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('welcomeSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Sparkles className="w-3 h-3" />
              {t('scopeNotice')}
            </div>

            <div className="w-full max-w-xl space-y-3">
              <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">
                {t('quickActionsTitle')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.slice(0, 4).map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendText(action.message)}
                      disabled={isLoading}
                      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${action.bg}`}
                    >
                      <span className={`flex-shrink-0 ${action.color}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-foreground/80">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <>
            {/* Guaranteed Welcome Message */}
            <div className="flex gap-2.5 mr-auto max-w-[85%] z-20">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-muted text-foreground rounded-tl-sm shadow-sm border border-border/50">
                <div className="flex items-center gap-1.5 mb-2 text-amber-600 font-medium text-xs uppercase tracking-wider">
                  <Pin className="w-3 h-3 fill-current" /> {t('pinnedMessage')}
                </div>
                <div className="whitespace-pre-wrap">{t('welcomeMessage')}</div>
              </div>
            </div>

            {messages.map((m: Message) => {
              const text = getMessageText(m);
              const hasTools =
                m.toolInvocations && m.toolInvocations.length > 0;

              // Skip empty assistant messages and the welcome message
              if (m.id === 'welcome') return null;
              if (m.role === "assistant" && !text && !hasTools) return null;

              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${
                    m.id === 'welcome' ? 'sticky top-4 z-20 w-[95%] mx-auto backdrop-blur-md bg-background/95 p-2 rounded-xl shadow-sm border border-border/50' :
                    m.role === "user"
                      ? "ml-auto flex-row-reverse max-w-[80%]"
                      : "mr-auto max-w-[85%]"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.role === "user" ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    {m.id === 'welcome' && (
                      <div className="flex items-center gap-1.5 mb-2 text-amber-600 font-medium text-xs uppercase tracking-wider">
                        <Pin className="w-3 h-3 fill-current" /> {t('pinnedMessage')}
                      </div>
                    )}
                    {/* Text */}
                    {text && (
                      <div className="whitespace-pre-wrap">
                        <span dangerouslySetInnerHTML={{ __html: renderHtml(text) }} />
                        {isLoading && m.id === messages[messages.length - 1]?.id && (
                          <span className="inline-flex items-center gap-1 ml-2 align-middle">
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tool status */}
                    {hasTools && (
                      <div className={`space-y-1 ${text ? "mt-2" : ""}`}>
                        {(m.toolInvocations as any[]).map((t, idx) =>
                          t.state !== "result" ? (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 text-muted-foreground"
                            >
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="text-xs italic opacity-80">
                                {t('working')}
                              </span>
                            </div>
                          ) : !text ? (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 text-green-600"
                            >
                              <Zap className="w-3 h-3" />
                              <span className="text-xs font-medium">
                                {t('done')}
                              </span>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Error bubble */}
            {error && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-red-100 text-red-600">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 text-sm bg-red-50 text-red-600 rounded-tl-sm border border-red-200">
                  <p className="font-semibold mb-0.5">{t('errorTitle')}</p>
                  <p className="text-xs opacity-80">
                    {error.message ||
                      t('errorMessage')}
                  </p>
                </div>
              </div>
            )}

            {/* Typing indicator — stays visible until the assistant's
                actual text content arrives (not just when a message
                object appears), so it correctly spans tool-call time too */}
            {isLoading &&
              messages.length > 0 &&
              (messages[messages.length - 1].role === "user" ||
                (messages[messages.length - 1].role === "assistant" &&
                  !getMessageText(messages[messages.length - 1]))) && (
                <div className="flex gap-2.5 max-w-[85%] mr-auto">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-muted rounded-tl-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                    <span
                      className="w-2 h-2 rounded-full bg-primary/65 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary/80 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
          </>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* ── Footer ── */}
      <CardFooter className="p-3 border-t bg-background/80 backdrop-blur-sm flex-col gap-2 flex-shrink-0">
        {/* Compact chips when chatting */}
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 w-full scrollbar-hide">
            {QUICK_ACTIONS.slice(0, 4).map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendText(action.message)}
                  disabled={isLoading}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all disabled:opacity-50 ${action.bg}`}
                >
                  <Icon className={`w-3 h-3 ${action.color}`} />
                  <span className="text-foreground/75 whitespace-nowrap">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('placeholder')}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText(input);
              }
            }}
            className="flex-1 rounded-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background text-sm"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={stop}
              size="icon"
              variant="outline"
              className="rounded-full flex-shrink-0 w-9 h-9 border-red-300 text-red-500 hover:bg-red-50"
              title="Stop"
            >
              <StopCircle className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input?.trim()}
              size="icon"
              className="rounded-full flex-shrink-0 w-9 h-9 shadow-sm"
            >
              <SendIcon className="w-4 h-4 ml-0.5" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </form>
      </CardFooter>
    </Card>
  );
}