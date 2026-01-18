# Relations Engine

## Overview

The Relations Engine validates logical relationships between prediction market events, flags incoherent pricing, and supports pricing/positioning through constraint-aware probabilities.

## Core Architecture

### Main Components

- **src/analyze.ts**: Relation validation and arbitrage detection
- **src/pricing.ts**: Coherent probability projection and edge calculation
- **src/sizing.ts**: Fractional Kelly sizing helper (optional utility)
- **src/types.ts**: Type definitions
- **src/index.ts**: Public exports

### Public API

```typescript
import {
  analyzeRelations,
  priceRelations,
  calculateKellySizing,
} from '@pindex/relations-engine';
```

## Relation Types (Directional)

The engine models directed relationships between `root` and `related`. Direction matters.

- **IMPLIES** (related ⇒ root)  
  Constraint: `P(related) <= P(root)`

- **SUBEVENT** (root ⊆ related)  
  Constraint: `P(root) <= P(related)`

- **CONDITIONED_ON** (root only meaningful if related)  
  Constraint: `P(root) <= P(related)`

- **CONTRADICTS** (mutually exclusive)  
  Constraint: `P(root) + P(related) <= 1`

- **PARTITION_OF** (members partition a parent)  
  Constraint: `sum(P(members)) = 1` (engine-level expectation)

- **WEAK_SIGNAL** (correlation only)  
  No pricing constraint; used only for warnings/risk guidance.

## Pricing System (Engine)

### Inputs
- Market-implied probabilities (`probabilityYes`) per event
- Relationship constraints from `RelationInput[]`

### Method
`priceRelations()` uses iterative weighted projections onto the constraints:
- Each step projects probabilities onto a constraint set while minimizing squared deviation from the current values.
- Weights can be supplied per event (or via `PricingOptions.weights`) to preserve higher-confidence markets.
- Iteration stops when changes fall below `tolerance` or `maxIterations` is reached.

### Output
`priceRelations()` returns coherent probabilities, edge signals, convergence metadata, and warnings.

## Server Compact Pricing Adapter (Root + Dependants)

The server exposes a compact `/api/relations/price` payload where direction is **relative to the root**:
- **IMPLIES** means `dependant ⇒ root`
- **SUBEVENT / CONDITIONED_ON / CONTRADICTS** are evaluated as `root ⇒ dependant` constraints

### Input Schema

```json
{
  "root": { "probability": 0.62, "weight": 1.1, "decision": "yes" },
  "dependants": [
    { "id": "1", "probability": 0.55, "relation": "IMPLIES" }
  ],
  "volatility": 1,
  "options": { "epsilon": 0.01 }
}
```

### Target Probability Rules (Compact Mode)

Each dependant is adjusted against the root using the relation-specific direction:

- **IMPLIES**  
  Target: `min(P(dep), P(root))`  
  (If dependant > root, buy NO on dependant.)

- **SUBEVENT / CONDITIONED_ON**  
  Target: `max(P(dep), P(root))`  
  (If root > dependant, buy YES on dependant.)

- **CONTRADICTS**  
  Target: `min(P(dep), 1 - P(root))`  
  (If root + dependant > 1, buy NO on dependant.)

- **PARTITION_OF**  
  All dependants marked PARTITION_OF are rescaled so  
  `sum(P(dep)) = P(root)` (server compact choice).

- **WEAK_SIGNAL**  
  Target: `P(dep)` (no constraint → no trade).

### Edge, Decision, and Weight

- Edge: `edge = targetProbability - marketProbability`
- Base epsilon: `options.epsilon` (default 0.01)
- Volatility: risk-seeking control (default 1)

Effective threshold and sizing:

```
effectiveEpsilon = baseEpsilon / volatility   (clamped; volatility=0 => no trades)
adjustedEdge = max(0, |edge| - effectiveEpsilon)
normalizedEdge = adjustedEdge / (1 - effectiveEpsilon)
weight = root.weight * normalizedEdge^(1 / volatility)
```

Decision:
- If `adjustedEdge > 0`: `decision = "yes"` when `edge > 0`, else `"no"`
- Otherwise: `decision = root.decision`

### Output Schema

```json
{
  "dependants": [
    { "id": "1", "weight": 0.5, "decision": "yes", "relation": "IMPLIES" }
  ]
}
```

## Sizing Helper (Optional)

`calculateKellySizing()` implements fractional Kelly sizing using coherent vs market probabilities. The compact server adapter currently uses the custom volatility-based sizing described above.
