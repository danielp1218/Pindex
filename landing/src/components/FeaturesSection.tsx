'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

const particlePositions = [
  { top: "8%", left: "18%" },
  { top: "22%", left: "72%" },
  { top: "38%", left: "44%" },
  { top: "54%", left: "86%" },
  { top: "68%", left: "12%" },
  { top: "84%", left: "60%" },
];

// Prediction Market Card Component
const MarketCard = ({ 
  image, 
  title, 
  percentage, 
  volume, 
  frequency,
  zIndex,
  offsetY,
  offsetX,
  width = '240px',
  glowColor = 'rgba(255,255,255,0.05)',
  hoverBorderOpacity = '20',
  showGlow = true,
  relative = false,
}: { 
  image?: string;
  title: string; 
  percentage: number;
  volume: string;
  frequency?: string;
  zIndex: number;
  offsetY: number;
  offsetX: number;
  width?: string;
  glowColor?: string;
  hoverBorderOpacity?: string;
  showGlow?: boolean;
  relative?: boolean;
}) => {
  return (
    <div
      className={relative ? "relative group" : "absolute top-0 right-0 group"}
      style={relative ? { 
        zIndex: zIndex,
      } : { 
        zIndex: zIndex,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      {/* Outer Glow Effect - Enhanced */}
      {showGlow && (
        <div 
          className="absolute inset-[-20px] blur-[40px] opacity-0 group-hover:opacity-40 transition-opacity duration-500 rounded-[2rem] -z-10"
          style={{ backgroundColor: glowColor }}
        />
      )}
      
      {/* Card - Enhanced Beauty */}
      <div 
        className={`relative bg-[#1a2332]/90 backdrop-blur-2xl rounded-xl md:rounded-2xl p-3 md:p-5 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] transition-all duration-300 ${
          hoverBorderOpacity === '30' ? 'group-hover:border-white/30' : 'group-hover:border-white/20'
        }`}
        style={{ 
          width: width,
          background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.95) 0%, rgba(13, 25, 38, 0.9) 100%)'
        }}
      >
        {/* Subtle Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />
        
        <div className="flex items-start gap-2 md:gap-4 mb-3 md:mb-4 relative z-10">
          {/* Profile Image - Smaller but nicer */}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-gray-700/50 to-gray-900/50 border border-white/5 shadow-inner flex items-center justify-center">
            {image ? (
              <Image
                src={image}
                alt={title}
                width={48}
                height={48}
                sizes="(min-width: 768px) 48px, 40px"
                className="w-full h-full object-cover"
              />
            ) : title.toLowerCase().includes('bitcoin') || title.toLowerCase().includes('btc') ? (
              <div className="w-full h-full bg-orange-500 flex items-center justify-center">
                <span className="text-xl md:text-2xl font-bold">&#8383;</span>
              </div>
            ) : title.toLowerCase().includes('spacex') || title.toLowerCase().includes('starship') ? (
              <Image
                src="/betlist/spacex.png"
                alt="SpaceX"
                width={48}
                height={48}
                sizes="(min-width: 768px) 48px, 40px"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg md:text-xl filter drop-shadow-sm">📊</span>
            )}
          </div>

          {/* Title and Percentage */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-[11px] md:text-[13px] leading-tight mb-2 md:mb-2.5 line-clamp-2 tracking-wide group-hover:text-white transition-colors">
              {title}
            </h3>
            
            {/* Percentage with circular progress - Smaller */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="relative w-7 h-7 md:w-9 md:h-9">
                <svg className="w-7 h-7 md:w-9 md:h-9 transform -rotate-90" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="2.5"
                    className="[stroke-width:2.5px] md:[stroke-width:3px]"
                  />
                  <motion.circle
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: percentage / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke={percentage >= 50 ? '#6fd1b0' : '#fca5a5'}
                    strokeWidth="2.5"
                    className="[stroke-width:2.5px] md:[stroke-width:3px]"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 4px ${percentage >= 50 ? '#6fd1b0' : '#fca5a5'}44)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] md:text-[11px] font-bold text-white/90">
                    {percentage}%
                  </span>
                </div>
              </div>
              <span className="text-[9px] md:text-[11px] text-gray-400 font-medium uppercase tracking-tighter opacity-70">chance</span>
            </div>
          </div>
        </div>

        {/* Yes/No Buttons - More Beautiful */}
        <div className="flex gap-1.5 md:gap-2 mb-3 md:mb-4 relative z-10">
          <button className="flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.1)]">
            Yes
          </button>
          <button className="flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] md:text-[11px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all active:scale-95 shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
            No
          </button>
        </div>

        {/* Volume Info - Smaller */}
        <div className="flex items-center justify-between text-[9px] md:text-[10px] text-gray-500 pt-2 md:pt-2.5 border-t border-white/5 relative z-10">
          <span className="font-medium tracking-tight opacity-60">{volume} Vol.</span>
          {frequency && (
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <svg className="w-2 md:w-2.5 h-2 md:h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium">{frequency}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function FeaturesSection() {
  return (
    <section
      className="min-h-screen py-16 md:py-32 relative overflow-hidden bg-[#0d1926]"
    >
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-[#6fd1b0]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-[#ba96e3]/10 rounded-full blur-[150px]" />
      </div>

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
         
         
        </motion.div>

        {/* Bento Box Grid Layout - 2 on top, 1 on bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Top Left: Container 1 - Extension UI Showcase with Radial Blur */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-[#1a2332]/90 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 group relative overflow-hidden h-[400px] md:h-[550px]"
          >
            {/* Blurred background simulating Polymarket grid of cards */}
            <div className="absolute inset-0 blur-[5px] opacity-40 scale-105">
              {/* Grid of prediction market cards */}
              <div className="grid grid-cols-4 gap-2 p-3 h-full">
                {/* Row 1 */}
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-emerald-400">58%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded text-[7px] text-emerald-400 flex items-center justify-center">Yes</div>
                    <div className="flex-1 h-5 bg-red-500/30 rounded text-[7px] text-red-400 flex items-center justify-center">No</div>
                  </div>
                  <div className="text-[6px] text-gray-500">$2m Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">3%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$1m Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">13%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$2m Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-emerald-400">23%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$46k Vol.</div>
                </div>
                {/* Row 2 */}
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-emerald-400">77%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$60k Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">2%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$116k Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">22%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$2k Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">&lt;1%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$91k Vol.</div>
                </div>
                {/* Row 3 */}
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">3%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$47k Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">7%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$46k Vol.</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-emerald-400">46%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">NEW</div>
                </div>
                <div className="bg-[#1e2d3d] rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-md" />
                    <div className="flex-1 h-3 bg-white/20 rounded" />
                    <div className="text-[8px] text-red-400">4%</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    <div className="flex-1 h-5 bg-emerald-500/30 rounded" />
                    <div className="flex-1 h-5 bg-red-500/30 rounded" />
                  </div>
                  <div className="text-[6px] text-gray-500">$5k Vol.</div>
                </div>
              </div>
            </div>

            {/* Radial blur/vignette effect */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ 
                background: 'radial-gradient(ellipse at center, transparent 20%, rgba(13,25,38,0.4) 50%, rgba(13,25,38,0.85) 80%, rgba(13,25,38,0.98) 100%)',
              }} 
            />
            
            {/* Glow behind modal */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[400px] bg-[#6fd1b0]/10 blur-[80px] rounded-full pointer-events-none" />
            
            {/* Extension Modal UI - positioned to show top, cut off at bottom */}
            <div className="relative z-10 h-full flex flex-col items-center justify-start pt-8 md:pt-16 p-4 md:p-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-center mb-6 md:mb-12"
              >
                <h3 className="text-white text-lg md:text-xl lg:text-2xl font-serif font-medium tracking-tight">
                  blur out the noise, predict with knowledge.
                </h3>
              </motion.div>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="w-full max-w-[280px] md:max-w-[340px] group-hover:-translate-y-4 transition-transform duration-300"
              >
                {/* Modal Container */}
                <div className="bg-[#1a2332]/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                        <Image
                          src="/betlist/usa.png"
                          alt="USA Flag"
                          width={32}
                          height={32}
                          sizes="32px"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">PINDEX</div>
                        <div className="text-white text-sm font-semibold">USA Presidential Election</div>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-md text-[11px] text-white font-medium transition-colors">
                      View Nodes
                    </button>
                  </div>

                  {/* Strategy */}
                  <div className="p-4 border-b border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Strategy</div>
                    <div className="bg-white/5 rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                      <span>Trading</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Chain Dependency */}
                  <div className="p-4 border-b border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">Chain Dependency</div>
                    <div className="bg-white/5 rounded-lg p-4">
                      {/* Nodes visualization */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#1a2332] border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                          <Image
                            src="/featurelist/trumpwin.webp"
                            alt="Trump Win"
                            width={40}
                            height={40}
                            sizes="40px"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/20 via-white/40 to-white/20 mx-4" />
                        <div className="w-10 h-10 rounded-full bg-[#1a2332] border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                          <Image
                            src="/featurelist/trumpflorida.jpeg"
                            alt="Trump Florida"
                            width={40}
                            height={40}
                            sizes="40px"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <div className="text-center">
                          <div className="text-gray-500 uppercase">Source</div>
                          <div className="text-white">Trump Win Election</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 uppercase">Target</div>
                          <div className="text-white">Trump takes Florida</div>
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-gray-400 text-center">
                        Florida's probability curve acts as a high-confidence lead indicator.
                      </div>
                    </div>
                  </div>

                  {/* Position */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <span className="text-gray-400 text-sm">Your position</span>
                    <span className="text-[#6fd1b0] font-semibold text-sm">Yes</span>
                  </div>

                  {/* Recommendation */}
                  <div className="p-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Recommendation</div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                      <div className="text-white font-semibold mb-2">Accept</div>
                      <div className="text-gray-400 text-xs leading-relaxed">
                        Institutional volume in Florida has reached critical mass. Probability drift suggests a <span className="text-[#6fd1b0]">4.2% alpha opportunity</span>.
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">Drag header to move | ESC to close</span>
                    <span className="text-[10px] text-gray-500 font-semibold tracking-wider">PINDEX</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Top Right: Container 2 - Enhanced Recommendation UI */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#1a2332]/90 rounded-2xl p-4 md:p-8 border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden h-[500px] md:h-[550px]"
          >
            {/* Background Golden Chart (replica of BalanceCard) */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="balanceChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e8b923" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#d4a520" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#c4941a" stopOpacity="0.05" />
                  </linearGradient>
                  {/* Peak Glow Filter */}
                  <filter id="peakGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Dotted vertical lines for each day */}
                <line x1="57" y1="0" x2="57" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                <line x1="114" y1="0" x2="114" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                <line x1="171" y1="0" x2="171" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                <line x1="228" y1="0" x2="228" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                <line x1="285" y1="0" x2="285" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                <line x1="342" y1="0" x2="342" y2="200" stroke="#374151" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />
                
                {/* Chart fill - scaled to fit */}
                <path
                  d="M0,156 L15,164 L25,150 L35,176 L45,144 L55,160 L65,136 L75,110 L85,84 L95,70 L105,56 L115,76 L125,104 L135,90 L145,120 L155,96 L165,70 L175,44 L185,36 L195,64 L205,96 L215,84 L225,110 L235,76 L245,100 L255,84 L265,70 L275,56 L285,44 L295,36 L305,50 L315,64 L325,56 L335,44 L345,36 L355,50 L365,40 L375,30 L385,24 L400,20 L400,200 L0,200 Z"
                  fill="url(#balanceChartGradient)"
                />
                
                {/* Chart line - golden color */}
                <path
                  d="M0,156 L15,164 L25,150 L35,176 L45,144 L55,160 L65,136 L75,110 L85,84 L95,70 L105,56 L115,76 L125,104 L135,90 L145,120 L155,96 L165,70 L175,44 L185,36 L195,64 L205,96 L215,84 L225,110 L235,76 L245,100 L255,84 L265,70 L275,56 L285,44 L295,36 L305,50 L315,64 L325,56 L335,44 L345,36 L355,50 L365,40 L375,30 L385,24 L400,20"
                  fill="none"
                  stroke="#e8b923"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="miter"
                  opacity="0.4"
                />

                {/* Peak Glows */}
                <circle cx="105" cy="56" r="3" fill="#e8b923" filter="url(#peakGlow)" opacity="0.6" />
                <circle cx="185" cy="36" r="3" fill="#e8b923" filter="url(#peakGlow)" opacity="0.6" />
                <circle cx="295" cy="36" r="3" fill="#e8b923" filter="url(#peakGlow)" opacity="0.6" />
                <circle cx="400" cy="20" r="3" fill="#e8b923" filter="url(#peakGlow)" opacity="0.6" />
              </svg>
            </div>

            {/* Aurora Gradient Effect - Top Right */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
              
            </div>

            {/* Floating Content Container */}
            <div className="relative h-full w-full z-10 flex flex-col items-start">
              {/* Extra spotlight effect */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

             

              {/* Main Recommendation Card - Top (Bigger) */}
              <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                className="relative bg-[#1a2332]/95 backdrop-blur-2xl rounded-2xl p-4 md:p-6 border border-white/10 hover:border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.6)] w-full md:w-[60%] mb-4 md:mb-6 group transition-all duration-300"
              >
                
                <h4 className="text-white font-serif font-bold text-xl md:text-2xl mb-3 md:mb-4">Accept</h4>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed mb-4 md:mb-6 font-medium">
                SpaceX-linked Bitcoin activity has historically coincided with BTC volatility spikes. Cross-asset momentum suggests a <span className="text-[#6fd1b0]">4.2% alpha opportunity</span>                </p>
                
                <div className="flex gap-2 md:gap-3">
                  <button className="flex-1 py-2 md:py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs md:text-sm font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all">
                    Accept
                  </button>
                  <button className="flex-1 py-2 md:py-3 rounded-xl bg-gray-500/10 border border-white/5 text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider hover:bg-white/5 transition-all">
                    Reject
                  </button>
                </div>
              </motion.div>

              {/* Supporting Secondary Card - Bottom (Smaller) */}
              {/* Mobile: Flex layout with full MarketCards */}
              <div className="flex gap-2 md:hidden mt-4 relative">
                <div className="flex-1 min-w-0">
                  <MarketCard
                    title="SpaceX Starship Launch - Will the next mission succeed?"
                    percentage={7}
                    volume="$847k"
                    zIndex={10}
                    offsetY={0}
                    offsetX={0}
                    width="100%"
                    glowColor="#6fd1b0"
                    hoverBorderOpacity="30"
                    showGlow={false}
                    relative={true}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <MarketCard
                    title="Bitcoin Price Prediction - Will BTC exceed $200k by end of year?"
                    percentage={56}
                    volume="$1.7m"
                    zIndex={10}
                    offsetY={0}
                    offsetX={0}
                    width="100%"
                    glowColor="#6fd1b0"
                    hoverBorderOpacity="30"
                    showGlow={false}
                    relative={true}
                  />
                </div>
              </div>
              {/* Desktop: Absolute positioning */}
              <div className="hidden md:block">
                <MarketCard
                    title="SpaceX Starship Launch - Will the next mission succeed?"
                    percentage={7}
                    volume="$847k"
                    zIndex={10}
                    offsetY={250}
                    offsetX={-150}
                    glowColor="#6fd1b0"
                    hoverBorderOpacity="30"
                    showGlow={false}
                  />
                <MarketCard
                  title="Bitcoin Price Prediction - Will BTC exceed $200k by end of year?"
                  percentage={56}
                  volume="$1.7m"
                  zIndex={10}
                  offsetY={180}
                  offsetX={10}
                  glowColor="#6fd1b0"
                  hoverBorderOpacity="30"
                  showGlow={false}
                />
              </div>

              <div className="absolute bottom-0 left-0 max-w-[200px] md:max-w-[240px]">
                <h3 className="text-base md:text-xl font-serif text-white leading-tight">
                  link correlations, <br />
                  play with less risk.
                </h3>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA for Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-12 md:mt-24 text-center"
        >
          <button
            onClick={() => {
              // TODO: Add waitlist functionality
              console.log('Join waitlist clicked');
            }}
            className="group relative inline-flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 rounded-full border border-white/10 text-white/60 text-xs md:text-sm tracking-widest uppercase font-semibold hover:text-white hover:border-white/30 transition-all duration-300 overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, rgba(69, 90, 112, 0.1) 0%, rgba(47, 61, 77, 0.1) 50%, rgba(69, 90, 112, 0.1) 100%)'
            }}
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#6fd1b0]/20 via-[#ba96e3]/20 to-[#6fd1b0]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
            
            {/* Shimmer effect on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
            
            <span className="relative z-10">Join the waitlist</span>
            
            {/* Arrow icon */}
            <motion.svg
              className="w-4 h-4 relative z-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              initial={{ x: 0 }}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.3 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </motion.svg>
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-4 md:py-8 text-center">
        <p className="text-white/30 text-[10px] md:text-xs tracking-wide">
          © {new Date().getFullYear()} Pindex. All rights reserved.
        </p>
      </footer>
    </section>
  );
}
