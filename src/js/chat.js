// Chat Controller - Connects UI, Groq AI, and Helius
import { GroqService } from './services/groq.js';
import { HeliusService } from './services/helius.js';

export class ChatController {
    constructor() {
        this.groq = new GroqService();
        this.helius = new HeliusService();
        this.conversationHistory = [];
        this.isProcessing = false;
        
        // DOM elements
        this.chatMessages = null;
        this.chatInput = null;
        this.sendButton = null;
    }

    init() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-btn');

        if (!this.chatMessages || !this.chatInput) {
            console.error('Chat elements not found');
            return;
        }

        // Event listeners
        this.sendButton?.addEventListener('click', () => this.handleSend());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Welcome message
        this.addMessage('assistant', `Welcome to ClawCrypt! I'm your AI wallet intelligence assistant.

You can ask me things like:
• "Track wallet ABC123..."
• "Show top holders of $BONK"
• "Is this wallet a whale?"
• "Explain this wallet's behavior"

What would you like to know?`);
    }

    async handleSend() {
        const message = this.chatInput.value.trim();
        if (!message || this.isProcessing) return;

        // Clear input
        this.chatInput.value = '';
        
        // Add user message
        this.addMessage('user', message);
        
        // Show typing indicator
        this.setProcessing(true);

        try {
            // Process with Groq
            const aiResponse = await this.groq.processQuery(message, this.conversationHistory);
            
            // Handle the command
            await this.handleCommand(aiResponse, message);
            
            // Update conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: JSON.stringify(aiResponse) }
            );
            
            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }
        } catch (error) {
            this.addMessage('assistant', `Sorry, I encountered an error: ${error.message}`, 'error');
        } finally {
            this.setProcessing(false);
        }
    }

    async handleCommand(response, originalMessage) {
        switch (response.command) {
            case 'CHAT':
                this.addMessage('assistant', response.response);
                break;

            case 'NEED_INFO':
                this.addMessage('assistant', response.question);
                break;

            case 'GET_WALLET_PROFILE':
            case 'TRACK_WALLET':
                await this.handleWalletProfile(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'GET_TRANSACTIONS':
                await this.handleTransactions(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'CLASSIFY_WALLET':
                await this.handleClassify(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'EXPLAIN_WALLET':
                await this.handleExplain(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'GET_TOP_HOLDERS':
                await this.handleTopHolders(
                    response.params?.token || 
                    response.params?.mint || 
                    response.params?.address ||
                    this.extractAddress(originalMessage)
                );
                break;

            case 'SEARCH_WALLETS':
                this.addMessage('assistant', 'Wallet search by criteria is coming soon! For now, please provide a specific wallet address.');
                break;

            case 'GET_WALLET_PNL':
            case 'GET_BEST_TRADE':
                await this.handleWalletPnL(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'GET_WALLET_WINRATE':
                await this.handleWalletWinrate(response.params?.address || this.extractAddress(originalMessage));
                break;

            case 'GET_TOP_TRADERS':
                await this.handleTopTraders(
                    response.params?.token || 
                    response.params?.address ||
                    this.extractAddress(originalMessage)
                );
                break;

            case 'GET_EARLY_BUYERS':
                await this.handleEarlyBuyers(
                    response.params?.token || this.extractAddress(originalMessage),
                    false
                );
                break;

            case 'GET_DIAMOND_HANDS':
                await this.handleEarlyBuyers(
                    response.params?.token || this.extractAddress(originalMessage),
                    true
                );
                break;

            case 'GET_WALLET_TOKEN_PNL':
            case 'GET_WALLET_TOKEN_HISTORY':
                await this.handleWalletTokenPnL(
                    response.params?.address,
                    response.params?.token,
                    originalMessage
                );
                break;

            case 'GET_WALLET_PNL_30D':
            case 'GET_WALLET_PNL_7D':
                const periodDays = response.command === 'GET_WALLET_PNL_7D' ? 7 : 
                                   (response.params?.days || 30);
                await this.handleWalletPnLPeriod(
                    response.params?.address || this.extractAddress(originalMessage),
                    periodDays
                );
                break;

            case 'SIMULATE_COPY_TRADE':
                await this.handleCopyTradeSimulation(
                    response.params?.address || this.extractAddress(originalMessage),
                    response.params?.amount || this.extractAmount(originalMessage) || 1,
                    response.params?.days || 30
                );
                break;

            case 'GET_SOL_PRICE':
                await this.handleSolPrice();
                break;

            case 'ERROR':
                this.addMessage('assistant', `I had trouble processing that: ${response.error}`, 'error');
                break;

            default:
                if (response.explanation) {
                    this.addMessage('assistant', response.explanation);
                } else {
                    this.addMessage('assistant', "I'm not sure how to help with that. Try asking about a specific wallet address or token.");
                }
        }
    }

    async handleWalletProfile(address) {
        if (!address) {
            this.addMessage('assistant', 'Please provide a wallet address to analyze.');
            return;
        }

        if (!this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'That doesn\'t look like a valid Solana address. Please check and try again.');
            return;
        }

        this.addMessage('assistant', `Analyzing wallet \`${this.truncateAddress(address)}\`...`);

        try {
            const profile = await this.helius.getWalletProfile(address);
            this.displayWalletProfile(profile);
        } catch (error) {
            this.addMessage('assistant', `Couldn't fetch wallet data: ${error.message}`, 'error');
        }
    }

    async handleTransactions(address) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address.');
            return;
        }

        try {
            const txs = await this.helius.getTransactions(address, 10);
            this.displayTransactions(txs, address);
        } catch (error) {
            this.addMessage('assistant', `Couldn't fetch transactions: ${error.message}`, 'error');
        }
    }

    async handleClassify(address) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to classify.');
            return;
        }

        try {
            const profile = await this.helius.getWalletProfile(address);
            this.displayClassification(profile);
        } catch (error) {
            this.addMessage('assistant', `Couldn't classify wallet: ${error.message}`, 'error');
        }
    }

    async handleExplain(address) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to explain.');
            return;
        }

        try {
            const profile = await this.helius.getWalletProfile(address);
            const explanation = await this.groq.explainWallet(profile);
            this.addMessage('assistant', explanation);
        } catch (error) {
            this.addMessage('assistant', `Couldn't analyze wallet: ${error.message}`, 'error');
        }
    }

    async handleTopHolders(tokenMint) {
        if (!tokenMint) {
            this.addMessage('assistant', `I need a token mint address to find top holders. 

You can find the mint address on:
• **Pump.fun** - Copy from the token page URL
• **Birdeye** - Look for "Token Address"
• **Solscan** - In the token details

Just paste it and I'll show you the biggest holders!`);
            return;
        }

        if (!this.helius.isValidAddress(tokenMint)) {
            this.addMessage('assistant', `That doesn't look like a valid Solana address. 

Token mint addresses are 32-44 characters long, like:
\`So11111111111111111111111111111111111111112\` (SOL)

Please paste the full token address.`);
            return;
        }

        this.addMessage('assistant', `🔍 Finding top holders for token \`${this.truncateAddress(tokenMint)}\`...`);

        try {
            const holders = await this.helius.getTokenHolders(tokenMint);
            
            if (!holders || holders.length === 0) {
                this.addMessage('assistant', `No holders found for this token. It might be a new token or the address might be incorrect.`);
                return;
            }
            
            this.displayTopHolders(holders, tokenMint);
        } catch (error) {
            this.addMessage('assistant', `Couldn't fetch top holders: ${error.message}

This could happen if:
• The token doesn't exist
• The Helius API is temporarily unavailable
• Rate limits were hit

Try again in a moment!`, 'error');
        }
    }

    // ==================== NEW ANALYTICS HANDLERS ====================

    async handleWalletPnL(address) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to analyze PnL.');
            return;
        }

        this.addMessage('assistant', `📊 Calculating PnL for \`${this.truncateAddress(address)}\`...`);

        try {
            const pnl = await this.helius.getWalletPnL(address);
            this.displayWalletPnL(pnl);
        } catch (error) {
            this.addMessage('assistant', `Couldn't calculate PnL: ${error.message}`, 'error');
        }
    }

    async handleWalletWinrate(address) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to analyze winrate.');
            return;
        }

        this.addMessage('assistant', `🎯 Calculating winrate for \`${this.truncateAddress(address)}\`...`);

        try {
            const winrate = await this.helius.getWalletWinrate(address);
            this.displayWalletWinrate(winrate);
        } catch (error) {
            this.addMessage('assistant', `Couldn't calculate winrate: ${error.message}`, 'error');
        }
    }

    async handleTopTraders(tokenMint) {
        if (!tokenMint || !this.helius.isValidAddress(tokenMint)) {
            this.addMessage('assistant', `I need a token mint address to find the best traders.

Paste the token's contract address and I'll show you:
• **Highest Realized Profit** - Who made the most SOL
• **Best ROI** - Who got the best returns
• **Diamond Hands** - Who's still holding`);
            return;
        }

        this.addMessage('assistant', `🏆 Finding top traders for \`${this.truncateAddress(tokenMint)}\`...`);

        try {
            const traders = await this.helius.getTopTraders(tokenMint);
            this.displayTopTraders(traders, tokenMint);
        } catch (error) {
            this.addMessage('assistant', `Couldn't analyze traders: ${error.message}`, 'error');
        }
    }

    async handleEarlyBuyers(tokenMint, diamondHandsOnly = false) {
        if (!tokenMint || !this.helius.isValidAddress(tokenMint)) {
            this.addMessage('assistant', 'Please provide a token mint address to find early buyers.');
            return;
        }

        const label = diamondHandsOnly ? 'diamond hands 💎🙌' : 'early buyers';
        this.addMessage('assistant', `🔍 Finding ${label} for \`${this.truncateAddress(tokenMint)}\`...`);

        try {
            const buyers = await this.helius.getEarlyBuyers(tokenMint, diamondHandsOnly);
            this.displayEarlyBuyers(buyers, tokenMint, diamondHandsOnly);
        } catch (error) {
            this.addMessage('assistant', `Couldn't find early buyers: ${error.message}`, 'error');
        }
    }

    async handleWalletTokenPnL(walletAddress, tokenMint, originalMessage) {
        // Try to extract both addresses from the message if not provided
        const addresses = originalMessage.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
        
        if (!walletAddress && addresses.length >= 1) walletAddress = addresses[0];
        if (!tokenMint && addresses.length >= 2) tokenMint = addresses[1];

        if (!walletAddress || !tokenMint) {
            this.addMessage('assistant', `To analyze a wallet's performance on a specific token, I need both:

1. **Wallet address** - The trader's wallet
2. **Token mint address** - The token they traded

Example: "How much did [wallet] make on [token]"`);
            return;
        }

        this.addMessage('assistant', `💰 Analyzing wallet \`${this.truncateAddress(walletAddress)}\` performance on token \`${this.truncateAddress(tokenMint)}\`...`);

        try {
            const pnl = await this.helius.getWalletTokenPnL(walletAddress, tokenMint);
            this.displayWalletTokenPnL(pnl);
        } catch (error) {
            this.addMessage('assistant', `Couldn't analyze: ${error.message}`, 'error');
        }
    }

    // ==================== 30-DAY PNL & COPY TRADE HANDLERS ====================

    async handleWalletPnLPeriod(address, days = 30) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to analyze.');
            return;
        }

        this.addMessage('assistant', `📊 Calculating ${days}-day PnL for \`${this.truncateAddress(address)}\`... This may take a moment.`);

        try {
            const pnl = await this.helius.getWalletPnLPeriod(address, days);
            this.displayWalletPnLPeriod(pnl);
        } catch (error) {
            this.addMessage('assistant', `Couldn't calculate ${days}-day PnL: ${error.message}`, 'error');
        }
    }

    async handleCopyTradeSimulation(address, amount = 1, days = 30) {
        if (!address || !this.helius.isValidAddress(address)) {
            this.addMessage('assistant', 'Please provide a valid wallet address to simulate copy trading.');
            return;
        }

        this.addMessage('assistant', `🎮 Simulating what would happen if you copy traded \`${this.truncateAddress(address)}\` with **${amount} SOL** over ${days} days...`);

        try {
            const simulation = await this.helius.simulateCopyTrade(address, amount, days);
            this.displayCopyTradeSimulation(simulation);
        } catch (error) {
            this.addMessage('assistant', `Couldn't simulate copy trade: ${error.message}`, 'error');
        }
    }

    async handleSolPrice() {
        try {
            const price = await this.helius.getSolPrice();
            this.addMessage('assistant', `**Current SOL Price:** $${price.toFixed(2)} USD`);
        } catch (error) {
            this.addMessage('assistant', `Couldn't fetch SOL price: ${error.message}`, 'error');
        }
    }

    // Extract amount from text (e.g., "1 sol", "5 SOL", "10")
    extractAmount(text) {
        const match = text.match(/(\d+(?:\.\d+)?)\s*(?:sol|SOL)?/);
        return match ? parseFloat(match[1]) : null;
    }

    // ==================== NEW DISPLAY METHODS ====================

    displayWalletPnL(pnl) {
        const isProfitable = parseFloat(pnl.realizedPnL) > 0;
        const roiClass = parseFloat(pnl.roi) > 0 ? 'positive' : parseFloat(pnl.roi) < 0 ? 'negative' : '';
        
        const html = `
<div class="pnl-card">
    <div class="pnl-header">
        <h4>📊 Wallet PnL Analysis</h4>
        <span class="wallet-addr">${this.truncateAddress(pnl.address)}</span>
    </div>
    
    <div class="pnl-main ${isProfitable ? 'profit' : 'loss'}">
        <div class="pnl-value">${isProfitable ? '+' : ''}${pnl.realizedPnL} SOL</div>
        <div class="pnl-label">Realized PnL</div>
    </div>
    
    <div class="pnl-stats">
        <div class="stat-item">
            <span class="stat-label">ROI</span>
            <span class="stat-value ${roiClass}">${pnl.roi}%</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Total Trades</span>
            <span class="stat-value">${pnl.totalTrades}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Buys</span>
            <span class="stat-value">${pnl.totalBuys}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Sells</span>
            <span class="stat-value">${pnl.totalSells}</span>
        </div>
    </div>
    
    <div class="pnl-flow">
        <div class="flow-item out">
            <span class="flow-label">Total Spent</span>
            <span class="flow-value">${pnl.buyValue} SOL</span>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-item in">
            <span class="flow-label">Total Received</span>
            <span class="flow-value">${pnl.sellValue} SOL</span>
        </div>
    </div>
    
    <div class="pnl-actions">
        <button class="action-btn" onclick="document.getElementById('chat-input').value='What is the winrate for ${pnl.address}'; document.getElementById('send-btn').click();">
            View Winrate
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayWalletWinrate(data) {
        const winrateClass = parseFloat(data.winrate) >= 50 ? 'good' : 'bad';
        
        const html = `
<div class="winrate-card">
    <div class="winrate-header">
        <h4>🎯 Winrate Analysis</h4>
        <span class="wallet-addr">${this.truncateAddress(data.address)}</span>
    </div>
    
    <div class="winrate-main">
        <div class="winrate-circle ${winrateClass}">
            <span class="winrate-value">${data.winrate}%</span>
            <span class="winrate-label">Win Rate</span>
        </div>
    </div>
    
    <div class="winrate-stats">
        <div class="stat-box win">
            <span class="stat-num">${data.wins}</span>
            <span class="stat-label">Wins</span>
        </div>
        <div class="stat-box loss">
            <span class="stat-num">${data.losses}</span>
            <span class="stat-label">Losses</span>
        </div>
        <div class="stat-box neutral">
            <span class="stat-num">${data.breakeven}</span>
            <span class="stat-label">Breakeven</span>
        </div>
    </div>
    
    <div class="winrate-avgs">
        <div class="avg-item">
            <span class="avg-label">Avg Win</span>
            <span class="avg-value positive">+${data.avgWin.toFixed(4)} SOL</span>
        </div>
        <div class="avg-item">
            <span class="avg-label">Avg Loss</span>
            <span class="avg-value negative">${data.avgLoss.toFixed(4)} SOL</span>
        </div>
    </div>
    
    ${data.topTrades.length > 0 ? `
    <div class="top-trades">
        <h5>Best Trades</h5>
        ${data.topTrades.filter(t => t.result === 'win').slice(0, 3).map(t => `
            <div class="trade-item win">
                <span class="trade-token">${this.truncateAddress(t.mint)}</span>
                <span class="trade-pnl">+${t.pnl.toFixed(4)} SOL (${t.roi.toFixed(0)}%)</span>
            </div>
        `).join('')}
    </div>
    ` : ''}
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayTopTraders(traders, tokenMint) {
        if (!traders || traders.length === 0) {
            this.addMessage('assistant', 'No trading data found for this token. It might be too new or have low activity.');
            return;
        }

        const html = `
<div class="traders-card">
    <div class="traders-header">
        <h4>🏆 Top Traders</h4>
        <span class="token-addr">${this.truncateAddress(tokenMint)}</span>
    </div>
    
    <div class="traders-list">
        ${traders.slice(0, 10).map((t, i) => {
            const isProfitable = parseFloat(t.realizedPnL) > 0;
            return `
            <div class="trader-item ${i < 3 ? 'top-3' : ''}">
                <div class="trader-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">
                    ${i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)}
                </div>
                <div class="trader-info">
                    <span class="trader-address" onclick="navigator.clipboard.writeText('${t.address}')">${this.truncateAddress(t.address)}</span>
                    <div class="trader-tags">
                        ${t.stillHolding ? '<span class="tag holding">Still Holding</span>' : '<span class="tag sold">Sold</span>'}
                    </div>
                </div>
                <div class="trader-stats">
                    <div class="trader-pnl ${isProfitable ? 'profit' : 'loss'}">
                        ${isProfitable ? '+' : ''}${t.realizedPnL} SOL
                    </div>
                    <div class="trader-roi ${parseFloat(t.roi) > 0 ? 'positive' : 'negative'}">
                        ${t.roi}% ROI
                    </div>
                </div>
            </div>
        `}).join('')}
    </div>
    
    <div class="traders-footer">
        <button class="action-btn" onclick="document.getElementById('chat-input').value='Show early buyers still holding ${tokenMint}'; document.getElementById('send-btn').click();">
            Find Diamond Hands 💎
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayEarlyBuyers(buyers, tokenMint, diamondHandsOnly) {
        if (!buyers || buyers.length === 0) {
            this.addMessage('assistant', diamondHandsOnly 
                ? 'No diamond hands found - everyone who bought early has sold!'
                : 'No early buyer data found for this token.');
            return;
        }

        const title = diamondHandsOnly ? '💎 Diamond Hands' : '🕐 Early Buyers';
        
        const html = `
<div class="early-buyers-card">
    <div class="eb-header">
        <h4>${title}</h4>
        <span class="token-addr">${this.truncateAddress(tokenMint)}</span>
    </div>
    
    <div class="eb-list">
        ${buyers.slice(0, 10).map((b, i) => {
            const buyDate = new Date(b.firstBuyTime * 1000);
            return `
            <div class="eb-item ${b.isDiamondHands ? 'diamond' : ''}">
                <div class="eb-rank">#${i + 1}</div>
                <div class="eb-info">
                    <span class="eb-address" onclick="navigator.clipboard.writeText('${b.address}')">${this.truncateAddress(b.address)}</span>
                    <span class="eb-date">First buy: ${buyDate.toLocaleDateString()}</span>
                </div>
                <div class="eb-stats">
                    <div class="eb-holding">
                        ${b.stillHolding ? `
                            <span class="holding-amount">${this.formatAmount(b.currentHolding)}</span>
                            <span class="holding-pct">(${b.holdingPercent}% kept)</span>
                        ` : '<span class="sold-tag">Sold All</span>'}
                    </div>
                    ${b.isDiamondHands ? '<span class="diamond-badge">💎🙌</span>' : ''}
                </div>
            </div>
        `}).join('')}
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayWalletTokenPnL(pnl) {
        const isProfitable = parseFloat(pnl.realizedPnL) > 0;
        const buyDate = pnl.firstBuy ? new Date(pnl.firstBuy * 1000).toLocaleDateString() : 'N/A';
        
        const html = `
<div class="token-pnl-card">
    <div class="tpnl-header">
        <h4>💰 Token Performance</h4>
        <div class="tpnl-addresses">
            <span class="tpnl-wallet">Wallet: ${this.truncateAddress(pnl.wallet)}</span>
            <span class="tpnl-token">Token: ${this.truncateAddress(pnl.token)}</span>
        </div>
    </div>
    
    <div class="tpnl-main ${isProfitable ? 'profit' : 'loss'}">
        <div class="tpnl-value">${isProfitable ? '+' : ''}${pnl.realizedPnL} SOL</div>
        <div class="tpnl-roi">${pnl.roi}% ROI</div>
    </div>
    
    <div class="tpnl-details">
        <div class="tpnl-row">
            <span class="tpnl-label">Total Bought</span>
            <span class="tpnl-val">${this.formatAmount(pnl.totalBought)} tokens</span>
        </div>
        <div class="tpnl-row">
            <span class="tpnl-label">Total Sold</span>
            <span class="tpnl-val">${this.formatAmount(pnl.totalSold)} tokens</span>
        </div>
        <div class="tpnl-row">
            <span class="tpnl-label">Currently Holding</span>
            <span class="tpnl-val">${this.formatAmount(pnl.currentHolding)} tokens</span>
        </div>
        <div class="tpnl-row">
            <span class="tpnl-label">First Buy</span>
            <span class="tpnl-val">${buyDate}</span>
        </div>
        <div class="tpnl-row">
            <span class="tpnl-label">Trade Count</span>
            <span class="tpnl-val">${pnl.tradeCount}</span>
        </div>
    </div>
    
    <div class="tpnl-prices">
        <div class="price-item">
            <span class="price-label">Avg Buy Price</span>
            <span class="price-val">${pnl.avgBuyPrice} SOL</span>
        </div>
        <div class="price-item">
            <span class="price-label">Avg Sell Price</span>
            <span class="price-val">${pnl.avgSellPrice} SOL</span>
        </div>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    // ==================== 30-DAY PNL & COPY TRADE DISPLAYS ====================

    displayWalletPnLPeriod(data) {
        const isProfitable = parseFloat(data.summary.realizedPnLSOL) > 0;
        const roiClass = parseFloat(data.summary.roi) > 0 ? 'positive' : parseFloat(data.summary.roi) < 0 ? 'negative' : '';
        
        const html = `
<div class="period-pnl-card">
    <div class="ppnl-header">
        <h4>📊 ${data.period} Performance</h4>
        <div class="ppnl-meta">
            <span class="wallet-addr">${this.truncateAddress(data.address)}</span>
            <span class="sol-price">SOL: $${data.solPrice.toFixed(2)}</span>
        </div>
    </div>
    
    <div class="ppnl-main ${isProfitable ? 'profit' : 'loss'}">
        <div class="ppnl-sol">${isProfitable ? '+' : ''}${data.summary.realizedPnLSOL} SOL</div>
        <div class="ppnl-usd">${isProfitable ? '+' : ''}$${data.summary.realizedPnLUSD}</div>
        <div class="ppnl-roi ${roiClass}">${data.summary.roi}% ROI</div>
    </div>
    
    <div class="ppnl-stats">
        <div class="stat-box">
            <span class="stat-val">${data.summary.totalTrades}</span>
            <span class="stat-label">Total Trades</span>
        </div>
        <div class="stat-box">
            <span class="stat-val">${data.summary.totalBuys}</span>
            <span class="stat-label">Buys</span>
        </div>
        <div class="stat-box">
            <span class="stat-val">${data.summary.totalSells}</span>
            <span class="stat-label">Sells</span>
        </div>
    </div>
    
    <div class="ppnl-flow">
        <div class="flow-box spent">
            <span class="flow-label">Total Spent</span>
            <span class="flow-sol">${data.summary.buyValueSOL} SOL</span>
            <span class="flow-usd">$${data.summary.buyValueUSD}</span>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-box received">
            <span class="flow-label">Total Received</span>
            <span class="flow-sol">${data.summary.sellValueSOL} SOL</span>
            <span class="flow-usd">$${data.summary.sellValueUSD}</span>
        </div>
    </div>
    
    <div class="ppnl-highlights">
        <div class="highlight-item best">
            <span class="hl-icon">🏆</span>
            <div class="hl-info">
                <span class="hl-label">Biggest Win</span>
                <span class="hl-val">+${data.biggestWin.sol} SOL ($${data.biggestWin.usd})</span>
                ${data.biggestWin.token ? `<span class="hl-token">${data.biggestWin.token}</span>` : ''}
            </div>
        </div>
        <div class="highlight-item worst">
            <span class="hl-icon">📉</span>
            <div class="hl-info">
                <span class="hl-label">Biggest Loss</span>
                <span class="hl-val">${data.biggestLoss.sol} SOL ($${data.biggestLoss.usd})</span>
                ${data.biggestLoss.token ? `<span class="hl-token">${data.biggestLoss.token}</span>` : ''}
            </div>
        </div>
    </div>
    
    ${data.topTokens.length > 0 ? `
    <div class="ppnl-tokens">
        <h5>Top Performing Tokens</h5>
        <div class="token-list">
            ${data.topTokens.slice(0, 5).map(t => `
                <div class="token-row ${t.pnl > 0 ? 'profit' : 'loss'}">
                    <span class="token-sym">${t.symbol}</span>
                    <span class="token-pnl">${t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(4)} SOL</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    <div class="ppnl-actions">
        <button class="action-btn" onclick="document.getElementById('chat-input').value='What if I copy traded ${data.address} with 1 SOL?'; document.getElementById('send-btn').click();">
            🎮 Simulate Copy Trade
        </button>
        <button class="action-btn" onclick="document.getElementById('chat-input').value='What is the winrate for ${data.address}?'; document.getElementById('send-btn').click();">
            📊 View Winrate
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayCopyTradeSimulation(sim) {
        const isProfitable = parseFloat(sim.results.pnlSOL) > 0;
        const verdictClass = sim.verdict.rating.includes('🔥') || sim.verdict.rating.includes('✅') ? 'good' : 
                            sim.verdict.rating.includes('❌') ? 'bad' : 'neutral';
        
        const html = `
<div class="copy-trade-card">
    <div class="ct-header">
        <h4>🎮 Copy Trade Simulation</h4>
        <span class="wallet-addr">${this.truncateAddress(sim.wallet)}</span>
    </div>
    
    <div class="ct-setup">
        <div class="setup-item">
            <span class="setup-label">Initial Investment</span>
            <span class="setup-val">${sim.simulation.initialInvestment} SOL ($${sim.simulation.initialInvestmentUSD})</span>
        </div>
        <div class="setup-item">
            <span class="setup-label">Period</span>
            <span class="setup-val">${sim.simulation.period}</span>
        </div>
        <div class="setup-item">
            <span class="setup-label">SOL Price</span>
            <span class="setup-val">$${sim.simulation.solPrice.toFixed(2)}</span>
        </div>
    </div>
    
    <div class="ct-result ${isProfitable ? 'profit' : 'loss'}">
        <div class="result-main">
            <div class="result-final">
                <span class="final-label">Final Portfolio</span>
                <span class="final-sol">${sim.results.finalPortfolioSOL} SOL</span>
                <span class="final-usd">$${sim.results.finalPortfolioUSD}</span>
            </div>
            <div class="result-pnl">
                <span class="pnl-label">Total P&L</span>
                <span class="pnl-sol">${isProfitable ? '+' : ''}${sim.results.pnlSOL} SOL</span>
                <span class="pnl-usd">${isProfitable ? '+' : ''}$${sim.results.pnlUSD}</span>
            </div>
        </div>
        <div class="result-roi">${sim.results.totalROI}% ROI</div>
    </div>
    
    <div class="ct-stats">
        <div class="stat-item">
            <span class="stat-num">${sim.results.tradesCopied}</span>
            <span class="stat-label">Trades Copied</span>
        </div>
        <div class="stat-item win">
            <span class="stat-num">${sim.results.wins}</span>
            <span class="stat-label">Wins</span>
        </div>
        <div class="stat-item loss">
            <span class="stat-num">${sim.results.losses}</span>
            <span class="stat-label">Losses</span>
        </div>
        <div class="stat-item">
            <span class="stat-num">${sim.results.winrate}%</span>
            <span class="stat-label">Winrate</span>
        </div>
    </div>
    
    <div class="ct-avgs">
        <div class="avg-box">
            <span class="avg-label">Avg Win</span>
            <span class="avg-val positive">+${sim.results.avgWin} SOL</span>
        </div>
        <div class="avg-box">
            <span class="avg-label">Avg Loss</span>
            <span class="avg-val negative">-${sim.results.avgLoss} SOL</span>
        </div>
    </div>
    
    <div class="ct-verdict ${verdictClass}">
        <span class="verdict-rating">${sim.verdict.rating}</span>
        <div class="verdict-info">
            <span class="verdict-text">${sim.verdict.text}</span>
            <span class="verdict-rec">${sim.verdict.recommendation}</span>
        </div>
    </div>
    
    ${sim.trades.length > 0 ? `
    <div class="ct-trades">
        <h5>Recent Copied Trades</h5>
        <div class="trades-list">
            ${sim.trades.slice(-8).reverse().map(t => `
                <div class="trade-row ${t.type.toLowerCase()}">
                    <span class="trade-type">${t.type}</span>
                    <span class="trade-token">${t.token}</span>
                    <span class="trade-amount">${t.type === 'BUY' ? `-${t.spent}` : `+${t.received}`} SOL</span>
                    ${t.pnl ? `<span class="trade-pnl ${parseFloat(t.pnl) > 0 ? 'profit' : 'loss'}">${t.pnl} SOL</span>` : ''}
                    <span class="trade-date">${t.date}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    <div class="ct-actions">
        <button class="action-btn" onclick="document.getElementById('chat-input').value='What if I copy traded ${sim.wallet} with 5 SOL?'; document.getElementById('send-btn').click();">
            Try with 5 SOL
        </button>
        <button class="action-btn" onclick="document.getElementById('chat-input').value='Show 30 day PnL for ${sim.wallet}'; document.getElementById('send-btn').click();">
            View Full PnL
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    // Display helpers
    displayWalletProfile(profile) {
        const solValue = profile.balances.sol;
        const topTokens = profile.balances.tokens
            .sort((a, b) => (b.amount || 0) - (a.amount || 0))
            .slice(0, 5);
        
        const html = `
<div class="wallet-card">
    <div class="wallet-header">
        <div class="wallet-title">
            <span class="wallet-icon">👛</span>
            <span class="wallet-address" onclick="navigator.clipboard.writeText('${profile.address}')" title="Click to copy full address">
                ${this.truncateAddress(profile.address)}
            </span>
        </div>
        <div class="wallet-actions">
            <a href="https://solscan.io/account/${profile.address}" target="_blank" class="view-explorer">
                View on Solscan ↗
            </a>
        </div>
    </div>
    
    <div class="wallet-balances">
        <div class="balance-item sol">
            <div class="balance-icon">◎</div>
            <div class="balance-info">
                <span class="balance-label">SOL Balance</span>
                <span class="balance-value">${solValue.toFixed(4)} SOL</span>
            </div>
        </div>
        <div class="balance-item tokens">
            <div class="balance-icon">🪙</div>
            <div class="balance-info">
                <span class="balance-label">Tokens Held</span>
                <span class="balance-value">${profile.balances.tokens.length} tokens</span>
            </div>
        </div>
    </div>

    ${topTokens.length > 0 ? `
    <div class="wallet-tokens">
        <h4>Top Tokens</h4>
        <div class="tokens-list">
            ${topTokens.map(t => `
                <div class="token-item">
                    <span class="token-name">${t.symbol || 'Unknown'}</span>
                    <span class="token-amount">${this.formatAmount(t.amount / Math.pow(10, t.decimals || 0))}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <div class="wallet-activity">
        <h4>📊 Activity Overview</h4>
        <div class="activity-grid">
            <div class="activity-item">
                <span class="label">First Seen</span>
                <span class="value">${profile.activity.firstSeen ? new Date(profile.activity.firstSeen).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="activity-item">
                <span class="label">Last Active</span>
                <span class="value">${profile.activity.lastActive ? new Date(profile.activity.lastActive).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="activity-item">
                <span class="label">Avg Tx/Day</span>
                <span class="value">${profile.activity.avgTransactionsPerDay}</span>
            </div>
            <div class="activity-item">
                <span class="label">Tokens Traded</span>
                <span class="value">${profile.activity.uniqueTokensInteracted}</span>
            </div>
        </div>
    </div>

    <div class="wallet-labels">
        ${profile.classification.map(c => `
            <div class="label-item">
                <span class="label-tag ${c.type}">${c.type.replace('_', ' ')}</span>
                <span class="label-reason">${c.reason}</span>
            </div>
        `).join('')}
    </div>

    <div class="wallet-actions-footer">
        <button class="action-btn" onclick="document.getElementById('chat-input').value='Show recent transactions for ${profile.address}'; document.getElementById('send-btn').click();">
            View Transactions
        </button>
        <button class="action-btn primary" onclick="document.getElementById('chat-input').value='Explain this wallet ${profile.address}'; document.getElementById('send-btn').click();">
            AI Analysis
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayTransactions(txs, address) {
        if (txs.length === 0) {
            this.addMessage('assistant', 'No recent transactions found for this wallet.');
            return;
        }

        const html = `
<div class="transactions-card">
    <h4>Recent Transactions</h4>
    <div class="tx-list">
        ${txs.slice(0, 5).map(tx => `
            <div class="tx-item ${tx.status}">
                <div class="tx-type">${tx.type || 'Transaction'}</div>
                <div class="tx-desc">${tx.description || 'No description'}</div>
                <div class="tx-time">${new Date(tx.timestamp * 1000).toLocaleString()}</div>
            </div>
        `).join('')}
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayClassification(profile) {
        const html = `
<div class="classification-card">
    <h4>Wallet Classification</h4>
    <div class="wallet-address">${this.truncateAddress(profile.address)}</div>
    <div class="labels-container">
        ${profile.classification.map(c => `
            <div class="classification-item">
                <span class="label-tag ${c.type}">${c.type.replace('_', ' ')}</span>
                <span class="confidence">${c.confidence} confidence</span>
                <span class="reason">${c.reason}</span>
            </div>
        `).join('')}
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    displayTopHolders(holders, mint) {
        if (!holders || holders.length === 0) {
            this.addMessage('assistant', 'No holders found for this token.');
            return;
        }

        // Calculate total supply from holders for percentage
        const totalHeld = holders.reduce((sum, h) => sum + (h.uiAmount || 0), 0);

        const html = `
<div class="holders-card">
    <div class="holders-header">
        <h4>🏆 Top Token Holders</h4>
        <span class="token-mint">${this.truncateAddress(mint)}</span>
    </div>
    <div class="holders-stats">
        <span>Found ${holders.length} holders</span>
    </div>
    <div class="holders-list">
        ${holders.slice(0, 10).map((h, i) => {
            const percentage = totalHeld > 0 ? ((h.uiAmount || 0) / totalHeld * 100).toFixed(2) : '0';
            return `
            <div class="holder-item ${i < 3 ? 'top-holder' : ''}">
                <span class="rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">#${h.rank || i + 1}</span>
                <div class="holder-info">
                    <span class="holder-address" onclick="navigator.clipboard.writeText('${h.address}')" title="Click to copy">${this.truncateAddress(h.address)}</span>
                    <div class="holder-bar">
                        <div class="holder-bar-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
                <div class="holder-amount-container">
                    <span class="holder-amount">${this.formatAmount(h.uiAmount)}</span>
                    <span class="holder-percent">${percentage}%</span>
                </div>
            </div>
        `}).join('')}
    </div>
    <div class="holders-footer">
        <button class="analyze-btn" onclick="document.getElementById('chat-input').value='Analyze wallet ${holders[0]?.address || ''}'; document.getElementById('chat-input').focus();">
            Analyze Top Holder
        </button>
    </div>
</div>`;

        this.addMessage('assistant', html, 'html');
    }

    formatAmount(amount) {
        if (!amount) return '0';
        if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
        if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
        if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
        return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // Utility methods
    addMessage(role, content, type = 'text') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (type === 'html') {
            contentDiv.innerHTML = content;
        } else {
            // Convert markdown-like formatting
            let formatted = content
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            contentDiv.innerHTML = formatted;
        }

        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setProcessing(processing) {
        this.isProcessing = processing;
        
        if (processing) {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message assistant typing';
            typingDiv.id = 'typing-indicator';
            typingDiv.innerHTML = `
                <div class="message-content">
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;
            this.chatMessages.appendChild(typingDiv);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        } else {
            document.getElementById('typing-indicator')?.remove();
        }

        this.sendButton.disabled = processing;
        this.chatInput.disabled = processing;
    }

    extractAddress(text) {
        // Try to extract a Solana address from text
        // Solana addresses are base58 encoded, 32-44 chars
        // They don't contain 0, O, I, l (to avoid confusion)
        const matches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
        
        if (!matches) return null;
        
        // Return the longest valid-looking match (prefer pump.fun style addresses)
        return matches.reduce((best, current) => {
            if (!best) return current;
            // Prefer addresses that end with "pump" (pump.fun tokens)
            if (current.endsWith('pump')) return current;
            if (best.endsWith('pump')) return best;
            // Otherwise prefer longer addresses
            return current.length > best.length ? current : best;
        }, null);
    }

    truncateAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
}
