import { defineAgent } from "eve";
import { openai } from "@ai-sdk/openai";

export default defineAgent({
  // Change model here, e.g. openai("gpt-4.1") or "anthropic/claude-sonnet-4.6" via AI Gateway.
  // Direct OpenAI provider requires OPENAI_API_KEY in .env.local.
  model: openai("gpt-5"),
});
