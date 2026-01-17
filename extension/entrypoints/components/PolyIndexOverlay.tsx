import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import 'tailwindcss';

interface PolyIndexOverlayProps {
  eventSlug: string;
}

export default function PolyIndexOverlay({ eventSlug }: PolyIndexOverlayProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'hedge' | 'trading'>('trading');
  const [nodesExpanded, setNodesExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const strategyRef = useRef<HTMLDivElement>(null);

  // Click outside handler for strategy dropdown
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

  // Default title
  const eventTitle = 'Market Decision';

  return (
    <div
      ref={overlayRef}
      className="bg-[#131c2e]/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden flex flex-col relative z-10"
      style={{ width: '420px', maxHeight: '90vh' }}
    >
      {/* Header with minimize button */}
      <div className="p-5 border-b border-slate-700/30 bg-[#1a2438]/50 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-white text-xl border border-slate-500/30 flex-shrink-0">
            📊
          </div>
          <h2 className="text-slate-100 text-[16px] font-semibold leading-tight truncate tracking-tight">
            {eventTitle}
          </h2>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-slate-400 hover:text-slate-200 px-2 py-1 text-xs"
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {!isMinimized && (
        <div className="p-5 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* 1. Strategy Selection */}
          <div ref={strategyRef} className="flex flex-col gap-2">
            <button
              onClick={() => setStrategyOpen(!strategyOpen)}
              className="w-full bg-[#1a2438] hover:bg-[#1e293b] text-slate-200 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-between border border-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/30 uppercase tracking-wide font-semibold">
                  Agent
                </span>
                <span className="capitalize text-[13px]">{selectedStrategy} Strategy</span>
              </div>
              {strategyOpen ? <ChevronUpIcon className="text-slate-400" /> : <ChevronDownIcon className="text-slate-400" />}
            </button>

            {strategyOpen && (
              <div className="bg-[#1a2438] rounded-xl border border-slate-700/50 overflow-hidden shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStrategy('hedge');
                    setStrategyOpen(false);
                  }}
                  className={`w-full p-4 text-left transition-colors border-b border-slate-700/30 bg-[#1a2438] hover:bg-[#243044] ${
                    selectedStrategy === 'hedge' ? 'bg-[#243044]' : ''
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Hedge</span>
                    <span className="text-[9px] text-orange-400 font-semibold uppercase border border-orange-400/30 px-1.5 py-0.5 rounded">
                      Safety
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">Minimize losses by betting against current position.</p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStrategy('trading');
                    setStrategyOpen(false);
                  }}
                  className={`w-full p-4 text-left transition-colors bg-[#1a2438] hover:bg-[#243044] ${
                    selectedStrategy === 'trading' ? 'bg-[#243044]' : ''
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Trading</span>
                    <span className="text-[9px] text-emerald-400 font-semibold uppercase border border-emerald-400/30 px-1.5 py-0.5 rounded">
                      Alpha
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">Capitalize on market inefficiencies to increase EV.</p>
                </button>
              </div>
            )}
          </div>

          {/* 2. Chain Dependency */}
          <div
            onClick={() => setNodesExpanded(!nodesExpanded)}
            className="bg-[#1a2438] rounded-xl border border-slate-700/50 p-4 cursor-pointer hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Chain Dependency</span>
              <span className="text-[10px] text-blue-400 font-medium uppercase tracking-tight">
                {nodesExpanded ? 'Hide' : 'Expand'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0f172a] p-2.5 rounded-lg border border-slate-700/30 text-[11px]">
                <span className="text-slate-500 block text-[9px] uppercase font-medium mb-0.5">Source</span>
                <span className="text-slate-200 font-medium truncate">Related Market</span>
              </div>
              <div className="text-slate-600 font-medium">→</div>
              <div className="flex-1 bg-[#0f172a] p-2.5 rounded-lg border border-slate-700/30 text-[11px]">
                <span className="text-slate-500 block text-[9px] uppercase font-medium mb-0.5">Target</span>
                <span className="text-slate-200 font-medium truncate">{eventTitle}</span>
              </div>
            </div>
            {nodesExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-700/30">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Market correlation analysis shows this event has dependencies on related prediction markets. Volume spikes here
                  traditionally precede sentiment shifts in correlated markets.
                </p>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-700/30" />

          {/* 3. AI Recommendation */}
          <div className="flex flex-col gap-3">
            <div className="bg-[#1a2438] p-5 rounded-xl border border-slate-700/50 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">System Decision</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <h3 className="text-slate-100 text-xl font-bold uppercase tracking-tight">ACCEPT</h3>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReasoning(!showReasoning);
                }}
                className="bg-[#243044] hover:bg-[#2d3a52] px-4 py-1.5 rounded-lg border border-slate-600/50 text-[10px] text-slate-300 font-medium uppercase tracking-wide transition-colors"
              >
                {showReasoning ? 'Hide Logic' : 'View Reasoning'}
              </button>
            </div>

            {showReasoning && (
              <div className="bg-[#1a2438] p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Analysis</span>
                </div>
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  "Market signals indicate a favorable risk/reward ratio. Current probability drift suggests a 4.2% alpha
                  opportunity. Optimal execution window is now."
                </p>
              </div>
            )}
          </div>

          {/* Accept / Reject Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setAccepted(true)}
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm uppercase tracking-wide transition-all border ${
                accepted === true
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              Accept
            </button>
            <button
              onClick={() => setAccepted(false)}
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm uppercase tracking-wide transition-all border ${
                accepted === false
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
              }`}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto bg-[#0f172a] py-3 px-5 flex justify-between items-center border-t border-slate-700/30">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">PolyIndex</span>
        <img src={chrome?.runtime?.getURL('logo.jpg') || '/logo.jpg'} alt="PolyIndex Logo" className="h-5 w-auto opacity-80" />
      </div>
    </div>
  );
}

