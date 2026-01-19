import { Sidebar } from './components/Sidebar';
import { BalanceCard } from './components/BalanceCard';
import { BetsList } from './components/BetsList';
import { IndexTable } from './components/IndexTable';
import { Spotlight } from './components/ui/Spotlight';
import Image from 'next/image';

function App() {
  return (
    <div className="h-screen bg-[#0d1926] overflow-hidden relative">
      {/* Thin diagonal light beam - shifted right, more white-blue */}
      

      {/* Blur overlay with thin diagonal cutout - less blur */}
      <div
        className="absolute inset-0 pointer-events-none z-[41]"
        style={{
          backdropFilter: 'blur(1px)',
          WebkitBackdropFilter: 'blur(1px)',
          maskImage: `linear-gradient(
            45deg,
            black 0%,
            black 40%,
            transparent 48%,
            transparent 56%,
            black 64%,
            black 100%
          )`,
          WebkitMaskImage: `linear-gradient(
            45deg,
            black 0%,
            black 40%,
            transparent 48%,
            transparent 56%,
            black 64%,
            black 100%
          )`
        }}
      />

      {/* Darkening overlay - more blue tint */}
      <div
        className="absolute inset-0 pointer-events-none z-[40]"
        style={{
          background: `linear-gradient(
            45deg,
            rgba(8, 18, 32, 0.3) 0%,
            rgba(8, 18, 32, 0.2) 40%,
            transparent 48%,
            transparent 56%,
            rgba(8, 18, 32, 0.2) 64%,
            rgba(8, 18, 32, 0.4) 80%,
            rgba(8, 18, 32, 0.55) 100%
          )`
        }}
      />

      {/* Bottom-left blur for hero text area */}
      <div
        className="absolute inset-0 pointer-events-none z-[39]"
        style={{
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          maskImage: `radial-gradient(ellipse 60% 50% at 20% 80%, black 0%, transparent 70%)`,
          WebkitMaskImage: `radial-gradient(ellipse 60% 50% at 20% 80%, black 0%, transparent 70%)`
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-transparent border-b border-white/5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="max-w-[1400px] mx-auto h-full px-4 md:px-8 flex items-center justify-between">
          <span className="text-white font-serif text-xl md:text-2xl font-extrabold italic tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">Pindex</span>
          
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 h-screen relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 h-[calc(100vh-56px)] flex flex-col overflow-hidden">
          {/* Dashboard Layout */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden">
            {/* Left Sidebar */}
            <div className="hidden md:block border-r border-white/10 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Sidebar />
            </div>

            {/* Right Content */}
            <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
              {/* Top Row: Balance + Bets */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch flex-1 min-h-0">
                <div className="flex-[3] min-w-0 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                  <BalanceCard />
                </div>
                <div className="flex-[2] min-w-0 animate-fade-in" style={{ animationDelay: '0.7s' }}>
                  <BetsList />
                </div>
              </div>

              {/* Bottom: Index Table with fade */}
              <div className="relative flex-1 min-h-0 overflow-hidden animate-fade-in" style={{ animationDelay: '0.8s' }}>
                <IndexTable />
                {/* Fade overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#111d2e] via-[#111d2e]/80 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Spotlight effects for hero section */}
          <Spotlight
            className="-top-40 left-0 md:left-60 md:-top-20"
            fill="#6fd1b0"
          />
          <Spotlight
            className="-top-40 right-0 md:right-80 md:-top-32"
            fill="#ba96e3"
          />

          {/* Hero Text Overlay - above lighting effects */}
          <div className="absolute bottom-16 md:bottom-24 left-4 md:left-8 right-4 md:right-8 pointer-events-none z-[200] animate-fade-in" style={{ animationDelay: '1s' }}>
            <div className="max-w-[1400px] mx-auto pl-0 md:pl-32 mb-4 md:mb-6 text-center md:text-left">
              <h1 className="text-3xl md:text-5xl lg:text-7xl text-white font-serif font-bold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] whitespace-nowrap md:whitespace-normal">
                Bet <span className="italic">smarter </span>
                <span className="md:block">with Pindex.</span>
              </h1>
              <p className="text-gray-300 mt-3 md:mt-5 text-sm md:text-lg font-medium">
                Build diversified portfolios with AI-powered index funds on Polymarket.
              </p>
            </div>

            {/* Download Buttons - Centered on mobile, original on desktop */}
            <div className="flex flex-row justify-center gap-2 md:gap-3 px-4">
              <button
                className="pointer-events-auto flex items-center justify-center gap-2.5 px-4 md:px-5 py-2 md:py-2.5 rounded-full border border-white/10 text-white text-sm md:text-base font-medium hover:border-white/30 hover:brightness-125 hover:shadow-[0_8px_32px_rgba(70,100,140,0.3)] transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                style={{
                  background: 'linear-gradient(90deg, #455a70 0%, #2f3d4d 50%, #455a70 100%)'
                }}
              >
                <Image
                  src="/chrome.png"
                  alt="Chrome"
                  width={32}
                  height={20}
                  sizes="(min-width: 768px) 32px, 24px"
                  className="w-6 md:w-8 h-4 md:h-5 rounded-full"
                  priority
                />
                <span className="hidden sm:inline">Download for Chrome</span>
                <span className="sm:hidden">Chrome</span>
              </button>
              <a
                href="https://github.com/danielp1218/pindex"
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto flex items-center justify-center gap-2.5 px-4 md:px-5 py-2 md:py-2.5 rounded-full border border-white/10 text-white text-sm md:text-base font-medium hover:border-white/30 hover:brightness-125 hover:shadow-[0_8px_32px_rgba(70,100,140,0.3)] transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                style={{
                  background: 'linear-gradient(90deg, #455a70 0%, #2f3d4d 50%, #455a70 100%)'
                }}
              >
                <svg className="w-4 md:w-5 h-4 md:h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}

export default App;
