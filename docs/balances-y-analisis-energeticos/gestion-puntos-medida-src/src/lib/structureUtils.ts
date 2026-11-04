import { Estructura } from "../types";

export type ValidStructureType = "PB" | "L" | "CTO" | "PT";
export const VALID_STRUCTURE_TYPES: ValidStructureType[] = ["PB", "L", "CTO", "PT"];

export const STRUCTURE_TYPE_LABELS: Record<ValidStructureType, string> = {
  PB: "Barrajes",
  L: "Líneas del SDL",
  CTO: "Alimentadores",
  PT: "Transformadores"
};

/**
 * Classifies a structure code or metadata into one of the official electrical distribution structure types:
 * - PB: Barrajes
 * - L: Líneas del SDL
 * - CTO: Alimentadores
 * - PT: Transformadores
 * 
 * Any unrecognised code (e.g. municipality names like HOBO, YAGUARA, circuits, etc.) returns null.
 */
export function getStructureType(estCode: string, estObj?: Estructura | { tipo?: string }): ValidStructureType | null {
  // 1. Check estObj.tipo if available in base network data
  if (estObj?.tipo) {
    const t = estObj.tipo.toUpperCase().trim();
    if (t === "PB" || t.startsWith("PB ") || t.startsWith("PB-") || t.includes("POSTE BAJA") || t.includes("BAJA TENSI")) {
      return "PB";
    }
    if (t === "CTO" || t.startsWith("CTO ") || t.startsWith("CTO-") || t.includes("CENTRO DE TRANSF") || t.includes("TRANSFORMADOR")) {
      return "CTO";
    }
    if (t === "PT" || t.startsWith("PT ") || t.startsWith("PT-") || t.includes("POSTE TRANSF") || t.includes("POSTE DE TRANSF")) {
      return "PT";
    }
    if (t === "L" || t.startsWith("L ") || t.startsWith("L-") || t.includes("LINEA") || t.includes("LÍNEA")) {
      return "L";
    }
  }

  const code = (estCode || "").toUpperCase().trim();
  if (!code) return null;

  // 2. Direct prefix check on the structure code
  // CTO check before C, PT check before P, PB check before P
  if (/^CTO([-_\s\d]|$)/i.test(code)) return "CTO";
  if (/^PB([-_\s\d]|$)/i.test(code)) return "PB";
  if (/^PT([-_\s\d]|$)/i.test(code)) return "PT";
  if (/^L([-_\s\d]|$)/i.test(code)) return "L";

  // 3. Token check if municipality, circuit, or zone prefix is attached (e.g. HOBO-PB-01, GARZON_CTO_02, AIPE-PT-03, NEIVA-L-04)
  const tokens = code.split(/[-_\s/.:]+/);
  for (const token of tokens) {
    if (token === "CTO" || /^CTO\d+$/i.test(token)) return "CTO";
    if (token === "PB" || /^PB\d+$/i.test(token)) return "PB";
    if (token === "PT" || /^PT\d+$/i.test(token)) return "PT";
    if (token === "L" || /^L\d+$/i.test(token)) return "L";
  }

  // 4. Substring check bounded by delimiters or digit boundaries
  if (/(?:^|[-_\s/])CTO(?:[-_\s/\d]|$)/i.test(code)) return "CTO";
  if (/(?:^|[-_\s/])PB(?:[-_\s/\d]|$)/i.test(code)) return "PB";
  if (/(?:^|[-_\s/])PT(?:[-_\s/\d]|$)/i.test(code)) return "PT";
  if (/(?:^|[-_\s/])L(?:[-_\s/\d]|$)/i.test(code)) return "L";

  return null;
}
