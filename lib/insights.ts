// Dashboard "daily read" — system-generated sentences that make the portal feel
// like it THINKS (perceived intelligence + anticipation, psychology report §7).
//
// HARD RULE: every sentence is derived from REAL metrics only. No fabricated
// trends / comparisons — there is no historical data to compare against, so we
// never claim "X% better than last month." Honest reads that still feel smart.
import { money, fmtDate } from "@/lib/utils";

export interface InsightInput {
  hasCallData: boolean;
  isPaid:      boolean;
  callsTotal:  number;
  callsQual:   number;
  jobsBooked:  number;
  qualRate:    number;
  revenue:     number;
  netROI:      number;
  adSpend:     number;
  monthlyBudget: number;
  ratePerCall: number;
  launchDate:  Date;
}

export type StatusTone = "green" | "gold";
export interface DailyRead {
  insights: string[];
  status:   { label: string; tone: StatusTone } | null;
}

export function buildInsights(x: InsightInput): DailyRead {
  const now = Date.now();

  // ── Pre-data: forward-looking, honest ──
  if (!x.hasCallData) {
    const insights: string[] = [];
    if (x.launchDate.getTime() > now) {
      insights.push(`Your campaign launches ${fmtDate(x.launchDate)}. The moment your first call lands, your numbers appear right here.`);
    } else {
      insights.push(`Your campaign is live and warming up. Call volume typically builds through the first two weeks — results surface here as they land.`);
    }
    return { insights, status: x.isPaid ? { label: "Campaign Deploying", tone: "gold" } : null };
  }

  const insights: string[] = [];

  // 1 — Results read
  const jobsClause = x.jobsBooked > 0 ? ` → ${x.jobsBooked} job${x.jobsBooked !== 1 ? "s" : ""} booked` : "";
  const revClause  = x.revenue > 0 ? `, ~${money(x.revenue)} in estimated revenue` : "";
  insights.push(`This month: ${x.callsQual} qualified call${x.callsQual !== 1 ? "s" : ""} from ${x.callsTotal} total${jobsClause}${revClause}.`);

  // 2 — Efficiency read
  if (x.jobsBooked > 0) {
    const costPerJob = (x.adSpend + x.callsQual * x.ratePerCall) / x.jobsBooked;
    insights.push(`That's ${money(costPerJob)} per booked job at a ${x.qualRate}% qualification rate.`);
  } else if (x.callsTotal > 0) {
    insights.push(`${x.qualRate}% of your calls have qualified${x.callsQual > 0 ? ` — ${x.callsQual} ready to convert into jobs` : ""}.`);
  }

  // 3 — Pacing / forward
  if (x.monthlyBudget > 0) {
    const left = Math.max(0, x.monthlyBudget - x.adSpend);
    insights.push(left > 0
      ? `You've invested ${money(x.adSpend)} of your ${money(x.monthlyBudget)} budget — ${money(left)} still working for you this cycle.`
      : `Your ${money(x.monthlyBudget)} budget is fully deployed this cycle and generating calls.`);
  }

  // Honest, threshold-based status (never "above market" — no market data).
  let status: DailyRead["status"] = { label: "Campaign Active", tone: "gold" };
  if (x.netROI > 0) status = { label: "ROI Positive", tone: "green" };
  else if (x.qualRate >= 65 && x.callsTotal >= 5) status = { label: "Strong Qualification", tone: "green" };

  return { insights: insights.slice(0, 3), status };
}
