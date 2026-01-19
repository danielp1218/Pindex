export function BalanceCard() {
  return (
    <div className="bg-[#1a2332]/90 rounded-xl p-4 md:p-5 w-full h-full border border-white/10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-3 md:gap-0 mb-4">
        <div className="flex items-baseline">
          <span className="text-xl md:text-2xl" style={{ color: '#9ca3af' }}>$</span>
          <span className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: '#9ca3af' }}>847,291</span>
          <span className="text-lg md:text-xl" style={{ color: '#9ca3af' }}>.45</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button className="px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs font-medium bg-gray-700 text-white">Balance</button>
          <button className="px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white">Profits</button>
          <button className="px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white">This Week</button>
        </div>
      </div>

      <div className="mb-0">
        <p className="text-xs text-gray-500 mb-2">Current balance</p>
        <svg className="w-full h-[200px]" viewBox="0 0 400 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e8b923" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#d4a520" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#c4941a" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Dotted vertical lines for each day */}
          <line x1="57" y1="0" x2="57" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          <line x1="114" y1="0" x2="114" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          <line x1="171" y1="0" x2="171" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          <line x1="228" y1="0" x2="228" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          <line x1="285" y1="0" x2="285" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          <line x1="342" y1="0" x2="342" y2="100" stroke="#374151" strokeWidth="1" strokeDasharray="2,4" />
          {/* Chart fill - more realistic with sharper peaks and valleys */}
          <path
            d="M0,78 L15,82 L25,75 L35,88 L45,72 L55,80 L65,68 L75,55 L85,42 L95,35 L105,28 L115,38 L125,52 L135,45 L145,60 L155,48 L165,35 L175,22 L185,18 L195,32 L205,48 L215,42 L225,55 L235,38 L245,50 L255,42 L265,35 L275,28 L285,22 L295,18 L305,25 L315,32 L325,28 L335,22 L345,18 L355,25 L365,20 L375,15 L385,12 L400,10 L400,100 L0,100 Z"
            fill="url(#chartGradient)"
          />
          {/* Chart line - pointy and realistic */}
          <path
            d="M0,78 L15,82 L25,75 L35,88 L45,72 L55,80 L65,68 L75,55 L85,42 L95,35 L105,28 L115,38 L125,52 L135,45 L145,60 L155,48 L165,35 L175,22 L185,18 L195,32 L205,48 L215,42 L225,55 L235,38 L245,50 L255,42 L265,35 L275,28 L285,22 L295,18 L305,25 L315,32 L325,28 L335,22 L345,18 L355,25 L365,20 L375,15 L385,12 L400,10"
            fill="none"
            stroke="#e8b923"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />
        </svg>
        <div className="flex justify-between text-xs text-gray-500 -mt-1">
          <span>MON</span>
          <span>TUE</span>
          <span>WED</span>
          <span>THU</span>
          <span>FRI</span>
          <span>SAT</span>
          <span>SUN</span>
        </div>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-gray-700/50">
        <span className="text-xs md:text-sm text-gray-400">Available to spend</span>
        <span className="text-base md:text-lg font-semibold" style={{ color: '#9ca3af' }}>$524,180.00</span>
      </div>
    </div>
  );
}
