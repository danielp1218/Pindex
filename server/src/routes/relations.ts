import { Hono } from 'hono';
import { priceRelationSet } from '../services/relation-analyzer';
import { priceRelations, type PricingOptions, type RelationInput, type RelationType } from '@pindex/relations-engine';
import type { GraphNodeInput } from '../services/graph-outcomes';
import { evaluateGraph } from '../services/graph-outcomes';
import { priceCompactDependants } from '../services/compact-relations';

export const relationsRouter = new Hono();

type Decision = 'yes' | 'no';

interface RootRelationInput {
  probability: number;
  weight?: number;
  decision?: Decision | string;
  id?: string;
}

interface DependantInput {
  id: string;
  probability: number;
  relation: RelationType;
}

interface CompactRelationsPayload {
  root: RootRelationInput;
  dependants: DependantInput[];
  options?: PricingOptions;
  volatility?: number;
}

interface GraphValidationError {
  path: string;
  message: string;
}

const RELATION_TYPES: RelationType[] = [
  'IMPLIES',
  'CONTRADICTS',
  'PARTITION_OF',
  'SUBEVENT',
  'CONDITIONED_ON',
  'WEAK_SIGNAL',
];

function isCompactPayload(payload: unknown): payload is CompactRelationsPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const candidate = payload as CompactRelationsPayload;
  return Array.isArray(candidate.dependants) && !!candidate.root;
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isVolatility(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeDecision(value: Decision | string | undefined): Decision {
  if (typeof value === 'string' && value.toLowerCase() === 'no') {
    return 'no';
  }
  return 'yes';
}

function isRelationType(value: unknown): value is RelationType {
  return typeof value === 'string' && RELATION_TYPES.includes(value as RelationType);
}

function isDecision(value: unknown): value is Decision {
  return value === 'yes' || value === 'no';
}

function validateGraphNode(
  node: GraphNodeInput,
  isRoot: boolean,
  path: string,
  seen: Set<string>,
  errors: GraphValidationError[]
) {
  if (!node || typeof node !== 'object') {
    errors.push({ path, message: 'Node must be an object.' });
    return;
  }

  if (!node.id || typeof node.id !== 'string') {
    errors.push({ path, message: 'Node.id is required.' });
  } else if (seen.has(node.id)) {
    errors.push({ path, message: `Duplicate node id: ${node.id}.` });
  } else {
    seen.add(node.id);
  }

  if (!isProbability(node.probability)) {
    errors.push({ path, message: 'Node.probability must be between 0 and 1.' });
  }

  if (!isWeight(node.weight)) {
    errors.push({ path, message: 'Node.weight must be a positive number.' });
  }

  if (!isRoot && !isRelationType(node.relation)) {
    errors.push({ path, message: 'Node.relation must be a valid relation type.' });
  }

  if (node.decision !== undefined && !isDecision(node.decision)) {
    errors.push({ path, message: 'Node.decision must be \"yes\" or \"no\".' });
  }

  if (node.children !== undefined && !Array.isArray(node.children)) {
    errors.push({ path, message: 'Node.children must be an array.' });
    return;
  }

  for (const [index, child] of (node.children ?? []).entries()) {
    validateGraphNode(
      child,
      false,
      `${path}.children[${index}]`,
      seen,
      errors
    );
  }
}

function buildRelationsFromGraph(root: GraphNodeInput): RelationInput[] {
  const relations: RelationInput[] = [];
  const stack: GraphNodeInput[] = [root];

  while (stack.length > 0) {
    const parent = stack.pop();
    if (!parent) {
      continue;
    }

    for (const child of parent.children ?? []) {
      if (child.relation) {
        relations.push({
          relation: child.relation,
          root: {
            id: parent.id,
            probabilityYes: parent.probability,
            weight: parent.weight,
          },
          related: {
            id: child.id,
            probabilityYes: child.probability,
            weight: child.weight,
          },
        });
      }
      stack.push(child);
    }
  }

  return relations;
}

function buildRelationsFromCompact(payload: CompactRelationsPayload) {
  const rootId = payload.root.id ?? 'root';
  const rootWeight = isWeight(payload.root.weight) ? payload.root.weight : 1;
  const rootDecision = normalizeDecision(payload.root.decision);

  const relations: RelationInput[] = payload.dependants.map(dependant => ({
    relation: dependant.relation,
    root: {
      id: rootId,
      probabilityYes: payload.root.probability,
      weight: rootWeight,
    },
    related: {
      id: dependant.id,
      probabilityYes: dependant.probability,
    },
  }));

  return {
    relations,
    options: payload.options,
    rootDecision,
    rootWeight,
  };
}

relationsRouter.post('/price', async (c) => {
  const payload = await c.req.json<
    RelationInput[] | { relations: RelationInput[]; options?: PricingOptions } | CompactRelationsPayload
  >();

  if (isCompactPayload(payload)) {
    const { root, dependants } = payload;

    if (!isProbability(root.probability)) {
      return c.json({ error: 'root.probability must be between 0 and 1.' }, 400);
    }

    if (root.weight !== undefined && !isWeight(root.weight)) {
      return c.json({ error: 'root.weight must be a positive number.' }, 400);
    }

    if (!Array.isArray(dependants) || dependants.length === 0) {
      return c.json({ error: 'dependants array required' }, 400);
    }

    if (payload.volatility !== undefined && !isVolatility(payload.volatility)) {
      return c.json({ error: 'volatility must be a non-negative number.' }, 400);
    }

    const invalidDependant = dependants.some(
      dependant =>
        !dependant ||
        !dependant.id ||
        !isProbability(dependant.probability) ||
        !isRelationType(dependant.relation)
    );

    if (invalidDependant) {
      return c.json(
        { error: 'Each dependant requires id, probability, and relation.' },
        400
      );
    }

    const rootWeight = isWeight(root.weight) ? root.weight : 1;
    const result = priceCompactDependants(
      {
        probability: root.probability,
        weight: rootWeight,
        decision: root.decision,
      },
      dependants,
      {
        volatility: payload.volatility,
        epsilon: payload.options?.epsilon,
      }
    );

    const response = {
      dependants: result.dependants,
    };

    return c.json(response);
  }

  const relations = Array.isArray(payload) ? payload : payload?.relations;
  const options = Array.isArray(payload) ? undefined : payload?.options;

  if (!relations || !Array.isArray(relations) || relations.length === 0) {
    return c.json({ error: 'relations array required' }, 400);
  }

  const invalid = relations.some(
    relation =>
      !relation ||
      !relation.relation ||
      !relation.root ||
      !relation.root.id ||
      !relation.related ||
      !relation.related.id
  );

  if (invalid) {
    return c.json(
      { error: 'Each relation requires relation, root.id, and related.id.' },
      400
    );
  }

  const result = priceRelationSet(relations, options);
  return c.json(result);
});

relationsRouter.post('/graph', async (c) => {
  const payload = await c.req.json<GraphNodeInput>();
  const errors: GraphValidationError[] = [];
  const seen = new Set<string>();

  validateGraphNode(payload, true, 'root', seen, errors);

  if (errors.length > 0) {
    return c.json({ error: 'Invalid graph payload', details: errors }, 400);
  }

  const result = evaluateGraph(payload);
  return c.json(result);
});

relationsRouter.post('/graph/price', async (c) => {
  const payload = await c.req.json<GraphNodeInput>();
  const errors: GraphValidationError[] = [];
  const seen = new Set<string>();

  validateGraphNode(payload, true, 'root', seen, errors);

  if (errors.length > 0) {
    return c.json({ error: 'Invalid graph payload', details: errors }, 400);
  }

  const relations = buildRelationsFromGraph(payload);
  if (relations.length === 0) {
    return c.json({ error: 'Graph must include at least one relation.' }, 400);
  }

  const result = priceRelations(relations);
  return c.json(result);
});
