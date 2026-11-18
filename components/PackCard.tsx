import Link from "next/link";
import { Pack, STATUS_LABEL } from "@/lib/types";
import { Icon } from "./Icons";

// Evidence numbers in the registry are staged samples. Cards therefore show
// structure (how the sample is shaped) and never verdicts or comparisons.
function runsLabel(p: Pack): string {
  if (!p.evidence) return p.reportDue ?? "In testing";
  const e = p.evidence;
  return `${e.runs} staged sample rows · ${e.taskCount} tasks x ${e.reps} reps · not a measurement`;
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
      <div className="meter none"></div>
      <div className="meter-lbls">
        <span>NO REAL RUNS EXECUTED</span>
        <span></span>
      </div>
    </Link>
  );
}
