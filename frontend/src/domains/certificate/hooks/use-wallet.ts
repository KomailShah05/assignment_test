import * as React from 'react';
import { BrowserProvider, Eip1193Provider } from 'ethers';

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

type WalletState = {
  account: string | null;
  chainId: string | null;
  isConnecting: boolean;
  error: string | null;
};

const initialState: WalletState = {
  account: null,
  chainId: null,
  isConnecting: false,
  error: null
};

export const isWalletAvailable = () => typeof window !== 'undefined' && Boolean(window.ethereum);

export const useWallet = () => {
  const [state, setState] = React.useState<WalletState>(initialState);

  const connect = React.useCallback(async () => {
    if (!isWalletAvailable()) {
      setState((s) => ({ ...s, error: 'MetaMask not detected. Install it to continue.' }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const provider = new BrowserProvider(window.ethereum!);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      setState({
        account: accounts[0] ?? null,
        chainId: network.chainId.toString(),
        isConnecting: false,
        error: null
      });
    } catch (error) {
      setState({
        ...initialState,
        error: error instanceof Error ? error.message : 'Failed to connect wallet'
      });
    }
  }, []);

  const disconnect = React.useCallback(() => setState(initialState), []);

  // Reflect an account the user already authorised, without prompting.
  React.useEffect(() => {
    if (!isWalletAvailable()) return;

    const provider = new BrowserProvider(window.ethereum!);
    provider
      .send('eth_accounts', [])
      .then(async (accounts: string[]) => {
        if (!accounts?.length) return;
        const network = await provider.getNetwork();
        setState((s) => ({
          ...s,
          account: accounts[0],
          chainId: network.chainId.toString()
        }));
      })
      .catch(() => undefined);
  }, []);

  // Keep the UI honest when the user switches account or network in MetaMask.
  React.useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setState((s) => ({ ...s, account: accounts?.[0] ?? null }));
    };
    const onChainChanged = (...args: unknown[]) => {
      const chainId = args[0] as string;
      setState((s) => ({ ...s, chainId: BigInt(chainId).toString() }));
    };

    ethereum.on('accountsChanged', onAccountsChanged);
    ethereum.on('chainChanged', onChainChanged);
    return () => {
      ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      ethereum.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  return { ...state, connect, disconnect, isWalletAvailable: isWalletAvailable() };
};
