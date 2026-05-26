import type { FundsProvider } from '../types.js';

import { AmfiFundsProvider } from './amfi.js';

export { AmfiFundsProvider, parseNavAll } from './amfi.js';
export { MfApiClient } from './mfapi.js';

/** Default provider facade. Today we have a single primary; designed to add fallbacks later. */
export function getFundsProvider(): FundsProvider {
  return new AmfiFundsProvider();
}
