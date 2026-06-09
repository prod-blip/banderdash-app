export interface ReactiveValueProps {
  label: string;
  description?: string;
  initialValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  calculation: {
    operation: "add" | "multiply";
    operand: number;
    precision?: number;
  };
  resultLabel: string;
  fallbackText: string;
}

export const reactiveValuePropSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "initialValue", "min", "max", "step", "calculation", "resultLabel", "fallbackText"],
  properties: {
    label: { type: "string", minLength: 1 },
    description: { type: "string" },
    initialValue: { type: "number" },
    min: { type: "number" },
    max: { type: "number" },
    step: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string" },
    calculation: {
      type: "object",
      additionalProperties: false,
      required: ["operation", "operand"],
      properties: {
        operation: { type: "string", enum: ["add", "multiply"] },
        operand: { type: "number" },
        precision: { type: "integer", minimum: 0, maximum: 6 }
      }
    },
    resultLabel: { type: "string", minLength: 1 },
    fallbackText: { type: "string", minLength: 1 }
  }
} as const;

export function isReactiveValueProps(value: unknown): value is ReactiveValueProps {
  if (!isRecord(value) || !isNonEmptyString(value.label) || !isNonEmptyString(value.resultLabel)) {
    return false;
  }

  if (!isFiniteNumber(value.initialValue) || !isFiniteNumber(value.min) || !isFiniteNumber(value.max) || !isFiniteNumber(value.step)) {
    return false;
  }

  if (value.step <= 0 || value.min > value.max || value.initialValue < value.min || value.initialValue > value.max) {
    return false;
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    return false;
  }

  if (value.unit !== undefined && typeof value.unit !== "string") {
    return false;
  }

  if (!isNonEmptyString(value.fallbackText)) {
    return false;
  }

  if (!isRecord(value.calculation)) {
    return false;
  }

  const operation = value.calculation.operation;
  const precision = value.calculation.precision;
  const validPrecision =
    precision === undefined || (typeof precision === "number" && Number.isInteger(precision) && precision >= 0 && precision <= 6);

  return (operation === "add" || operation === "multiply") && isFiniteNumber(value.calculation.operand) && validPrecision;
}

export function computeReactiveValue(props: ReactiveValueProps, currentValue: number): number {
  const raw =
    props.calculation.operation === "add"
      ? currentValue + props.calculation.operand
      : currentValue * props.calculation.operand;
  const precision = props.calculation.precision ?? 2;
  return Number(raw.toFixed(precision));
}

export function createReactiveValueFallbackText(props: ReactiveValueProps): string {
  return props.fallbackText;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
