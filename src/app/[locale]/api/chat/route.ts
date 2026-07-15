
// @ts-nocheck
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, convertToModelMessages, generateId, stepCountIs } from 'ai';
import { getCurrentUser } from '@/lib/auth/utils';
import { appTools } from '@/lib/ai/tools';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

// Maps the app's URL locale segment (src/messages/*.json) to the language
// the assistant must reply in — driven by the app's selected language
// rather than guessed from the user's message.
const LOCALE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ur: 'Urdu (Urdu script)',
  ru: 'Roman Urdu (Urdu written in English/Latin script)',
};

const getSystemPrompt = (locale: string) => {
  const languageName = LOCALE_LANGUAGE_NAMES[locale] || LOCALE_LANGUAGE_NAMES.en;

  return `You are DukaanKhata AI Assistant — an intelligent business assistant built exclusively for the DukaanKhata app.

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
7. Always confirm what action you took after using a tool. Show the user what was created/updated/deleted with all the details.

## CUSTOMER / PARTY FIELDS — VERY IMPORTANT DISTINCTION
There are TWO separate company-related fields. NEVER confuse them:

| Field | Meaning | When to use |
|-------|---------|-------------|
| **company_name** | The NAME of the company/business (e.g. "ATF", "Ali Traders") | "company ka naam ATF hai", "dukaan ka naam XYZ" |
| **company_address** | The physical LOCATION/ADDRESS (e.g. "Lahore", "Shop 5, Main Bazar") | "address Lahore hai", "ghar ka pata..." |

When creating or updating a customer, ALWAYS extract ALL fields the user mentioned:
- **name** (REQUIRED): Party ka naam — e.g. "Shoaib Raza"
- **phone** (optional): Phone number — agar "phone nahi" kaha to skip karo
- **company_name** (optional): Company ka NAAM — e.g. "ATF", "ABC Traders"
- **company_address** (optional): Company ka ADDRESS/LOCATION
- **opening_balance** (optional): Opening balance — number extract karo

EXAMPLE: "Shoaib Raza ki company ka naam ATF karo"
→ Run getCustomers to find Shoaib Raza's ID, then call updateCustomer with company_name="ATF"

EXAMPLE: "Party ka naam Shoaib Raza, company ATF, phone nahi, balance 100"
→ createCustomer with name="Shoaib Raza", company_name="ATF", opening_balance=100

After creating/updating, ALWAYS confirm with a clear summary:
"✅ Party update ho gayi!
- Naam: Shoaib Raza
- Company: ATF
- Opening Balance: Rs. 100"

## TRANSACTION / PAYMENT RULES
- The 'getCustomerTransactions' and 'createCustomerTransaction' tools handle BOTH Payment In and Payment Out. In DukaanKhata, "Customers", "Parties", and "Vendors" are all accessed via these same tools.
- NEVER say that data for vendors or payment out is not available or handled by another app. Always use the provided tools.
- If a tool returns no data (e.g., 0 transactions), simply state that there are no records. DO NOT hallucinate or mention other software.

## TABLE FORMATTING — STRICT
- Whenever a tool result contains MULTIPLE records (e.g. a list of customers, products, transactions, orders), present them as a GitHub-flavored Markdown pipe table — NOT a bullet list, NOT plain sentences.
- Table format: a header row, then a separator row of dashes ('|---|---|'), then one row per record. Example:
  | Naam | Phone | Balance |
  |---|---|---|
  | Ali Traders | 0300-1234567 | Rs. 500 |
- Keep columns to the fields the user actually asked about (don't dump every field). Only single-record answers (e.g. "get customer by id") should be plain text.

## ACCOUNT STATEMENT FORMATTING — STRICT
- When displaying an Account Statement, the table MUST have separate columns for "Debit (DR)" and "Credit (CR)". DO NOT combine them into a single Amount column with "(DR)/(CR)" suffixes.
- Example Table Columns: | Date | Transaction | Items | Debit (DR) | Credit (CR) | Balance |
- At the end of the statement, ALWAYS provide a summary that includes: Total Debit, Total Credit, and Closing Balance for that period.

## LANGUAGE RULES — STRICT
8. The app's currently selected language is **${languageName}**. You MUST respond ONLY in ${languageName}, regardless of the language the user typed their message in.
9. NEVER respond in Hindi, Russian, or any language other than ${languageName}. NEVER use foreign scripts or gibberish.
10. If you cannot express something naturally in ${languageName}, keep numbers/product names as-is but write all surrounding text in ${languageName}.
11. Do not switch language based on the user's message — always stay in ${languageName} since that is the language selected in the app.
12. Always be polite, helpful, and concise. Do NOT hallucinate weird words.

## SCOPE REMINDER
You can help with:
✅ Customers/Parties management
✅ Products/Items & stock management  
✅ Payment In / Payment Out recording
✅ Business queries (how many customers, total payments, etc.)
✅ General DukaanKhata app guidance

## CURRENCY FORMATTING — STRICT
13. **ALWAYS format currency values in Pakistani Rupee (PKR).**
14. ALWAYS prefix amounts with "PKR" or "Rs." (e.g., "PKR 500" or "Rs. 500").
15. **NEVER use Indian Rupee (₹), Dollar ($), Euro (€), or any other foreign currency symbol.** This is a strict requirement for a Pakistani application.
You CANNOT help with:
❌ General knowledge questions
❌ Weather, news, sports
❌ Cooking, recipes
❌ Coding or technical questions unrelated to DukaanKhata
❌ Personal advice`;
};

// How many of the most recent model messages to keep. Older messages are
// dropped entirely so the conversation doesn't grow unbounded turn over turn.
const MAX_HISTORY_MESSAGES = 20;

// Tool results can be large (full customer/product/order lists). Only the
// most recent N tool-result messages are kept in full; older ones are
// replaced with a placeholder so they stop being re-billed as context on
// every subsequent turn.
const MAX_FULL_TOOL_RESULTS = 2;

// Trims the message history sent to the model: caps total message count and
// collapses stale tool-result payloads, since the client resends the full
// conversation (including raw tool outputs) on every turn.
function trimMessageHistory(allMessages: any[]) {
  let trimmed =
    allMessages.length > MAX_HISTORY_MESSAGES
      ? allMessages.slice(-MAX_HISTORY_MESSAGES)
      : allMessages;

  // A leading 'tool' message means its matching assistant tool-call message
  // got sliced off above — drop the orphan so role ordering stays valid.
  while (trimmed.length > 0 && trimmed[0].role === 'tool') {
    trimmed = trimmed.slice(1);
  }

  const toolMessageIndices = trimmed
    .map((m, i) => (m.role === 'tool' ? i : -1))
    .filter((i) => i !== -1);
  const keepFullIndices = new Set(toolMessageIndices.slice(-MAX_FULL_TOOL_RESULTS));

  return trimmed.map((m, i) => {
    if (m.role !== 'tool' || keepFullIndices.has(i) || !Array.isArray(m.content)) {
      return m;
    }
    return {
      ...m,
      content: m.content.map((part: any) =>
        part.type === 'tool-result'
          ? {
              ...part,
              output: {
                type: 'text',
                value:
                  '[Older tool result omitted to stay within context limits — re-run the tool if this data is needed again.]',
              },
            }
          : part
      ),
    };
  });
}

export async function POST(req: Request, { params }: { params: { locale: string } }) {
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

    // Fix messages that might be missing 'parts'
    const safeMessages = messages.map((m: any) => {
      if (m.role === 'user' && !m.parts) {
        return { ...m, parts: [{ type: 'text', text: m.content || '' }] };
      }
      return m;
    });
    const modelMessages = trimMessageHistory(await convertToModelMessages(safeMessages));

    const result = streamText({
      model: openrouter(process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free'),
      messages: modelMessages,
      system: getSystemPrompt(params.locale),
      tools: appTools(user.id),
      // Allow the model to call a tool AND generate the final text reply
      // within the SAME stream/request (up to 5 steps), so the frontend
      // never needs a "hidden continue" hack to get a first-attempt answer.
      stopWhen: stepCountIs(5),
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