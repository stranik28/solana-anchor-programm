// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const anchor = require("@project-serum/anchor");

import { Program } from "@project-serum/anchor";
import { Donation } from "../target/types/donation";

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);
  const program = anchor.workspace.Donation as  Program<Donation>;

  // Add your deploy script here.
  await program.methods.initialize(provider.wallet.publicKey)
      .accounts({
        payer: provider.wallet.publicKey,
      })
      .rpc();

    const [donationBank, _bump] = await anchor.web3.PublicKey.findProgramAddress(
        [provider.wallet.publicKey.toBuffer()], program.programId);

  console.log("Authority: ", provider.wallet.publicKey.toString());
  console.log("DonationBank: ", donationBank.toString());
};
