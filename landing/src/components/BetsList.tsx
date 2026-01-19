import Image from "next/image";

export function BetsList() {
  const bets = [
    {
      logo: '/betlist/usa.png',
      title: "US Election '28 Winner",
      category: 'Political Prediction',
      value: '-$1,500.00',
      positive: false,
    },
    {
      icon: '₿',
      iconBg: 'bg-orange-500',
      title: 'Bitcoin Price > $200k by EOY',
      category: 'Crypto Market',
      value: '-$2,300.00',
      positive: false,
    },
    {
      logo: '/betlist/spacex.png',
      title: 'SpaceX Starship Launch Success',
      category: 'Science & Tech',
      value: '+$4,200.00',
      positive: true,
    },
    {
      logo: '/betlist/recession.png',
      title: 'Next Recession Start Date',
      category: 'Economic Bet',
      value: '-$800.00',
      positive: false,
    },
    {
      logo: '/betlist/polylogo.jpeg',
      title: "Taylor Swift's Next Album Title",
      category: 'Entertainment Bet',
      value: '+$1,100.00',
      positive: true,
    },
  ];

  return (
    <div className="bg-[#1a2332]/90 rounded-xl p-4 md:p-5 w-full h-full border border-white/10">
      <h3 className="text-white font-semibold text-sm md:text-base mb-4">Latest Polymarket Bets</h3>

      <div className="flex flex-col gap-4">
        {bets.map((bet, index) => (
          <div key={index} className="flex items-center gap-3">
            {bet.logo ? (
              <Image
                src={bet.logo}
                alt={bet.title}
                width={40}
                height={40}
                sizes="40px"
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className={`w-10 h-10 ${bet.iconBg} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
                {bet.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{bet.title}</div>
              <div className="text-xs text-gray-500">{bet.category}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-sm font-medium ${bet.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {bet.value}
              </div>
              <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1">
                <Image
                  src="/polylogo.png"
                  alt="Poly Index"
                  width={12}
                  height={12}
                  sizes="12px"
                  className="w-3 h-3 object-contain"
                />
                Pindex
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
