/**
 * npx esrun token_updater.ts
 * 
 * @see https://solana.com/developers/courses/tokens-and-nfts/nfts-with-metaplex-core
 */

import { createGenericFile, keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { base58 } from '@metaplex-foundation/umi/serializers';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { fetchDigitalAsset, updateMetadataAccountV2, MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createSplAssociatedTokenProgram } from "@metaplex-foundation/mpl-toolbox";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { promises as fs } from "fs";
import {getUploadPriceInSol} from "./helpers/getUploadPriceInSol";
import {getTransactionCost} from "./helpers/getTransactionCost";

//
// Note: needed vars
//

const ASSET_ADDRESS          = "2GHEknBpEFqCcwHQ3pfhtWTWNe4e3qTDtSBiP2HjCmwn";
const TOKEN_METADATA_PROGRAM = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
const NEW_ASSET_FILE         = "index.html";
const NEW_ASSET_VERSION      = "0.0.14";

//
// Segment: load coins for devnet
//

// create a new connection to Solana's devnet cluster
const connection = new Connection(clusterApiUrl("devnet"));

// load keypair from local file system
// See https://github.com/solana-developers/helpers?tab=readme-ov-file#get-a-keypair-from-a-keypair-file
// assumes that the keypair is already generated using `solana-keygen new`
const user = await getKeypairFromFile();
console.log("Starting update token to version", NEW_ASSET_VERSION);
console.log("Asset:", ASSET_ADDRESS);
console.log("Loaded user:", user.publicKey.toBase58());

//
// Segment: init connections
//

// create a new connection to Solana's devnet cluster
const umi = createUmi(connection).use(irysUploader());
const umiKeypair = umi.eddsa.createKeypairFromSecretKey(user.secretKey);
umi.use(keypairIdentity(umiKeypair)).use(mplTokenMetadata());
umi.programs.add(createSplAssociatedTokenProgram(), true);

//
// Segment: preload asset
//

console.log("Fetching asset...");
const asset = await fetchDigitalAsset(umi, publicKey(ASSET_ADDRESS));

console.log("Current metadata URI:", asset.metadata.uri);
type  schema = {
                  name: string,
                  symbol: string,
                  description: string,
                  image: string,
                  animation_url: string,
                  external_url: string,
                  attributes: object[],
                  properties: object
              };
let metadata = await umi.downloader.downloadJson<schema>(asset.metadata.uri);

console.log("Uploading new file...");
const buffer = await fs.readFile(NEW_ASSET_FILE);
let file = createGenericFile(buffer, NEW_ASSET_FILE, {contentType: "text/html"});
const [htmlURI] = await umi.uploader.upload([file]);
console.log(">>> New file uri:", htmlURI);
const fUploadCost = await getUploadPriceInSol(umi, buffer, "text/html");
console.log(`>>> File upload cost: ${fUploadCost} SOL`);

metadata.animation_url = htmlURI;
metadata.external_url  = htmlURI;
metadata.attributes[0] = {trait_type: "Version", value: NEW_ASSET_VERSION };

// upload offchain json using irys and get metadata uri
console.log("Uploading metadata...");
const uri = await umi.uploader.uploadJson(metadata);
console.log(">>> New metadata URI:", uri);
const mdUploadCost = await getUploadPriceInSol(umi, Buffer.from(JSON.stringify(metadata)), "application/json");
console.log(`>>> Metadata upload cost: ${mdUploadCost} SOL`);

//
// Segment: update the asset
//

const metadataSeeds = [
    Buffer.from('metadata'),
    TOKEN_METADATA_PROGRAM.toBuffer(),
    new PublicKey(ASSET_ADDRESS).toBuffer(),
];
const [metadataPda] = umi.eddsa.findPda(MPL_TOKEN_METADATA_PROGRAM_ID, metadataSeeds);

// Update collection data
const src_meta  = asset.metadata;
src_meta.uri = uri;
const txBuilder = updateMetadataAccountV2(umi, {
    metadata: metadataPda,
    updateAuthority: umi.identity,
    data: src_meta
});

const update_tx = await txBuilder.sendAndConfirm(umi);
const usignature = base58.deserialize(update_tx.signature)[0];
console.log(`>>> Transaction signature: ${usignature}`);
try {
    const { fee, totalSpent } = await getTransactionCost(connection, usignature, new PublicKey(umi.identity.publicKey));
    console.log('>>> Update fee: ', fee / 1e9, 'SOL');
    console.log('>>> Update cost:', totalSpent / 1e9, 'SOL');
} catch (err) {
    console.log('Warning: ', err);
}
console.log("✅ Update complete.");
