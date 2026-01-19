import { fetchDependencies, type DependencyDecision, type DependenciesResponse } from './dependenciesApi';
import {
  getDependencyState,
  setDependencyState,
  type DependencyQueueItem,
  getEventIdFromUrl,
} from './eventStorage';

interface ProcessDecisionInput {
  eventUrl: string;
  keep: boolean;
  fallbackDecision?: DependencyDecision;
  fallbackWeight?: number;
  risk?: number;
}

export interface DependencyDecisionResult {
  response?: DependenciesResponse;
  queue: DependencyQueueItem[];
  visited: string[];
}

function toUnique(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

function extractQueueUrls(items: DependencyQueueItem[]): string[] {
  return items.map(item => item.url).filter(Boolean);
}

function extractQueueIds(items: DependencyQueueItem[]): string[] {
  return items.map(item => item.id).filter(Boolean);
}

function hasVisitedEvent(visited: string[], url: string): boolean {
  const targetId = getEventIdFromUrl(url);
  if (!targetId) {
    return visited.includes(url);
  }
  return visited.some(entry => getEventIdFromUrl(entry) === targetId);
}

function deduplicateQueue(items: DependencyQueueItem[]): DependencyQueueItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeRisk(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 50;
  }
  if ((value as number) < 0) {
    return 0;
  }
  if ((value as number) > 100) {
    return 100;
  }
  return value as number;
}

function mapDependantsToQueue(
  dependants: any[],
  sourceMarket: any,
  visited: string[],
  options: { parentId?: string; parentUrl?: string }
): DependencyQueueItem[] {
  if (!Array.isArray(dependants)) {
    return [];
  }

  const sourceSlug = typeof sourceMarket?.slug === 'string' ? sourceMarket.slug : undefined;
  const sourceUrl = sourceSlug ? `https://polymarket.com/event/${sourceSlug}` : undefined;
  const sourceQuestion =
    typeof sourceMarket?.question === 'string'
      ? sourceMarket.question
      : sourceSlug
        ? sourceSlug.replace(/-/g, ' ')
        : undefined;
  const sourceId = typeof sourceMarket?.id === 'string' ? sourceMarket.id : undefined;

  // Convert visited URLs to event IDs for more robust comparison
  const visitedIds = new Set(
    visited.map(url => getEventIdFromUrl(url)).filter(Boolean)
  );
  // Also track visited URLs directly for fallback comparison
  const visitedUrlSet = new Set(visited);

  return dependants
    .filter(dep => typeof dep?.url === 'string' && dep.url.length > 0)
    .filter(dep => {
      // Skip if URL is already in visited set
      if (visitedUrlSet.has(dep.url)) return false;
      // Skip if event ID is already in visited IDs
      const depId = getEventIdFromUrl(dep.url);
      if (depId && visitedIds.has(depId)) return false;
      return true;
    })
    .map(dep => {
      const imageUrl =
        typeof dep.imageUrl === 'string'
          ? dep.imageUrl
          : typeof dep.image === 'string'
            ? dep.image
            : undefined;

      return {
        id: String(dep.id ?? dep.url),
        url: dep.url,
        weight: typeof dep.weight === 'number' ? dep.weight : 0,
        decision: dep.decision === 'no' ? 'no' : 'yes',
        relation: String(dep.relation ?? ''),
        imageUrl,
        parentId: options.parentId,
        parentUrl: options.parentUrl,
        sourceId,
        sourceSlug,
        sourceUrl,
        sourceQuestion,
        explanation: dep.explanation,
        question: dep.question,
        probability: typeof dep.probability === 'number' ? dep.probability : undefined,
        yesPercentage: typeof dep.yesPercentage === 'number' ? dep.yesPercentage : undefined,
        noPercentage: typeof dep.noPercentage === 'number' ? dep.noPercentage : undefined,
      };
    });
}

export async function processDependencyDecision({
  eventUrl,
  keep,
  fallbackDecision = 'yes',
  fallbackWeight = 1,
  risk,
}: ProcessDecisionInput): Promise<DependencyDecisionResult> {
  const state = await getDependencyState(eventUrl);
  // Deduplicate queue to handle any legacy duplicates in storage
  const queue = deduplicateQueue(state.queue);
  const visited = state.visited;

  const current = queue[0] ?? null;
  const remainingQueue = current ? queue.slice(1) : queue;

  const currentUrl = current?.url || eventUrl;
  const currentDecision = current?.decision ?? fallbackDecision;
  const currentWeight = typeof current?.weight === 'number' ? current.weight : fallbackWeight;
  const rootId = getEventIdFromUrl(eventUrl) ?? 'root';

  let nextQueue = remainingQueue;
  let nextVisited = toUnique([
    ...visited,
    currentUrl,
    ...extractQueueUrls(remainingQueue),
  ]);

  if (!keep) {
    await setDependencyState(eventUrl, nextQueue, nextVisited);
    return { queue: nextQueue, visited: nextVisited };
  }

  if (!current && hasVisitedEvent(visited, eventUrl)) {
    await setDependencyState(eventUrl, nextQueue, nextVisited);
    return { queue: nextQueue, visited: nextVisited };
  }

  if (current) {
    // Avoid expanding dependencies on every accept; only the root decision triggers expansion.
    await setDependencyState(eventUrl, nextQueue, nextVisited);
    return { queue: nextQueue, visited: nextVisited };
  }

  let response: DependenciesResponse | undefined;
  const volatility = 0.5 + normalizeRisk(risk) / 100;

  try {
    response = await fetchDependencies({
      url: currentUrl,
      weight: currentWeight,
      decision: currentDecision,
      visited: nextVisited,
      volatility,
    });

    const parentId = current?.id ?? rootId;
    const existingIds = new Set(extractQueueIds(nextQueue));
    const newItems = mapDependantsToQueue(
      response.dependants || [],
      response.sourceMarket,
      nextVisited,
      { parentId, parentUrl: currentUrl }
    ).filter(item => !existingIds.has(item.id)); // Prevent duplicate IDs in queue

    if (newItems.length > 0) {
      nextQueue = [...nextQueue, ...newItems];
      nextVisited = toUnique([...nextVisited, ...extractQueueUrls(newItems)]);
    }
  } catch (error) {
    // Keep existing queue/visited if dependencies fetch fails.
    console.error('Failed to fetch dependencies', error);
  }

  await setDependencyState(eventUrl, nextQueue, nextVisited);
  return { response, queue: nextQueue, visited: nextVisited };
}
