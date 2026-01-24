import type { GraphData, Link, Node } from '@/types/graph';
import type { RelationGraphNode, RelationType, Decision } from '@/types/relationGraph';
import type { DependencyQueueItem } from './eventStorage';
import type { DependenciesSourceMarket } from './dependenciesApi';
import { getCurrentPageState, updateCurrentPageState, getEventIdFromUrl } from './eventStorage';

const DEFAULT_PROBABILITY = 0.5;
const DEFAULT_WEIGHT = 1;
const DEFAULT_ROOT_INVESTMENT = 100;

const RELATION_TYPES: RelationType[] = [
  'IMPLIES',
  'CONTRADICTS',
  'PARTITION_OF',
  'SUBEVENT',
  'CONDITIONED_ON',
  'WEAK_SIGNAL',
];

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROBABILITY;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function normalizeWeight(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) <= 0) {
    return DEFAULT_WEIGHT;
  }
  return value as number;
}

function normalizeDecision(value: Decision | string | undefined): Decision {
  if (typeof value === 'string' && value.toLowerCase() === 'no') {
    return 'no';
  }
  return 'yes';
}

function normalizeRelation(value: string | undefined): RelationType {
  if (value && RELATION_TYPES.includes(value as RelationType)) {
    return value as RelationType;
  }
  return 'WEAK_SIGNAL';
}

function normalizeNode(node: RelationGraphNode, isRoot: boolean): RelationGraphNode {
  const children = (node.children ?? []).map(child => normalizeNode(child, false));
  let weight = node.weight;
  if (!Number.isFinite(weight) || weight <= 0) {
    weight = isRoot ? DEFAULT_ROOT_INVESTMENT : DEFAULT_WEIGHT;
  } else if (isRoot && weight === 1) {
    weight = DEFAULT_ROOT_INVESTMENT;
  }
  return {
    ...node,
    probability: clampProbability(node.probability),
    weight,
    decision: normalizeDecision(node.decision),
    relation: isRoot ? undefined : normalizeRelation(node.relation),
    children,
  };
}

export function createRootGraph(options: {
  url: string;
  title?: string;
  imageUrl?: string;
  probability?: number;
  weight?: number;
  decision?: Decision;
}): RelationGraphNode {
  const rootId = getEventIdFromUrl(options.url) ?? 'root';
  return {
    id: rootId,
    label: options.title ?? rootId,
    imageUrl: options.imageUrl,
    probability: clampProbability(options.probability ?? DEFAULT_PROBABILITY),
    weight: options.weight ?? DEFAULT_ROOT_INVESTMENT,
    decision: normalizeDecision(options.decision),
    children: [],
  };
}

function convertGraphData(
  graphData: GraphData,
  rootId: string,
  title?: string,
  imageUrl?: string
): RelationGraphNode {
  const rootLabel = title ?? rootId;
  const root: RelationGraphNode = {
    id: rootId,
    label: rootLabel,
    imageUrl,
    probability: DEFAULT_PROBABILITY,
    weight: DEFAULT_ROOT_INVESTMENT,
    decision: 'yes',
    children: [],
  };

  const nodes = graphData?.nodes ?? [];
  for (const node of nodes) {
    if (node.id === rootId || node.id === 'root') {
      continue;
    }
    root.children?.push({
      id: node.id,
      label: node.label ?? node.id,
      imageUrl: node.imageUrl,
      probability: DEFAULT_PROBABILITY,
      weight: DEFAULT_WEIGHT,
      decision: 'yes',
      relation: 'WEAK_SIGNAL',
      children: [],
    });
  }

  return root;
}

export async function loadRelationGraph(options: {
  url: string;
  title?: string;
  imageUrl?: string;
  decision?: Decision;
}): Promise<RelationGraphNode> {
  const rootId = getEventIdFromUrl(options.url) ?? 'root';
  const state = await getCurrentPageState(options.url);
  let graph: RelationGraphNode | null = null;

  if (state?.relationGraph) {
    graph = normalizeNode(state.relationGraph as RelationGraphNode, true);
  } else if (state?.graphData) {
    graph = convertGraphData(state.graphData as GraphData, rootId, options.title, options.imageUrl);
  } else {
    graph = createRootGraph(options);
  }

  graph = updateRootMetadata(graph, {
    id: rootId,
    title: options.title,
    imageUrl: options.imageUrl,
    decision: options.decision,
  });

  await updateCurrentPageState(options.url, { relationGraph: graph });
  return graph;
}

export async function saveRelationGraph(
  url: string,
  graph: RelationGraphNode
): Promise<void> {
  await updateCurrentPageState(url, { relationGraph: graph });
}

export function updateRootMetadata(
  graph: RelationGraphNode,
  updates: {
    id?: string;
    title?: string;
    imageUrl?: string;
    decision?: Decision;
  }
): RelationGraphNode {
  let changed = false;
  const next: RelationGraphNode = { ...graph };

  if (updates.id && updates.id !== graph.id) {
    next.id = updates.id;
    changed = true;
  }
  if (updates.title && updates.title !== graph.label) {
    next.label = updates.title;
    changed = true;
  }
  if (updates.imageUrl && updates.imageUrl !== graph.imageUrl) {
    next.imageUrl = updates.imageUrl;
    changed = true;
  }
  if (updates.decision) {
    const normalized = normalizeDecision(updates.decision);
    if (normalized !== graph.decision) {
      next.decision = normalized;
      changed = true;
    }
  }

  return changed ? next : graph;
}

export function updateNodeFromSource(
  graph: RelationGraphNode,
  nodeId: string,
  source?: DependenciesSourceMarket,
  decision?: Decision
): RelationGraphNode {
  if (!source) {
    return graph;
  }

  if (graph.id === nodeId) {
    const nextLabel = source.question ?? graph.label;
    const nextProbability = clampProbability(source.probability ?? graph.probability);
    const nextWeight = normalizeWeight(source.weight ?? graph.weight);
    const nextDecision = decision ? normalizeDecision(decision) : graph.decision;

    if (
      nextLabel === graph.label &&
      nextProbability === graph.probability &&
      nextWeight === graph.weight &&
      nextDecision === graph.decision
    ) {
      return graph;
    }

    return {
      ...graph,
      label: nextLabel,
      probability: nextProbability,
      weight: nextWeight,
      decision: nextDecision,
    };
  }

  if (!graph.children || graph.children.length === 0) {
    return graph;
  }

  let updated = false;
  const nextChildren = graph.children.map(child => {
    const next = updateNodeFromSource(child, nodeId, source, decision);
    if (next !== child) {
      updated = true;
    }
    return next;
  });

  return updated ? { ...graph, children: nextChildren } : graph;
}

export function buildNodeFromQueueItem(item: DependencyQueueItem): RelationGraphNode {
  const probability =
    typeof item.probability === 'number'
      ? item.probability
      : typeof item.yesPercentage === 'number'
        ? item.yesPercentage / 100
        : DEFAULT_PROBABILITY;
  return {
    id: item.id,
    label: item.question ?? item.id,
    question: item.question,
    explanation: item.explanation,
    url: item.url,
    imageUrl: item.imageUrl,
    probability: clampProbability(probability),
    weight: normalizeWeight(item.weight),
    decision: normalizeDecision(item.decision),
    relation: normalizeRelation(item.relation),
    children: [],
  };
}

function mergeNode(existing: RelationGraphNode, incoming: RelationGraphNode): RelationGraphNode {
  return {
    ...existing,
    ...incoming,
    children: existing.children ?? incoming.children ?? [],
  };
}

export function addChildNode(
  graph: RelationGraphNode,
  parentId: string,
  child: RelationGraphNode
): RelationGraphNode {
  if (graph.id === parentId) {
    const children = graph.children ?? [];
    const existingIndex = children.findIndex(item => item.id === child.id);
    if (existingIndex >= 0) {
      const nextChildren = [...children];
      nextChildren[existingIndex] = mergeNode(nextChildren[existingIndex], child);
      return { ...graph, children: nextChildren };
    }
    return { ...graph, children: [...children, child] };
  }

  if (!graph.children || graph.children.length === 0) {
    return graph;
  }

  let updated = false;
  const nextChildren = graph.children.map(item => {
    const next = addChildNode(item, parentId, child);
    if (next !== item) {
      updated = true;
    }
    return next;
  });

  return updated ? { ...graph, children: nextChildren } : graph;
}

export function addQueueItemToGraph(
  graph: RelationGraphNode,
  item: DependencyQueueItem,
  parentId: string
): RelationGraphNode {
  const child = buildNodeFromQueueItem(item);
  return addChildNode(graph, parentId, child);
}

export function flattenGraph(root: RelationGraphNode): RelationGraphNode[] {
  const nodes: RelationGraphNode[] = [];
  const stack: RelationGraphNode[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    nodes.push(current);
    for (const child of current.children ?? []) {
      stack.push(child);
    }
  }

  return nodes;
}

export function updateNodeImage(
  graph: RelationGraphNode,
  nodeId: string,
  imageUrl: string
): RelationGraphNode {
  if (graph.id === nodeId) {
    if (graph.imageUrl === imageUrl) {
      return graph;
    }
    return { ...graph, imageUrl };
  }

  if (!graph.children || graph.children.length === 0) {
    return graph;
  }

  let updated = false;
  const nextChildren = graph.children.map(child => {
    const next = updateNodeImage(child, nodeId, imageUrl);
    if (next !== child) {
      updated = true;
    }
    return next;
  });

  return updated ? { ...graph, children: nextChildren } : graph;
}

export function graphToGraphData(root: RelationGraphNode): GraphData {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const seen = new Set<string>();
  const linkSet = new Set<string>();
  const allNodes: RelationGraphNode[] = [];

  const addLink = (source: string, target: string, relationship?: RelationType, reasoning?: string) => {
    const key = `${source}->${target}`;
    const reverseKey = `${target}->${source}`;
    if (linkSet.has(key) || linkSet.has(reverseKey) || source === target) return;
    linkSet.add(key);
    links.push({ source, target, relationship, reasoning });
  };

  const walk = (node: RelationGraphNode) => {
    if (!seen.has(node.id)) {
      nodes.push({
        id: node.id,
        label: node.label ?? node.id,
        imageUrl: node.imageUrl,
      });
      seen.add(node.id);
      allNodes.push(node);
    }

    const children = node.children ?? [];
    for (const child of children) {
      addLink(child.id, node.id, child.relation, child.explanation);
      walk(child);
    }

    if (children.length >= 2) {
      addLink(children[0].id, children[1].id, children[0].relation);
    }
  };

  walk(root);

  const nonRoot = allNodes.filter(n => n.id !== root.id);
  if (nonRoot.length >= 3) {
    addLink(nonRoot[0].id, nonRoot[2].id, nonRoot[0].relation);
  }
  if (nonRoot.length >= 5) {
    addLink(nonRoot[1].id, nonRoot[4].id, nonRoot[1].relation);
  }

  return { nodes, links };
}

export function graphToApiPayload(root: RelationGraphNode): RelationGraphNode {
  const toPayload = (node: RelationGraphNode, isRoot: boolean): RelationGraphNode => {
    const children = (node.children ?? []).map(child => toPayload(child, false));
    let weight = node.weight;
    if (!Number.isFinite(weight) || weight <= 0) {
      weight = isRoot ? DEFAULT_ROOT_INVESTMENT : DEFAULT_WEIGHT;
    } else if (isRoot && weight === 1) {
      weight = DEFAULT_ROOT_INVESTMENT;
    }
    const payload: RelationGraphNode = {
      id: node.id,
      probability: clampProbability(node.probability),
      weight,
      decision: normalizeDecision(node.decision),
      children,
    };

    if (!isRoot) {
      payload.relation = normalizeRelation(node.relation);
    }

    return payload;
  };

  return toPayload(root, true);
}
