import { getComponentByName } from "@banderdash/components";

export const COMPONENT_SPEC_MODES = ["library"] as const;
export type ComponentSpecMode = (typeof COMPONENT_SPEC_MODES)[number];

export interface ComponentSpec {
  id: string;
  candidateId: string;
  articleId: string;
  documentVersion: number;
  mode: ComponentSpecMode;
  componentName: string;
  props: Record<string, unknown>;
  embeddedData: Record<string, unknown>;
  fallbackText: string;
  accessibilityNotes: string;
  reducedMotionRequirements: string;
}

export const componentSpecJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["specs"],
  properties: {
    specs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "candidateId",
          "articleId",
          "documentVersion",
          "mode",
          "componentName",
          "props",
          "embeddedData",
          "fallbackText",
          "accessibilityNotes",
          "reducedMotionRequirements"
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          candidateId: { type: "string", minLength: 1 },
          articleId: { type: "string", minLength: 1 },
          documentVersion: { type: "integer", minimum: 1 },
          mode: { type: "string", enum: [...COMPONENT_SPEC_MODES] },
          componentName: { type: "string", minLength: 1 },
          props: { type: "object" },
          embeddedData: { type: "object" },
          fallbackText: { type: "string", minLength: 1 },
          accessibilityNotes: { type: "string", minLength: 1 },
          reducedMotionRequirements: { type: "string", minLength: 1 }
        }
      }
    }
  }
} as const;

export interface ComponentSpecSet {
  specs: ComponentSpec[];
}

export function isComponentSpec(value: unknown): value is ComponentSpec {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.candidateId) &&
    isNonEmptyString(value.articleId) &&
    isPositiveInteger(value.documentVersion) &&
    value.mode === "library" &&
    isNonEmptyString(value.componentName) &&
    isRecord(value.props) &&
    isRecord(value.embeddedData) &&
    isNonEmptyString(value.fallbackText) &&
    isNonEmptyString(value.accessibilityNotes) &&
    isNonEmptyString(value.reducedMotionRequirements)
  );
}

export function isComponentSpecSet(value: unknown): value is ComponentSpecSet {
  return isRecord(value) && Array.isArray(value.specs) && value.specs.every(isComponentSpec);
}

export function validateLibraryComponentSpec(spec: ComponentSpec): boolean {
  const component = getComponentByName(spec.componentName);
  return Boolean(component?.validateProps(spec.props));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
