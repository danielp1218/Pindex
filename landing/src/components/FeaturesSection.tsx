import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const FeatureCard = ({ title, description, icon, delay, color }: { 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  delay: number;
  color: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="group relative p-8 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-all duration-500 overflow-hidden"
    >
      {/* Background Glow */}
      <div 
        className="absolute -right-20 -top-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{ backgroundColor: color }}
      />
      
      {/* Icon Container */}
      <div 
        className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center relative overflow-hidden group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-500"
        style={{ 
          background: `linear-gradient(135deg, ${color}33 0%, ${color}11 100%)`,
          border: `1px solid ${color}44`
        }}
      >
        <div className="relative z-10 text-white group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
        <motion.div 
          className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"
        />
      </div>

      <h3 className="text-2xl font-semibold text-white mb-4 group-hover:text-white transition-colors duration-300">
        {title}
      </h3>
      <p className="text-gray-400 leading-relaxed text-lg group-hover:text-gray-300 transition-colors duration-300">
        {description}
      </p>

      {/* Bottom Accent Line */}
      <div 
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent w-0 group-hover:w-full transition-all duration-700"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
    </motion.div>
  );
};

export function FeaturesSection() {
  const containerRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <section 
      ref={containerRef}
      className="min-h-screen py-32 px-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, 
          #0d1926 0%, 
          #0d1926 5%,
          #0f1b2a 15%,
          #111d2e 30%,
          #0d1926 50%,
          #0d1926 100%
        )`
      }}
    >
      {/* Seamless Transition Overlay - Enhanced gradient blend */}
      <div 
        className="absolute top-0 left-0 right-0 h-96 pointer-events-none z-20"
        style={{
          background: `linear-gradient(to bottom, 
            rgba(17, 29, 46, 0.8) 0%,
            rgba(17, 29, 46, 0.6) 20%,
            rgba(13, 25, 38, 0.4) 40%,
            rgba(13, 25, 38, 0.2) 60%,
            transparent 100%
          )`
        }}
      />
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-[#6fd1b0]/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          style={{ y: y2 }}
          className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-[#ba96e3]/10 rounded-full blur-[150px]" 
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ 
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
          <h2 className="text-5xl md:text-7xl text-white font-serif font-bold mb-6 tracking-tight">
            Why <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#6fd1b0] to-[#ba96e3]">Pindex</span>?
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-[#6fd1b0] to-[#ba96e3] mx-auto mb-8 rounded-full" />
          <p className="text-gray-400 text-xl md:text-2xl max-w-3xl mx-auto font-light leading-relaxed">
            Experience the future of prediction market investing with  <br /><span className="text-white font-medium"> agentic index funds</span>.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Floating particle effects behind cards */}
          <div className="absolute inset-0 -z-10 overflow-visible">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5
                }}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </div>

          <FeatureCard 
            title="Diversified Portfolios"
            color="#6fd1b0"
            delay={0.1}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h2a2 2 0 002-2V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10z" />
              </svg>
            }
            description="Build balanced portfolios across multiple markets, reducing risk and maximizing potential returns."
          />

          <FeatureCard 
            title="AI-Powered Insights"
            color="#ba96e3"
            delay={0.2}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            description="Leverage advanced algorithms to identify the best opportunities and optimize your betting strategy."
          />

          <FeatureCard 
            title="Real-Time Tracking"
            color="#6fd1b0"
            delay={0.3}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            description="Monitor your positions and portfolio performance in real-time with intuitive visualizations."
          />
        </div>

        {/* Bottom CTA for Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-24 text-center"
        >
          <button
            onClick={() => {
              // TODO: Add waitlist functionality
              console.log('Join waitlist clicked');
            }}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full border border-white/10 text-white/60 text-sm tracking-widest uppercase font-semibold hover:text-white hover:border-white/30 transition-all duration-300 overflow-hidden"
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

      {/* Decorative side beams */}
      <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      
      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-8 text-center border-t border-white/5">
        <p className="text-white/30 text-xs tracking-wide">
          © {new Date().getFullYear()} Pindex. All rights reserved.
        </p>
      </footer>
    </section>
  );
}
