import { defineTool } from "eve/tools";
import { z } from "zod";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "decision";
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export default defineTool({
  description:
    "Save a product decision log entry as markdown in the Eve sandbox under decision-logs/.",
  inputSchema: z.object({
    title: z.string().min(1),
    decision: z.string().min(1),
    context: z.string().min(1),
    optionsConsidered: z.array(z.string()).optional(),
    owner: z.string().optional(),
    date: z.string().optional(),
  }),
  async execute(input, ctx) {
    const date = input.date ?? new Date().toISOString().slice(0, 10);
    const owner = input.owner ?? "unassigned";
    const options = input.optionsConsidered?.length
      ? input.optionsConsidered
      : ["Not documented"];

    const markdown = `# Decision: ${input.title}

**Date:** ${date}  
**Owner:** ${owner}

## Context

${input.context}

## Decision

${input.decision}

## Options Considered

${bulletList(options)}
`;

    const filename = `${date}-${slugify(input.title)}.md`;
    const path = `decision-logs/${filename}`;

    const sandbox = await ctx.getSandbox();
    await sandbox.writeTextFile({ path, content: markdown });

    return {
      saved: true,
      path: `/workspace/${path}`,
      markdown,
    };
  },
});
