import { z } from 'zod';

export const IssueCertificateSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, 'Student ID is required')
    .regex(/^\d+$/, 'Student ID must be a number'),
  studentName: z.string().trim().min(1, 'Student name is required'),
  course: z.string().trim().min(1, 'Course is required'),
  grade: z.string().trim().optional(),
  description: z.string().trim().optional()
});

export type IssueCertificateForm = z.infer<typeof IssueCertificateSchema>;

export const VerifyCertificateSchema = z.object({
  certificateId: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'Enter a 32-byte certificate id (0x + 64 hex characters)')
});

export type VerifyCertificateForm = z.infer<typeof VerifyCertificateSchema>;
