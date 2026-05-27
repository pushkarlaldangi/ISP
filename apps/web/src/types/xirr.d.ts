/**
 * Ambient types for `xirr` v1.x — re-declared here so apps/web tsc can see them.
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
