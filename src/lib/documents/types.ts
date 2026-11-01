export type DocumentOperation = "transcribe" | "translate";
export type DocumentSuggestionKind = "person" | "place" | "date" | "sender" | "recipient" | "summary" | "topic";
export interface DocumentSuggestion {
  kind: DocumentSuggestionKind;
  value: string;
  evidence: string;
  page: number;
  context: string;
}
export interface ProviderReceipt { responseId: string; model: string; usage: Record<string,unknown> | null; provider?: string; apiVersion?: string; requestId?: string | null; stopReason?: string; }
export interface PageReading {
  receipt?: ProviderReceipt;
  rawResponse?: Record<string,unknown>;
  text: string;
  language: string;
  uncertainty: string[];
  confidence: number | null;
}
export interface DocumentExtraction {suggestions: DocumentSuggestion[]; receipt?: ProviderReceipt; rawResponse?: Record<string,unknown>;}
export interface DocumentProvider {
  name: string;
  model: string;
  readPage(input: {image: string; operation: DocumentOperation; sourceText?: string}): Promise<PageReading>;
  extract(pages: {text: string; page: number}[]): Promise<DocumentExtraction>;
}
export interface DocumentSource {
  id: string;
  page_order: number;
  page_role: string;
  sha256: string;
}
export interface DocumentRun {
  id: string;
  archive_id: string;
  item_id: string;
  operation: DocumentOperation;
  source_run_id: string | null;
  source_texts?: {original_file_id:string;text:string;transcription_id:string;review_revision:number}[];
  source_version: string;
  source_manifest: DocumentSource[];
  provider: string;
  model: string;
  status: "processing" | "failed" | "complete";
  error_code: string | null;
  output: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
export type DocumentRunSummary = Omit<DocumentRun, "output">;
export interface DocumentPageText {
  id: string;
  original_file_id: string;
  document_run_id: string;
  page_order_snapshot: number;
  raw_ai_text: string;
  reviewed_text: string | null;
  review_status: string;
  review_revision: number;
  output_kind: "source" | "translation";
  confidence: number | null;
  provider: string;
  model: string;
  version: number;
  processed_at: string;
}
export const documentKinds = ["Letter", "Document", "Postcard", "Certificate"];
export function pageLabel(role: string, index: number) {
  return ({"envelope-front":"Envelope front", "envelope-back":"Envelope back", "page-front":"Page front", "page-back":"Page back", "picture-side":"Picture side", "written-side":"Written side"} as Record<string,string>)[role] || `Page ${index+1}`;
}

export function suggestedDate(value: string) {
  const approximate=value.match(/^c(?:irca)?\.?\s+(\d{4})$/i);
  if(approximate)return {value:approximate[1],precision:"approximate"};
  const precision=/^\d{4}-\d{2}-\d{2}$/.test(value)?"exact":/^\d{4}-\d{2}$/.test(value)?"month":/^\d{4}$/.test(value)?"year":/^\d{3}0s$/.test(value)?"decade":"unknown";
  return {value,precision};
}
