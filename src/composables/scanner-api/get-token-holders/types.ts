export interface TokenHolder {
    owner: string              // wallet address that owns the tokens
    amount: number             // raw amount (in smallest unit)
    humanReadableAmount: number // decimal-adjusted amount
    accountAddress: string     // associated token account (ATA)
}

export interface TokenHoldersAPIResponse {
    holders: TokenHolder[]
    count: number
    stats: {
        uniqueHolders: number
        totalSupply: number
        averageBalance: number
    }
}

export type TokenHoldersError = {
    message: string
}