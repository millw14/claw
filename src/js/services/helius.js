// Helius API Service - Solana Wallet Data
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_URL = `https://api.helius.xyz/v0`;

export class HeliusService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute
    }

    // Get wallet balances (SOL + tokens)
    async getBalances(address) {
        try {
            const response = await fetch(`${HELIUS_API_URL}/addresses/${address}/balances?api-key=${HELIUS_API_KEY}`);
            if (!response.ok) throw new Error('Failed to fetch balances');
            const data = await response.json();
            return {
                sol: data.nativeBalance / 1e9,
                tokens: data.tokens?.map(t => ({
                    mint: t.mint,
                    amount: t.amount,
                    decimals: t.decimals,
                    symbol: t.symbol || 'Unknown',
                    name: t.name || 'Unknown Token',
                    logoURI: t.logoURI
                })) || []
            };
        } catch (error) {
            console.error('Get balances error:', error);
            throw error;
        }
    }

    // Get transaction history
    async getTransactions(address, limit = 20) {
        try {
            const response = await fetch(`${HELIUS_API_URL}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch transactions');
            const data = await response.json();
            return data.map(tx => ({
                signature: tx.signature,
                timestamp: tx.timestamp,
                type: tx.type,
                description: tx.description,
                fee: tx.fee / 1e9,
                status: tx.transactionError ? 'failed' : 'success',
                tokenTransfers: tx.tokenTransfers || [],
                nativeTransfers: tx.nativeTransfers || []
            }));
        } catch (error) {
            console.error('Get transactions error:', error);
            throw error;
        }
    }

    // Get wallet profile (comprehensive)
    async getWalletProfile(address) {
        try {
            const [balances, transactions] = await Promise.all([
                this.getBalances(address),
                this.getTransactions(address, 50)
            ]);

            // Analyze activity
            const now = Date.now() / 1000;
            const firstTx = transactions[transactions.length - 1];
            const lastTx = transactions[0];
            
            // Calculate activity metrics
            const txCount = transactions.length;
            const timeSpan = firstTx ? (lastTx.timestamp - firstTx.timestamp) : 0;
            const avgTxPerDay = timeSpan > 0 ? (txCount / (timeSpan / 86400)) : 0;

            // Get unique tokens interacted with
            const tokensInteracted = new Set();
            transactions.forEach(tx => {
                tx.tokenTransfers?.forEach(t => tokensInteracted.add(t.mint));
            });

            // Classify behavior
            const classification = this.classifyWallet(balances, transactions);

            return {
                address,
                balances,
                activity: {
                    totalTransactions: txCount,
                    firstSeen: firstTx?.timestamp ? new Date(firstTx.timestamp * 1000).toISOString() : null,
                    lastActive: lastTx?.timestamp ? new Date(lastTx.timestamp * 1000).toISOString() : null,
                    avgTransactionsPerDay: avgTxPerDay.toFixed(2),
                    uniqueTokensInteracted: tokensInteracted.size
                },
                recentTransactions: transactions.slice(0, 10),
                classification
            };
        } catch (error) {
            console.error('Get wallet profile error:', error);
            throw error;
        }
    }

    // Classify wallet behavior
    classifyWallet(balances, transactions) {
        const labels = [];
        const solBalance = balances.sol;
        const tokenCount = balances.tokens.length;
        const txCount = transactions.length;

        // Whale detection
        if (solBalance > 1000) {
            labels.push({ type: 'whale', confidence: 'high', reason: 'Holds >1000 SOL' });
        } else if (solBalance > 100) {
            labels.push({ type: 'whale', confidence: 'medium', reason: 'Holds >100 SOL' });
        }

        // Active trader
        if (txCount >= 50) {
            labels.push({ type: 'active_trader', confidence: 'high', reason: 'High transaction count' });
        }

        // Diversified holder
        if (tokenCount > 20) {
            labels.push({ type: 'diversified', confidence: 'high', reason: 'Holds many different tokens' });
        }

        // Check for swap patterns (simplified)
        const swapTxs = transactions.filter(tx => 
            tx.type?.toLowerCase().includes('swap') || 
            tx.description?.toLowerCase().includes('swap')
        );
        if (swapTxs.length > txCount * 0.5) {
            labels.push({ type: 'dex_trader', confidence: 'medium', reason: 'Frequent swaps' });
        }

        // Default
        if (labels.length === 0) {
            labels.push({ type: 'regular_user', confidence: 'low', reason: 'Normal activity' });
        }

        return labels;
    }

    // Search for token holders (uses DAS API)
    async getTokenHolders(mintAddress, limit = 20) {
        try {
            // First, get the largest token accounts
            const response = await fetch(HELIUS_RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'holders',
                    method: 'getTokenLargestAccounts',
                    params: [mintAddress]
                })
            });
            
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const tokenAccounts = data.result?.value?.slice(0, limit) || [];
            
            if (tokenAccounts.length === 0) return [];

            // Now resolve each token account to get the owner wallet
            const holdersWithOwners = await Promise.all(
                tokenAccounts.map(async (account, index) => {
                    try {
                        const ownerResponse = await fetch(HELIUS_RPC_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: `owner-${index}`,
                                method: 'getAccountInfo',
                                params: [
                                    account.address,
                                    { encoding: 'jsonParsed' }
                                ]
                            })
                        });
                        
                        const ownerData = await ownerResponse.json();
                        const owner = ownerData.result?.value?.data?.parsed?.info?.owner;
                        
                        return {
                            rank: index + 1,
                            address: owner || account.address,
                            tokenAccount: account.address,
                            amount: account.amount,
                            uiAmount: account.uiAmount,
                            decimals: account.decimals
                        };
                    } catch (e) {
                        return {
                            rank: index + 1,
                            address: account.address,
                            amount: account.amount,
                            uiAmount: account.uiAmount
                        };
                    }
                })
            );

            return holdersWithOwners;
        } catch (error) {
            console.error('Get token holders error:', error);
            throw error;
        }
    }

    // Get token metadata
    async getTokenMetadata(mintAddress) {
        try {
            const response = await fetch(HELIUS_RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'metadata',
                    method: 'getAsset',
                    params: { id: mintAddress }
                })
            });
            
            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('Get token metadata error:', error);
            throw error;
        }
    }

    // Validate Solana address
    isValidAddress(address) {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    // ==================== ADVANCED ANALYTICS ====================

    // Get wallet PnL and performance stats
    async getWalletPnL(walletAddress) {
        try {
            const transactions = await this.getTransactions(walletAddress, 100);
            
            let totalBuys = 0;
            let totalSells = 0;
            let buyValue = 0;
            let sellValue = 0;
            let trades = [];

            // Analyze each transaction for swaps
            for (const tx of transactions) {
                if (tx.type?.toLowerCase().includes('swap') || tx.description?.toLowerCase().includes('swap')) {
                    const tokenTransfers = tx.tokenTransfers || [];
                    const nativeTransfers = tx.nativeTransfers || [];
                    
                    // Simplified: track SOL in/out as proxy for value
                    const solIn = nativeTransfers
                        .filter(t => t.toUserAccount === walletAddress)
                        .reduce((sum, t) => sum + (t.amount || 0), 0) / 1e9;
                    
                    const solOut = nativeTransfers
                        .filter(t => t.fromUserAccount === walletAddress)
                        .reduce((sum, t) => sum + (t.amount || 0), 0) / 1e9;

                    if (solOut > solIn) {
                        // Buy (spent SOL)
                        totalBuys++;
                        buyValue += solOut - solIn;
                        trades.push({ type: 'buy', value: solOut - solIn, timestamp: tx.timestamp });
                    } else if (solIn > solOut) {
                        // Sell (received SOL)
                        totalSells++;
                        sellValue += solIn - solOut;
                        trades.push({ type: 'sell', value: solIn - solOut, timestamp: tx.timestamp });
                    }
                }
            }

            const realizedPnL = sellValue - buyValue;
            const roi = buyValue > 0 ? ((sellValue - buyValue) / buyValue * 100) : 0;

            return {
                address: walletAddress,
                totalTrades: totalBuys + totalSells,
                totalBuys,
                totalSells,
                buyValue: buyValue.toFixed(4),
                sellValue: sellValue.toFixed(4),
                realizedPnL: realizedPnL.toFixed(4),
                roi: roi.toFixed(2),
                trades: trades.slice(0, 10)
            };
        } catch (error) {
            console.error('Get wallet PnL error:', error);
            throw error;
        }
    }

    // Get wallet winrate
    async getWalletWinrate(walletAddress) {
        try {
            const transactions = await this.getTransactions(walletAddress, 100);
            
            // Track token positions
            const tokenPositions = new Map(); // mint -> { totalBought, totalSold, avgBuyPrice }
            let wins = 0;
            let losses = 0;
            let breakeven = 0;

            for (const tx of transactions) {
                const tokenTransfers = tx.tokenTransfers || [];
                const nativeTransfers = tx.nativeTransfers || [];
                
                for (const transfer of tokenTransfers) {
                    const mint = transfer.mint;
                    if (!mint) continue;

                    const solFlow = nativeTransfers.reduce((sum, t) => {
                        if (t.toUserAccount === walletAddress) return sum + (t.amount || 0);
                        if (t.fromUserAccount === walletAddress) return sum - (t.amount || 0);
                        return sum;
                    }, 0) / 1e9;

                    if (!tokenPositions.has(mint)) {
                        tokenPositions.set(mint, { bought: 0, sold: 0, buySpent: 0, sellReceived: 0 });
                    }

                    const pos = tokenPositions.get(mint);
                    
                    if (transfer.toUserAccount === walletAddress) {
                        // Received tokens (buy)
                        pos.bought += transfer.tokenAmount || 0;
                        pos.buySpent += Math.abs(solFlow);
                    } else if (transfer.fromUserAccount === walletAddress) {
                        // Sent tokens (sell)
                        pos.sold += transfer.tokenAmount || 0;
                        pos.sellReceived += Math.abs(solFlow);
                    }
                }
            }

            // Calculate wins/losses per token
            const tokenResults = [];
            for (const [mint, pos] of tokenPositions) {
                if (pos.sold > 0 && pos.buySpent > 0) {
                    const pnl = pos.sellReceived - pos.buySpent;
                    const roi = (pnl / pos.buySpent) * 100;
                    
                    if (pnl > 0.001) {
                        wins++;
                        tokenResults.push({ mint, pnl, roi, result: 'win' });
                    } else if (pnl < -0.001) {
                        losses++;
                        tokenResults.push({ mint, pnl, roi, result: 'loss' });
                    } else {
                        breakeven++;
                        tokenResults.push({ mint, pnl, roi, result: 'breakeven' });
                    }
                }
            }

            const totalClosed = wins + losses + breakeven;
            const winrate = totalClosed > 0 ? (wins / totalClosed * 100) : 0;

            return {
                address: walletAddress,
                wins,
                losses,
                breakeven,
                totalClosed,
                winrate: winrate.toFixed(1),
                avgWin: tokenResults.filter(t => t.result === 'win').reduce((sum, t) => sum + t.pnl, 0) / Math.max(wins, 1),
                avgLoss: tokenResults.filter(t => t.result === 'loss').reduce((sum, t) => sum + t.pnl, 0) / Math.max(losses, 1),
                topTrades: tokenResults.sort((a, b) => b.pnl - a.pnl).slice(0, 5)
            };
        } catch (error) {
            console.error('Get wallet winrate error:', error);
            throw error;
        }
    }

    // Get top traders for a token (by profit and ROI)
    async getTopTraders(tokenMint) {
        try {
            // First get holders
            const holders = await this.getTokenHolders(tokenMint, 20);
            
            // Analyze each holder's trading performance for this token
            const traderStats = await Promise.all(
                holders.slice(0, 10).map(async (holder) => {
                    try {
                        const txs = await this.getTransactions(holder.address, 50);
                        
                        // Filter for transactions involving this token
                        let bought = 0;
                        let sold = 0;
                        let buySpent = 0;
                        let sellReceived = 0;
                        let firstBuy = null;

                        for (const tx of txs) {
                            const transfers = tx.tokenTransfers?.filter(t => t.mint === tokenMint) || [];
                            if (transfers.length === 0) continue;

                            const solFlow = (tx.nativeTransfers || []).reduce((sum, t) => {
                                if (t.toUserAccount === holder.address) return sum + (t.amount || 0);
                                if (t.fromUserAccount === holder.address) return sum - (t.amount || 0);
                                return sum;
                            }, 0) / 1e9;

                            for (const transfer of transfers) {
                                if (transfer.toUserAccount === holder.address) {
                                    bought += transfer.tokenAmount || 0;
                                    buySpent += Math.abs(solFlow);
                                    if (!firstBuy) firstBuy = tx.timestamp;
                                } else if (transfer.fromUserAccount === holder.address) {
                                    sold += transfer.tokenAmount || 0;
                                    sellReceived += Math.abs(solFlow);
                                }
                            }
                        }

                        const realizedPnL = sellReceived - buySpent;
                        const roi = buySpent > 0 ? (realizedPnL / buySpent * 100) : 0;
                        const stillHolding = holder.uiAmount > 0;

                        return {
                            address: holder.address,
                            bought,
                            sold,
                            stillHolding,
                            currentHolding: holder.uiAmount,
                            buySpent: buySpent.toFixed(4),
                            sellReceived: sellReceived.toFixed(4),
                            realizedPnL: realizedPnL.toFixed(4),
                            roi: roi.toFixed(1),
                            firstBuy
                        };
                    } catch (e) {
                        return null;
                    }
                })
            );

            // Filter and sort by realized profit
            return traderStats
                .filter(t => t && parseFloat(t.realizedPnL) !== 0)
                .sort((a, b) => parseFloat(b.realizedPnL) - parseFloat(a.realizedPnL));
        } catch (error) {
            console.error('Get top traders error:', error);
            throw error;
        }
    }

    // Get early buyers who are still holding (diamond hands)
    async getEarlyBuyers(tokenMint, stillHoldingOnly = false) {
        try {
            const holders = await this.getTokenHolders(tokenMint, 20);
            
            const buyerData = await Promise.all(
                holders.map(async (holder) => {
                    try {
                        const txs = await this.getTransactions(holder.address, 100);
                        
                        // Find first buy of this token
                        let firstBuyTime = null;
                        let firstBuyAmount = 0;
                        let totalBought = 0;
                        let totalSold = 0;

                        for (const tx of txs.reverse()) { // oldest first
                            const transfers = tx.tokenTransfers?.filter(t => t.mint === tokenMint) || [];
                            
                            for (const transfer of transfers) {
                                if (transfer.toUserAccount === holder.address) {
                                    totalBought += transfer.tokenAmount || 0;
                                    if (!firstBuyTime) {
                                        firstBuyTime = tx.timestamp;
                                        firstBuyAmount = transfer.tokenAmount || 0;
                                    }
                                } else if (transfer.fromUserAccount === holder.address) {
                                    totalSold += transfer.tokenAmount || 0;
                                }
                            }
                        }

                        const stillHolding = holder.uiAmount > 0;
                        const holdingPercent = totalBought > 0 ? (holder.uiAmount / totalBought * 100) : 0;

                        return {
                            address: holder.address,
                            firstBuyTime,
                            firstBuyAmount,
                            totalBought,
                            totalSold,
                            currentHolding: holder.uiAmount,
                            stillHolding,
                            holdingPercent: holdingPercent.toFixed(1),
                            isDiamondHands: stillHolding && holdingPercent > 50
                        };
                    } catch (e) {
                        return null;
                    }
                })
            );

            let results = buyerData
                .filter(b => b && b.firstBuyTime)
                .sort((a, b) => a.firstBuyTime - b.firstBuyTime);

            if (stillHoldingOnly) {
                results = results.filter(b => b.stillHolding);
            }

            return results.slice(0, 15);
        } catch (error) {
            console.error('Get early buyers error:', error);
            throw error;
        }
    }

    // Get wallet's performance on a specific token
    async getWalletTokenPnL(walletAddress, tokenMint) {
        try {
            const txs = await this.getTransactions(walletAddress, 100);
            
            let bought = 0;
            let sold = 0;
            let buySpent = 0;
            let sellReceived = 0;
            let trades = [];
            let firstBuy = null;
            let lastTrade = null;

            for (const tx of txs) {
                const transfers = tx.tokenTransfers?.filter(t => t.mint === tokenMint) || [];
                if (transfers.length === 0) continue;

                const solFlow = (tx.nativeTransfers || []).reduce((sum, t) => {
                    if (t.toUserAccount === walletAddress) return sum + (t.amount || 0);
                    if (t.fromUserAccount === walletAddress) return sum - (t.amount || 0);
                    return sum;
                }, 0) / 1e9;

                for (const transfer of transfers) {
                    if (transfer.toUserAccount === walletAddress) {
                        bought += transfer.tokenAmount || 0;
                        buySpent += Math.abs(solFlow);
                        if (!firstBuy) firstBuy = tx.timestamp;
                        trades.push({ type: 'buy', amount: transfer.tokenAmount, sol: Math.abs(solFlow), time: tx.timestamp });
                    } else if (transfer.fromUserAccount === walletAddress) {
                        sold += transfer.tokenAmount || 0;
                        sellReceived += Math.abs(solFlow);
                        trades.push({ type: 'sell', amount: transfer.tokenAmount, sol: Math.abs(solFlow), time: tx.timestamp });
                    }
                    lastTrade = tx.timestamp;
                }
            }

            // Get current balance
            const balances = await this.getBalances(walletAddress);
            const currentHolding = balances.tokens.find(t => t.mint === tokenMint);
            const holdingAmount = currentHolding ? currentHolding.amount / Math.pow(10, currentHolding.decimals || 0) : 0;

            const realizedPnL = sellReceived - buySpent;
            const roi = buySpent > 0 ? (realizedPnL / buySpent * 100) : 0;
            const avgBuyPrice = bought > 0 ? buySpent / bought : 0;
            const avgSellPrice = sold > 0 ? sellReceived / sold : 0;

            return {
                wallet: walletAddress,
                token: tokenMint,
                totalBought: bought,
                totalSold: sold,
                currentHolding: holdingAmount,
                buySpent: buySpent.toFixed(4),
                sellReceived: sellReceived.toFixed(4),
                realizedPnL: realizedPnL.toFixed(4),
                roi: roi.toFixed(1),
                avgBuyPrice: avgBuyPrice.toFixed(8),
                avgSellPrice: avgSellPrice.toFixed(8),
                firstBuy,
                lastTrade,
                tradeCount: trades.length,
                trades: trades.slice(0, 10)
            };
        } catch (error) {
            console.error('Get wallet token PnL error:', error);
            throw error;
        }
    }
}
