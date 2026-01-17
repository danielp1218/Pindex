import { useState, useRef, useEffect } from 'react';

interface DecisionScreenProps {
  eventTitle: string;
  onViewNodes: () => void;
}

export default function DecisionScreen({ eventTitle, onViewNodes }: DecisionScreenProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'hedge' | 'trading'>('trading');
  const [nodesExpanded, setNodesExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const strategyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (strategyRef.current && !strategyRef.current.contains(event.target as Node)) {
        setStrategyOpen(false);
      }
    }

    if (strategyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [strategyOpen]);

  return (
    <div style={{
      width: '600px',
      minHeight: '480px',
      background: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0f172a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>📊</div>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
            {eventTitle}
          </h1>
        </div>
        <button
          onClick={onViewNodes}
          style={{
            background: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>View Nodes</span>
          <span style={{ fontSize: '10px' }}>→</span>
        </button>
      </div>

      {/* Main Content - Two Column Layout */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        padding: '16px 20px',
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Strategy Selection */}
          <div ref={strategyRef} style={{ position: 'relative' }}>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              fontWeight: 600,
            }}>Strategy</div>
            <button
              style={{
                width: '100%',
                background: '#1e293b',
                color: '#e2e8f0',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
              }}
              onClick={() => setStrategyOpen(!strategyOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '9px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}>AGENT</span>
                <span style={{ textTransform: 'capitalize' }}>{selectedStrategy}</span>
              </div>
              <span style={{ color: '#64748b', fontSize: '10px' }}>{strategyOpen ? '▲' : '▼'}</span>
            </button>

            {strategyOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                overflow: 'hidden',
                zIndex: 10,
              }}>
                <button
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: selectedStrategy === 'hedge' ? '#334155' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #334155',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => { setSelectedStrategy('hedge'); setStrategyOpen(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: '12px' }}>Hedge</span>
                    <span style={{ fontSize: '9px', color: '#fb923c' }}>SAFETY</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Minimize risk</div>
                </button>
                <button
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: selectedStrategy === 'trading' ? '#334155' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => { setSelectedStrategy('trading'); setStrategyOpen(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: '12px' }}>Trading</span>
                    <span style={{ fontSize: '9px', color: '#34d399' }}>ALPHA</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Maximize EV</div>
                </button>
              </div>
            )}
          </div>

          {/* Chain Dependency */}
          <div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>Chain Dependency</span>
              <span 
                style={{ color: '#60a5fa', cursor: 'pointer' }}
                onClick={() => setNodesExpanded(!nodesExpanded)}
              >
                {nodesExpanded ? 'HIDE' : 'EXPAND'}
              </span>
            </div>
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  flex: 1,
                  background: '#0f172a',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}>
                  <div style={{ color: '#64748b', fontSize: '9px', marginBottom: '2px' }}>SOURCE</div>
                  <div style={{ fontWeight: 500 }}>Trump Win Election</div>
                </div>
                <span style={{ color: '#475569' }}>→</span>
                <div style={{
                  flex: 1,
                  background: '#0f172a',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}>
                  <div style={{ color: '#64748b', fontSize: '9px', marginBottom: '2px' }}>TARGET</div>
                  <div style={{ fontWeight: 500 }}>Trump takes Florida</div>
                </div>
              </div>
              {nodesExpanded && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid #334155',
                  fontSize: '11px',
                  color: '#94a3b8',
                  lineHeight: 1.4,
                }}>
                  Florida's probability curve acts as a high-confidence lead indicator. Volume spikes traditionally precede national sentiment shifts.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* System Decision */}
          <div>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              fontWeight: 600,
            }}>System Decision</div>
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              padding: '16px',
              textAlign: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} />
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>ACCEPT</span>
              </div>
              <button
                style={{
                  background: '#334155',
                  color: '#94a3b8',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
                onClick={() => setShowReasoning(!showReasoning)}
              >
                {showReasoning ? 'Hide Logic' : 'View Reasoning'}
              </button>
            </div>
          </div>

          {/* Reasoning (if shown) */}
          {showReasoning && (
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <div style={{ width: '3px', height: '10px', background: '#3b82f6', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>ANALYSIS</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                Institutional volume in Florida has reached critical mass. Probability drift suggests a 4.2% alpha opportunity.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                border: '1px solid',
                background: accepted === true ? '#059669' : 'rgba(16, 185, 129, 0.1)',
                color: accepted === true ? 'white' : '#34d399',
                borderColor: accepted === true ? '#059669' : 'rgba(16, 185, 129, 0.3)',
              }}
              onClick={() => setAccepted(true)}
            >
              Accept
            </button>
            <button
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                border: '1px solid',
                background: accepted === false ? '#dc2626' : 'rgba(239, 68, 68, 0.1)',
                color: accepted === false ? 'white' : '#f87171',
                borderColor: accepted === false ? '#dc2626' : 'rgba(239, 68, 68, 0.3)',
              }}
              onClick={() => setAccepted(false)}
            >
              Reject
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '10px',
        color: '#475569',
      }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Polyindex • Secure Node</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
