import { defineTool } from "eve/tools";
import { z } from "zod";

const opportunitySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  reach: z.number().nonnegative(),
  impact: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  effort: z.number().positive(),
  strategicFit: z.number().nonnegative().optional(),
  risk: z.number().nonnegative().optional(),
});

/**
 * Priority score formula:
 *   base = (reach * impact * confidence) / max(effort, 1)
 *   + strategicFit (if provided, default 0)
 *   - risk (if provided, default 0)
 */
function computeScore(opportunity: z.infer<typeof opportunitySchema>): number {
  const { reach, impact, confidence, effort, strategicFit = 0, risk = 0 } = opportunity;
  const base = (reach * impact * confidence) / Math.max(effort, 1);
  return Math.round((base + strategicFit - risk) * 100) / 100;
}

function buildRationale(
  opportunity: z.infer<typeof opportunitySchema>,
  score: number,
): string {
  const parts = [
    `RICE-style base ${((opportunity.reach * opportunity.impact * opportunity.confidence) / Math.max(opportunity.effort, 1)).toFixed(2)}`,
  ];
  if (opportunity.strategicFit !== undefined) {
    parts.push(`+${opportunity.strategicFit} strategic fit`);
  }
  if (opportunity.risk !== undefined) {
    parts.push(`-${opportunity.risk} risk`);
  }
  parts.push(`= ${score}`);
  return parts.join("; ");
}

export default defineTool({
  description:
    "Score and rank product opportunities using a simple RICE-like model (reach, impact, confidence, effort, optional strategic fit and risk).",
  inputSchema: z.object({
    opportunities: z.array(opportunitySchema).min(1),
  }),
  async execute({ opportunities }) {
    const scored = opportunities
      .map((opportunity) => {
        const score = computeScore(opportunity);
        return {
          title: opportunity.title,
          description: opportunity.description,
          reach: opportunity.reach,
          impact: opportunity.impact,
          confidence: opportunity.confidence,
          effort: opportunity.effort,
          strategicFit: opportunity.strategicFit ?? 0,
          risk: opportunity.risk ?? 0,
          score,
          rationale: buildRationale(opportunity, score),
        };
      })
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    const recommendationSummary = top
      ? `Prioritize "${top.title}" first (score ${top.score}). ${scored.length > 1 ? `Next: "${scored[1]?.title}" (score ${scored[1]?.score}).` : ""}`
      : "No opportunities to score.";

    return { scored, recommendationSummary };
  },
});
