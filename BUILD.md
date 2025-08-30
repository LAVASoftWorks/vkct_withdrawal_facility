
# VolkaChain Withdrawal Facility Build Instructions

You don't need to build anything, but, still here are the simple steps to build it.

**Important**: the steps below were made on a topped Ubuntu 24 server.

## Preinits

Before starting up, make sure you have Node.js installed.

```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
# Restart session before continuing

nvm install stable --lts
```

## Installing dependencies

Just go for

```shell
npm install
```

The `install_prereqs.sh` file has the list of packages and versions as reference.

## Install the Solana wallet

```shell
cd ~
sh -c "$(curl -sSfL https://release.anza.xyz/v2.2.3/install)"
# Restart SSH session
```

Then pick your poison:

For devnet:

```shell
solana config set --url "https://api.devnet.solana.com"
```

For mainnet:

```shell
solana config set --url "https://api.mainnet-beta.solana.com"
```

Then set up a keypair to pay the fees:

```shell
solana-keygen new --no-bip39-passphrase

# Output:
#> Wrote new keypair to /home/user/.config/solana/id.json
#> =============================================================================
#> pubkey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#> =============================================================================
#> Save this seed phrase to recover your new keypair:
#> xxxx xxxxxxx xxxxxx xxxxxx xxxxxxx xxxxx xxxxx xxxx xxxxx xxxxxxxx xxxxx xxxx
#> =============================================================================
```

**Important:** save the pubkey and seed phrase somewhere safe!

## That's all

Now you should be able to run the TS scripts.
