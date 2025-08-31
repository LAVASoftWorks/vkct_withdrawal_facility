/**
 * Initializes the NFT that contains the withdrawal script
 * 
 * npx esrun token_initializer.ts
 */

import { createGenericFile, createSignerFromKeypair, keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { base58 } from '@metaplex-foundation/umi/serializers';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { getKeypairFromFile, } from "@solana-developers/helpers";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { promises as fs } from "fs";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { percentAmount } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createSplAssociatedTokenProgram } from "@metaplex-foundation/mpl-toolbox";
import { getTransactionCost } from './helpers/getTransactionCost';
import { getUploadPriceInSol } from "./helpers/getUploadPriceInSol";
import os from 'os';

//
// Note: needed vars
//

const ASSET_NAME           = "VKCT Withdrawal Facility";
const ASSET_SYMBOL         = "VKCTWF"; // Warn: 10 chars max
const ASSET_DESCRIPTION    = "A token that stores the stand-alone HTML page used to withdraw fungible tokens owned by NFTs built with the VolkaChain Tokenizer Framework";
const ASSET_IMAGE_PATH     = "icon.png";
const ASSET_FILE           = "index.html";
const ASSET_VERSION        = "1.0.0";
const ASSET_SIGNER_KEYPAIR = os.homedir() + "/.config/solana/asset.json";

//
// Segment: init connections
//

// create a new connection
const connection = new Connection(clusterApiUrl("mainnet-beta"));

// load keypair from local file system
// assumes that the keypair is already generated using `solana-keygen new`
const user = await getKeypairFromFile();
console.log("Loaded user:", user.publicKey.toBase58());

const umi        = createUmi(connection).use(irysUploader());
const umiKeypair = umi.eddsa.createKeypairFromSecretKey(user.secretKey);
umi.use(keypairIdentity(umiKeypair)).use(mplTokenMetadata());
umi.programs.add(createSplAssociatedTokenProgram(), true);

//
// Segment: upload offchain files
//

console.log("Uploading image...");
const buffer = await fs.readFile(ASSET_IMAGE_PATH);
let file = createGenericFile(buffer, ASSET_IMAGE_PATH, {contentType: "image/png"});
const [image] = await umi.uploader.upload([file]);
console.log(">>> Image uri:", image);
const imgUploadCost = await getUploadPriceInSol(umi, buffer, "image/png");
console.log(`>>> Image upload cost: ${imgUploadCost} SOL`);

console.log("Uploading file...");
const buffer2 = await fs.readFile(ASSET_FILE);
let file2 = createGenericFile(buffer2, ASSET_FILE, {contentType: "text/html"});
const [htmlfile] = await umi.uploader.upload([file2]);
console.log(">>> File uri:", htmlfile);
const htmlUploadCost = await getUploadPriceInSol(umi, buffer, "text/html");
console.log(`>>> File upload cost: ${htmlUploadCost} SOL`);

let NFT_METADATA = {
    name: ASSET_NAME,
    symbol: ASSET_SYMBOL,
    description: ASSET_DESCRIPTION,
    image,
    animation_url: htmlfile,
    external_url: htmlfile,
    attributes: [
        {
            trait_type: "Version",
            value:      ASSET_VERSION
        },
        {
            trait_type: "GitHub repo",
            value:      "https://github.com/LAVASoftWorks/vkct_withdrawal_facility"
        },
    ],
    properties: {
        files: [
            {
                uri: image,
                type: "image/png",
            },
        ],
        category: "image",
    },
};

// upload offchain json using irys and get metadata uri
console.log("Uploading metadata...");
const uri = await umi.uploader.uploadJson(NFT_METADATA);
console.log(">>> Metadata URI:", uri);
const mdUploadCost = await getUploadPriceInSol(umi, Buffer.from(JSON.stringify(NFT_METADATA)), "application/json");
console.log(`>>> Metadata upload cost: ${mdUploadCost} SOL`);

//
// Segment: push the asset
//

const secret  = Uint8Array.from(JSON.parse(await fs.readFile(ASSET_SIGNER_KEYPAIR, "utf8")));
const kp      = umi.eddsa.createKeypairFromSecretKey(secret);
const nftMint = createSignerFromKeypair(umi, kp);

console.log("Minting...");
const transaction = await createNft(umi, {
    payer: umi.identity,
    mint: nftMint,
    authority: umi.identity,
    uri,
    name: ASSET_NAME,
    symbol: ASSET_SYMBOL,
    sellerFeeBasisPoints: percentAmount(0),
    decimals: 0,
    tokenOwner: publicKey(user.publicKey)
}).sendAndConfirm(umi);

const txsignature = base58.deserialize(transaction.signature)[0];
const private_key = JSON.stringify(Array.from(nftMint.secretKey));
console.log(`>>> Asset address:         ${nftMint.publicKey}`);
console.log(`>>> Transaction signature: ${txsignature}`);
try {
    const { fee, totalSpent } = await getTransactionCost(connection, txsignature, new PublicKey(umi.identity.publicKey));
    console.log('>>> Minting fee: ', fee / 1e9, 'SOL');
    console.log('>>> Minting cost:', totalSpent / 1e9, 'SOL');
} catch (err) {
    console.log('Warning: ', err);
}
console.log("✅ Minting complete.");
