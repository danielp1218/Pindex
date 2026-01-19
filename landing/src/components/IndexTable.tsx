import Image from "next/image";

const indexData = [
  { name: 'Politics Index', logo: '/indextable/politic.png', account: 'Primary Account', performance: '+12.5%', amount: '+$18,750.00', status: 'Active' },
  { name: 'Crypto Index', logo: '/indextable/crypto.png', account: 'Crypto Index', performance: '+5.2%', amount: '+$7,800.00', status: 'Active' },
  { name: 'Sports Index', logo: '/indextable/sports.png', account: 'Primary Account', performance: '-1.1%', amount: '-$1,850.00', status: 'Paused' },
  { name: 'Science Index', logo: '/indextable/science.png', account: 'Science Index', performance: '+8.9%', amount: '+$13,300.00', status: 'Active' },
  { name: 'Marketing Index', logo: '/indextable/marketing.png', account: 'Marketing', performance: '+2.4%', amount: '+$3,600.00', status: 'Active' },
  { name: 'Entertainment Index', logo: '/indextable/entertainment.png', account: 'Primary Account', performance: '+6.7%', amount: '+$10,050.00', status: 'Active' },
];

export function IndexTable() {
  return (
    <div className="bg-[#1a2332]/90 rounded-xl overflow-hidden w-full border border-white/10">
      {/* Desktop Header */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_120px] border-b border-white/10">
        <div className="px-5 py-4 border-r border-white/10">
          <span className="text-sm font-medium text-gray-400">Bet Groups</span>
        </div>
        <div className="px-5 py-4 border-r border-white/10">
          <span className="text-sm font-medium text-gray-400">Account</span>
        </div>
        <div className="px-5 py-4 border-r border-white/10">
          <span className="text-sm font-medium text-gray-400">Index Performance</span>
        </div>
        <div className="px-5 py-4">
          <span className="text-sm font-medium text-gray-400">Status</span>
        </div>
      </div>
      {/* Rows */}
      <div className="flex flex-col">
        {indexData.map((item, index) => (
          <div key={index} className="border-b border-white/10 last:border-b-0">
            {/* Desktop Layout */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_120px]">
              <div className="px-5 py-4 flex items-center gap-3 border-r border-white/10">
                <Image
                  src={item.logo}
                  alt={item.name}
                  width={32}
                  height={32}
                  sizes="32px"
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <span className="text-white text-sm">{item.name}</span>
              </div>
              <div className="px-5 py-4 flex items-center border-r border-white/10">
                <span className="text-sm text-gray-400">{item.account}</span>
              </div>
              <div className="px-5 py-4 flex items-center border-r border-white/10">
                <span className={`text-sm font-medium ${item.performance.startsWith('+') ? 'text-emerald-500/80' : 'text-red-400/80'}`}>
                  {item.performance} ({item.amount})
                </span>
              </div>
              <div className="px-5 py-4 flex items-center justify-center">
                <span className={`inline-flex items-center justify-center gap-1.5 w-[76px] py-1 rounded-md text-xs font-medium ${
                  item.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-400/90' : 'bg-gray-400'}`} />
                  {item.status}
                </span>
              </div>
            </div>
            {/* Mobile Layout */}
            <div className="md:hidden p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Image
                  src={item.logo}
                  alt={item.name}
                  width={40}
                  height={40}
                  sizes="40px"
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.account}</div>
                </div>
                <span className={`inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium flex-shrink-0 ${
                  item.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-400/90' : 'bg-gray-400'}`} />
                  {item.status}
                </span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <span className={`text-sm font-medium ${item.performance.startsWith('+') ? 'text-emerald-500/80' : 'text-red-400/80'}`}>
                  {item.performance} ({item.amount})
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
