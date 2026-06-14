import { getComponentByName, type RegisteredComponent } from "@banderdash/components";
import type { ComponentSpec } from "../nodes/schemas/componentSpec.js";

export interface LibraryComponentResolution {
  component: RegisteredComponent;
  fallbackText: string;
}

export class LibraryComponentLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryComponentLookupError";
  }
}

export function resolveLibraryComponentSpec(spec: ComponentSpec): LibraryComponentResolution {
  if (spec.mode !== "library") {
    throw new LibraryComponentLookupError(`Spec ${spec.id} uses unsupported mode ${spec.mode}.`);
  }

  const component = getComponentByName(spec.componentName);
  if (!component) {
    throw new LibraryComponentLookupError(`Spec ${spec.id} references unsupported component ${spec.componentName}.`);
  }

  if (!component.validateProps(spec.props)) {
    throw new LibraryComponentLookupError(`Spec ${spec.id} has invalid props for ${spec.componentName}.`);
  }

  const fallbackText = (component.createFallbackText as unknown as (props: Record<string, unknown>) => string)(spec.props);
  if (fallbackText.trim().length === 0) {
    throw new LibraryComponentLookupError(`Spec ${spec.id} produced empty fallback text.`);
  }

  return { component, fallbackText };
}
