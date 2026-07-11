// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useRef, useState, useCallback } from "react";
import { Message } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { SendIcon, Loader2, Bot, User, Sparkles, Zap, Users, Package, CreditCard, BarChart2, PlusCircle, ShoppingBag } from "lucide-react";

// ─── Quick action chips shown on welcome screen ───────────────────────────────
const QUICK_ACTIONS = [
  {
    icon: Users,
    label: "Mere sab customers",
    message: "Mere sab customers/parties ki list dikhao",
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
  },
  {
    icon: CreditCard,
    label: "Payment In record karo",
    message: "Mujhe payment in record karne mein help karo",
    color: "text-green-500",
    bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/20",
  },
  {
    icon: Package,
    label: "Products ki list",
    message: "Mere sab products/items ki list do aur unki quantity bhi batao",
    color: "text-orange-500",
    bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
  },
  {
    icon: PlusCircle,
    label: "Naya customer banao",
    message: "Mujhe naya customer/party banane mein help karo",
    color: "text-purple-500",
    bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
  },
  {
    icon: BarChart2,
    label: "Total customers count",
    message: "Mere kitne total customers/parties hain? Summary batao",
    color: "text-pink-500",
    bg: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20",
  },
  {
    icon: ShoppingBag,
    label: "Payment Out record karo",
    message: "Mujhe payment out (vendor ko payment) record karne mein help karo",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20",
  },
];

export function AiChatInterface() {
  const t = useTranslations("aiChat");
  const locale = useLocale();
  const chatHelpers = useChat({
    api: `/${locale}/api/chat`,
    maxSteps: 5,
  });
  const { messages, sendMessage, status, stop, error, append } = chatHelpers as any;

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageText(input);
  };

  const sendMessageText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (append) {
        append({ role: "user", content: text });
      } else if (sendMessage) {
        sendMessage({ role: "user", content: text });
      }
      setInput("");
    },
    [append, sendMessage]
  );

  const handleQuickAction = (message: string) => {
    sendMessageText(message);
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] w-full max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto shadow-md border-border/50 overflow-hidden">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
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
              DukaanKhata AI
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Beta
              </span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 text-muted-foreground/80">
              Business Assistant · Sirf DukaanKhata ke liye
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* ─── Messages Area ──────────────────────────────────────────────────── */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-background min-h-0">
        {messages.length === 0 ? (
          /* ── Welcome Screen ──────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-start h-full pt-6 pb-4 space-y-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-background">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-foreground">
                Aapka DukaanKhata AI Assistant
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Main aapke business ko manage karne mein help karta hoon — customers, products, payments, aur bhi bahut kuch. Kuch bhi poochein!
              </p>
            </div>

            {/* Scope Badge */}
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Sparkles className="w-3 h-3" />
              Sirf DukaanKhata ke business matters ka jawab deta hoon
            </div>

            {/* Quick Actions Grid */}
            <div className="w-full max-w-xl space-y-3">
              <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">
                Quick Actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleQuickAction(action.message)}
                      disabled={isLoading}
                      className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${action.bg}`}
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
          /* ── Chat Messages ───────────────────────────────────────────── */
          <>
            {messages.map((m: Message) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === "user" ? "ml-auto flex-row-reverse max-w-[80%]" : "mr-auto max-w-[85%]"}`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-gradient-to-br from-primary/80 to-primary text-white"
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
                  {/* Text content */}
                  {m.parts && m.parts.length > 0 ? (
                    <>
                      {m.parts.map((part: any, index: number) => {
                        if (part.type === "text") {
                          return (
                            <div
                              key={index}
                              className="whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{
                                __html: part.text
                                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                                  .replace(/^• /gm, "&#x2022; ")
                                  .replace(/^- /gm, "&#x2022; "),
                              }}
                            />
                          );
                        }
                        return null;
                      })}
                      {/* Tool invocations */}
                      {m.toolInvocations && m.toolInvocations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.toolInvocations.map((t: any, index: number) =>
                            t.state !== "result" ? (
                              <div key={`tool-${index}`} className="flex items-center gap-1.5 text-muted-foreground italic">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="text-xs opacity-80">Kaam kar raha hoon...</span>
                              </div>
                            ) : (
                              <div key={`tool-${index}`} className="flex items-center gap-1.5 text-muted-foreground italic opacity-60">
                                <Zap className="w-3 h-3 text-green-500" />
                                <span className="text-xs">Action complete</span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </>
                  ) : m.content ? (
                    <div
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: String(m.content)
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\*(.*?)\*/g, "<em>$1</em>"),
                      }}
                    />
                  ) : m.toolInvocations ? (
                    m.toolInvocations.some((t) => t.state !== "result") ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground italic">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-xs opacity-80">Kaam kar raha hoon...</span>
                      </div>
                    ) : null
                  ) : null}
                </div>
              </div>
            ))}

            {/* Error */}
            {error && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-red-100 text-red-600">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 text-sm bg-red-50 text-red-600 rounded-tl-sm border border-red-200">
                  <p className="font-semibold mb-1">Koi masla hua</p>
                  <p className="text-xs">{error.message || "Kuch ghalat ho gaya. Dobara try karein."}</p>
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div className="flex gap-2.5 max-w-[85%] mr-auto">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/80 to-primary text-white">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-muted rounded-tl-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-primary/65 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
          </>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <CardFooter className="p-3 border-t bg-background/80 backdrop-blur-sm flex-col gap-2 flex-shrink-0">
        {/* Compact Quick Chips (visible when there are messages) */}
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 w-full scrollbar-hide">
            {QUICK_ACTIONS.slice(0, 4).map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.message)}
                  disabled={isLoading}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 disabled:opacity-50 ${action.bg}`}
                >
                  <Icon className={`w-3 h-3 ${action.color}`} />
                  <span className="text-foreground/75 whitespace-nowrap">{action.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Kuch bhi puchein DukaanKhata ke baare mein..."
            disabled={isLoading}
            className="flex-1 rounded-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background text-sm"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={stop}
              size="icon"
              variant="outline"
              className="rounded-full flex-shrink-0 w-9 h-9 border-red-300 text-red-500 hover:bg-red-50"
            >
              <span className="w-3 h-3 bg-red-500 rounded-sm" />
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
