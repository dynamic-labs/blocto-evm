import BloctoSDK from '@blocto/sdk';
import {
  Hex,
  WalletClient,
  createWalletClient,
  custom,
  Account,
  Transport,
  Chain as ViemChain,
} from 'viem';

import { Chain, logger } from '@dynamic-labs/wallet-connector-core';
import {
  EthWalletConnector,
  EthWalletConnectorOpts,
} from '@dynamic-labs/ethereum-core';

export class BloctoEvm extends EthWalletConnector {
  LOCAL_STORAGE_KEY = 'dynamic_blocto_evm_chain_id';
  SESSION_STORAGE_BLOCTO_KEY = 'BLOCTO_SDK';
  protected client?: BloctoSDK;
  name = 'bloctoevm';
  override overrideKey = 'bloctoevm';
  override canConnectViaCustodialService = true;
  connectedChain: Chain = 'EVM';
  supportedChains: Chain[] = ['EVM', 'ETH'];
  chainId: number;
  override supportsNetworkSwitching = () => false;

  constructor(props: EthWalletConnectorOpts) {
    super(props);
    // Taken from : https://docs.blocto.app/blocto-sdk/javascript-sdk/evm-sdk/provider
    const BLOCTO_SUPPORTED_CHAIN_IDS = [1, 4, 56, 97, 137, 80001, 43114, 43113];

    this.evmNetworks = this.evmNetworks.filter((n) =>
      BLOCTO_SUPPORTED_CHAIN_IDS.includes(n.chainId),
    );

    this.chainId =
      Number(localStorage.getItem(this.LOCAL_STORAGE_KEY)) ||
      this.evmNetworks.find((n) => n.chainId === 137)?.chainId ||
      this.evmNetworks[0]?.chainId;

    if (this.evmNetworks.length > 0) {
      this.initClient();
    }
  }

  // Check if there are already any accounts in the session
  // Blocto in version > 0.5.0 started to store the accounts in the session storage
  protected checkForSessionAccounts(): boolean {
    try {
      const sessionValue = sessionStorage.getItem(
        this.SESSION_STORAGE_BLOCTO_KEY,
      ) as any;

      const parsedSessionValue = JSON.parse(sessionValue);

      return (
        parsedSessionValue?.data?.accounts &&
        Object.keys(parsedSessionValue?.data?.accounts).length > 0
      );
    } catch {
      return false;
    }
  }

  protected initClient(): void {
    if (!this.client) {
      const network = this.evmNetworks.find((n) => n.chainId === this.chainId);

      if (network) {
        this.client = new BloctoSDK({
          ethereum: {
            chainId: `0x${this.chainId.toString(16)}`,
            rpc: network.rpcUrls[0],
          },
        });
      } else {
        logger.error("Couldn't find a configured network for Blocto EVM");
      }
    }
  }

  protected getClient(): BloctoSDK | undefined {
    return this.client;
  }

  protected removeClient(): void {
    this.client = undefined;
  }

  override getWalletClient():
    | WalletClient<Transport, ViemChain, Account>
    | undefined {
    const client = this.getClient();
    if (client?.ethereum && this.checkForSessionAccounts()) {
      return createWalletClient({ transport: custom(client.ethereum) });
    } else {
      return undefined;
    }
  }

  // We are calling the client directly and not via Web3Provider because if we will wrap it in Ethers,
  // Ethers will be making retries on failure. This becomes an issue on the connect step.
  // When Blocto's modal closes prior to receiving a response with the address on the connect step,
  // then ethers would retry and the modal will open again.
  override async getAddress(): Promise<Hex | undefined> {
    try {
      const client = this.getClient();
      if (!client?.ethereum) {
        return undefined;
      }

      const addresses = await client.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (addresses?.length > 0) {
        return addresses[0];
      }

      return undefined;
    } catch (e) {
      logger.error(e);
      return Promise.reject(e);
    }
  }

  override async signMessage(
    messageToSign: string,
  ): Promise<string | undefined> {
    try {
      const account = await this.getAddress();
      if (!account) {
        return Promise.resolve(undefined);
      }
      return await this.getWalletClient()?.signMessage({
        account,
        message: messageToSign,
      });
    } catch (e: any) {
      if (e.message === 'User declined the signing request') {
        return Promise.reject({ code: '4001' });
      } else {
        return Promise.reject(e);
      }
    }
  }

  override async endSession(): Promise<void> {
    localStorage.removeItem('sdk.session');

    if (this.client?.ethereum && this.checkForSessionAccounts()) {
      await this.client.ethereum.request({ method: 'wallet_disconnect' });
      this.removeClient();
    }
  }
}
