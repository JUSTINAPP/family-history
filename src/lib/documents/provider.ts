import "server-only";
import { createOpenAIProvider } from "./provider-core";
import type { DocumentProvider } from "./types";
export function documentProvider(): DocumentProvider | null {
  const key=process.env.OPENAI_API_KEY, model=process.env.DOCUMENT_AI_MODEL;
  if (process.env.DOCUMENT_AI_PROVIDER!=="openai" || !key || !model) return null;
  return createOpenAIProvider({key, model});
}
