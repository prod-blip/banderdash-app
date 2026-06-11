export interface ValidationFinding {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  hardFailures: ValidationFinding[];
  warnings: ValidationFinding[];
}

export function createValidationResult(options: {
  hardFailures?: ValidationFinding[];
  warnings?: ValidationFinding[];
} = {}): ValidationResult {
  const hardFailures = options.hardFailures ?? [];
  const warnings = options.warnings ?? [];

  return {
    ok: hardFailures.length === 0,
    hardFailures,
    warnings
  };
}
