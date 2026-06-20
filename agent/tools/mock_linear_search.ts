import { defineTool } from "eve/tools";
import { z } from "zod";

const MOCK_ISSUES = [
  {
    id: "LIN-101",
    title: "Enterprise onboarding checklist missing admin steps",
    status: "In Progress",
    priority: "High",
    owner: "alex.pm",
    summary:
      "New enterprise admins cannot complete setup without CS hand-holding. Blocks self-serve activation.",
    url: "https://linear.app/mock/issue/LIN-101",
  },
  {
    id: "LIN-102",
    title: "Dashboard load time exceeds 5s for large accounts",
    status: "Todo",
    priority: "High",
    owner: "sam.eng",
    summary: "Performance regression on dashboard for accounts with >50k records.",
    url: "https://linear.app/mock/issue/LIN-102",
  },
  {
    id: "LIN-103",
    title: "HubSpot CRM integration",
    status: "Backlog",
    priority: "Medium",
    owner: "jordan.pm",
    summary: "Prospect deal blocked pending bi-directional HubSpot sync.",
    url: "https://linear.app/mock/issue/LIN-103",
  },
  {
    id: "LIN-104",
    title: "Onboarding email sequence not triggered for SSO users",
    status: "Blocked",
    priority: "High",
    owner: "taylor.eng",
    summary: "SSO signups skip welcome checklist; depends on auth event pipeline fix.",
    url: "https://linear.app/mock/issue/LIN-104",
  },
  {
    id: "LIN-105",
    title: "Admin audit log export",
    status: "Backlog",
    priority: "Low",
    owner: "riley.eng",
    summary: "Enterprise security review requested CSV export of admin actions.",
    url: "https://linear.app/mock/issue/LIN-105",
  },
  {
    id: "LIN-106",
    title: "Beta launch checklist and go/no-go criteria",
    status: "Todo",
    priority: "High",
    owner: "alex.pm",
    summary: "Define beta exit criteria, support runbook, and rollout guardrails.",
    url: "https://linear.app/mock/issue/LIN-106",
  },
] as const;

export default defineTool({
  description:
    "Search mock Linear-style issues (sample data only — not a real integration). Filter by query, status, and limit.",
  inputSchema: z.object({
    query: z.string().min(1),
    status: z.string().optional(),
    limit: z.number().int().positive().max(20).optional(),
  }),
  async execute({ query, status, limit = 10 }) {
    const q = query.toLowerCase();

    let issues = MOCK_ISSUES.filter((issue) => {
      const haystack = `${issue.id} ${issue.title} ${issue.summary} ${issue.status}`.toLowerCase();
      return haystack.includes(q);
    });

    if (status) {
      const s = status.toLowerCase();
      issues = issues.filter((issue) => issue.status.toLowerCase() === s);
    }

    return {
      issues: issues.slice(0, limit),
      note: "MOCK DATA: These issues are hardcoded samples for prototyping. No external Linear/GitHub/Jira API was called.",
    };
  },
});
