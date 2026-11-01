import { createOpenAIProvider } from "./provider-core";
import { createAnthropicProvider } from "./anthropic-provider";
import type { DocumentProvider } from "./types";
export interface DocumentProviderConfig {provider?:string;model?:string;openaiKey?:string;anthropicKey?:string;}
export function configuredDocumentProvider(config:DocumentProviderConfig,fetcher?:typeof fetch):DocumentProvider|null {
  const model=config.model?.trim();
  if(!model || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,149}$/.test(model))return null;
  const key=config.provider==="anthropic"?config.anthropicKey:config.provider==="openai"?config.openaiKey:undefined;
  if(!key || !key.trim() || /\s/.test(key))return null;
  if(config.provider==="anthropic")return createAnthropicProvider({key,model,fetcher});
  if(config.provider==="openai")return createOpenAIProvider({key,model,fetcher});
  return null;
}
