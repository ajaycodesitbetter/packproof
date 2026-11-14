import Link from "next/link";
import { Pack, STATUS_LABEL } from "@/lib/types";
import { pct } from "@/lib/packs";
import { Icon } from "./Icons";

function runsLabel(p: Pack): string {
  if (!p.evidence) return p.reportDue ?? "In testing";
  const e = p.evidence;
  if (e.packSolved === null)
    return `${e.baseTotal} of ${e.runs} runs done · with-pack run in progress · SAMPLE`;
  return `${e.runs} runs · ${e.improved} improved · ${e.regressions} regression${e.regressions === 1 ? "" : "s"} · SAMPLE`;
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
          <div className={`meter${e.packSolved === null ? "" : ""}`}>
            <div className="base" style={{ width: `${pct(e.baseSolved, e.baseTotal)}%` }}></div>
            {e.packSolved !== null && (
              <div className="fill" style={{ width: `${pct(e.packSolved, e.packTotal)}%` }}></div>
            )}
          </div>
          <div className="meter-lbls">
            <span>
              BASE {e.baseSolved}/{e.baseTotal}
            </span>
            <span>{e.packSolved !== null ? `PACK ${e.packSolved}/${e.packTotal}` : "PACK -"}</span>
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
