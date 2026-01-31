// Groq AI Service - Natural Language Processing
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqService {
    constructor() {
        this.model = 'llama-3.3-70b-versatile';
        this.systemPrompt = `You are ClawCrypt AI, a Solana wallet intelligence assistant. Parse user queries and return structured JSON.

CRITICAL: Solana addresses are 32-44 character alphanumeric strings. ALWAYS extract them!
- Pump.fun tokens often end with "pump" (like "49cUiboRziVxKh9qhUiNbWgCQxZgoTCKrktoRvLmpump")

QUERY TYPES & COMMANDS:

1. WALLET ANALYSIS (needs wallet address):
   - "analyze/track/check wallet" → GET_WALLET_PROFILE
   - "transactions/history/activity" → GET_TRANSACTIONS  
   - "classify/what type/is this a whale" → CLASSIFY_WALLET
   - "explain/summarize" → EXPLAIN_WALLET

2. WALLET PNL & PERFORMANCE (needs wallet address):
   - "profit/pnl/how much made/gains" → GET_WALLET_PNL
   - "winrate/win rate/success rate" → GET_WALLET_WINRATE
   - "best trade/biggest profit" → GET_BEST_TRADE
   - "ROI/returns" → GET_WALLET_PNL
   - "last 30 days/30d/monthly pnl" → GET_WALLET_PNL_30D
   - "last 7 days/7d/weekly pnl" → GET_WALLET_PNL_7D

3. COPY TRADE SIMULATION (needs wallet address + optional investment amount):
   - "copy trade/what if I copied/simulate copying" → SIMULATE_COPY_TRADE
   - "if I invested X SOL copying them" → SIMULATE_COPY_TRADE with amount
   - "copy traded with 1 sol/5 sol/etc" → SIMULATE_COPY_TRADE
   - Extract investment amount if mentioned (default 1 SOL)
   - Extract days if mentioned (default 30 days)

4. TOKEN ANALYSIS (needs token mint address):
   - "top holders/biggest holders/whales" → GET_TOP_HOLDERS
   - "best trader/most profitable/highest profit in this coin" → GET_TOP_TRADERS
   - "early buyers/first buyers/OG holders" → GET_EARLY_BUYERS
   - "who bought first and still holding" → GET_DIAMOND_HANDS

5. WALLET + TOKEN COMBO (needs both):
   - "how much did [wallet] make on [token]" → GET_WALLET_TOKEN_PNL
   - "did [wallet] trade [token]" → GET_WALLET_TOKEN_HISTORY

6. PRICE QUERIES:
   - "sol price/solana price" → GET_SOL_PRICE

SYNONYMS:
- "best traders" / "most profitable" / "top earners" = GET_TOP_TRADERS
- "diamond hands" / "still holding" / "early + holding" = GET_DIAMOND_HANDS
- "winrate" / "win ratio" / "success" = GET_WALLET_WINRATE
- "pnl" / "profit" / "made" / "earned" = GET_WALLET_PNL or GET_WALLET_TOKEN_PNL
- "30 days" / "30d" / "monthly" / "last month" = 30 day period
- "7 days" / "7d" / "weekly" / "last week" = 7 day period
- "copy trade" / "copy trading" / "what if I copied" / "simulate" = SIMULATE_COPY_TRADE

RESPONSE FORMAT:
{
    "command": "COMMAND_NAME",
    "params": { 
        "address": "wallet_address_if_applicable",
        "token": "token_mint_if_applicable",
        "days": number_of_days_if_specified,
        "amount": investment_amount_in_sol_if_specified
    },
    "explanation": "Brief description"
}

For general chat: { "command": "CHAT", "response": "your response" }
If info missing: { "command": "NEED_INFO", "missing": "wallet_address|token_address", "question": "Please provide..." }

CONTEXT CLUES:
- "coin/token/holders" + address = token mint address
- "wallet/portfolio/trader" + address = wallet address
- If BOTH wallet and token mentioned, extract both
- Numbers like "1 sol", "5 SOL", "10" before "copy" = investment amount
- "in this coin" = token context, "this wallet" = wallet context`;
    }

    async processQuery(userMessage, conversationHistory = []) {
        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parse JSON response
            try {
                // Extract JSON from response (handle markdown code blocks)
                let jsonStr = content;
                if (content.includes('```json')) {
                    jsonStr = content.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || content;
                } else if (content.includes('```')) {
                    jsonStr = content.match(/```\s*([\s\S]*?)\s*```/)?.[1] || content;
                }
                return JSON.parse(jsonStr.trim());
            } catch (e) {
                // If not valid JSON, treat as chat response
                return {
                    command: 'CHAT',
                    response: content
                };
            }
        } catch (error) {
            console.error('Groq API error:', error);
            return {
                command: 'ERROR',
                error: error.message
            };
        }
    }

    async explainWallet(walletData) {
        const prompt = `Analyze this Solana wallet data and provide a brief, insightful summary:
${JSON.stringify(walletData, null, 2)}

Explain:
1. What type of wallet this appears to be (whale, trader, holder, etc.)
2. Notable activity patterns
3. Key insights about their holdings
Keep it concise and conversational.`;

        try {
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: 'You are a crypto analyst. Provide concise, insightful wallet analysis.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 500
                })
            });

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Explain wallet error:', error);
            return 'Unable to analyze wallet at this time.';
        }
    }
}
