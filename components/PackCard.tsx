import Link from "next/link";
import { Pack, STATUS_LABEL } from "@/lib/types";
import { pct, attemptedSolved, attemptedTotal } from "@/lib/packs";
import { Icon } from "./Icons";

function runsLabel(p: Pack): string {
  if (!p.evidence) return p.reportDue ?? "In testing";
  const e = p.evidence;
  if (e.packSolved === null)
    return `${e.baseTotal} of ${e.runs} sample baseline rows · with-pack data absent · SAMPLE`;
  return `${e.runs} runs · ${e.improved} improved · ${e.regressions} regression${e.regressions === 1 ? "" : "s"} · SAMPLE`;
}

function packScoreLabel(e: NonNullable<Pack["evidence"]>): string {
  if (e.packSolved === null) return "PACK not measured";
  const s = attemptedSolved(e);
  const t = attemptedTotal(e);
  return s === e.packSolved && t === e.packTotal
    ? `PACK ${s}/${t}`
    : `PACK ${s}/${t} attempted`;
}

export default function PackCard({ pack }: { pack: Pack }) {
  const st = pack.status === "evidence-complete" ? "ok" : pack.status === "partial" ? "part" : "test";
  const e = pack.evidence;
  return (
    <Link href={`/packs/${pack.slug}`} className={`pack st-${st}`}>
      <span className="ptape"></span>
      <div className="p-top">
        <span className="p-icon">
          <Icon name={pack.icon} />
        </span>
        <span className="status">{STATUS_LABEL[pack.status]}</span>
      </div>
      <h3>{pack.name}</h3>
      <div className="ver">
        v{pack.version} · {pack.category}
      </div>
      <p className="task">{pack.tagline}</p>
      <div className="runs">{runsLabel(pack)}</div>
      {e ? (
        <>
          <div className="meter">
            <div className="base" style={{ width: `${pct(e.baseSolved, e.baseTotal)}%` }}></div>
            {e.packSolved !== null && attemptedTotal(e) > 0 && (
              <div className="fill" style={{ width: `${pct(attemptedSolved(e), attemptedTotal(e))}%` }}></div>
            )}
          </div>
          <div className="meter-lbls">
            <span>
              BASE {e.baseSolved}/{e.baseTotal}
            </span>
            <span>{packScoreLabel(e)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="meter none"></div>
          <div className="meter-lbls">
            <span>NOT MEASURED</span>
            <span></span>
          </div>
        </>
      )}
    </Link>
  );
}
