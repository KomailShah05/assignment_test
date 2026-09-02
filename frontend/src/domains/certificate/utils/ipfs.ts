/**
 * Certificate metadata storage.
 *
 * The full certificate document lives off-chain; only its CID goes on-chain.
 * Two backends are supported behind one interface:
 *
 *  - "pinata"  real pinning, enabled by setting VITE_PINATA_JWT
 *  - "local"   offline fallback used when no credentials are configured
 *
 * The local backend still derives a genuine CIDv1 (raw codec, sha2-256,
 * base32) from the exact bytes, so the identifier written on-chain is a real
 * content address and matches `ipfs add --cid-version=1 --raw-leaves`. It is
 * simply not announced to the IPFS network.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PINATA_ENDPOINT = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

export const IPFS_GATEWAY =
  (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? 'https://ipfs.io/ipfs/';

const LOCAL_STORE_KEY = 'certificate-metadata-store';

export type CertificateMetadata = {
  studentId: number;
  studentName: string;
  course: string;
  grade?: string;
  issuedAt: string;
  issuedBy: string;
  description?: string;
};

export const isPinningConfigured = () => Boolean(PINATA_JWT);

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** RFC 4648 base32, lower-case, no padding — the multibase 'b' encoding. */
const toBase32 = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

/**
 * CIDv1, raw codec (0x55), sha2-256 (0x12, 32 bytes), base32 multibase ('b').
 */
export const computeCid = async (content: string) => {
  const bytes = new TextEncoder().encode(content);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

  const cid = new Uint8Array(4 + digest.length);
  cid[0] = 0x01; // CID version 1
  cid[1] = 0x55; // raw codec
  cid[2] = 0x12; // sha2-256
  cid[3] = digest.length;
  cid.set(digest, 4);

  return `b${toBase32(cid)}`;
};

type LocalStore = Record<string, string>;

const readLocalStore = (): LocalStore => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORE_KEY) ?? '{}') as LocalStore;
  } catch {
    return {};
  }
};

const writeLocalStore = (store: LocalStore) => {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private window, quota). The CID is still valid and
    // still recorded on-chain; only local retrieval is lost.
  }
};

const pinToPinata = async (metadata: CertificateMetadata) => {
  const response = await fetch(PINATA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PINATA_JWT}`
    },
    body: JSON.stringify({ pinataContent: metadata })
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed (${response.status})`);
  }

  const { IpfsHash } = (await response.json()) as { IpfsHash: string };
  return IpfsHash;
};

/** Stores metadata and returns the CID to record on-chain. */
export const uploadMetadata = async (metadata: CertificateMetadata) => {
  const content = JSON.stringify(metadata);

  if (isPinningConfigured()) {
    return pinToPinata(metadata);
  }

  const cid = await computeCid(content);
  const store = readLocalStore();
  store[cid] = content;
  writeLocalStore(store);
  return cid;
};

/** Resolves metadata for a CID, preferring the local store then the gateway. */
export const fetchMetadata = async (cid: string): Promise<CertificateMetadata | null> => {
  const local = readLocalStore()[cid];
  if (local) {
    try {
      return JSON.parse(local) as CertificateMetadata;
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(`${IPFS_GATEWAY}${cid}`);
    if (!response.ok) return null;
    return (await response.json()) as CertificateMetadata;
  } catch {
    return null;
  }
};
