import { defineTool } from "eve/tools";
import { z } from "zod";

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function parseDeadline(deadline?: string): Date | null {
  if (!deadline) return null;
  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function offsetDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default defineTool({
  description:
    "Turn a goal, optional deadline, and constraints into a pragmatic execution plan with milestones and immediate next steps.",
  inputSchema: z.object({
    goal: z.string().min(1),
    deadline: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    team: z.array(z.string()).optional(),
    knownRisks: z.array(z.string()).optional(),
    desiredOutput: z.string().optional(),
  }),
  async execute({ goal, deadline, constraints = [], team = [], knownRisks = [], desiredOutput }) {
    const deadlineDate = parseDeadline(deadline);
    const teamList = team.length ? team : ["PM", "Engineer", "Designer"];
    const output = desiredOutput ?? "beta launch";

    const milestoneTemplates = [
      {
        name: "Discovery & scope lock",
        owner: teamList.find((m) => /pm/i.test(m)) ?? teamList[0] ?? "PM",
        phaseDays: [0, 3],
        tasks: [
          "Confirm success criteria and non-goals",
          "Review constraints and dependencies",
          "Draft MVP scope and acceptance criteria",
        ],
        risks: knownRisks.filter((r) => /scope|requirement/i.test(r)),
      },
      {
        name: "Build & design",
        owner: teamList.find((m) => /engineer|dev/i.test(m)) ?? teamList[1] ?? "Engineer",
        phaseDays: [4, 12],
        tasks: [
          "Implement core user flows",
          "Design and review key screens",
          "Add instrumentation for success metrics",
        ],
        risks: knownRisks.filter((r) => /capacity|technical/i.test(r)),
      },
      {
        name: "Beta readiness",
        owner: teamList.find((m) => /pm/i.test(m)) ?? teamList[0] ?? "PM",
        phaseDays: [13, 18],
        tasks: [
          "Run QA and fix launch blockers",
          "Prepare beta cohort and support playbook",
          `Ship ${output}`,
        ],
        risks: knownRisks.filter((r) => /launch|quality|beta/i.test(r)),
      },
    ];

    const start = deadlineDate
      ? new Date(deadlineDate.getTime() - 21 * 24 * 60 * 60 * 1000)
      : null;

    const milestones = milestoneTemplates.map((m) => ({
      name: m.name,
      owner: m.owner,
      dueDate: start ? offsetDate(start, m.phaseDays[1]) : `Phase end (week ${Math.ceil(m.phaseDays[1] / 7)})`,
      tasks: m.tasks,
      risks: m.risks.length ? m.risks : ["Scope creep", "Underestimated integration work"],
    }));

    const immediateNextSteps = [
      `Align the team on the goal: ${goal}`,
      "Confirm MVP scope and what is explicitly out of scope",
      "Assign owners for discovery, build, and beta readiness milestones",
      deadline ? `Back-plan from deadline ${deadlineDate?.toISOString().slice(0, 10)}` : "Pick a target beta date",
      "Identify the top 3 launch risks and mitigation owners",
    ];

    const constraintsBlock =
      constraints.length > 0 ? bulletList(constraints) : "- None specified";

    const actionPlanMarkdown = `# Action Plan: ${goal}

## Objective

Deliver **${output}**${deadline ? ` by **${deadlineDate?.toISOString().slice(0, 10)}**` : " in phased milestones"}.

## Team

${bulletList(teamList)}

## Constraints

${constraintsBlock}

## Milestones

${milestones
  .map(
    (m) => `### ${m.name}
- **Owner:** ${m.owner}
- **Due:** ${m.dueDate}
- **Tasks:**
${m.tasks.map((t) => `  - ${t}`).join("\n")}
- **Risks:** ${m.risks.join("; ")}`,
  )
  .join("\n\n")}

## Immediate Next Steps

${bulletList(immediateNextSteps)}
`;

    return { actionPlanMarkdown, milestones, immediateNextSteps };
  },
});
