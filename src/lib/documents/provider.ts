import "server-only";
import { configuredDocumentProvider } from "./provider-config";
export function documentProvider() {
  return configuredDocumentProvider({provider:process.env.DOCUMENT_AI_PROVIDER,model:process.env.DOCUMENT_AI_MODEL,
    openaiKey:process.env.OPENAI_API_KEY,anthropicKey:process.env.ANTHROPIC_API_KEY});
}
