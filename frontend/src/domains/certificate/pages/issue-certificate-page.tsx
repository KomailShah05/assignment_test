import * as React from 'react';
import { Alert, Box, Grid2, Paper, TextField, Typography } from '@mui/material';
import { WorkspacePremium } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-toastify';

import { PageContentHeader } from '@/components/page-content-header';
import { IssueCertificateSchema, IssueCertificateForm } from '../types/certificate-schema';
import { issueCertificate } from '../api';
import { useWallet } from '../hooks';
import { WalletConnectButton } from '../components';
import { isPinningConfigured } from '../utils/ipfs';

const initialState: IssueCertificateForm = {
  studentId: '',
  studentName: '',
  course: '',
  grade: '',
  description: ''
};

export const IssueCertificate = () => {
  const wallet = useWallet();
  const [isSaving, setIsSaving] = React.useState(false);
  const [result, setResult] = React.useState<{
    certificateId: string;
    cid: string;
    txHash: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<IssueCertificateForm>({
    defaultValues: initialState,
    resolver: zodResolver(IssueCertificateSchema)
  });

  const onSubmit = async (data: IssueCertificateForm) => {
    if (!wallet.account) {
      toast.error('Connect your wallet before issuing a certificate.');
      return;
    }

    setIsSaving(true);
    setResult(null);
    try {
      const issued = await issueCertificate({
        studentId: Number(data.studentId),
        studentName: data.studentName,
        course: data.course,
        grade: data.grade || undefined,
        description: data.description || undefined
      });
      setResult(issued);
      toast.success('Certificate issued on-chain.');
      reset(initialState);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to issue certificate');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageContentHeader
        icon={<WorkspacePremium sx={{ mr: 1 }} />}
        heading='Issue Certificate'
      />
      <Box component={Paper} sx={{ padding: '20px' }}>
        <WalletConnectButton wallet={wallet} />

        {!isPinningConfigured() && (
          <Alert severity='info' sx={{ mb: 2 }}>
            No IPFS pinning credentials configured. Metadata is content-addressed locally with a
            real CIDv1 — set <code>VITE_PINATA_JWT</code> to pin to the IPFS network.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                {...register('studentId')}
                error={Boolean(errors.studentId)}
                helperText={errors.studentId?.message}
                label='Student ID'
                size='small'
                fullWidth
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                {...register('studentName')}
                error={Boolean(errors.studentName)}
                helperText={errors.studentName?.message}
                label='Student Name'
                size='small'
                fullWidth
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                {...register('course')}
                error={Boolean(errors.course)}
                helperText={errors.course?.message}
                label='Course / Achievement'
                size='small'
                fullWidth
              />
            </Grid2>
            <Grid2 size={{ xs: 12, md: 6 }}>
              <TextField
                {...register('grade')}
                error={Boolean(errors.grade)}
                helperText={errors.grade?.message}
                label='Grade (optional)'
                size='small'
                fullWidth
              />
            </Grid2>
            <Grid2 size={{ xs: 12 }}>
              <TextField
                {...register('description')}
                error={Boolean(errors.description)}
                helperText={errors.description?.message}
                label='Description (optional)'
                size='small'
                multiline
                minRows={2}
                fullWidth
              />
            </Grid2>
          </Grid2>

          <LoadingButton
            loading={isSaving}
            type='submit'
            variant='contained'
            disabled={!wallet.account}
            sx={{ mt: 3 }}
          >
            Issue Certificate
          </LoadingButton>
        </form>

        {result && (
          <Alert severity='success' sx={{ mt: 3, wordBreak: 'break-all' }}>
            <Typography variant='body2'>
              <strong>Certificate ID:</strong> {result.certificateId}
            </Typography>
            <Typography variant='body2'>
              <strong>Metadata CID:</strong> {result.cid}
            </Typography>
            <Typography variant='body2'>
              <strong>Transaction:</strong> {result.txHash}
            </Typography>
          </Alert>
        )}
      </Box>
    </>
  );
};
