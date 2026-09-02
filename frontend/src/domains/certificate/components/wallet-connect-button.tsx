import * as React from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { AccountBalanceWallet } from '@mui/icons-material';
import { useWallet } from '../hooks';
import { CONTRACT_ADDRESS } from '../api';

const shorten = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

type Props = { wallet: ReturnType<typeof useWallet> };

export const WalletConnectButton: React.FC<Props> = ({ wallet }) => {
  const { account, chainId, isConnecting, error, connect, disconnect, isWalletAvailable } = wallet;

  if (!isWalletAvailable) {
    return (
      <Alert severity='warning' sx={{ mb: 2 }}>
        MetaMask was not detected. Install the extension to issue or revoke certificates.
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
        {account ? (
          <>
            <Chip
              color='success'
              variant='outlined'
              icon={<AccountBalanceWallet />}
              label={shorten(account)}
            />
            <Chip size='small' label={`Chain ${chainId ?? '?'}`} />
            <Button size='small' onClick={disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant='contained'
            size='small'
            startIcon={<AccountBalanceWallet />}
            disabled={isConnecting}
            onClick={connect}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </Stack>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
        Registry: {CONTRACT_ADDRESS}
      </Typography>
      {error && (
        <Alert severity='error' sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
