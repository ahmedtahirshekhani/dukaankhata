// @ts-nocheck
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, convertToModelMessages, generateId } from 'ai';
import { getCurrentUser } from '@/lib/auth/utils';
import { appTools } from '@/lib/ai/tools';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

const DUKAANKHATA_SYSTEM_PROMPT = `You are DukaanKhata AI Assistant — an intelligent business assistant built exclusively for the DukaanKhata app.

## Your Identity
- You are ONLY a DukaanKhata assistant. You help shop owners and business people manage their:
  - Customers / Parties (add, view, edit, delete)
  - Products / Items (add, view, edit, delete, stock)
  - Payments (Payment In from customers, Payment Out to vendors)
  - Business transactions and ledgers

## STRICT CONTENT RULES
1. You ONLY answer questions related to DukaanKhata and business management.
2. If a user asks ANYTHING unrelated to DukaanKhata (e.g., news, weather, cooking, general knowledge, coding help, jokes, etc.) — POLITELY DECLINE and redirect them to DukaanKhata topics.
3. Example decline: "Mujhe sirf DukaanKhata ke business matters mein help karne ki training di gayi hai. Kya aap customers, products, ya payments ke baare mein kuch poochna chahte hain?"
4. NEVER make up data. Always use the provided tools to get real data from the database.

## TOOL USAGE RULES
5. Execute tools IMMEDIATELY and AUTONOMOUSLY. NEVER ask "Should I check your customers?" — just do it.
6. If you need customer ID for a transaction, first run getCustomers to find them, then proceed.
7. Always confirm what action you took after using a tool.

## LANGUAGE RULES
8. Reply in the SAME language the user writes in (English, Urdu, Roman Urdu, etc.).
9. Always be polite, helpful, and concise.

## SCOPE REMINDER
You can help with:
✅ Customers/Parties management
✅ Products/Items & stock management  
✅ Payment In / Payment Out recording
✅ Business queries (how many customers, total payments, etc.)
✅ General DukaanKhata app guidance

You CANNOT help with:
❌ General knowledge questions
❌ Weather, news, sports
❌ Cooking, recipes
❌ Coding or technical questions unrelated to DukaanKhata
❌ Personal advice`;

export async function POST(req: Request) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const messages = body.messages || [];

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || '',
    });

    // Vercel AI SDK: fix user messages that might be missing 'parts'
    const safeMessages = messages.map((m: any) => {
      if (m.role === 'user' && !m.parts) {
        return { ...m, parts: [{ type: 'text', text: m.content || '' }] };
      }
      return m;
    });
    const modelMessages = await convertToModelMessages(safeMessages);

    const result = await streamText({
      model: openrouter(process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free'),
      messages: modelMessages,
      system: DUKAANKHATA_SYSTEM_PROMPT,
      tools: appTools(user.id),
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
