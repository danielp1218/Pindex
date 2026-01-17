import {
  GlobeIcon,
  QuestionMarkCircledIcon,
  ArchiveIcon,
  MagicWandIcon,
  FileTextIcon,
  BarChartIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';

const menuItems = [
  { icon: 'trending', label: 'Trending', active: true },
  { icon: 'line', label: 'Breaking' },
  { icon: 'line', label: 'New' },
  { icon: 'sports', label: 'Sports' },
  { icon: 'crypto', label: 'Crypto' },
  { icon: 'finance', label: 'Finance' },
  { icon: 'sparkles', label: 'Virtual Accounts' },
  { icon: 'document', label: 'Invoicing' },
  { icon: 'chart', label: 'Analytics' },
  { icon: 'calculator', label: 'Accounting' },
];

function SidebarIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4";

  switch (type) {
    case 'trending':
      return (
        <svg className={iconClass} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 10l3.5-3.5 2.5 2.5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 4h4v4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'line':
      return (
        <div className="w-4 flex justify-center">
          <div className="w-px h-4 bg-gray-500" />
        </div>
      );
    case 'sports':
      return (
        <svg className={iconClass} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="7.5" cy="7.5" r="6" />
          <path d="M7.5 1.5v12M1.5 7.5h12M3 3.5c1.5 1.5 3 2.5 4.5 2.5s3-1 4.5-2.5M3 11.5c1.5-1.5 3-2.5 4.5-2.5s3 1 4.5 2.5" strokeLinecap="round" />
        </svg>
      );
    case 'globe':
      return <GlobeIcon className={iconClass} />;
    case 'crypto':
      return <QuestionMarkCircledIcon className={iconClass} />;
    case 'finance':
      return <ArchiveIcon className={iconClass} />;
    case 'sparkles':
      return <MagicWandIcon className={iconClass} />;
    case 'document':
      return <FileTextIcon className={iconClass} />;
    case 'chart':
      return <BarChartIcon className={iconClass} />;
    case 'calculator':
      return <ReaderIcon className={iconClass} />;
    default:
      return null;
  }
}

export function Sidebar() {
  return (
    <div className="w-48 py-2 select-none pr-4 relative">
      <ul className="flex flex-col">
        {menuItems.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
              item.active
                ? 'bg-gradient-to-r from-[#1a2836] to-[#182530] text-white rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <SidebarIcon type={item.icon} />
            <span className="text-sm">{item.label}</span>
          </li>
        ))}
      </ul>
      {/* Bottom fade overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111d2e] via-[#111d2e]/60 to-transparent pointer-events-none" />
    </div>
  );
}
