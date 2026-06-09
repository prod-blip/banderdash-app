export interface ComponentRegistryEntry<Props = unknown> {
  name: string;
  pattern: string;
  componentPath: string;
  propSchema: Record<string, unknown>;
  validateProps: (value: unknown) => value is Props;
  createFallbackText: (props: Props) => string;
}
