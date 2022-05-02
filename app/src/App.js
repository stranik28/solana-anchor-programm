import logo from './logo.svg';
import { useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, Provider, web3, BN } from '@project-serum/anchor';
import { Buffer } from 'buffer';
import idl from './donation.json';
import * as anchor from "@project-serum/anchor";

window.Buffer = Buffer; // for "Buffer is not defined"

const { SystemProgram, Keypair } = web3;
/* create an account  */
const crudAccount = Keypair.generate();
const opts = {
  preflightCommitment: "processed"
}
const programID = new PublicKey(idl.metadata.address);
const donationBank = new PublicKey("4tC2SuPgKn1hFfVLVUWAFUZSeBctQGaVkSqxWcMSRxnd");
const network = clusterApiUrl('devnet');

function App() {
  const [donationSize, setDonationSize] = useState("10000");
  const [donor, setDonorValue] = useState();
  const [donationBankBalance, setDonationBankBalance] = useState(0);

  async function connectWallet() {
    try {
      const resp = await window.solana.connect();
      console.log("Connected! Public Key: ", resp.publicKey.toString());
    } catch (err) {
      console.log(err);
    }
  }

  async function disconnectWallet() {
    window.solana.disconnect();
    window.solana.on('disconnect', () => console.log("Disconnected!"));
  }


  async function getProvider() {
    const connection = new Connection(network, opts.preflightCommitment);
    const wallet = window.solana;

    const provider = new Provider(
        connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  async function makeDonation() {
    if (!donationSize) return;

    const provider = await getProvider();
    const program = new Program(idl, programID, provider);

    program.methods.makeDonation(new BN(donationSize))
        .accounts({
          donationBank,
          donor: provider.wallet.publicKey,
        })
        .rpc();
  }

  async function withdraw() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);

    await program.methods.withdraw()
        .accounts({
          donationBank,
          authority: provider.wallet.publicKey,
          destination: provider.wallet.publicKey,
        })
        .rpc();
  }

  async function listDonors() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);

    const all = await program.account.registry.all([
      {
        memcmp: {
          offset: 8, // Discriminator
          bytes: anchor.utils.bytes.bs58.encode(donationBank.toBuffer())
        }
      }
    ]);

    all.map(registry => registry.account.donor).forEach(donor => console.log("Donor: ", donor.toString()));
  }

  async function getDonationsForDonor() {
    if (!donor) return;

    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    const donorKey = new PublicKey(donor);

    const [registry, _registryBump] = await web3.PublicKey.findProgramAddress(
        [donationBank.toBuffer(), donorKey.toBuffer()], program.programId
    );

    let registryAccount = await program.account.registry.fetchNullable(registry);
    if (registryAccount) {
      console.log("Donor ", donorKey.toString(), " has made donations for ", registryAccount.amount.toNumber() / web3.LAMPORTS_PER_SOL, " SOL");
    } else {
      console.log("Donor ", donorKey.toString(), " has never made any donations!");
    }
  }

  return (
      <div className="App">
        <header className="App-header">
          <button onClick={connectWallet}>1. Connect to Wallet</button>
          <br/>
          <button onClick={makeDonation}>2. Make a Donation</button>
          <br/>
          <input onChange={e => setDonationSize(e.target.value)} placeholder="Lamports" />
          <br/>

          <button onClick={withdraw}>3. Withdraw</button>
          <br/>
          <button onClick={listDonors}>4. List Donors </button>
          <br/>
          <button onClick={getDonationsForDonor}>5. Get Donations for Donor</button>
          <br/>
          <input onChange={e => setDonorValue(e.target.value)} placeholder="Donor" />
          <button onClick={disconnectWallet}>6. Disconnect</button>
      
        </header>
      </div>
  );
}

export default App;
