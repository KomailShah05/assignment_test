import * as React from 'react';
import { Alert, Box, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { VerifiedUser } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { PageContentHeader } from '@/components/page-content-header';
import { VerifyCertificateSchema, VerifyCertificateForm } from '../types/certificate-schema';
import { verifyCertificate } from '../api';
import { VerificationResult } from '../types';
import { CertificateMetadata, fetchMetadata, IPFS_GATEWAY } from '../utils/ipfs';

export const VerifyCertificate = () => {
  const [isChecking, setIsChecking] = React.useState(false);
  const [result, setResult] = React.useState<VerificationResult | null>(null);
  const [metadata, setMetadata] = React.useState<CertificateMetadata | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<VerifyCertificateForm>({
    defaultValues: { certificateId: '' },
    resolver: zodResolver(VerifyCertificateSchema)
  });

  const onSubmit = async (data: VerifyCertificateForm) => {
    setIsChecking(true);
    setResult(null);
    setMetadata(null);
    setError(null);
    try {
      const verification = await verifyCertificate(data.certificateId);
      setResult(verification);
      if (verification.certificate) {
        setMetadata(await fetchMetadata(verification.certificate.metadataCid));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setIsChecking(false);
    }
  };

  const cert = result?.certificate;

  return (
    <>
      <PageContentHeader icon={<VerifiedUser sx={{ mr: 1 }} />} heading='Verify Certificate' />
      <Box component={Paper} sx={{ padding: '20px' }}>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Verification reads directly from the contract and needs no wallet.
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems='flex-start'>
            <TextField
              {...register('certificateId')}
              error={Boolean(errors.certificateId)}
              helperText={errors.certificateId?.message}
              label='Certificate ID'
              size='small'
              fullWidth
            />
            <LoadingButton loading={isChecking} type='submit' variant='contained'>
              Verify
            </LoadingButton>
          </Stack>
        </form>

        {error && (
          <Alert severity='error' sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {result && !result.found && (
          <Alert severity='error' sx={{ mt: 3 }}>
            No certificate exists with that id.
          </Alert>
        )}

        {cert && (
          <Box sx={{ mt: 3 }}>
            <Alert severity={result?.isValid ? 'success' : 'warning'}>
              {result?.isValid
                ? 'Valid certificate, recorded on-chain.'
                : 'This certificate exists but has been revoked.'}
            </Alert>

            <Stack spacing={1} sx={{ mt: 2, wordBreak: 'break-all' }}>
              <Typography variant='body2'>
                <strong>Student:</strong> {cert.studentName} (ID {cert.studentId})
              </Typography>
              <Typography variant='body2'>
                <strong>Course:</strong> {cert.course}
              </Typography>
              <Typography variant='body2'>
                <strong>Issued:</strong> {new Date(cert.issuedAt * 1000).toLocaleString()}
              </Typography>
              <Typography variant='body2'>
                <strong>Issuer:</strong> {cert.issuer}
              </Typography>
              <Typography variant='body2'>
                <strong>Status:</strong>{' '}
                <Chip
                  size='small'
                  color={cert.revoked ? 'error' : 'success'}
                  label={cert.revoked ? 'Revoked' : 'Active'}
                />
              </Typography>
              <Typography variant='body2'>
                <strong>Metadata CID:</strong>{' '}
                <a href={`${IPFS_GATEWAY}${cert.metadataCid}`} target='_blank' rel='noreferrer'>
                  {cert.metadataCid}
                </a>
              </Typography>
            </Stack>

            {metadata && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant='subtitle2' gutterBottom>
                  Metadata
                </Typography>
                <Box
                  component='pre'
                  sx={{ m: 0, p: 2, bgcolor: 'action.hover', borderRadius: 1, overflowX: 'auto' }}
                >
                  {JSON.stringify(metadata, null, 2)}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>
    </>
  );
};
