import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Spotlight } from '../components/ui/Spotlight';

interface DecisionScreenProps {
  eventTitle: string;
  userSelection: 'yes' | 'no' | null;
  onViewNodes: () => void;
}

export default function DecisionScreen({ eventTitle, userSelection, onViewNodes }: DecisionScreenProps) {
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
      {/* Spotlight effect */}
      <Spotlight />
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #475569, #334155)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>🇺🇸</div>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
            {eventTitle}
          </h1>
        </div>
        <button
          onClick={onViewNodes}
          style={{
            background: 'transparent',
            color: '#60a5fa',
            border: 'none',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500,
          }}
        >
          <span>View Nodes</span>
          <span style={{ fontSize: '9px' }}>→</span>
        </button>
      </div>

      {/* Main Content - Vertical Stack */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '0 20px 16px 20px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Strategy Selection */}
        <div ref={strategyRef} style={{ position: 'relative' }}>
          <div style={{
            fontSize: '9px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontWeight: 600,
          }}>Strategy</div>
          <motion.button
            whileHover={{ backgroundColor: '#2d3a52', borderColor: '#475569' }}
            whileTap={{ scale: 0.99 }}
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
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setStrategyOpen(!strategyOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '8px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}>AGENT</span>
              <span style={{ textTransform: 'capitalize' }}>{selectedStrategy}</span>
            </div>
            <motion.span 
              animate={{ rotate: strategyOpen ? 180 : 0 }}
              style={{ color: '#64748b', fontSize: '9px', display: 'inline-block' }}
            >
              ▼
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {strategyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  zIndex: 10,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }}
              >
                <button
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: selectedStrategy === 'hedge' ? 'rgba(51, 65, 85, 0.5)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => { setSelectedStrategy('hedge'); setStrategyOpen(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px' }}>Hedge</span>
                    <span style={{ fontSize: '8px', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.3)', padding: '1px 4px', borderRadius: '3px' }}>SAFETY</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>Minimize risk</div>
                </button>
                <button
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: selectedStrategy === 'trading' ? 'rgba(51, 65, 85, 0.5)' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => { setSelectedStrategy('trading'); setStrategyOpen(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px' }}>Trading</span>
                    <span style={{ fontSize: '8px', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '1px 4px', borderRadius: '3px' }}>ALPHA</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>Maximize EV</div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chain Dependency */}
        <div>
          <div style={{
            fontSize: '9px',
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
              style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 500 }}
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
                fontSize: '10px',
              }}>
                <div style={{ color: '#64748b', fontSize: '8px', marginBottom: '3px', textTransform: 'uppercase' }}>Source</div>
                <div style={{ fontWeight: 500 }}>Trump Win Election</div>
              </div>
              <span style={{ color: '#475569', fontSize: '12px' }}>→</span>
              <div style={{
                flex: 1,
                background: '#0f172a',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '10px',
              }}>
                <div style={{ color: '#64748b', fontSize: '8px', marginBottom: '3px', textTransform: 'uppercase' }}>Target</div>
                <div style={{ fontWeight: 500 }}>Trump takes Florida</div>
              </div>
            </div>
            <AnimatePresence>
              {nodesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(51, 65, 85, 0.5)',
                    fontSize: '10px',
                    color: '#94a3b8',
                    lineHeight: 1.4,
                  }}>
                    Florida's probability curve acts as a high-confidence lead indicator. Volume spikes traditionally precede national sentiment shifts.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* User Selection Display */}
        {userSelection && (
          <div style={{
            background: userSelection === 'yes' 
              ? 'rgba(16, 185, 129, 0.15)' 
              : 'rgba(239, 68, 68, 0.15)',
            borderRadius: '8px',
            border: `1px solid ${userSelection === 'yes' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '10px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
              fontWeight: 600,
            }}>User Selection</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: userSelection === 'yes' ? '#34d399' : '#f87171',
              fontWeight: 600,
              fontSize: '14px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: userSelection === 'yes' ? '#10b981' : '#ef4444',
                borderRadius: '50%',
              }} />
              <span>User said {userSelection === 'yes' ? 'yes' : 'no'}</span>
            </div>
          </div>
        )}

        {/* System Decision */}
        <div>
          <div style={{
            fontSize: '9px',
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
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: '#475569' }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '10px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setShowReasoning(!showReasoning)}
            >
              {showReasoning ? 'Hide Logic' : 'View Reasoning'}
            </motion.button>
          </div>
        </div>

        {/* Reasoning (if shown) */}
        <AnimatePresence>
          {showReasoning && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                border: '1px solid rgba(51, 65, 85, 0.5)',
                padding: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '3px', height: '10px', background: '#3b82f6', borderRadius: '2px' }} />
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Analysis</span>
                </div>
                <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Institutional volume in Florida has reached critical mass. Probability drift suggests a 4.2% alpha opportunity.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: accepted === true ? '#059669' : 'rgba(16, 185, 129, 0.25)' }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: accepted === true 
                ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' 
                : 'rgba(16, 185, 129, 0.1)',
              color: accepted === true ? 'white' : '#34d399',
              backdropFilter: 'blur(8px)',
              boxShadow: accepted === true 
                ? '0 4px 12px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)' 
                : '0 4px 12px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            onClick={() => setAccepted(true)}
          >
            Accept
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: accepted === false ? '#dc2626' : 'rgba(239, 68, 68, 0.25)' }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: accepted === false 
                ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' 
                : 'rgba(239, 68, 68, 0.1)',
              color: accepted === false ? 'white' : '#f87171',
              backdropFilter: 'blur(8px)',
              boxShadow: accepted === false 
                ? '0 4px 12px rgba(239, 68, 68, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)' 
                : '0 4px 12px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            onClick={() => setAccepted(false)}
          >
            Reject
          </motion.button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '9px',
        color: '#475569',
        borderTop: '1px solid #1e293b',
        position: 'relative',
        zIndex: 10,
      }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Polyindex • Secure Node</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
