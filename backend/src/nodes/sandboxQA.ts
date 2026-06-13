import type { LibraryBuildUnit } from "./builder.js";
import {
  createSandboxQAResult,
  persistQAResults,
  statusFromQAResult,
  type SandboxQAFinding,
  type SandboxQARecord
} from "../services/qaResults.js";
import type { BanderdashDatabase } from "../services/db.js";

export interface SandboxQANodeOptions {
  buildUnits: LibraryBuildUnit[];
  componentSourceByPath: Record<string, string>;
  db: BanderdashDatabase;
  mountComponent?: (unit: LibraryBuildUnit, source: string) => void;
  now?: () => Date;
}

export function runSandboxQANode(options: SandboxQANodeOptions): SandboxQARecord[] {
  const records = options.buildUnits.map((unit) => qaBuildUnit(unit, options));
  persistQAResults({ db: options.db, now: options.now?.(), records });
  return records;
}

function qaBuildUnit(unit: LibraryBuildUnit, options: SandboxQANodeOptions): SandboxQARecord {
  const source = options.componentSourceByPath[unit.componentPath];
  const findings: SandboxQAFinding[] = [];

  if (!source) {
    findings.push({
      code: "COMPONENT_BUILD_MISSING_SOURCE",
      message: `No component source was provided for ${unit.componentPath}.`,
      severity: "crash"
    });
  } else {
    findings.push(...runMountCheck(unit, source, options.mountComponent));
    findings.push(...runNonVisualChecks(unit, source));
  }

  const result = createSandboxQAResult(findings);

  return {
    id: `qa_${unit.specId}`,
    generatedSpecId: unit.specId,
    articleId: unit.articleId,
    documentVersion: unit.documentVersion,
    status: statusFromQAResult(result),
    result
  };
}

function runMountCheck(
  unit: LibraryBuildUnit,
  source: string,
  mountComponent?: (unit: LibraryBuildUnit, source: string) => void
): SandboxQAFinding[] {
  try {
    mountComponent?.(unit, source);
    return [];
  } catch (error) {
    return [
      {
        code: "RUNTIME_ERROR_CAPTURED",
        message: `Sandbox mount captured a runtime error for ${unit.componentName}: ${errorMessage(error)}.` ,
        severity: "crash"
      }
    ];
  }
}

function runNonVisualChecks(unit: LibraryBuildUnit, source: string): SandboxQAFinding[] {
  const findings: SandboxQAFinding[] = [];

  if (unit.fallbackText.trim().length === 0) {
    findings.push({
      code: "MISSING_FALLBACK_TEXT",
      message: `${unit.componentName} does not include fallback text for non-interactive contexts.`,
      severity: "warning"
    });
  }

  if (usesStandardControl(source) && !hasAccessibleControlLabel(source)) {
    findings.push({
      code: "BASIC_LABEL_WARNING",
      message: `${unit.componentName} uses a standard control without an obvious label, aria-label, or aria-labelledby.`,
      severity: "warning"
    });
  }

  if (usesStandardControl(source) && disablesKeyboardReachability(source)) {
    findings.push({
      code: "KEYBOARD_REACHABILITY_WARNING",
      message: `${unit.componentName} disables keyboard reachability for a standard control.`,
      severity: "warning"
    });
  }

  if (usesAnimation(source) && !mentionsReducedMotion(source, unit.reducedMotionRequirements)) {
    findings.push({
      code: "REDUCED_MOTION_WARNING",
      message: `${unit.componentName} appears to animate without prefers-reduced-motion support or documented reduced-motion requirements.`,
      severity: "warning"
    });
  }

  return findings;
}

function usesStandardControl(source: string): boolean {
  return /<(button|input|select|textarea)\b/i.test(source);
}

function hasAccessibleControlLabel(source: string): boolean {
  return /(<label\b|aria-label\s*=|aria-labelledby\s*=)/i.test(source);
}

function disablesKeyboardReachability(source: string): boolean {
  return /<(button|input|select|textarea)\b[^>]*tabindex\s*=\s*["']-1["']/i.test(source);
}

function usesAnimation(source: string): boolean {
  return /(animation\s*:|transition\s*:|svelte\/transition|from ["']svelte\/transition["'])/i.test(source);
}

function mentionsReducedMotion(source: string, reducedMotionRequirements: string): boolean {
  const combined = `${source}\n${reducedMotionRequirements}`;
  return /(prefers-reduced-motion|reduced motion|no animation|required no motion)/i.test(combined);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
