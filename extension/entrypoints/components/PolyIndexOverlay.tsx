import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import 'tailwindcss';

interface PolyIndexOverlayProps {
  eventSlug: string;
  userSelection?: 'yes' | 'no' | null;
}

export default function PolyIndexOverlay({ eventSlug, userSelection }: PolyIndexOverlayProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [nodesExpanded, setNodesExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Default title
  const eventTitle = 'Market Decision';

  return (
    <div
      ref={overlayRef}
      className="bg-[#131c2e]/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden flex flex-col relative z-10"
      style={{ width: '420px', maxHeight: '90vh' }}
    >
      {/* Header with minimize button */}
      <div className="p-4 border-b border-slate-700/30 bg-[#1a2438]/50 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-white text-lg border border-slate-500/30 flex-shrink-0">
            📊
          </div>
          <h2 className="text-slate-100 text-[14px] font-semibold leading-tight truncate tracking-tight">
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
        <div className="p-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 70px)' }}>
          {/* Chain Dependency */}
          <div
            onClick={() => setNodesExpanded(!nodesExpanded)}
            className="bg-[#1a2438] rounded-xl border border-slate-700/50 p-3 cursor-pointer hover:bg-[#1e293b] transition-colors"
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
            <AnimatePresence>
              {nodesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 pt-3 border-t border-slate-700/30 overflow-hidden"
                >
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Market correlation analysis shows this event has dependencies on related prediction markets. Volume spikes here
                    traditionally precede sentiment shifts in correlated markets.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-px bg-slate-700/30" />

          {/* User Selection Display */}
          {userSelection && (
            <div className={`rounded-xl border p-4 ${
              userSelection === 'yes'
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : 'bg-red-500/15 border-red-500/30'
            }`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                User Selection
              </div>
              <div className={`flex items-center gap-2 ${
                userSelection === 'yes' ? 'text-emerald-400' : 'text-red-400'
              } font-semibold text-sm`}>
                <div className={`w-2 h-2 rounded-full ${
                  userSelection === 'yes' ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
                <span>User said {userSelection === 'yes' ? 'yes' : 'no'}</span>
              </div>
            </div>
          )}

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

            <AnimatePresence>
              {showReasoning && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#1a2438] p-4 rounded-xl border border-slate-700/50 overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-blue-500 rounded-full" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Analysis</span>
                  </div>
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    "Market signals indicate a favorable risk/reward ratio. Current probability drift suggests a 4.2% alpha
                    opportunity. Optimal execution window is now."
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Accept / Reject Buttons */}
          <div className="flex gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAccepted(true)}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border backdrop-blur-md shadow-lg ${
                accepted === true
                  ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white border-emerald-400/50 shadow-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              Accept
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAccepted(false)}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border backdrop-blur-md shadow-lg ${
                accepted === false
                  ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-red-400/50 shadow-red-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
              }`}
            >
              Reject
            </motion.button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto bg-[#0f172a] py-2 px-4 flex justify-between items-center border-t border-slate-700/30">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider font-medium">PolyIndex</span>
        <img src={chrome?.runtime?.getURL('logo.jpg') || '/logo.jpg'} alt="PolyIndex Logo" className="h-5 w-auto opacity-80" />
      </div>
    </div>
  );
}
