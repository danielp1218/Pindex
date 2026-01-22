export type BetRelationship =
  | 'IMPLIES'
  | 'CONTRADICTS'
  | 'CORRELATED'
  | 'PARTITION_OF'
  | 'SUBEVENT'
  | 'CONDITIONED_ON'
  | 'WEAK_SIGNAL';

export interface Node {
  id: string;
  label: string;
  imageUrl?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  marketId?: string;
  slug?: string;
  url?: string;
  yesPercentage?: number;
  noPercentage?: number;
  weight?: number;
  probability?: number;
  decision?: 'yes' | 'no';
}

export interface Link {
  source: string | Node;
  target: string | Node;
  relationship?: BetRelationship;
  reasoning?: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export const RELATIONSHIP_COLORS: Record<BetRelationship, string> = {
  IMPLIES: '#4a7c6f',
  CONTRADICTS: '#8b5c5c',
  CORRELATED: '#6b7a8a',
  PARTITION_OF: '#5c7a9e',
  SUBEVENT: '#7a6b8a',
  CONDITIONED_ON: '#8a7a5c',
  WEAK_SIGNAL: '#64748b',
};

export function getRelationshipColor(relationship?: BetRelationship): string {
  return relationship ? RELATIONSHIP_COLORS[relationship] : '#334155';
}
