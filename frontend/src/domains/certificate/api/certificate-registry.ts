import { BrowserProvider, Contract, JsonRpcProvider, getBigInt, keccak256 } from 'ethers';
import registry from '../contract/certificate-registry.json';
import { Certificate, IssueCertificateInput, VerificationResult } from '../types';
import { uploadMetadata } from '../utils/ipfs';

const RPC_URL = (import.meta.env.VITE_RPC_URL as string | undefined) ?? 'http://127.0.0.1:8545';

export const CONTRACT_ADDRESS = registry.address;

/** Read-only contract — used by the public verify page, no wallet required. */
const getReadContract = () => new Contract(registry.address, registry.abi, new JsonRpcProvider(RPC_URL));

/** Write contract — requires a connected wallet to sign. */
const getWriteContract = async () => {
  if (!window.ethereum) throw new Error('MetaMask not detected');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(registry.address, registry.abi, signer);
};

type RawCertificate = {
  studentId: bigint;
  studentName: string;
  course: string;
  metadataCid: string;
  issuedAt: bigint;
  issuer: string;
  revoked: boolean;
};

const toCertificate = (certificateId: string, raw: RawCertificate): Certificate => ({
  certificateId,
  studentId: Number(raw.studentId),
  studentName: raw.studentName,
  course: raw.course,
  metadataCid: raw.metadataCid,
  issuedAt: Number(raw.issuedAt),
  issuer: raw.issuer,
  revoked: raw.revoked
});

export const issueCertificate = async (input: IssueCertificateInput) => {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const contract = await getWriteContract();

  // Metadata goes to IPFS first: the CID is part of what we commit on-chain.
  const cid = await uploadMetadata({
    studentId: input.studentId,
    studentName: input.studentName,
    course: input.course,
    grade: input.grade,
    description: input.description,
    issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
    issuedBy: await (await (await new BrowserProvider(window.ethereum!).getSigner()).getAddress())
  });

  const certificateId: string = await contract.computeCertificateId(
    input.studentId,
    input.course,
    issuedAtSeconds
  );

  const tx = await contract.issueCertificate(
    certificateId,
    input.studentId,
    input.studentName,
    input.course,
    cid,
    issuedAtSeconds
  );
  const receipt = await tx.wait();

  return { certificateId, cid, txHash: receipt?.hash as string };
};

export const revokeCertificate = async (certificateId: string) => {
  const contract = await getWriteContract();
  const tx = await contract.revokeCertificate(certificateId);
  const receipt = await tx.wait();
  return { txHash: receipt?.hash as string };
};

export const verifyCertificate = async (certificateId: string): Promise<VerificationResult> => {
  const contract = getReadContract();
  const [isValid, raw] = await contract.verifyCertificate(certificateId);

  // An unknown id returns a zeroed struct rather than reverting.
  const found = raw.metadataCid !== '';
  return {
    found,
    isValid,
    certificate: found ? toCertificate(certificateId, raw) : null
  };
};

export const listCertificates = async (): Promise<Certificate[]> => {
  const contract = getReadContract();
  const total = Number(await contract.totalCertificates());

  const ids: string[] = await Promise.all(
    Array.from({ length: total }, (_, i) => contract.certificateIdAt(i))
  );

  return Promise.all(
    ids.map(async (id) => toCertificate(id, await contract.getCertificate(id)))
  );
};

/** Lets a verifier recompute an id from the printed certificate fields. */
export const computeCertificateId = async (studentId: number, course: string, issuedAt: number) => {
  const contract = getReadContract();
  return (await contract.computeCertificateId(studentId, course, issuedAt)) as string;
};

export const isCertificateIdFormat = (value: string) => /^0x[0-9a-fA-F]{64}$/.test(value);

export { getBigInt, keccak256 };
