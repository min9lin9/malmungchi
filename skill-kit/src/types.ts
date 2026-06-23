export type ElementKind = "heading" | "paragraph" | "code" | "list" | "table" | "json";

export interface NormalizedElement {
  docId: string;
  elementId: string;
  kind: ElementKind;
  text: string;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
  path?: string;
}

export interface Chunk {
  docId: string;
  elementId: string;
  chunkId: string;
  text: string;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
}

export interface EvidenceQuote {
  quote: string;
  chunkId: string;
  elementId: string;
  docId: string;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
}

export interface PersonaClaim {
  id: string;
  text: string;
  confidence: "low" | "medium" | "high";
  evidence: EvidenceQuote[];
}

export interface Persona {
  personaId: string;
  authorId: string;
  provider: string;
  not_real_person: true;
  categories?: readonly string[];
  primaryCategory?: string;
  displayName?: string;
  tagline?: string;
  voiceTraits?: readonly string[];
  claims: PersonaClaim[];
  caveats: string[];
}

export interface Eval4SimReport {
  pass: boolean;
  retrievalAdherence: number;
  consistency: number;
  pcr: number;
  scr: number;
  humanSimilarity: number;
  failures: string[];
}
