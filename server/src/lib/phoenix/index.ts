// Phoenix Observability & Prompt Optimization

export {
  initializeTracing,
  shutdownTracing,
  withSpan,
  traceRelatedBetsJob,
  traceBatchAnalysis,
  recordFoundRelationship,
  recordEvaluation,
  setLLMAttributes,
  collectDatasetEntry,
  getCollectedDataset,
  clearCollectedDataset,
  exportDatasetToPhoenix,
  evaluateRelationship,
  evalValidRelationship,
  evalReasoningQuality,
  type DatasetEntry,
  type EvalResult,
} from "./tracing";

export {
  registerPrompt,
  getPrompt,
  getPromptVersion,
  getPromptVersions,
  getAllPrompts,
  updatePromptMetrics,
  syncPromptToPhoenix,
  RELATED_BETS_PROMPT_V1,
  type PromptVersion,
  type Prompt,
} from "./prompts";

export {
  runExperiment,
  getExperiment,
  getAllExperiments,
  exportForPromptLearning,
  syncExperimentToPhoenix,
  type ExperimentRun,
  type ExperimentResult,
  type EvaluationFeedback,
  type AggregateMetrics,
} from "./experiments";

export {
  fetchResolvedMarkets,
  buildBacktestDataset,
  runBacktest,
  validateRelationship,
  scorePromptWithBacktest,
  type ResolvedMarket,
  type BacktestExample,
  type BacktestResult,
} from "./backtest";

export {
  optimizePrompt,
  quickOptimize,
  type OptimizationResult,
  type ScoredExample,
} from "./optimizer";