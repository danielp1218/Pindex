import { Sidebar } from './components/Sidebar';
import { BalanceCard } from './components/BalanceCard';
import { BetsList } from './components/BetsList';
import { IndexTable } from './components/IndexTable';
import { Spotlight } from './components/ui/Spotlight';

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
        <div className="max-w-[1400px] mx-auto h-full px-8 flex items-center justify-between">
          <span className="text-white font-serif text-2xl font-extrabold italic tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">PolyIndex</span>
          <button className="px-4 py-1.5 bg-transparent border border-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/5">
            Get Started
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 h-screen relative">
        <div className="max-w-[1400px] mx-auto px-8 py-4 h-[calc(100vh-56px)] flex flex-col">
          {/* Dashboard Layout */}
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left Sidebar */}
            <div className="border-r border-white/10 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Sidebar />
            </div>

            {/* Right Content */}
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              {/* Top Row: Balance + Bets */}
              <div className="flex gap-4 items-stretch flex-1 min-h-0">
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
          <div className="absolute bottom-24 left-8 right-8 pointer-events-none z-[200] animate-fade-in" style={{ animationDelay: '1s' }}>
            <div className="max-w-[1400px] mx-auto pl-32 mb-6">
              <h1 className="text-5xl md:text-7xl text-white font-serif font-bold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                A <span className="italic">higher standard</span>
              </h1>
              <h1 className="text-5xl md:text-7xl text-white font-serif font-bold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                in Polymarket betting.
              </h1>
              <p className="text-gray-300 mt-5 text-lg font-medium">
                Diversify your risk, creating your own agentic index funds on any bet.
              </p>
            </div>

            {/* Chrome Download Button - Centered on page */}
            <div className="flex justify-center">
              <button
                className="pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/10 text-white font-medium hover:border-white/30 hover:brightness-125 hover:shadow-[0_8px_32px_rgba(70,100,140,0.3)] transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                style={{
                  background: 'linear-gradient(90deg, #455a70 0%, #2f3d4d 50%, #455a70 100%)'
                }}
              >
                <img src="/chrome.png" alt="Chrome" className="w-8 h-5 rounded-full" />
                Download for Chrome
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
