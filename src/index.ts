import { WalletConnectorConstructor } from '@dynamic-labs/wallet-connector-core';

import { BloctoEvm } from './BloctoEvm';
import { BloctoEmailConnector } from './BloctoEmailConnector';

export * from './BloctoEvm';
export * from './BloctoEmailConnector';

export const BloctoEvmWalletConnectors = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: any,
): WalletConnectorConstructor[] => [
  BloctoEvm,
  ...(_props.apiProviders.blocto ? [BloctoEmailConnector] : []),
];
