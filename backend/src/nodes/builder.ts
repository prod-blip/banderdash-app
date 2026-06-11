import type { ComponentSpec } from "./schemas/componentSpec.js";
import { LibraryComponentLookupError, resolveLibraryComponentSpec } from "../services/libraryLookup.js";

export interface BuilderNodeOptions {
  specs: ComponentSpec[];
}

export interface LibraryBuildUnit {
  id: string;
  specId: string;
  candidateId: string;
  articleId: string;
  documentVersion: number;
  mode: "library";
  componentName: string;
  componentPath: string;
  props: Record<string, unknown>;
  embeddedData: Record<string, unknown>;
  fallbackText: string;
  accessibilityNotes: string;
  reducedMotionRequirements: string;
}

export class BuilderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuilderValidationError";
  }
}

export function runLibraryBuilderNode(options: BuilderNodeOptions): LibraryBuildUnit[] {
  return options.specs.map((spec) => buildLibraryUnit(spec));
}

function buildLibraryUnit(spec: ComponentSpec): LibraryBuildUnit {
  try {
    const { component, fallbackText } = resolveLibraryComponentSpec(spec);

    return {
      id: `build_${spec.id}`,
      specId: spec.id,
      candidateId: spec.candidateId,
      articleId: spec.articleId,
      documentVersion: spec.documentVersion,
      mode: "library",
      componentName: component.name,
      componentPath: component.componentPath,
      props: spec.props,
      embeddedData: spec.embeddedData,
      fallbackText,
      accessibilityNotes: spec.accessibilityNotes,
      reducedMotionRequirements: spec.reducedMotionRequirements
    };
  } catch (error) {
    if (error instanceof LibraryComponentLookupError) {
      throw new BuilderValidationError(error.message);
    }
    throw error;
  }
}
