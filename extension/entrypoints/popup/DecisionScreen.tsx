import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { getRelationshipColor, type BetRelationship } from '@/types/graph';
import type { GraphOutcomeResult, GraphOutcomeDelta } from '@/utils/globalsApi';

interface DecisionMiniGraphData {
  nodes: Array<{
    id: string;
    label: string;
    fullLabel: string;
    x: number;
    y: number;
    imageUrl?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    relationship?: BetRelationship;
    reasoning?: string;
  }>;
  sourceLabel: string;
  targetLabel: string;
  reasoning: string;
  sourceImageUrl?: string;
}

interface DecisionScreenProps {
  eventTitle: string;
  userSelection: 'yes' | 'no' | null;
  profileImage: string | null;
  onViewNodes: () => void;
  onDecision: (accepted: boolean, risk: number) => void;
  isProcessing: boolean;
  hasDecisionTarget?: boolean;
  miniGraphData?: DecisionMiniGraphData | null;
  showUserSelection?: boolean;
  globalsBaseline?: GraphOutcomeResult | null;
  globalsCandidate?: GraphOutcomeResult | null;
  globalsDelta?: GraphOutcomeDelta | null;
  globalsLoading?: boolean;
  globalsError?: string | null;
}

// Reusable button styles matching landing page
const buttonBase = {
  padding: '6px 12px',
  borderRadius: '7px',
  fontWeight: 500,
  fontSize: '11px',
  cursor: 'pointer',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
  color: '#e2e8f0',
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
};

export default function DecisionScreen({
  eventTitle,
  userSelection,
  profileImage,
  onViewNodes,
  onDecision,
  isProcessing,
  hasDecisionTarget = true,
  miniGraphData,
  showUserSelection,
  globalsBaseline,
  globalsCandidate,
  globalsDelta,
  globalsLoading,
  globalsError,
}: DecisionScreenProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [riskLevel, setRiskLevel] = useState(50);
  const [viewNodesHover, setViewNodesHover] = useState(false);
  const [acceptBtnHover, setAcceptBtnHover] = useState(false);
  const [rejectBtnHover, setRejectBtnHover] = useState(false);
  const [riskHover, setRiskHover] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccepted(null);
  }, [miniGraphData?.targetLabel, miniGraphData?.sourceLabel]);

  useEffect(() => {
    if (!svgRef.current || !miniGraphData) return;

    const width = 320;
    const height = 90;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('style', 'background: transparent; overflow: visible;');

    // Create a group for rendering (no zoom/pan)
    const g = svg.append('g');

    // Create copies of data for D3 (no simulation needed - fixed positions)
    const nodes = miniGraphData.nodes.map(d => ({ ...d }));
    const links = miniGraphData.links
      .map(d => {
        const source = nodes.find(node => node.id === d.source) ?? nodes[0];
        const target = nodes.find(node => node.id === d.target) ?? nodes[nodes.length - 1];
        if (!source || !target) {
          return null;
        }
        return { ...d, source, target };
      })
      .filter(Boolean) as Array<any>;

    const nodeRadius = 16;

    // Add circular clip path for images
    const defs = svg.append('defs');
    defs.append('clipPath')
      .attr('id', 'decisionMiniCircleClip')
      .append('circle')
      .attr('r', nodeRadius - 2)
      .attr('cx', 0)
      .attr('cy', 0);

    // Access tooltip for edge hover
    const tooltip = d3.select(tooltipRef.current);

    // Draw link with relationship color
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d: any) => getRelationshipColor(d.relationship))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d: any) => {
        d3.select(event.target as Element)
          .attr('stroke-opacity', 1);

        const relationship = d.relationship || 'RELATED';
        tooltip
          .style('opacity', '1')
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`)
          .html(`<strong style="color: ${getRelationshipColor(d.relationship)}">${relationship}</strong>${d.reasoning ? `<br/><span style="color: #94a3b8; font-size: 10px; margin-top: 4px; display: block;">${d.reasoning}</span>` : ''}`);
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltip
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`);
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.target as Element)
          .attr('stroke-opacity', 0.6);
        tooltip.style('opacity', '0');
      });

    // Draw nodes (stationary - no drag)
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'default');

    // Render nodes with images if available, otherwise circle with text
    node.each(function(d: any) {
      const nodeGroup = d3.select(this);
      
      if (d.imageUrl) {
        // Clipped image node
        nodeGroup.append('image')
          .attr('href', d.imageUrl)
          .attr('width', (nodeRadius - 2) * 2)
          .attr('height', (nodeRadius - 2) * 2)
          .attr('x', -(nodeRadius - 2))
          .attr('y', -(nodeRadius - 2))
          .attr('clip-path', 'url(#decisionMiniCircleClip)')
          .attr('preserveAspectRatio', 'xMidYMid slice');
      } else {
        // Fallback circle with text
        nodeGroup.append('circle')
          .attr('r', nodeRadius)
          .attr('fill', '#1e293b')
          .attr('stroke', '#334155')
          .attr('stroke-width', 1);
        
        nodeGroup.append('text')
          .text(d.label)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', '#64748b')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('pointer-events', 'none');
      }
    });

    // Add hover tooltip events (reuse tooltip from above)
    node
      .on('mouseenter', (event: MouseEvent, d: any) => {
        tooltip
          .style('opacity', '1')
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`)
          .text(d.fullLabel);
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltip
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`);
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', '0');
      });

    // Set fixed positions (no simulation needed)
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  }, [miniGraphData]);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return value.toFixed(decimals);
  };

  const formatSigned = (value: number, formatter: (val: number) => string) => {
    if (!Number.isFinite(value)) {
      return '—';
    }
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${formatter(Math.abs(value))}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  const getDeltaColor = (value: number) => {
    if (value > 0) {
      return '#6ee7b7';
    }
    if (value < 0) {
      return '#fca5a5';
    }
    return '#94a3b8';
  };

  const deltaRows = globalsDelta
    ? [
        {
          label: 'Expected Value',
          value: globalsDelta.expectedValue,
          display: formatSigned(globalsDelta.expectedValue, formatNumber),
        },
        {
          label: 'Worst Case',
          value: globalsDelta.worstCase,
          display: formatSigned(globalsDelta.worstCase, formatNumber),
        },
        {
          label: 'Best Case',
          value: globalsDelta.bestCase,
          display: formatSigned(globalsDelta.bestCase, formatNumber),
        },
        {
          label: 'Total Stake',
          value: globalsDelta.totalStake,
          display: formatSigned(globalsDelta.totalStake, formatNumber),
        },
        {
          label: 'ROI',
          value: globalsDelta.roi,
          display: formatSigned(globalsDelta.roi, formatPercent),
        },
      ]
    : [];

  return (
    <div style={{
      width: '420px',
      minWidth: '420px',
      maxWidth: '420px',
      height: '600px',
      maxHeight: '600px',
      background: '#0a0f1a',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
        gap: '8px',
        minWidth: 0, // Allow flex items to shrink
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          flex: 1,
          minWidth: 0, // Allow title to shrink
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            background: profileImage ? 'transparent' : 'linear-gradient(135deg, #475569, #334155)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0, // Prevent icon from shrinking
            overflow: 'hidden',
          }}>
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Event profile" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%',
                }}
                onError={(e) => {
                  // Fallback to flag if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.textContent = '🇺🇸';
                    parent.style.background = 'linear-gradient(135deg, #475569, #334155)';
                  }
                }}
              />
            ) : (
              '🇺🇸'
            )}
          </div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '14px', 
            fontWeight: 600, 
            color: '#f1f5f9',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0, // Allow text to truncate
          }}>
            {eventTitle}
          </h1>
        </div>
        <button
          onClick={onViewNodes}
          onMouseEnter={() => setViewNodesHover(true)}
          onMouseLeave={() => setViewNodesHover(false)}
          style={{
            ...buttonBase,
            padding: '6px 12px',
            fontSize: '11px',
            flexShrink: 0,
            border: viewNodesHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: viewNodesHover 
              ? '0 8px 32px rgba(70, 100, 140, 0.3)' 
              : '0 2px 8px rgba(0, 0, 0, 0.15)',
            filter: viewNodesHover ? 'brightness(1.25)' : 'brightness(1)',
          }}
        >
          View Nodes
        </button>
      </div>

      {/* Main Content - Vertical Stack */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '0 16px 12px 16px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Risk Slider */}
        <div>
          <div style={{
            fontSize: '9px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontWeight: 600,
          }}>Risk</div>
          <div
            onMouseEnter={() => setRiskHover(true)}
            onMouseLeave={() => setRiskHover(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
              color: '#e2e8f0',
              padding: '8px 12px',
              borderRadius: '8px',
              border: riskHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              boxShadow: riskHover
                ? '0 8px 24px rgba(70, 100, 140, 0.25)'
                : '0 2px 8px rgba(0, 0, 0, 0.15)',
              outline: 'none',
              transition: 'all 0.2s ease',
              filter: riskHover ? 'brightness(1.2)' : 'brightness(1)',
            }}
          >
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={riskLevel}
              onChange={(e) => setRiskLevel(Number(e.target.value))}
                style={{
                flex: 1,
                    cursor: 'pointer',
                accentColor: '#38bdf8',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
              {Math.round(riskLevel)}
            </span>
                  </div>
        </div>

        {/* Chain Dependency - Mini Graph (matching VisualizationScreen style) */}
        <div>
          <div style={{
            fontSize: '9px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontWeight: 600,
          }}>Chain Dependency</div>
          <div style={{
          background: 'transparent',
            borderRadius: '8px',
            border: '1px solid #334155',
            padding: '12px',
          }}>
            {/* Mini graph visualization - D3 controlled with pan/zoom/drag */}
            <div style={{ position: 'relative' }}>
              <svg ref={svgRef} style={{ overflow: 'visible' }}></svg>
              <div
                ref={tooltipRef}
                style={{
                  position: 'absolute',
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#94a3b8',
                  padding: '6px 10px',
                borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  pointerEvents: 'none',
                  opacity: 0,
                  transition: 'opacity 0.1s',
                  maxWidth: '180px',
                  wordWrap: 'break-word',
                  zIndex: 10,
                }}
              />
              </div>
            
            {/* Labels below graph */}
            {miniGraphData && (
              <>
              <div style={{
                  display: 'flex',
                  justifyContent: miniGraphData.sourceLabel ? 'space-between' : 'center',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                }}>
                  {miniGraphData.sourceLabel && (
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Source</div>
                      <div style={{ fontSize: '10px', fontWeight: 500, color: '#e2e8f0' }}>{miniGraphData.sourceLabel}</div>
                    </div>
                  )}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Target</div>
                    <div style={{ fontSize: '10px', fontWeight: 500, color: '#e2e8f0' }}>{miniGraphData.targetLabel}</div>
              </div>
            </div>

                {miniGraphData.links[0]?.relationship && (
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                  }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      color: getRelationshipColor(miniGraphData.links[0].relationship),
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {miniGraphData.links[0].relationship}
                    </span>
                  </div>
                )}

                {miniGraphData.reasoning && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '10px',
                    color: '#64748b',
                    lineHeight: 1.4,
                  }}>
                    {miniGraphData.reasoning}
                  </div>
                )}
              </>
            )}
            {!miniGraphData && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                fontSize: '10px',
                color: '#64748b',
                lineHeight: 1.4,
                textAlign: 'center',
              }}>
                No queued dependencies yet
              </div>
            )}
          </div>
        </div>

        {/* User Selection Display */}
        {userSelection && (showUserSelection ?? true) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid #1e293b',
          }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Your position</span>
            <span style={{ 
              fontSize: '11px', 
              color: userSelection === 'yes' ? '#6ee7b7' : '#fca5a5',
              fontWeight: 500,
            }}>
              {userSelection === 'yes' ? 'Yes' : 'No'}
            </span>
          </div>
        )}

        {/* Impact Summary */}
        <div style={{ marginTop: '10px' }}>
          <div style={{
            fontSize: '9px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontWeight: 600,
          }}>Accept vs Reject</div>
          <motion.div 
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              padding: '12px 14px',
            background: '#1e293b',
            borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#f1f5f9',
              letterSpacing: '0.2px',
              display: 'block',
              marginBottom: '8px',
            }}>
              {globalsLoading
                ? 'Calculating impact'
                : globalsError
                  ? 'Impact unavailable'
                  : 'Decision impact'}
            </span>
            {globalsLoading && (
              <p style={{ 
                margin: 0, 
                fontSize: '11px', 
                color: '#64748b', 
                lineHeight: 1.5,
              }}>
                Comparing accept vs reject outcomes...
              </p>
            )}
            {globalsError && !globalsLoading && (
              <p style={{ 
                margin: 0, 
                fontSize: '11px', 
                color: '#fca5a5', 
                lineHeight: 1.5,
              }}>
                {globalsError}
              </p>
            )}
            {!globalsLoading && !globalsError && globalsDelta && (
              <>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {deltaRows.map((row) => (
                    <div
                      key={row.label}
              style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>{row.label}</span>
                      <span style={{ color: getDeltaColor(row.value), fontWeight: 600 }}>
                        {row.display}
                      </span>
          </div>
                  ))}
        </div>
                {globalsBaseline && globalsCandidate && (
              <div style={{
                    marginTop: '8px', 
                    paddingTop: '8px', 
                    borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                    fontSize: '10px', 
                    color: '#64748b',
                    lineHeight: 1.4,
                  }}>
                    Accept EV: {formatNumber(globalsCandidate.expectedValue)} | Reject EV: {formatNumber(globalsBaseline.expectedValue)}
                    <br />
                    Accept ROI: {formatPercent(globalsCandidate.roi)} | Reject ROI: {formatPercent(globalsBaseline.roi)}
                  </div>
                )}
              </>
            )}
            {!globalsLoading && !globalsError && !globalsDelta && (
              <p style={{ 
                margin: 0, 
                fontSize: '11px', 
                color: '#64748b', 
                lineHeight: 1.5,
              }}>
                No queued dependency to compare yet.
              </p>
            )}
          </motion.div>
              </div>

        {/* Action Buttons */}
        {hasDecisionTarget && (
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px' }}>
            <button
              onMouseEnter={() => setAcceptBtnHover(true)}
              onMouseLeave={() => setAcceptBtnHover(false)}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '12px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                border: accepted === true 
                  ? '1px solid rgba(110, 231, 183, 0.3)' 
                  : acceptBtnHover 
                    ? '1px solid rgba(255, 255, 255, 0.3)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                background: accepted === true 
                  ? 'linear-gradient(180deg, #2d4a3e 0%, #1e3a2f 100%)' 
                  : 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
                color: accepted === true ? '#6ee7b7' : '#e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: acceptBtnHover && accepted !== true
                  ? '0 8px 32px rgba(70, 100, 140, 0.3)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                filter: acceptBtnHover && accepted !== true ? 'brightness(1.25)' : 'brightness(1)',
                opacity: isProcessing ? 0.6 : 1,
              }}
              onClick={() => {
                setAccepted(true);
                onDecision(true, riskLevel);
              }}
            >
              Accept
            </button>
            <button
              onMouseEnter={() => setRejectBtnHover(true)}
              onMouseLeave={() => setRejectBtnHover(false)}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '12px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                border: accepted === false 
                  ? '1px solid rgba(252, 165, 165, 0.3)' 
                  : rejectBtnHover 
                    ? '1px solid rgba(255, 255, 255, 0.3)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                background: accepted === false 
                  ? 'linear-gradient(180deg, #4a2d2d 0%, #3a1e1e 100%)' 
                  : 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
                color: accepted === false ? '#fca5a5' : '#e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: rejectBtnHover && accepted !== false
                  ? '0 8px 32px rgba(70, 100, 140, 0.3)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                filter: rejectBtnHover && accepted !== false ? 'brightness(1.25)' : 'brightness(1)',
                opacity: isProcessing ? 0.6 : 1,
              }}
              onClick={() => {
                setAccepted(false);
                onDecision(false, riskLevel);
              }}
            >
              Reject
            </button>
          </div>
        )}
      </div>


    </div>
  );
}
