export {
  componentRegistry,
  getComponentByName,
  getComponentByPattern,
  compareToggleRegistryEntry,
  reactiveValueRegistryEntry,
  type RegisteredComponent
} from "./registry.js";
export {
  compareTogglePropSchema,
  createCompareToggleFallbackText,
  isCompareToggleProps,
  type CompareToggleOption,
  type CompareToggleProps
} from "./compareToggle.schema.js";
export {
  computeReactiveValue,
  createReactiveValueFallbackText,
  isReactiveValueProps,
  reactiveValuePropSchema,
  type ReactiveValueProps
} from "./reactiveValue.schema.js";
export type { ComponentRegistryEntry } from "./types.js";
