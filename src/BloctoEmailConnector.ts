import {
  IEmailWalletConnector,
  logger,
} from '@dynamic-labs/wallet-connector-core';

import { BloctoEvm } from './BloctoEvm';

export class BloctoEmailConnector
  extends BloctoEvm
  implements IEmailWalletConnector
{
  override requiresNonDynamicEmailOtp = true;
  protected _email: string | undefined | null;

  get email() {
    return this._email;
  }

  setEmail(email: BloctoEmailConnector['email']) {
    this._email = email;
    if (!email) {
      localStorage.removeItem(BloctoEmailConnector.storageEmailKey);
    } else {
      localStorage.setItem(BloctoEmailConnector.storageEmailKey, email);
    }
  }

  override async getAddress(): Promise<`0x${string}` | undefined> {
    try {
      const client = this.getClient();

      if (!client?.ethereum) {
        return undefined;
      }

      const addresses = await client.ethereum.request({
        method: 'eth_requestAccounts',
        // When the email is provided, the login modal will prefill the email field.
        params: this.email ? [this.email] : undefined,
      });

      if (addresses?.length > 0) {
        return addresses[0] as `0x${string}`;
      }

      return undefined;
    } catch (e) {
      logger.error(e);
      return Promise.reject(e);
    }
  }

  override async getConnectedAccounts(): Promise<string[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }

    if (client.ethereum) {
      const accounts = await client.ethereum.request({
        method: 'eth_requestAccounts',
        // When the email is provided, the login modal will prefill the email field.
        params: this.email ? [this.email] : undefined,
      });
      return accounts || [];
    }

    return [];
  }

  clearEmail() {
    this.setEmail(undefined);
  }

  override async endSession() {
    const client = this.getClient();
    localStorage.removeItem('sdk.session');

    if (
      this.email && // cancel the session only if the email is set
      client &&
      client.ethereum &&
      this.checkForSessionAccounts()
    ) {
      await client.ethereum.request({ method: 'wallet_disconnect' });
      this.removeClient();
    }

    this.clearEmail();
  }

  static storageEmailKey = 'blocto-email';
}
