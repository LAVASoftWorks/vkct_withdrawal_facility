/**
 * Helper to get upload to Irys cost
 */

import { createGenericFile, Umi } from '@metaplex-foundation/umi';

export async function getUploadPriceInSol(
    umi: Umi,
    data: Buffer | Uint8Array,
    fileName: string,
    contentType: string = 'application/octet-stream'
): Promise<number> {
    const genericFile = createGenericFile(data, fileName, { contentType });
    const price = await umi.uploader.getUploadPrice([genericFile]);
    return Number(price.basisPoints) / 1e9; // Convert lamports to SOL
}
