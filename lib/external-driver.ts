/**
 * An external driver works for us but belongs to another company. Of every
 * load total we keep `ourPercent`, the driver gets `driverPercent`, and the
 * rest goes to the company that lent us the driver:
 *
 *   $10,000  →  we 10% = $1,000 · driver 32% = $3,200 · their company $5,800
 *
 * The base is the load total (rate + accessorials), before permits.
 *
 * Permits bought for the load are paid out of the company's share, never out
 * of the total — so our cut and the driver's pay don't move, and what we owe
 * the company is its share minus the permits:
 *
 *   $5,800 − $300 permits = $5,500 owed
 */

export type ExternalSplit = {
  total: number;
  our: number;
  driver: number;
  /** The company's share of the total, before permits. */
  partnerShare: number;
  /** Permit costs covered out of that share. */
  permits: number;
  /** What is actually owed to the company: its share minus the permits. */
  partner: number;
  partnerPercent: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function partnerPercentOf(ourPercent: number, driverPercent: number): number {
  return round2(100 - ourPercent - driverPercent);
}

export function splitExternal(
  total: number,
  ourPercent: number,
  driverPercent: number,
  permits = 0,
): ExternalSplit {
  const our = round2((total * ourPercent) / 100);
  const driver = round2((total * driverPercent) / 100);
  // What is left, so the three parts always add back up to the total.
  const partnerShare = round2(total - our - driver);
  return {
    total: round2(total),
    our,
    driver,
    partnerShare,
    permits: round2(permits),
    partner: round2(partnerShare - permits),
    partnerPercent: partnerPercentOf(ourPercent, driverPercent),
  };
}
