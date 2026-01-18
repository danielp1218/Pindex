import type { RelationType } from '@pindex/relations-engine';

export type Decision = 'yes' | 'no';

export interface GraphNodeInput {
  id: string;
  probability: number;
  weight: number;
  decision?: Decision | string;
  relation?: RelationType;
  children?: GraphNodeInput[];
}

export interface GraphOutcomeResult {
  totalStake: number;
  worstCase: number;
  bestCase: number;
  expectedValue: number;
  roi: number;
  warnings: string[];
}

interface OutcomeMetrics {
  min: number;
  max: number;
  expected: number;
}

interface NodeMetrics {
  probability: number;
  yes: OutcomeMetrics;
  no: OutcomeMetrics;
}

const RELATION_TYPES: RelationType[] = [
  'IMPLIES',
  'CONTRADICTS',
  'PARTITION_OF',
  'SUBEVENT',
  'CONDITIONED_ON',
  'WEAK_SIGNAL',
];

function normalizeDecision(value: Decision | string | undefined): Decision {
  if (typeof value === 'string' && value.toLowerCase() === 'no') {
    return 'no';
  }
  return 'yes';
}

function clampProbability(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function outcomeReturn(decision: Decision, outcome: Decision, weight: number): number {
  return decision === outcome ? weight : -weight;
}

function allowedOutcomes(relation: RelationType, parentOutcome: Decision): Decision | 'both' {
  if (relation === 'IMPLIES') {
    return parentOutcome === 'yes' ? 'both' : 'no';
  }
  if (relation === 'SUBEVENT' || relation === 'CONDITIONED_ON') {
    return parentOutcome === 'yes' ? 'yes' : 'both';
  }
  if (relation === 'CONTRADICTS') {
    return parentOutcome === 'yes' ? 'no' : 'both';
  }
  if (relation === 'PARTITION_OF') {
    return 'both';
  }
  return 'both';
}

function conditionalYesProbability(
  relation: RelationType,
  parentProbability: number,
  childProbability: number,
  parentOutcome: Decision,
  warnings: string[],
  childId: string
): number {
  if (relation === 'IMPLIES') {
    if (parentOutcome === 'no') {
      return 0;
    }
    const denom = parentProbability;
    if (denom <= 0) {
      return 0;
    }
    const raw = childProbability / denom;
    if (childProbability > parentProbability) {
      warnings.push(
        `probability_incoherent:${childId}:child probability above parent for IMPLIES.`
      );
    }
    return clampProbability(raw);
  }

  if (relation === 'SUBEVENT' || relation === 'CONDITIONED_ON') {
    if (parentOutcome === 'yes') {
      return 1;
    }
    const denom = 1 - parentProbability;
    if (denom <= 0) {
      return 0;
    }
    const raw = (childProbability - parentProbability) / denom;
    if (childProbability < parentProbability) {
      warnings.push(
        `probability_incoherent:${childId}:child probability below parent for ${relation}.`
      );
    }
    return clampProbability(raw);
  }

  if (relation === 'CONTRADICTS') {
    if (parentOutcome === 'yes') {
      return 0;
    }
    const denom = 1 - parentProbability;
    if (denom <= 0) {
      return 0;
    }
    const raw = childProbability / denom;
    if (parentProbability + childProbability > 1) {
      warnings.push(
        `probability_incoherent:${childId}:sum exceeds 1 for CONTRADICTS.`
      );
    }
    return clampProbability(raw);
  }

  if (relation === 'WEAK_SIGNAL') {
    return clampProbability(childProbability);
  }

  return clampProbability(childProbability);
}

function evaluatePartitionGroup(
  children: GraphNodeInput[],
  metrics: NodeMetrics[],
  parentOutcome: Decision,
  parentProbability: number,
  warnings: string[]
): OutcomeMetrics {
  if (children.length === 0) {
    return { min: 0, max: 0, expected: 0 };
  }

  if (parentOutcome === 'no') {
    const sumMin = metrics.reduce((total, child) => total + child.no.min, 0);
    const sumMax = metrics.reduce((total, child) => total + child.no.max, 0);
    const sumExpected = metrics.reduce((total, child) => total + child.no.expected, 0);
    return { min: sumMin, max: sumMax, expected: sumExpected };
  }

  const baseNoMin = metrics.reduce((total, child) => total + child.no.min, 0);
  const baseNoMax = metrics.reduce((total, child) => total + child.no.max, 0);
  const baseNoExpected = metrics.reduce((total, child) => total + child.no.expected, 0);

  const sumProb = children.reduce((total, child) => total + child.probability, 0);
  if (sumProb <= 0) {
    warnings.push('partition_probability:sum is zero; using uniform split.');
  } else if (Math.abs(sumProb - parentProbability) > 0.05) {
    warnings.push('partition_probability:sum does not match parent probability.');
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let expected = 0;

  const uniform = children.length > 0 ? 1 / children.length : 0;

  for (let i = 0; i < children.length; i += 1) {
    const child = metrics[i];
    const childMin = baseNoMin - child.no.min + child.yes.min;
    const childMax = baseNoMax - child.no.max + child.yes.max;
    min = Math.min(min, childMin);
    max = Math.max(max, childMax);

    const probability = sumProb > 0 ? children[i].probability / sumProb : uniform;
    expected += probability * (baseNoExpected - child.no.expected + child.yes.expected);
  }

  if (!Number.isFinite(min)) {
    min = 0;
  }
  if (!Number.isFinite(max)) {
    max = 0;
  }

  return { min, max, expected };
}

function evaluateChildren(
  parent: GraphNodeInput,
  metricsById: Map<string, NodeMetrics>,
  parentOutcome: Decision,
  warnings: string[]
): OutcomeMetrics {
  const children = parent.children ?? [];
  const partitionChildren: GraphNodeInput[] = [];
  const partitionMetrics: NodeMetrics[] = [];

  let min = 0;
  let max = 0;
  let expected = 0;

  for (const child of children) {
    const relation = child.relation;
    if (!relation || !RELATION_TYPES.includes(relation)) {
      warnings.push(`missing_relation:${child.id}`);
      continue;
    }

    const metrics = metricsById.get(child.id);
    if (!metrics) {
      continue;
    }

    if (relation === 'PARTITION_OF') {
      partitionChildren.push(child);
      partitionMetrics.push(metrics);
      continue;
    }

    const allowed = allowedOutcomes(relation, parentOutcome);

    if (allowed === 'yes') {
      min += metrics.yes.min;
      max += metrics.yes.max;
      expected += metrics.yes.expected;
      continue;
    }

    if (allowed === 'no') {
      min += metrics.no.min;
      max += metrics.no.max;
      expected += metrics.no.expected;
      continue;
    }

    const childYesProbability = conditionalYesProbability(
      relation,
      parent.probability,
      child.probability,
      parentOutcome,
      warnings,
      child.id
    );

    min += Math.min(metrics.yes.min, metrics.no.min);
    max += Math.max(metrics.yes.max, metrics.no.max);
    expected +=
      childYesProbability * metrics.yes.expected +
      (1 - childYesProbability) * metrics.no.expected;
  }

  const partition = evaluatePartitionGroup(
    partitionChildren,
    partitionMetrics,
    parentOutcome,
    parent.probability,
    warnings
  );

  return {
    min: min + partition.min,
    max: max + partition.max,
    expected: expected + partition.expected,
  };
}

function evaluateNode(node: GraphNodeInput, warnings: string[]): NodeMetrics {
  const decision = normalizeDecision(node.decision);
  const weight = node.weight;

  const childMetricsById = new Map<string, NodeMetrics>();
  for (const child of node.children ?? []) {
    childMetricsById.set(child.id, evaluateNode(child, warnings));
  }

  const yesChildren = evaluateChildren(node, childMetricsById, 'yes', warnings);
  const noChildren = evaluateChildren(node, childMetricsById, 'no', warnings);

  return {
    probability: node.probability,
    yes: {
      min: outcomeReturn(decision, 'yes', weight) + yesChildren.min,
      max: outcomeReturn(decision, 'yes', weight) + yesChildren.max,
      expected: outcomeReturn(decision, 'yes', weight) + yesChildren.expected,
    },
    no: {
      min: outcomeReturn(decision, 'no', weight) + noChildren.min,
      max: outcomeReturn(decision, 'no', weight) + noChildren.max,
      expected: outcomeReturn(decision, 'no', weight) + noChildren.expected,
    },
  };
}

function collectNodes(root: GraphNodeInput): GraphNodeInput[] {
  const nodes: GraphNodeInput[] = [];
  const stack = [root];
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

export function evaluateGraph(root: GraphNodeInput): GraphOutcomeResult {
  const warnings: string[] = [];
  const nodes = collectNodes(root);
  const rootMetrics = evaluateNode(root, warnings);

  const totalStake = nodes.reduce((sum, node) => sum + node.weight, 0);
  const expectedValue =
    root.probability * rootMetrics.yes.expected +
    (1 - root.probability) * rootMetrics.no.expected;
  const worstCase = Math.min(rootMetrics.yes.min, rootMetrics.no.min);
  const bestCase = Math.max(rootMetrics.yes.max, rootMetrics.no.max);
  const roi = totalStake > 0 ? expectedValue / totalStake : 0;

  return {
    totalStake,
    worstCase,
    bestCase,
    expectedValue,
    roi,
    warnings,
  };
}
