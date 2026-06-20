import { defineTool } from "eve/tools";
import { z } from "zod";

const feedbackItemSchema = z.object({
  text: z.string().min(1),
  customerSegment: z.string().optional(),
  customerName: z.string().optional(),
  channel: z.string().optional(),
  createdAt: z.string().optional(),
});

const categorySchema = z.enum([
  "bug",
  "feature_request",
  "usability",
  "pricing",
  "performance",
  "integration",
  "other",
]);

const severitySchema = z.enum(["low", "medium", "high", "critical"]);

type Category = z.infer<typeof categorySchema>;
type Severity = z.infer<typeof severitySchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function summarize(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

function categorize(text: string): Category {
  const lower = text.toLowerCase();
  if (/\b(bug|broken|error|crash|fail|incorrect|wrong)\b/.test(lower)) return "bug";
  if (/\b(slow|latency|load time|loading|performance|timeout)\b/.test(lower))
    return "performance";
  if (/\b(hubspot|salesforce|integration|integrate|api|connect|sync)\b/.test(lower))
    return "integration";
  if (/\b(confusing|onboarding|hard to use|usability|ux|unclear)\b/.test(lower))
    return "usability";
  if (/\b(price|pricing|cost|expensive|billing|subscription)\b/.test(lower))
    return "pricing";
  if (/\b(feature|request|need|want|wish|would like)\b/.test(lower))
    return "feature_request";
  return "other";
}

function inferSeverity(text: string, category: Category): Severity {
  const lower = text.toLowerCase();
  if (/\b(critical|blocker|cannot use|data loss|outage|security)\b/.test(lower))
    return "critical";
  if (
    category === "bug" ||
    category === "performance" ||
    /\b(blocking|before buying|churn|enterprise)\b/.test(lower)
  )
    return "high";
  if (/\b(annoying|confusing|slow|important)\b/.test(lower)) return "medium";
  return "low";
}

function extractSignals(text: string, category: Category): string[] {
  const signals = new Set<string>();
  const lower = text.toLowerCase();

  if (category === "usability" || /\bonboarding\b/.test(lower)) {
    signals.add("activation_risk");
    signals.add("usability_friction");
  }
  if (category === "performance" || /\b(slow|latency|timeout)\b/.test(lower)) {
    signals.add("performance_degradation");
  }
  if (category === "integration" || /\b(hubspot|salesforce|integrate|sync)\b/.test(lower)) {
    signals.add("deal_blocker_potential");
    signals.add("buyer_requirement");
  }
  if (/\benterprise\b/.test(lower)) signals.add("enterprise_segment");
  if (/\badmin\b/.test(lower)) signals.add("admin_workflow");
  if (/\b(before buying|won't buy|churn|renewal|pricing)\b/.test(lower)) {
    signals.add("revenue_blocker");
  }
  if (
    category === "bug" ||
    /\b(critical|outage|data loss|unreliable|crash)\b/.test(lower)
  ) {
    signals.add("reliability_risk");
  }
  if (signals.size === 0) signals.add("general_feedback");

  return [...signals];
}

export default defineTool({
  description:
    "Normalize raw customer feedback items into structured product feedback with category, severity, and signal tags.",
  inputSchema: z.object({
    source: z.string().min(1),
    items: z.array(feedbackItemSchema).min(1),
  }),
  async execute({ source, items }) {
    const normalizedItems = items.map((item, index) => {
      const category = categorize(item.text);
      const severity = inferSeverity(item.text, category);
      const id = `${slugify(source)}-${index + 1}-${slugify(item.text).slice(0, 20) || "item"}`;

      return {
        id,
        source,
        summary: summarize(item.text),
        category,
        severity,
        customerSegment: item.customerSegment ?? "unknown",
        customerName: item.customerName ?? "unknown",
        channel: item.channel ?? "unknown",
        createdAt: item.createdAt ?? new Date().toISOString(),
        signals: extractSignals(item.text, category),
      };
    });

    const countsByCategory = Object.fromEntries(
      categorySchema.options.map((cat) => [
        cat,
        normalizedItems.filter((i) => i.category === cat).length,
      ]),
    ) as Record<Category, number>;

    const countsBySeverity = Object.fromEntries(
      severitySchema.options.map((sev) => [
        sev,
        normalizedItems.filter((i) => i.severity === sev).length,
      ]),
    ) as Record<Severity, number>;

    return { normalizedItems, countsByCategory, countsBySeverity };
  },
});
