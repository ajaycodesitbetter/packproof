// Cross-instance coordination for GitHub discovery quota.
//
// Why this exists: unauthenticated GitHub search allows 10 requests/minute
// per source IP, and on serverless the egress IP is shared with other
// customers, so the budget that is actually ours is smaller and unknown.
// Per-process caches and singleflight cannot coordinate across instances:
// two warm instances each spending "their" 9-call refresh burst blow the
// shared budget together. When the libSQL store is configured, claims and
// the refresh lease live in the shared database (single atomic statements,
// no transaction needed); otherwise a per-process in-memory store is used
// (single instance, local dev).
//
// The store is deliberately dumb: the caller passes the window size, cap
// and lease duration on every call, so policy lives in one place
// (lib/discovery.ts) and tests drive both implementations identically.

export interface LibSqlLike {
  execute(q: {
    sql: string;
    args: import("@libsql/client").InArgs;
  }): Promise<{ rows: Array<Record<string, unknown>>; rowsAffected: number }>;
}

export interface PartialQueryResult {
  index: number;
  ok: boolean;
  // DiscoveredRepo[] at runtime; typed loosely here to keep this module
  // free of the discovery types (it is imported by discovery.ts).
  repos: unknown[];
}

export interface CoordStore {
  // Atomically claim one upstream call in the current window.
  // true = granted (window counter incremented), false = window budget spent.
  claimCall(nowMs: number, windowMs: number, cap: number): Promise<boolean>;
  // Atomically take or renew the refresh lease. True when the caller holds
  // the lease after the call (fresh take, takeover of an expired lease, or
  // renewal of its own lease); false while another owner holds it.
  acquireLease(nowMs: number, leaseMs: number, owner: string): Promise<boolean>;
  loadProgress(): Promise<{ next: number; results: PartialQueryResult[] }>;
  saveProgress(next: number, results: PartialQueryResult[], leaseUntilMs: number): Promise<void>;
  // Mark the refresh cycle over: release the lease and clear progress.
  // cooldownUntilMs > 0 keeps the lease held until then (failure backoff),
  // with progress already reset so the next taker starts fresh.
  finishRefresh(cooldownUntilMs: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store: per-process. Correct for a single instance (local dev,
// tests); production with the libSQL store configured uses LibSqlCoordStore.
// ---------------------------------------------------------------------------

export class MemoryCoordStore implements CoordStore {
  private windowBucket = -1;
  private windowCalls = 0;
  private leaseUntil = 0;
  private owner: string | null = null;
  private next = 0;
  private results: PartialQueryResult[] = [];

  async claimCall(nowMs: number, windowMs: number, cap: number): Promise<boolean> {
    const bucket = Math.floor(nowMs / windowMs);
    if (bucket !== this.windowBucket) {
      this.windowBucket = bucket;
      this.windowCalls = 0;
    }
    if (this.windowCalls >= cap) return false;
    this.windowCalls++;
    return true;
  }

  async acquireLease(nowMs: number, leaseMs: number, owner: string): Promise<boolean> {
    if (this.leaseUntil > nowMs && this.owner !== owner) return false;
    this.leaseUntil = nowMs + leaseMs;
    this.owner = owner;
    return true;
  }

  async loadProgress(): Promise<{ next: number; results: PartialQueryResult[] }> {
    return { next: this.next, results: this.results.map((r) => ({ ...r })) };
  }

  async saveProgress(next: number, results: PartialQueryResult[], leaseUntilMs: number): Promise<void> {
    this.next = next;
    this.results = results.map((r) => ({ ...r, repos: [...r.repos] }));
    this.leaseUntil = leaseUntilMs;
  }

  async finishRefresh(cooldownUntilMs: number): Promise<void> {
    // Owner is always cleared: a failure cooldown must block the instance
    // that just failed too, or it would renew its own lease and hammer
    // upstream on every request during the backoff.
    this.leaseUntil = cooldownUntilMs;
    this.owner = null;
    this.next = 0;
    this.results = [];
  }
}

// ---------------------------------------------------------------------------
// libSQL store: shared across every instance that reaches the database.
// Each operation is one atomic statement so concurrent instances cannot
// both win a claim or a lease.
// ---------------------------------------------------------------------------

export class LibSqlCoordStore implements CoordStore {
  constructor(private getClient: () => Promise<LibSqlLike>) {}

  private async ensureRow(db: LibSqlLike): Promise<void> {
    // Migration 0003 must create the table. Missing schema rejects the
    // operation; the service returns a redacted failure without spending
    // upstream quota or switching to a permissive process-local ledger.
    await db.execute({
      sql: `INSERT OR IGNORE INTO discovery_coord
            (id, window_bucket, window_calls, lease_until, lease_owner, progress_next, progress_payload)
            VALUES (1, 0, 0, 0, '', 0, '[]')`,
      args: [],
    });
  }

  async claimCall(nowMs: number, windowMs: number, cap: number): Promise<boolean> {
    const bucket = Math.floor(nowMs / windowMs);
    const db = await this.getClient();
    await this.ensureRow(db);
    // One statement: same bucket -> increment under the cap; new bucket ->
    // reset to 1. rowsAffected 0 means the cap was already spent.
    const res = await db.execute({
      sql: `UPDATE discovery_coord SET
              window_bucket = ?,
              window_calls = CASE WHEN window_bucket = ? THEN window_calls + 1 ELSE 1 END
            WHERE id = 1 AND (window_bucket != ? OR window_calls < ?)`,
      args: [bucket, bucket, bucket, cap],
    });
    return res.rowsAffected === 1;
  }

  async acquireLease(nowMs: number, leaseMs: number, owner: string): Promise<boolean> {
    const db = await this.getClient();
    await this.ensureRow(db);
    const res = await db.execute({
      sql: `UPDATE discovery_coord SET lease_until = ?, lease_owner = ?
            WHERE id = 1 AND (lease_until <= ? OR lease_owner = ?)`,
      args: [nowMs + leaseMs, owner, nowMs, owner],
    });
    return res.rowsAffected === 1;
  }

  async loadProgress(): Promise<{ next: number; results: PartialQueryResult[] }> {
    const db = await this.getClient();
    const res = await db.execute({
      sql: "SELECT progress_next, progress_payload FROM discovery_coord WHERE id = 1",
      args: [],
    });
    const row = res.rows[0];
    if (!row) return { next: 0, results: [] };
    let results: PartialQueryResult[] = [];
    try {
      results = JSON.parse(String(row.progress_payload)) as PartialQueryResult[];
    } catch {
      results = [];
    }
    return { next: Number(row.progress_next) || 0, results };
  }

  async saveProgress(next: number, results: PartialQueryResult[], leaseUntilMs: number): Promise<void> {
    const db = await this.getClient();
    await db.execute({
      sql: "UPDATE discovery_coord SET progress_next = ?, progress_payload = ?, lease_until = ? WHERE id = 1",
      args: [next, JSON.stringify(results), leaseUntilMs],
    });
  }

  async finishRefresh(cooldownUntilMs: number): Promise<void> {
    const db = await this.getClient();
    await db.execute({
      sql: `UPDATE discovery_coord SET lease_until = ?, lease_owner = '', progress_next = 0, progress_payload = '[]'
            WHERE id = 1`,
      args: [cooldownUntilMs],
    });
  }
}
