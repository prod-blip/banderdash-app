export interface CompareToggleOption {
  id: "a" | "b";
  label: string;
  heading: string;
  body: string;
}

export interface CompareToggleProps {
  label: string;
  description?: string;
  optionA: CompareToggleOption;
  optionB: CompareToggleOption;
  fallbackText: string;
}

export const compareTogglePropSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "optionA", "optionB", "fallbackText"],
  properties: {
    label: { type: "string", minLength: 1 },
    description: { type: "string" },
    optionA: optionSchema("a"),
    optionB: optionSchema("b"),
    fallbackText: { type: "string", minLength: 1 }
  }
} as const;

export function isCompareToggleProps(value: unknown): value is CompareToggleProps {
  if (!isRecord(value) || !isNonEmptyString(value.label) || !isNonEmptyString(value.fallbackText)) {
    return false;
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    return false;
  }

  return isCompareToggleOption(value.optionA, "a") && isCompareToggleOption(value.optionB, "b");
}

export function createCompareToggleFallbackText(props: CompareToggleProps): string {
  return props.fallbackText;
}

function optionSchema(id: "a" | "b") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "heading", "body"],
    properties: {
      id: { type: "string", enum: [id] },
      label: { type: "string", minLength: 1 },
      heading: { type: "string", minLength: 1 },
      body: { type: "string", minLength: 1 }
    }
  } as const;
}

function isCompareToggleOption(value: unknown, expectedId: "a" | "b"): value is CompareToggleOption {
  return (
    isRecord(value) &&
    value.id === expectedId &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.heading) &&
    isNonEmptyString(value.body)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
