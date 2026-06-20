import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Real destructive actions must be idempotent and approval-gated (needsApproval).
// This tool simulates a gated delete/archive workflow without mutating any data.
export default defineTool({
  description:
    "Simulate a destructive delete or archive action. Requires human approval; does not actually delete anything.",
  inputSchema: z.object({
    target: z.string().min(1),
    reason: z.string().min(1),
  }),
  needsApproval: always(),
  async execute({ target, reason }) {
    return {
      simulated: true,
      message: `Simulated approved action: would delete or archive "${target}" because: ${reason}. No data was modified.`,
      target,
      reason,
    };
  },
});
