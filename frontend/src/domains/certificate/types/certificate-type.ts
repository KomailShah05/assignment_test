export type Certificate = {
  certificateId: string;
  studentId: number;
  studentName: string;
  course: string;
  metadataCid: string;
  issuedAt: number;
  issuer: string;
  revoked: boolean;
};

export type VerificationResult = {
  found: boolean;
  isValid: boolean;
  certificate: Certificate | null;
};

export type IssueCertificateInput = {
  studentId: number;
  studentName: string;
  course: string;
  grade?: string;
  description?: string;
};
