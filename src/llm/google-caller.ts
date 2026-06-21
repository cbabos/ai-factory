import { OpenAICompatibleCaller } from "./openai-compatible-caller.js";

/**
 * Google Gemini caller.
 *
 * Uses Gemini's OpenAI-compatible endpoint so we get:
 * - chat completions
 * - `/v1/models` model discovery
 * - structured JSON output
 *
 * without adding a dedicated Google SDK dependency.
 *
 * @see https://ai.google.dev/gemini-api/docs/openai
 */
export class GoogleCaller extends OpenAICompatibleCaller {
  constructor(apiKey: string) {
    super(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey,
      "google",
    );
  }
}
