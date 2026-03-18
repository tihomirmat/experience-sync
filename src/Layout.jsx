import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { TenantProvider, useTenant } from './components/shared/TenantContext';
import { 
  LayoutDashboard, Map, Calendar, Inbox, Users, Building2, 
  FileText, Handshake, Globe, Activity, BarChart3, Settings,
  ChevronDown, Menu, X, LogOut, Bell, Plug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Experiences', icon: Map, page: 'Experiences' },
  { name: 'Calendar', icon: Calendar, page: 'CalendarDepartures' },
  { name: 'Bookings', icon: Inbox, page: 'Bookings' },
  { name: 'Customers', icon: Users, page: 'Customers' },
  { name: 'Companies', icon: Building2, page: 'Companies' },
  { name: 'Invoices', icon: FileText, page: 'Invoices' },
  { name: 'Agencije & Skupine', icon: Users, page: 'Groups' },
  { name: 'Partners', icon: Handshake, page: 'Partners' },
  { name: 'DMO Feeds', icon: Globe, page: 'DmoFeeds' },
  { name: 'Monitoring', icon: Activity, page: 'Monitoring' },
  { name: 'Analitika', icon: BarChart3, page: 'Analytics' },
  { name: 'Reports', icon: BarChart3, page: 'Reports' },
  { name: 'Integracije', icon: Plug, page: 'Integrations' },
  { name: 'Settings', icon: Settings, page: 'IntegrationSettings' },
];

function SidebarContent({ currentPageName, onClose }) {
  const { currentTenant, tenants, switchTenant } = useTenant();

  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ['nav-unpaid-invoices', currentTenant?.id],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: currentTenant.id }),
    enabled: !!currentTenant?.id,
    select: (data) => data.filter(i => i.status === 'sent' || i.status === 'draft'),
    staleTime: 60000,
  });
  const unpaidCount = unpaidInvoices.length;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">EO</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">Experience Ops</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tenant Switcher */}
      {currentTenant && (
        <div className="px-3 py-3 border-b border-gray-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                  {currentTenant.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentTenant.name}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {tenants.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => switchTenant(t)}>
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-semibold mr-2">
                    {t.name?.[0]?.toUpperCase()}
                  </div>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function LayoutInner({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-[#FAFBFC]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0">
        <SidebarContent currentPageName={currentPageName} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[280px] h-full shadow-2xl">
            <SidebarContent currentPageName={currentPageName} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-gray-100 bg-white flex items-center justify-between px-4 lg:px-6">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden h-8 w-8">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="lg:hidden" />
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
              <Bell className="w-4 h-4" />
            </Button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-700">{user.full_name?.[0]?.toUpperCase() || 'U'}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.full_name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-gray-500">{user.email}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => base44.auth.logout()}>
                    <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <TenantProvider>
      <LayoutInner currentPageName={currentPageName}>
        {children}
      </LayoutInner>
    </TenantProvider>
  );
}