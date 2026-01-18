// Prompt Registry - store, version, and manage prompts

export interface PromptVersion {
  id: string;
  name: string;
  version: number;
  content: string;
  description?: string;
  createdAt: number;
  metrics?: {
    accuracy?: number;
    avgRelationshipsFound?: number;
    avgLatencyMs?: number;
    tokenUsage?: number;
  };
}

export interface Prompt {
  name: string;
  currentVersion: number;
  versions: PromptVersion[];
}

const prompts: Map<string, Prompt> = new Map();

export function registerPrompt(
  name: string,
  content: string,
  description?: string
): PromptVersion {
  const existing = prompts.get(name);
  const version = existing ? existing.currentVersion + 1 : 1;

  const promptVersion: PromptVersion = {
    id: `${name}-v${version}`,
    name,
    version,
    content,
    description,
    createdAt: Date.now(),
  };

  if (existing) {
    existing.versions.push(promptVersion);
    existing.currentVersion = version;
  } else {
    prompts.set(name, {
      name,
      currentVersion: version,
      versions: [promptVersion],
    });
  }

  console.log(`[Prompt Registry] Registered ${name} v${version}`);
  return promptVersion;
}

export function getPrompt(name: string): PromptVersion | null {
  const prompt = prompts.get(name);
  if (!prompt) return null;
  return prompt.versions[prompt.versions.length - 1];
}

export function getPromptVersion(name: string, version: number): PromptVersion | null {
  const prompt = prompts.get(name);
  if (!prompt) return null;
  return prompt.versions.find(v => v.version === version) || null;
}

export function getPromptVersions(name: string): PromptVersion[] {
  const prompt = prompts.get(name);
  return prompt?.versions || [];
}

export function getAllPrompts(): Prompt[] {
  return Array.from(prompts.values());
}

export function updatePromptMetrics(
  name: string,
  version: number,
  metrics: PromptVersion['metrics']
): void {
  const promptVersion = getPromptVersion(name, version);
  if (promptVersion) {
    promptVersion.metrics = { ...promptVersion.metrics, ...metrics };
    console.log(`[Prompt Registry] Updated metrics for ${name} v${version}:`, metrics);
  }
}

export async function syncPromptToPhoenix(pv: PromptVersion): Promise<void> {
  try {
    const { createPrompt, promptVersion } = await import('@arizeai/phoenix-client/prompts');

    await createPrompt({
      name: pv.name,
      description: pv.description,
      version: promptVersion({
        modelProvider: 'OPENAI',
        modelName: 'gpt-4o-mini',
        template: [
          {
            role: 'system',
            content: pv.content,
          },
        ],
      }),
    });

    console.log(`[Prompt Registry] Synced ${pv.name} v${pv.version} to Phoenix`);
  } catch (error) {
    console.error('[Prompt Registry] Failed to sync to Phoenix:', error);
  }
}

export const RELATED_BETS_PROMPT_V1 = `You are a strategic prediction market analyst finding ACTIONABLE related bets.
Source Market:
- Question: {{sourceQuestion}}
- Current Odds: {{sourceYes}}% YES / {{sourceNo}}% NO
- Description: {{sourceDescription}}
YOUR GOAL: Find markets where betting strategy changes based on beliefs about the source market.
GOOD Related Markets:
✓ Markets with hedging opportunities (opposite positions reduce risk)
✓ Markets with arbitrage potential (related but mispriced)
✓ Markets with causal relationships (one outcome affects another)
✓ Markets with competitive odds (10-90% range, not extreme long shots)
✓ Markets where information advantage transfers
BAD Related Markets:
✗ Extreme long shots (<5% or >95%) - no trading opportunity
✗ Same exact market in different words (redundant)
✗ Weak correlations without clear reasoning
✗ Markets from the same multi-outcome event (just partitions)
Relationship Types:
- IMPLIES: If this market YES → source YES (this market implies the source)
- CONTRADICTS: If source YES → this market NO more likely (inverse hedge)
- SUBEVENT: This event directly causes/prevents source outcome (risk factor)
- CONDITIONED_ON: Source outcome is prerequisite for this market
- WEAK_SIGNAL: Correlated indicator (only if odds are interesting)
DO NOT return PARTITION_OF relationships - those are just different options in the same event.
Return JSON with "related" array:
{
  "related": [
    {
      "marketId": "condition_id or id",
      "relationship": "IMPLIES|CONTRADICTS|SUBEVENT|CONDITIONED_ON|WEAK_SIGNAL",
      "reasoning": "Brief explanation of the strategic relationship and why odds matter"
    }
  ]
}
IMPORTANT:
- Return ALL markets that have strong strategic relationships
- Ignore markets with extreme odds (<5% or >95%) unless exceptional reasoning
- Prioritize IMPLIES, CONTRADICTS, SUBEVENT over WEAK_SIGNAL
- Focus on markets where position in source market informs trading strategy
- Return empty array only if NO good opportunities exist: {"related": []}`;

registerPrompt(
  'related-bets-analysis',
  RELATED_BETS_PROMPT_V1,
  'Default prompt for finding related prediction markets'
);