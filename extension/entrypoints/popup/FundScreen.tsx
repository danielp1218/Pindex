import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { RelationGraphNode } from '@/types/relationGraph';
import { flattenGraph } from '@/utils/relationGraph';
import type { GraphOutcomeResult } from '@/utils/globalsApi';

interface FundScreenProps {
  relationGraph: RelationGraphNode;
  globalsResult?: GraphOutcomeResult | null;
  globalsLoading?: boolean;
  globalsError?: string | null;
}

function FundScreen({ relationGraph, globalsResult, globalsLoading, globalsError }: FundScreenProps) {
  const allNodes = useMemo(() => flattenGraph(relationGraph), [relationGraph]);
  const childNodes = useMemo(() => allNodes.filter(n => n.id !== relationGraph.id), [allNodes, relationGraph.id]);

  const totalWeight = useMemo(() => {
    return childNodes.reduce((sum, node) => sum + (node.weight || 1), 0);
  }, [childNodes]);

  const rootInvestment = relationGraph.weight || 100;

  const allocations = useMemo(() => {
    if (totalWeight === 0) return [];
    return childNodes.map(node => {
      const weight = node.weight || 1;
      const percentage = (weight / totalWeight) * 100;
      const amount = (weight / totalWeight) * rootInvestment;
      return {
        node,
        weight,
        percentage,
        amount,
      };
    });
  }, [childNodes, totalWeight, rootInvestment]);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(decimals);
  };

  const formatPercent = (value: number) => {
    if (!Number.isFinite(value)) return '--';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return '--';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
          Your PolyIndex Fund
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Invested
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
              {formatCurrency(rootInvestment)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Positions
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
              {childNodes.length}
            </div>
          </div>
        </div>

        {globalsLoading && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Calculating outcomes...</div>
          </div>
        )}

        {globalsError && !globalsLoading && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#fca5a5' }}>{globalsError}</div>
          </div>
        )}

        {globalsResult && !globalsLoading && !globalsError && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Expected
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: globalsResult.expectedValue >= 0 ? '#6ee7b7' : '#fca5a5',
                }}>
                  {formatCurrency(globalsResult.expectedValue)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                  ROI
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: globalsResult.roi >= 0 ? '#6ee7b7' : '#fca5a5',
                }}>
                  {formatPercent(globalsResult.roi)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Best/Worst
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {formatCurrency(globalsResult.bestCase)} / {formatCurrency(globalsResult.worstCase)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allocations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#64748b',
            fontSize: '12px',
          }}>
            No positions in your fund yet.
            <br />
            Accept dependencies to build your index.
          </div>
        ) : (
          allocations.map(({ node, percentage, amount }, index) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              style={{
                background: 'linear-gradient(180deg, #1e293b 0%, #172033 100%)',
                borderRadius: '10px',
                padding: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
                background: node.imageUrl ? 'transparent' : 'linear-gradient(135deg, #334155, #1e293b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {node.imageUrl ? (
                  <img
                    src={node.imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
                    {(node.label || node.id).substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#e2e8f0',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {node.label || node.question || node.id}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: node.decision === 'yes' ? '#6ee7b7' : '#fca5a5',
                    textTransform: 'uppercase',
                  }}>
                    {node.decision || 'yes'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    {percentage.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>
                    {formatCurrency(amount)}
                  </span>
                  {node.probability !== undefined && (
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Odds: {(node.probability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

export default FundScreen;
