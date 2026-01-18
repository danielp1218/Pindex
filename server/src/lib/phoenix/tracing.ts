// Phoenix tracing - no-op for Cloudflare Workers, functional dataset/eval helpers

let isInitialized = false;

function isNodeEnvironment(): boolean {
  try {
    return typeof process !== 'undefined'
      && process.versions?.node !== undefined
      && typeof (globalThis as any).caches === 'undefined'; // CF Workers have caches
  } catch {
    return false;
  }
}

export function initializeTracing(): boolean {
  if (isInitialized) return true;
  isInitialized = true;

  if (!isNodeEnvironment()) {
    console.log('[Phoenix] Tracing disabled (non-Node environment)');
    return true;
  }

  // Only run in Node.js - don't even attempt in CF Workers
  try {
    // Wrap in setTimeout to avoid blocking and let module system settle
    setTimeout(async () => {
      try {
        const { NodeSDK } = await import('@opentelemetry/sdk-node');
        const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto');
        const { resourceFromAttributes } = await import('@opentelemetry/resources');
        const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
        const { OpenAIInstrumentation } = await import('@arizeai/openinference-instrumentation-openai');

        const endpoint = process.env.PHOENIX_ENDPOINT
          || process.env.COLLECTOR_ENDPOINT
          || 'http://localhost:6006/v1/traces';

        const exporter = new OTLPTraceExporter({
          url: endpoint,
          headers: process.env.PHOENIX_API_KEY
            ? { 'api-key': process.env.PHOENIX_API_KEY }
            : undefined,
        });

        const sdk = new NodeSDK({
          resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: 'pindex-server',
            [ATTR_SERVICE_VERSION]: '1.0.0',
          }),
          traceExporter: exporter,
          instrumentations: [new OpenAIInstrumentation()],
        });

        sdk.start();
        console.log(`✓ Phoenix tracing initialized → ${endpoint}`);
      } catch (err) {
        console.error('[Phoenix] Tracing init failed:', (err as Error).message);
      }
    }, 0);

    return true;
  } catch (error) {
    console.error('[Phoenix] Tracing init failed:', error);
    return false;
  }
}

export async function shutdownTracing(): Promise<void> {
  console.log('[Phoenix] Tracing shutdown');
}

// No-op span type for CF Workers
type NoopSpan = {
  setAttribute: (key: string, value: unknown) => void;
  addEvent: (name: string, attrs?: Record<string, unknown>) => void;
  setStatus: (status: { code: number; message?: string }) => void;
  recordException: (error: Error) => void;
  end: () => void;
};

const createNoopSpan = (): NoopSpan => ({
  setAttribute: () => {},
  addEvent: () => {},
  setStatus: () => {},
  recordException: () => {},
  end: () => {},
});

export async function withSpan<T>(
  _name: string,
  _attributes: Record<string, string | number | boolean>,
  fn: (span: NoopSpan) => Promise<T>
): Promise<T> {
  return fn(createNoopSpan());
}

export async function traceRelatedBetsJob<T>(
  _jobId: string,
  _sourceMarketId: string,
  _eventSlug: string | undefined,
  fn: (span: NoopSpan) => Promise<T>
): Promise<T> {
  return fn(createNoopSpan());
}

export async function traceBatchAnalysis<T>(
  _jobId: string,
  _batchIndex: number,
  _batchSize: number,
  fn: (span: NoopSpan) => Promise<T>
): Promise<T> {
  return fn(createNoopSpan());
}

export function recordFoundRelationship(
  _span: NoopSpan,
  _marketId: string,
  _relationship: string,
  _reasoning: string
): void {}

export function recordEvaluation(
  _span: NoopSpan,
  _evalName: string,
  _score: number,
  _label?: string,
  _explanation?: string
): void {}

export function setLLMAttributes(
  _span: NoopSpan,
  _attrs: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    temperature?: number;
  }
): void {}

// Dataset collection (works in both environments)
export interface DatasetEntry {
  input: {
    sourceMarket: {
      question: string;
      description: string;
    };
    candidateMarkets: Array<{
      id: string;
      question: string;
      description: string;
    }>;
  };
  output: {
    relationships: Array<{
      marketId: string;
      relationship: string;
      reasoning: string;
    }>;
  };
  metadata: {
    jobId: string;
    timestamp: number;
    batchIndex: number;
  };
}

const collectedDataset: DatasetEntry[] = [];

export function collectDatasetEntry(entry: DatasetEntry): void {
  collectedDataset.push(entry);
}

export function getCollectedDataset(): DatasetEntry[] {
  return [...collectedDataset];
}

export function clearCollectedDataset(): void {
  collectedDataset.length = 0;
}

export async function exportDatasetToPhoenix(
  datasetName: string,
  entries: DatasetEntry[]
): Promise<void> {
  if (!isNodeEnvironment()) {
    console.log('[Phoenix] Dataset export not available in this environment');
    return;
  }

  try {
    const { createOrGetDataset, appendDatasetExamples } = await import('@arizeai/phoenix-client/datasets');

    const { datasetId } = await createOrGetDataset({
      name: datasetName,
      description: 'Related bets analysis examples',
      examples: [],
    });

    await appendDatasetExamples({
      dataset: { datasetId },
      examples: entries.map(entry => ({
        input: entry.input,
        output: entry.output,
        metadata: entry.metadata,
      })),
    });

    console.log(`[Phoenix] Exported ${entries.length} entries to ${datasetName}`);
  } catch (error) {
    console.error('[Phoenix] Export failed:', error);
  }
}

// Evaluation helpers (work in both environments)
export interface EvalResult {
  name: string;
  score: number;
  label: 'pass' | 'fail' | 'unknown';
  explanation: string;
}

export function evalValidRelationship(relationship: string): EvalResult {
  const validTypes = ['IMPLIES', 'CONTRADICTS', 'PARTITION_OF', 'SUBEVENT', 'CONDITIONED_ON', 'WEAK_SIGNAL'];
  const isValid = validTypes.includes(relationship);

  return {
    name: 'valid_relationship_type',
    score: isValid ? 1 : 0,
    label: isValid ? 'pass' : 'fail',
    explanation: isValid
      ? `Valid relationship type: ${relationship}`
      : `Invalid relationship type: ${relationship}`,
  };
}

export function evalReasoningQuality(reasoning: string): EvalResult {
  const minLength = 20;
  const hasSubstance = reasoning.length >= minLength &&
    !reasoning.toLowerCase().includes('related market') &&
    !reasoning.toLowerCase().includes('similar');

  const score = hasSubstance ? 1 : Math.min(reasoning.length / minLength, 1);

  return {
    name: 'reasoning_quality',
    score,
    label: score >= 0.7 ? 'pass' : 'fail',
    explanation: hasSubstance
      ? 'Reasoning provides specific explanation'
      : 'Reasoning is too generic or short',
  };
}

export function evaluateRelationship(
  relationship: string,
  reasoning: string
): EvalResult[] {
  return [
    evalValidRelationship(relationship),
    evalReasoningQuality(reasoning),
  ];
}
