# Certificate Registry (Problem 3)

Blockchain-backed certificate issuance and verification for the school
management system.

## What is on-chain vs off-chain

The full certificate document is stored off-chain and content-addressed; only
its CID, the fields needed to verify it, and the revocation flag live in the
contract. Verification therefore never depends on the application database.

## Setup

```bash
cd blockchain
npm install
npm run compile
npm test            # 15 tests
```

Run a local chain and deploy:

```bash
npm run node        # terminal 1 - starts 127.0.0.1:8545
npm run deploy:local # terminal 2
```

`deploy:local` writes the deployed address and ABI to
`frontend/src/domains/certificate/contract/certificate-registry.json`, so the
frontend picks up a fresh deployment with no manual copying.

Point MetaMask at `http://127.0.0.1:8545` (chain id `31337`) and import one of
the private keys Hardhat prints on startup. The deploying account is the owner
and the first issuer.

## Contract

`CertificateRegistry.sol`

| Function | Access | Notes |
|---|---|---|
| `issueCertificate` | issuer | Rejects duplicate ids, zero ids and empty CIDs |
| `revokeCertificate` | issuer | Marks revoked; the record stays readable |
| `verifyCertificate` | public view | Returns `(isValid, certificate)`; never reverts |
| `getCertificate` | public view | Reverts on unknown id |
| `computeCertificateId` | pure | `keccak256(studentId, course, issuedAt)` |
| `addIssuer` / `removeIssuer` | owner | |

Ids are deterministic, so a verifier can recompute one from the printed
certificate fields rather than trusting a supplied id.

`verifyCertificate` deliberately returns `false` for an unknown id instead of
reverting, so a public verification page can be called with arbitrary input.

## IPFS metadata

`frontend/src/domains/certificate/utils/ipfs.ts` stores metadata behind one
interface with two backends:

- **Pinata** - used when `VITE_PINATA_JWT` is set; genuinely pins to IPFS.
- **Local** - the default. Derives a real CIDv1 (raw codec, sha2-256, base32)
  from the exact bytes and keeps the document in `localStorage`.

The local CID is a genuine content address and matches what
`ipfs add --cid-version=1 --raw-leaves` produces; it is simply not announced to
the network. This keeps the feature demonstrable with no credentials.

Optional frontend environment variables:

```
VITE_RPC_URL=http://127.0.0.1:8545
VITE_PINATA_JWT=          # enables real pinning
VITE_IPFS_GATEWAY=https://ipfs.io/ipfs/
```

## Admin pages

| Route | Purpose |
|---|---|
| `/app/certificates` | List issued certificates, revoke |
| `/app/certificates/issue` | Issue a new certificate |
| `/app/certificates/verify` | Verify by id (no wallet needed) |

Routes are gated by the app's permission data, so run once:

```bash
psql -d school_mgmt -f seed_db/certificate-access-controls.sql
```

The file is idempotent and safe to re-run.
