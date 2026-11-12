/**
 * An external driver works for us but belongs to another company. Of every
 * load total we keep `ourPercent`, the driver gets `driverPercent`, and the
 * rest goes to the company that lent us the driver:
 *
 *   $10,000  →  we 10% = $1,000 · driver 32% = $3,200 · their company $5,800
 *
 * The base is the load total (rate + accessorials), before permits.
 */

export type ExternalSplit = {
  total: number;
  our: number;
  driver: number;
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
): ExternalSplit {
  const our = round2((total * ourPercent) / 100);
  const driver = round2((total * driverPercent) / 100);
  return {
    total: round2(total),
    our,
    driver,
    // What is left, so the three parts always add back up to the total.
    partner: round2(total - our - driver),
    partnerPercent: partnerPercentOf(ourPercent, driverPercent),
  };
}
