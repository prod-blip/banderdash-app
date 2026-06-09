import {
  createReactiveValueFallbackText,
  isReactiveValueProps,
  reactiveValuePropSchema,
  type ReactiveValueProps
} from "./reactiveValue.schema.js";
import type { ComponentRegistryEntry } from "./types.js";

export const reactiveValueRegistryEntry: ComponentRegistryEntry<ReactiveValueProps> = {
  name: "ReactiveValue",
  pattern: "ReactiveValue",
  componentPath: "packages/components/src/ReactiveValue.svelte",
  propSchema: reactiveValuePropSchema,
  validateProps: isReactiveValueProps,
  createFallbackText: createReactiveValueFallbackText
};

export const componentRegistry = [reactiveValueRegistryEntry] as const;
export type RegisteredComponent = (typeof componentRegistry)[number];

export function getComponentByPattern(pattern: string): RegisteredComponent | null {
  return componentRegistry.find((entry) => entry.pattern === pattern) ?? null;
}

export function getComponentByName(name: string): RegisteredComponent | null {
  return componentRegistry.find((entry) => entry.name === name) ?? null;
}
