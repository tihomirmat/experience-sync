import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, FileText, Tag, Settings, BarChart2,
  MessageSquare, ChevronLeft, ChevronRight, Leaf, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Nadzorna plošča', icon: LayoutDashboard, path: '/' },
  { label: 'Rezervacije', icon: Calendar, path: '/bookings' },
  { label: 'Zasebne poizvedbe', icon: Users, path: '/inquiries' },
  { label: 'Ponudbe', icon: FileText, path: '/offers' },
  { label: 'Termini', icon: BarChart2, path: '/departures' },
  { label: 'Cenovni pravilnik', icon: Tag, path: '/pricing' },
  { label: 'Komunikacije', icon: MessageSquare, path: '/communications' },
  { divider: true },
  { label: 'Quibi nastavitve', icon: Settings, path: '/settings/quibi' },
  { label: 'FareHarbor Sync', icon: Activity, path: '/settings/fareharbor' },
];

export default function AppLayout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-[#1a5c38] text-white transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <Leaf className="w-7 h-7 text-[#ffc107] shrink-0" />
          {!collapsed && <span className="font-bold text-lg tracking-tight">Experience Sync</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map((item, i) => {
            if (item.divider) return <div key={i} className="my-2 border-t border-white/10" />;
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}>
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-white/10 hover:bg-white/10 transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}