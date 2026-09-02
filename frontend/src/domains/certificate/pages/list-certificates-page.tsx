import * as React from 'react';
import { Box, Button, Chip, Paper, Tooltip, Typography } from '@mui/material';
import { WorkspacePremium } from '@mui/icons-material';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { toast } from 'react-toastify';

import { PageContentHeader } from '@/components/page-content-header';
import { Certificate } from '../types';
import { listCertificates, revokeCertificate } from '../api';
import { useWallet } from '../hooks';
import { WalletConnectButton } from '../components';

const truncate = (value: string) => `${value.slice(0, 10)}...${value.slice(-6)}`;

export const ListCertificates = () => {
  const wallet = useWallet();
  const [certificates, setCertificates] = React.useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCertificates(await listCertificates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read the certificate registry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRevoke = async (certificateId: string) => {
    if (!wallet.account) {
      toast.error('Connect your wallet to revoke.');
      return;
    }
    setRevokingId(certificateId);
    try {
      await revokeCertificate(certificateId);
      toast.success('Certificate revoked.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke');
    } finally {
      setRevokingId(null);
    }
  };

  const columns: MRT_ColumnDef<Certificate>[] = React.useMemo(
    () => [
      {
        accessorKey: 'certificateId',
        header: 'Certificate ID',
        size: 200,
        Cell: ({ row }) => (
          <Tooltip title={row.original.certificateId}>
            <span>{truncate(row.original.certificateId)}</span>
          </Tooltip>
        )
      },
      { accessorKey: 'studentId', header: 'Student ID', size: 100 },
      { accessorKey: 'studentName', header: 'Student', size: 160 },
      { accessorKey: 'course', header: 'Course', size: 180 },
      {
        accessorKey: 'issuedAt',
        header: 'Issued',
        size: 180,
        Cell: ({ row }) => <>{new Date(row.original.issuedAt * 1000).toLocaleString()}</>
      },
      {
        accessorKey: 'revoked',
        header: 'Status',
        size: 120,
        Cell: ({ row }) => (
          <Chip
            size='small'
            color={row.original.revoked ? 'error' : 'success'}
            label={row.original.revoked ? 'Revoked' : 'Active'}
          />
        )
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        Cell: ({ row }) => (
          <Button
            size='small'
            color='error'
            disabled={row.original.revoked || revokingId === row.original.certificateId}
            onClick={() => onRevoke(row.original.certificateId)}
          >
            {revokingId === row.original.certificateId ? 'Revoking...' : 'Revoke'}
          </Button>
        )
      }
    ],
    // onRevoke depends on the connected account, so rebuild when it changes.
    [revokingId, wallet.account] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const table = useMaterialReactTable({
    data: certificates,
    columns,
    state: { isLoading, density: 'compact' },
    enableDensityToggle: false,
    getRowId: (row) => row.certificateId,
    renderEmptyRowsFallback: () => (
      <Box sx={{ textAlign: 'center', fontStyle: 'italic', my: 3 }}>
        {error ?? 'No certificates issued yet'}
      </Box>
    )
  });

  return (
    <>
      <PageContentHeader icon={<WorkspacePremium sx={{ mr: 1 }} />} heading='Certificates' />
      <Box component={Paper} sx={{ padding: '20px' }}>
        <WalletConnectButton wallet={wallet} />
        {error && (
          <Typography variant='body2' color='error' sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Box sx={{ width: '100%', display: 'table', tableLayout: 'fixed' }}>
          <MaterialReactTable table={table} />
        </Box>
      </Box>
    </>
  );
};
