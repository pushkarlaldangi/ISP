/**
 * Ambient types for `xirr` v1.x — no first-party types ship with the package.
 */
declare module 'xirr' {
  interface CashFlow {
    amount: number;
    when: Date;
  }
  interface XirrOptions {
    guess?: number;
  }
  function xirr(transactions: CashFlow[], options?: XirrOptions): number;
  export default xirr;
}
