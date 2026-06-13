"use client";

import { useChat } from "@ai-sdk/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Message } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { SendIcon, Loader2, Bot, User, Sparkles } from "lucide-react";

export function AiChatInterface() {
  const t = useTranslations("aiChat");
  const locale = useLocale();
  const chatHelpers = useChat({
    api: `/${locale}/api/chat`,
    maxSteps: 5,
  });
  const { messages, sendMessage, status, stop } = chatHelpers;
  
  const [input, setInput] = useState("");
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // In V4, we might use append or sendMessage. append is standard.
    // If append doesn't exist, we fallback to sending the message directly.
    // We can access the returned object to invoke the correct method.
    if (sendMessage) {
      sendMessage({ role: 'user', content: input });
    }
    
    setInput("");
  };
  
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] w-full max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto shadow-md border-border/50">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">{t("aiChatTitle")}</CardTitle>
            <CardDescription className="text-sm mt-1">{t("aiChatDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground p-8">
            <Bot className="w-16 h-16 opacity-20" />
            <p className="max-w-sm">{t("aiChatEmptyState")}</p>
          </div>
        ) : (
          messages.map((m: Message) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-[85%] ${
                m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                }`}
              >
                {m.parts && m.parts.length > 0 ? (
                  m.parts.map((part: any, index: number) => {
                    if (part.type === 'text') {
                      return <div key={index} className="whitespace-pre-wrap">{part.text}</div>;
                    }
                    if (part.type.startsWith('tool-') && part.state !== 'result') {
                       return (
                         <div key={index} className="flex items-center gap-2 text-muted-foreground italic">
                           <Loader2 className="w-3 h-3 animate-spin" />
                           <span className="text-xs font-medium opacity-80">Working on it...</span>
                         </div>
                       );
                    }
                    return null;
                  })
                ) : m.content ? (
                   <div className="whitespace-pre-wrap">{m.content}</div>
                ) : (
                   m.toolInvocations ? (
                     <div className="flex items-center gap-2 text-muted-foreground italic">
                       <Loader2 className="w-3 h-3 animate-spin" />
                       <span className="text-xs font-medium opacity-80">Working on it...</span>
                     </div>
                   ) : null
                )}
              </div>
            </div>
          ))
        )}

        
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground rounded-tl-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>

      <CardFooter className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={t("aiChatInputPlaceholder")}
            disabled={isLoading}
            className="flex-1 rounded-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input?.trim()} 
            size="icon" 
            className="rounded-full flex-shrink-0 w-10 h-10 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendIcon className="w-4 h-4 ml-0.5" />
            )}
            <span className="sr-only">{t("aiChatSend")}</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
