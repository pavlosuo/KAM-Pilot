import type { Dataset } from "../data/types";
import type { AssumptionValues } from "./assumptions";

export interface Transfer {
  productId: string;
  laundryId: string;
  fromSiteId: string;
  toSiteId: string;
  pieces: number;
}

export interface PoolReturn {
  siteId: string;
  productId: string;
  pieces: number;
}

export interface RebalancePlan {
  window: string[];
  idlePieces: number;
  transfers: Transfer[];
  returns: PoolReturn[];
  transferredPieces: number;
  returnedPieces: number;
  avoidedNewGarments: number;
  embodiedKgCo2eAvoided: number;
  embodiedKgCo2eReleased: number;
  capitalEurReleased: number;
  hotSites: string[];
}

/**
 * Greedy, explainable right-sizing. Uses the average of the last three months
 * in scope. A site-product needs ceil(active ÷ target) garments; anything
 * above that is surplus. Sites running above the target get surplus from
 * sites served by the same laundry first (no extra logistics); the remaining
 * surplus can return to Lindström's pool.
 */
export function planRebalance(ds: Dataset, customerId: string, months: string[], a: AssumptionValues, siteIds?: string[] | null): RebalancePlan {
  const window = months.slice(-3);
  const win = new Set(window);
  const rows = ds.activity.filter(
    (r) => r.customerId === customerId && win.has(r.month) && (!siteIds?.length || siteIds.includes(r.siteId)),
  );
  const products = new Map(ds.products.map((p) => [p.id, p]));

  const acc = new Map<string, { siteId: string; productId: string; laundryId: string; alloc: number; active: number; n: number }>();
  for (const r of rows) {
    const k = `${r.siteId}|${r.productId}`;
    const v = acc.get(k) ?? { siteId: r.siteId, productId: r.productId, laundryId: r.laundryId, alloc: 0, active: 0, n: 0 };
    v.alloc += r.allocatedPieces;
    v.active += r.activeAssetsScanned;
    v.n += 1;
    acc.set(k, v);
  }

  type Pos = { siteId: string; productId: string; laundryId: string; qty: number };
  const surplus: Pos[] = [];
  const deficit: Pos[] = [];
  let idle = 0;
  for (const v of acc.values()) {
    const alloc = v.alloc / v.n;
    const active = v.active / v.n;
    idle += Math.max(0, alloc - active);
    const need = Math.ceil(active / a.targetUtilization);
    const diff = Math.round(alloc - need);
    if (diff > 0) surplus.push({ siteId: v.siteId, productId: v.productId, laundryId: v.laundryId, qty: diff });
    else if (diff < 0) deficit.push({ siteId: v.siteId, productId: v.productId, laundryId: v.laundryId, qty: -diff });
  }

  surplus.sort((x, y) => y.qty - x.qty);
  deficit.sort((x, y) => y.qty - x.qty);
  const transfers: Transfer[] = [];
  for (const d of deficit) {
    for (const s of surplus) {
      if (d.qty <= 0) break;
      if (s.qty <= 0 || s.productId !== d.productId || s.laundryId !== d.laundryId || s.siteId === d.siteId) continue;
      const q = Math.min(s.qty, d.qty);
      transfers.push({ productId: d.productId, laundryId: d.laundryId, fromSiteId: s.siteId, toSiteId: d.siteId, pieces: q });
      s.qty -= q;
      d.qty -= q;
    }
  }
  const returns: PoolReturn[] = surplus.filter((s) => s.qty > 0).map((s) => ({ siteId: s.siteId, productId: s.productId, pieces: s.qty }));

  const transferred = transfers.reduce((t, x) => t + x.pieces, 0);
  const returned = returns.reduce((t, x) => t + x.pieces, 0);
  const fp = (pid: string) => products.get(pid)?.footprintKgCo2e ?? 0;
  const cost = (pid: string) => products.get(pid)?.purchaseCostEur ?? 0;

  return {
    window,
    idlePieces: Math.round(idle),
    transfers: transfers.sort((x, y) => y.pieces - x.pieces),
    returns: returns.sort((x, y) => y.pieces - x.pieces),
    transferredPieces: transferred,
    returnedPieces: returned,
    avoidedNewGarments: transferred,
    embodiedKgCo2eAvoided: transfers.reduce((t, x) => t + x.pieces * fp(x.productId), 0),
    embodiedKgCo2eReleased: returns.reduce((t, x) => t + x.pieces * fp(x.productId), 0),
    capitalEurReleased:
      transfers.reduce((t, x) => t + x.pieces * cost(x.productId), 0) + returns.reduce((t, x) => t + x.pieces * cost(x.productId), 0),
    hotSites: [...new Set(transfers.map((t) => t.toSiteId))],
  };
}
