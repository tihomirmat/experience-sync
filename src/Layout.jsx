import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { TenantProvider, useTenant } from './components/shared/TenantContext';
import { 
  LayoutDashboard, Map, Calendar, Inbox, Users, Building2, 
  FileText, Handshake, Globe, Activity, BarChart3, Settings,
  ChevronDown, Menu, X, LogOut, Bell, Plug, Mail, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

// Grouped so the few daily tasks come first and advanced/setup is clearly
// secondary — keeps the sidebar from overwhelming a time-poor user.
const navGroups = [
  {
    label: 'Vsak dan',
    items: [
      { name: 'Pregled', icon: LayoutDashboard, page: 'Dashboard' },
      { name: 'Rezervacije', icon: Inbox, page: 'Bookings' },
      { name: 'Koledar', icon: Calendar, page: 'CalendarDepartures' },
      { name: 'Doživetja', icon: Map, page: 'Experiences' },
    ],
  },
  {
    label: 'Stranke & sporočila',
    items: [
      { name: 'Stranke', icon: Users, page: 'Customers' },
      { name: 'Podjetja', icon: Building2, page: 'Companies' },
      { name: 'Agencije & skupine', icon: Handshake, page: 'Groups' },
      { name: 'E-pošta', icon: Mail, page: 'Email' },
      { name: 'E-poštne sekvence', icon: Activity, page: 'EmailSequences' },
    ],
  },
  {
    label: 'Računi & poročila',
    items: [
      { name: 'Računi', icon: FileText, page: 'Invoices' },
      { name: 'Analitika', icon: BarChart3, page: 'Analytics' },
      { name: 'Poročila', icon: BarChart3, page: 'Reports' },
    ],
  },
  {
    label: 'Nastavitve',
    items: [
      { name: 'Integracije', icon: Plug, page: 'Integrations' },
      { name: 'Partnerji', icon: Handshake, page: 'Partners' },
      { name: 'DMO viri', icon: Globe, page: 'DmoFeeds' },
      { name: 'Spremljanje', icon: Activity, page: 'Monitoring' },
      { name: 'Nastavitve', icon: Settings, page: 'IntegrationSettings' },
    ],
  },
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

  const { data: unreadEmails = [] } = useQuery({
    queryKey: ['nav-unread-emails', currentTenant?.id],
    queryFn: () => base44.entities.EmailMessage.filter({ tenant_id: currentTenant.id, status: 'received' }),
    enabled: !!currentTenant?.id,
    staleTime: 60000,
  });
  const unreadEmailCount = unreadEmails.length;

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
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-300">{group.label}</p>
            {group.items.map(item => {
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
                  <span className="flex-1">{item.name}</span>
                  {item.page === 'Invoices' && unpaidCount > 0 && (
                    <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none font-medium min-w-[18px] text-center">
                      {unpaidCount}
                    </span>
                  )}
                  {item.page === 'Email' && unreadEmailCount > 0 && (
                    <span className="ml-auto text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none font-medium min-w-[18px] text-center">
                      {unreadEmailCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

function LayoutInner({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // "Pomoč": clear all dismissed onboarding/how-to flags, signal the cards to
  // reappear, and go to the Dashboard so the guidance is front and centre.
  const reopenHelp = () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('os_howto_') || k.startsWith('os_onboarding_dismissed_'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('os:reopen-help'));
    navigate(createPageUrl('Dashboard'));
  };

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
            <Button variant="ghost" size="sm" onClick={reopenHelp} className="h-8 gap-1.5 text-gray-500 hover:text-gray-900">
              <HelpCircle className="w-4 h-4" /> <span className="hidden sm:inline text-xs">Pomoč</span>
            </Button>
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