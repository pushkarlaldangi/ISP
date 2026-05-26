import type { FundsProvider } from '../types';

import { AmfiFundsProvider } from './amfi';

export { AmfiFundsProvider, parseNavAll } from './amfi';
export { MfApiClient } from './mfapi';

/** Default provider facade. Today we have a single primary; designed to add fallbacks later. */
export function getFundsProvider(): FundsProvider {
  return new AmfiFundsProvider();
}
