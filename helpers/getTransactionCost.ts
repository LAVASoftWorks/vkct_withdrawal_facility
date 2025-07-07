/**
 * Helper to get transaction cost
 */

import { Connection, PublicKey } from '@solana/web3.js';

export async function getTransactionCost(
    connection: Connection,
    signature: string,
    payerPubkey: PublicKey
): Promise<{ fee: number; totalSpent: number }> {
    
    let maxWait = 30, waited = 0;
    process.stdout.write("Waiting for transaction to finalize [");
    let isConfirmed = false;
    while (!isConfirmed) {
        const status = await connection.getSignatureStatus(signature);
        if (status && status.value && status.value.confirmationStatus === 'finalized') {
            isConfirmed = true;
        } else {
            process.stdout.write(".");
            waited++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if( waited > maxWait )
        {
            let sWaited = waited === 0 ? '<1' : waited;
            process.stdout.write(`] ${sWaited} secs.\n`);
            throw new Error('Transaction finalization check timeout.');
        }
    }
    let sWaited = waited === 0 ? '<1' : waited;
    process.stdout.write(`] ${sWaited} secs.\n`);
    
    const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta || !tx.transaction) throw new Error('Transaction not found or not confirmed');
    
    let accountKeys: PublicKey[] = [];
    
    // Type guard: message is v0 if staticAccountKeys exists
    if ('staticAccountKeys' in tx.transaction.message) {
        // Versioned transaction (v0)
        accountKeys = tx.transaction.message.staticAccountKeys as PublicKey[];
    } else if ('accountKeys' in tx.transaction.message) {
        // @ts-ignore Legacy transaction
        accountKeys = tx.transaction.message.accountKeys as PublicKey[];
    } else {
        throw new Error('No account keys found in transaction message');
    }
    
    const payerIndex = accountKeys.findIndex(key => key.equals(payerPubkey));
    if (payerIndex < 0) throw new Error('Payer not found in transaction');
    
    const fee        = tx.meta.fee;
    const totalSpent = tx.meta.preBalances[payerIndex] - tx.meta.postBalances[payerIndex];
    return { fee, totalSpent };
}
