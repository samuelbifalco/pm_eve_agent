import { defineTool } from "eve/tools";
import { z } from "zod";

const sections = [
  "Title",
  "Summary",
  "Problem",
  "Target Users",
  "Goals",
  "Non-Goals",
  "Requirements",
  "Success Metrics",
  "Risks",
  "Open Questions",
  "Suggested Next Steps",
] as const;

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export default defineTool({
  description:
    "Generate a structured PRD draft in markdown from product inputs. Does not write to disk.",
  inputSchema: z.object({
    title: z.string().min(1),
    problem: z.string().min(1),
    audience: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1),
    nonGoals: z.array(z.string()).optional(),
    requirements: z.array(z.string().min(1)).min(1),
    successMetrics: z.array(z.string().min(1)).min(1),
    risks: z.array(z.string()).optional(),
    openQuestions: z.array(z.string()).optional(),
  }),
  async execute(input) {
    const nonGoals = input.nonGoals?.length ? input.nonGoals : ["None specified"];
    const risks = input.risks?.length ? input.risks : ["None identified yet"];
    const openQuestions = input.openQuestions?.length
      ? input.openQuestions
      : ["What is the MVP scope for v1?"];

    const prdMarkdown = `# ${input.title}

## Summary

${input.title} addresses ${input.problem} for ${input.audience}.

## Problem

${input.problem}

## Target Users

${input.audience}

## Goals

${bulletList(input.goals)}

## Non-Goals

${bulletList(nonGoals)}

## Requirements

${bulletList(input.requirements)}

## Success Metrics

${bulletList(input.successMetrics)}

## Risks

${bulletList(risks)}

## Open Questions

${bulletList(openQuestions)}

## Suggested Next Steps

- Validate problem and scope with 2–3 target users
- Align engineering and design on MVP requirements
- Define experiment or beta launch criteria
- Create tracking plan for success metrics
`;

    return { prdMarkdown, sections: [...sections] };
  },
});
