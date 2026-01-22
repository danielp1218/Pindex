export type Decision = 'yes' | 'no';

export type RelationType =
  | 'IMPLIES'
  | 'CONTRADICTS'
  | 'CORRELATED'
  | 'PARTITION_OF'
  | 'SUBEVENT'
  | 'CONDITIONED_ON'
  | 'WEAK_SIGNAL';

export interface RelationGraphNode {
  id: string;
  probability: number;
  weight: number;
  decision?: Decision;
  relation?: RelationType;
  children?: RelationGraphNode[];
  label?: string;
  question?: string;
  explanation?: string;
  url?: string;
  imageUrl?: string;
}
