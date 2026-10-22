export type PipelineStepContext = {
  messageId?: string;
  conversationId?: string;
  orderId?: string;
};

export type PipelineStep = {
  key: string;
  version: string;
  featureFlag: string;
  onIngest?: boolean;
  run: (ctx: PipelineStepContext) => Promise<void>;
};

const registry = new Map<string, PipelineStep>();

export function registerStep(step: PipelineStep): void {
  registry.set(step.key, step);
}

export function getStep(key: string): PipelineStep | undefined {
  return registry.get(key);
}

export function listIngestSteps(): PipelineStep[] {
  return [...registry.values()].filter((s) => s.onIngest);
}

export function clearRegistry(): void {
  registry.clear();
}
