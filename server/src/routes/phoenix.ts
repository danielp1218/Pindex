import { Hono } from "hono";
import {
  getCollectedDataset,
  clearCollectedDataset,
  exportDatasetToPhoenix,
  registerPrompt,
  getPrompt,
  getPromptVersions,
  getAllPrompts,
  syncPromptToPhoenix,
  runExperiment,
  getExperiment,
  getAllExperiments,
  exportForPromptLearning,
  syncExperimentToPhoenix,
  fetchResolvedMarkets,
  buildBacktestDataset,
  runBacktest,
  validateRelationship,
  optimizePrompt,
  quickOptimize,
  type ResolvedMarket,
} from "../lib/phoenix";

export const phoenixRouter = new Hono();

// GET /api/phoenix/datasets
phoenixRouter.get("/datasets", async (c) => {
  const entries = getCollectedDataset();
  return c.json({
    count: entries.length,
    entries,
  });
});

// POST /api/phoenix/datasets/export
phoenixRouter.post("/datasets/export", async (c) => {
  const body = await c.req.json();
  const datasetName = body.name || "related-bets-analysis";

  const entries = getCollectedDataset();

  if (entries.length === 0) {
    return c.json(
      {
        success: false,
        message: "No dataset entries collected yet. Run some jobs first.",
      },
      400,
    );
  }

  try {
    await exportDatasetToPhoenix(datasetName, entries);
    return c.json({
      success: true,
      message: `Exported ${entries.length} entries to Phoenix dataset: ${datasetName}`,
      count: entries.length,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Export failed",
      },
      500,
    );
  }
});

// DELETE /api/phoenix/datasets
phoenixRouter.delete("/datasets", async (c) => {
  const count = getCollectedDataset().length;
  clearCollectedDataset();
  return c.json({
    success: true,
    message: `Cleared ${count} dataset entries from memory`,
  });
});

// GET /api/phoenix/prompts
phoenixRouter.get("/prompts", async (c) => {
  const prompts = getAllPrompts();
  return c.json({
    count: prompts.length,
    prompts: prompts.map((p: any) => ({
      name: p.name,
      currentVersion: p.currentVersion,
      versionCount: p.versions.length,
      latestMetrics: p.versions[p.versions.length - 1]?.metrics,
    })),
  });
});

// GET /api/phoenix/prompts/:name
phoenixRouter.get("/prompts/:name", async (c) => {
  const name = c.req.param("name");
  const versions = getPromptVersions(name);

  if (versions.length === 0) {
    return c.json({ error: `Prompt "${name}" not found` }, 404);
  }

  return c.json({
    name,
    versions,
  });
});

// POST /api/phoenix/prompts
phoenixRouter.post("/prompts", async (c) => {
  const body = await c.req.json();
  const { name, content, description, syncToPhoenix } = body;

  if (!name || !content) {
    return c.json({ error: "name and content are required" }, 400);
  }

  const version = registerPrompt(name, content, description);

  if (syncToPhoenix) {
    await syncPromptToPhoenix(version);
  }

  return c.json({
    success: true,
    prompt: version,
  });
});

// GET /api/phoenix/experiments
phoenixRouter.get("/experiments", async (c) => {
  const experiments = getAllExperiments();
  return c.json({
    count: experiments.length,
    experiments: experiments.map((e) => ({
      id: e.id,
      promptName: e.promptName,
      promptVersion: e.promptVersion,
      status: e.status,
      datasetSize: e.datasetSize,
      accuracy: e.aggregateMetrics?.accuracy,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
    })),
  });
});

// GET /api/phoenix/experiments/:id
phoenixRouter.get("/experiments/:id", async (c) => {
  const id = c.req.param("id");
  const experiment = getExperiment(id);

  if (!experiment) {
    return c.json({ error: `Experiment "${id}" not found` }, 404);
  }

  return c.json(experiment);
});

// POST /api/phoenix/experiments
phoenixRouter.post("/experiments", async (c) => {
  const body = await c.req.json();
  const { promptName, promptVersion } = body;

  if (!promptName) {
    return c.json({ error: "promptName is required" }, 400);
  }

  const version = promptVersion || getPrompt(promptName)?.version || 1;

  try {
    const experiment = await runExperiment(promptName, version);
    return c.json({
      success: true,
      experiment: {
        id: experiment.id,
        status: experiment.status,
        accuracy: experiment.aggregateMetrics?.accuracy,
        errorTypeDistribution:
          experiment.aggregateMetrics?.errorTypeDistribution,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Experiment failed",
      },
      500,
    );
  }
});

// GET /api/phoenix/experiments/:id/export
phoenixRouter.get("/experiments/:id/export", async (c) => {
  const id = c.req.param("id");
  const data = exportForPromptLearning(id);

  if (data.length === 0) {
    return c.json(
      { error: `Experiment "${id}" not found or has no results` },
      404,
    );
  }

  return c.json({
    experimentId: id,
    count: data.length,
    data,
  });
});

// POST /api/phoenix/experiments/:id/sync
phoenixRouter.post("/experiments/:id/sync", async (c) => {
  const id = c.req.param("id");

  try {
    await syncExperimentToPhoenix(id);
    return c.json({
      success: true,
      message: `Experiment ${id} synced to Phoenix`,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      500,
    );
  }
});

// GET /api/phoenix/backtest/markets
phoenixRouter.get("/backtest/markets", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");

  try {
    const markets = await fetchResolvedMarkets(limit);
    return c.json({
      count: markets.length,
      markets: markets.map((m) => ({
        id: m.id,
        question: m.question,
        outcome: m.outcome,
        finalPrice: m.finalPrice,
        volume: m.volume,
      })),
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch resolved markets",
      },
      500,
    );
  }
});

// GET /api/phoenix/backtest/dataset
phoenixRouter.get("/backtest/dataset", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");

  try {
    const { markets, pairs } = await buildBacktestDataset(limit);
    return c.json({
      totalMarkets: markets.length,
      testPairs: pairs.length,
      sample: pairs.slice(0, 3).map((p) => ({
        source: {
          question: p.source.question,
          outcome: p.source.outcome,
        },
        candidateCount: p.candidates.length,
      })),
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build backtest dataset",
      },
      500,
    );
  }
});

// POST /api/phoenix/backtest/validate
phoenixRouter.post("/backtest/validate", async (c) => {
  const body = await c.req.json();
  const { sourceOutcome, relatedOutcome, relationship } = body;

  if (!sourceOutcome || !relatedOutcome || !relationship) {
    return c.json(
      {
        error: "sourceOutcome, relatedOutcome, and relationship are required",
      },
      400,
    );
  }

  const result = validateRelationship(
    sourceOutcome,
    relatedOutcome,
    relationship,
  );

  return c.json({
    relationship,
    sourceOutcome,
    relatedOutcome,
    held: result.held,
    explanation: result.explanation,
  });
});

// POST /api/phoenix/backtest/run
phoenixRouter.post("/backtest/run", async (c) => {
  const body = await c.req.json();
  const { predictions } = body;

  if (!predictions || !Array.isArray(predictions)) {
    return c.json(
      {
        error: "predictions array is required",
      },
      400,
    );
  }

  try {
    const marketIds = new Set<string>();
    for (const pred of predictions) {
      marketIds.add(pred.sourceMarketId);
      marketIds.add(pred.relatedMarketId);
    }

    const allMarkets = await fetchResolvedMarkets(200);
    const marketMap = new Map<string, ResolvedMarket>();
    for (const m of allMarkets) {
      if (marketIds.has(m.id) || marketIds.has(m.conditionId)) {
        marketMap.set(m.id, m);
        marketMap.set(m.conditionId, m);
      }
    }

    const result = await runBacktest(predictions, marketMap);

    return c.json({
      success: true,
      result: {
        accuracy: `${(result.accuracy * 100).toFixed(1)}%`,
        totalExamples: result.totalExamples,
        correctPredictions: result.correctPredictions,
        byRelationshipType: result.byRelationshipType,
        sampleExamples: result.examples.slice(0, 5).map((e) => ({
          sourceQuestion: e.sourceMarket.question,
          relatedQuestion: e.relatedMarket.question,
          relationship: e.predictedRelationship,
          held: e.relationshipHeld,
          explanation: e.explanation,
        })),
      },
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Backtest failed",
      },
      500,
    );
  }
});

// GET /api/phoenix/status
phoenixRouter.get("/status", async (c) => {
  const phoenixEndpoint =
    process.env.PHOENIX_ENDPOINT ||
    process.env.COLLECTOR_ENDPOINT ||
    "http://localhost:6006/v1/traces";
  const phoenixHost = process.env.PHOENIX_HOST || "http://localhost:6006";

  return c.json({
    tracing: {
      endpoint: phoenixEndpoint,
      enabled: true,
    },
    client: {
      host: phoenixHost,
      configured: !!process.env.PHOENIX_HOST || true,
    },
    datasets: {
      collectedCount: getCollectedDataset().length,
    },
    prompts: {
      registeredCount: getAllPrompts().length,
    },
    experiments: {
      totalCount: getAllExperiments().length,
    },
  });
});

// POST /api/phoenix/optimize
// Full optimization loop: scores prompt, extracts few-shot, analyzes failures, mutates
phoenixRouter.post("/optimize", async (c) => {
  const body = await c.req.json();
  const { promptName, maxIterations, testSetSize } = body;

  if (!promptName) {
    return c.json({ error: "promptName is required" }, 400);
  }

  try {
    console.log(`[Phoenix] Starting optimization for "${promptName}"...`);

    const result = await optimizePrompt(
      promptName,
      maxIterations || 3,
      testSetSize || 15,
    );

    return c.json({
      success: true,
      result: {
        originalScore: `${(result.originalScore * 100).toFixed(1)}%`,
        optimizedScore: `${(result.optimizedScore * 100).toFixed(1)}%`,
        improvement: `${(result.improvement * 100).toFixed(1)}%`,
        iterations: result.iterations,
        fewShotExamplesUsed: result.fewShotExamples.length,
        failurePatternsFound: result.failurePatterns.map((p) => ({
          type: p.type,
          count: p.count,
          fix: p.suggestedFix,
        })),
        promptPreview: result.optimizedPrompt.slice(0, 500) + "...",
      },
    });
  } catch (error) {
    console.error("[Phoenix] Optimization failed:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Optimization failed",
      },
      500,
    );
  }
});

// POST /api/phoenix/optimize/quick
// Quick optimization: just inject few-shot examples from recent resolved markets
phoenixRouter.post("/optimize/quick", async (c) => {
  const body = await c.req.json();
  const { promptName } = body;

  if (!promptName) {
    return c.json({ error: "promptName is required" }, 400);
  }

  try {
    const optimizedContent = await quickOptimize(promptName);
    const currentPrompt = getPrompt(promptName);

    return c.json({
      success: true,
      promptName,
      newVersion: currentPrompt?.version,
      contentPreview: optimizedContent.slice(0, 500) + "...",
      message: "Quick optimization complete. Few-shot examples injected.",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Quick optimization failed",
      },
      500,
    );
  }
});

// GET /api/phoenix/optimize/preview
// Preview what the optimizer would do without running it
phoenixRouter.get("/optimize/preview", async (c) => {
  const promptName = c.req.query("promptName") || "related-bets-analysis";

  try {
    const markets = await fetchResolvedMarkets(30);
    const validMarkets = markets.filter(
      (m) => m.outcome === "YES" || m.outcome === "NO",
    );

    return c.json({
      promptName,
      currentPrompt: getPrompt(promptName)
        ? {
            version: getPrompt(promptName)?.version,
            contentPreview: getPrompt(promptName)?.content.slice(0, 300) + "...",
          }
        : null,
      availableTestData: {
        resolvedMarkets: validMarkets.length,
        sampleMarkets: validMarkets.slice(0, 3).map((m) => ({
          question: m.question,
          outcome: m.outcome,
          volume: m.volume,
        })),
      },
      estimatedApiCalls: validMarkets.length * 2, // rough estimate
      message:
        "Use POST /api/phoenix/optimize to run full optimization, or POST /api/phoenix/optimize/quick for fast few-shot injection.",
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to preview optimization",
      },
      500,
    );
  }
});
