export function BalanceCard() {
  return (
    <div className="bg-[#1a2332]/80 backdrop-blur-sm rounded-xl p-5 w-full h-full border border-white/10">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-baseline">
          <span className="text-2xl" style={{ color: '#9ca3af' }}>$</span>
          <span className="text-4xl font-semibold tracking-tight" style={{ color: '#9ca3af' }}>847,291</span>
          <span className="text-xl" style={{ color: '#9ca3af' }}>.45</span>
        </div>
        <div className="flex gap-1">
          <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-700 text-white">Balance</button>
          <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white">Profits</button>
          <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white">This Week</button>
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
          {/* Chart fill */}
          <path
            d="M0,82 L20,75 L35,85 L50,65 L70,78 L85,45 L100,30 L115,50 L135,60 L155,35 L175,20 L195,40 L215,55 L235,42 L255,50 L275,35 L295,45 L315,28 L335,18 L355,30 L375,22 L400,15 L400,100 L0,100 Z"
            fill="url(#chartGradient)"
          />
          {/* Chart line */}
          <path
            d="M0,82 L20,75 L35,85 L50,65 L70,78 L85,45 L100,30 L115,50 L135,60 L155,35 L175,20 L195,40 L215,55 L235,42 L255,50 L275,35 L295,45 L315,28 L335,18 L355,30 L375,22 L400,15"
            fill="none"
            stroke="#e8b923"
            strokeWidth="2"
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
        <span className="text-sm text-gray-400">Available to spend</span>
        <span className="text-lg font-semibold" style={{ color: '#9ca3af' }}>$524,180.00</span>
      </div>
    </div>
  );
}
