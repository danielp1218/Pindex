import type { RelationType } from '@pindex/relations-engine';

export type Decision = 'yes' | 'no';

export interface CompactRootInput {
  probability: number;
  weight?: number;
  decision?: Decision | string;
  id?: string;
}

export interface CompactDependantInput {
  id: string;
  probability: number;
  relation: RelationType;
}

export interface CompactPricingOptions {
  epsilon?: number;
  volatility?: number;
}

export interface CompactPricingResult {
  dependants: Array<{
    id: string;
    weight: number;
    decision: Decision;
    relation: RelationType;
  }>;
  warnings: string[];
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

function normalizeDecision(value: Decision | string | undefined): Decision {
  if (typeof value === 'string' && value.toLowerCase() === 'no') {
    return 'no';
  }
  return 'yes';
}

function targetProbabilityForRelation(
  relation: RelationType,
  rootProbability: number,
  dependantProbability: number
): number {
  switch (relation) {
    case 'IMPLIES':
      return Math.min(dependantProbability, rootProbability);
    case 'SUBEVENT':
    case 'CONDITIONED_ON':
      return Math.max(dependantProbability, rootProbability);
    case 'CONTRADICTS':
      return Math.min(dependantProbability, 1 - rootProbability);
    case 'PARTITION_OF':
    case 'WEAK_SIGNAL':
    default:
      return dependantProbability;
  }
}

export function priceCompactDependants(
  root: CompactRootInput,
  dependants: CompactDependantInput[],
  options: CompactPricingOptions = {}
): CompactPricingResult {
  const warnings: string[] = [];
  const rootProbability = clampProbability(root.probability);
  const rootWeight = typeof root.weight === 'number' && root.weight > 0 ? root.weight : 1;
  const rootDecision = normalizeDecision(root.decision);
  const baseEpsilon = options.epsilon ?? 0.01;
  const volatility = options.volatility ?? 1;

  const effectiveEpsilon =
    volatility > 0
      ? Math.max(0, Math.min(0.99, baseEpsilon / volatility))
      : 1;
  const riskExponent = volatility > 0 ? 1 / volatility : 1;

  if (volatility <= 0) {
    warnings.push('volatility_non_positive:volatility <= 0 disables trades.');
  }

  const partitionDependants = dependants.filter(
    dependant => dependant.relation === 'PARTITION_OF'
  );
  const partitionTargets = new Map<string, number>();

  if (partitionDependants.length > 0) {
    const sum = partitionDependants.reduce(
      (total, dependant) => total + dependant.probability,
      0
    );

    if (sum > 0) {
      const scale = rootProbability / sum;
      for (const dependant of partitionDependants) {
        partitionTargets.set(
          dependant.id,
          clampProbability(dependant.probability * scale)
        );
      }
    } else {
      warnings.push('partition_sum_zero:PARTITION_OF group has zero probability sum.');
    }
  }

  const priced = dependants.map(dependant => {
    const targetProbability =
      partitionTargets.get(dependant.id) ??
      targetProbabilityForRelation(
        dependant.relation,
        rootProbability,
        dependant.probability
      );
    const edge = targetProbability - dependant.probability;
    const edgeMagnitude = Math.abs(edge);
    // Soft-threshold edges to avoid zeroing out small but real signals.
    const adjustedEdge =
      edgeMagnitude > 0
        ? (edgeMagnitude * edgeMagnitude) / (edgeMagnitude + effectiveEpsilon)
        : 0;
    const decision = edgeMagnitude > 0 ? (edge > 0 ? 'yes' : 'no') : rootDecision;
    const weight =
      edgeMagnitude > 0
        ? rootWeight * Math.pow(adjustedEdge, riskExponent)
        : 0;

    return {
      id: dependant.id,
      weight,
      decision,
      relation: dependant.relation,
    };
  });

  return { dependants: priced, warnings };
}
