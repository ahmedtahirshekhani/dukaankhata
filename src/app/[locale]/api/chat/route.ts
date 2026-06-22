// @ts-nocheck
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, generateId } from 'ai';
import { getCurrentUser } from '@/lib/auth/utils';
import { appTools } from '@/lib/ai/tools';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log("INCOMING PAYLOAD:", JSON.stringify(body, null, 2));
    const messages = body.messages || [];

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });

    // Vercel AI SDK 6.x convertToModelMessages crashes if 'parts' is missing on user messages.
    // We strictly fix user messages and leave assistant/tool messages intact to preserve tool invocation history:
    const safeMessages = messages.map((m: any) => {
      if (m.role === 'user' && !m.parts) {
        return { ...m, parts: [{ type: 'text', text: m.content || '' }] };
      }
      return m;
    });
    const modelMessages = await convertToModelMessages(safeMessages);

    const result = await streamText({
      model: google(process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
      messages: modelMessages,
      system: `You are DukaanKhata AI Assistant. You help shop owners manage their customers, transactions, and products. 
You can understand and speak any language the user speaks (including Roman Urdu, English, Urdu, etc.). Always reply in the same language the user uses.
You have tools to get, create, update, and delete customers, tools to get, create, and delete customer transactions (payments), and tools to get, create, update, and delete products (goods/services).
CRITICAL RULE: DO NOT ASK FOR PERMISSION BEFORE USING TOOLS. If you need data to answer the user's question, execute the appropriate tool IMMEDIATELY and autonomously. Never ask "Should I check your customers?" or "Do you want me to use a tool?". Just do it and give the final answer.
If a user asks for transactions of a specific customer, use getCustomers to find their ID/Name first if needed, then use getCustomerTransactions. Do not make up data.
Always be polite and keep answers concise.`,
      tools: appTools(user.id),
      // maxSteps: 5,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
