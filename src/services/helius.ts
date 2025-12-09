import axios from 'axios';
import { Buy } from '../types';

const API_KEY = "90bbbbc2-00cf-4703-a17f-f5d3408c9b6c";
const BASE = `https://api.helius.xyz/v0`;

export async function getSignatures(mint: string) {
    const res = await axios.get(`${BASE}/addresses/${mint}/transactions`, {
        params: { 'api-key': API_KEY, limit: 100 }
    });
    return res.data as any[];
}

export async function getParsedTx(sigs: string[]) {
    const res = await axios.post(
        `https://api.helius.xyz/v0/transactions`,
        { transactions: sigs.map((s: any) => s.signature) },
        {
            params: { 'api-key': API_KEY },
            headers: { 'Content-Type': 'application/json' }
        }
    );
    return res.data;
}

export function isTokenBuy(tx: any, mint: string): Buy | null {
    if (tx.transactionError) return null;

    // 1. Find the payer (feePayer = first account in message)
    const payer = tx.feePayer;

    // 2. Look at accountData → tokenBalanceChanges for our mint
    const tokenChanges = tx.accountData
        .flatMap((a: any) => a.tokenBalanceChanges ?? [])
        .filter((c: any) => c.mint === mint);

    if (tokenChanges.length === 0) return null;

    // 3. The *buyer* receives a **positive** amount
    const received = tokenChanges.find((c: any) => {
        const amount = Number(c.rawTokenAmount.tokenAmount);
        return amount > 0 && c.userAccount === payer;
    });

    if (!received) return null;

    // 4. How much SOL did the payer spend?
    const payerAcc = tx.accountData.find((a: any) => a.account === payer);
    if (!payerAcc) return null;

    const solSpentLamports = -payerAcc.nativeBalanceChange; // negative = spent
    if (solSpentLamports <= 1000) return null; // < 0.001 SOL

    const solIn = Number((solSpentLamports / 1e9).toFixed(4));

    return {
        wallet: payer,
        solIn,
        blockTime: tx.timestamp,
        bundleId: tx.bundleId,
        walletAge: 0,
        walletTxCount: 0,
    };
}

const walletCache = new Map<string, { age: number; count: number }>();

export async function enrichWallet(wallet: string): Promise<{ age: number; count: number }> {
    if (walletCache.has(wallet)) return walletCache.get(wallet)!;

    const txs = await axios.get(
        `${BASE}/addresses/${wallet}/transactions?api-key=${API_KEY}&limit=1000`
    );
    const data = txs.data;
    const age = data[0] ? Date.now() / 1000 - data[0].blockTime : Infinity;
    const count = data.length;

    walletCache.set(wallet, { age, count });
    return { age, count };
}


export async function enrichWalletsBatch(wallets: string[]) {
    const res = await axios.get(`${BASE}/addresses`, {
        params: { addresses: wallets.join(','), 'api-key': API_KEY }
    });
    const data = res.data as Array<{ address: string; transactions: any[] }>;

    const result: Record<string, { age: number; count: number }> = {};

    for (const item of data) {
        const age = item.transactions[0] ? Date.now() / 1000 - item.transactions[0].blockTime : Infinity;
        result[item.address] = { age, count: item.transactions.length };
    }

    // Fill missing wallets
    for (const w of wallets) {
        if (!result[w]) result[w] = { age: Infinity, count: 0 };
    }

    return result;
}

export function std(arr: number[]) {
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    return Math.sqrt(arr.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / arr.length);
}