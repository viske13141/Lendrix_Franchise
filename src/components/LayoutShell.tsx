import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  Clock,
  FileSignature,
  FileSpreadsheet,
  GitBranch,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Server,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ROLE_NAVIGATION_CONFIG, type NavIconKey, type RoleNavItem } from '../shared/navigation';
import type { UserAccount } from '../shared/types';

function NavIcon({ icon }: { icon: NavIconKey }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (icon) {
    case 'overview':
      return <LayoutDashboard className={cls} aria-hidden="true" />;
    case 'franchises':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'agreements':
      return <FileSignature className={cls} aria-hidden="true" />;
    case 'catalogue':
      return <Package className={cls} aria-hidden="true" />;
    case 'tiers':
      return <Layers className={cls} aria-hidden="true" />;
    case 'compliance':
      return <ShieldAlert className={cls} aria-hidden="true" />;
    case 'commissions':
      return <Wallet className={cls} aria-hidden="true" />;
    case 'training':
      return <Award className={cls} aria-hidden="true" />;
    case 'complaints':
      return <ClipboardCheck className={cls} aria-hidden="true" />;
    case 'marketing':
      return <Megaphone className={cls} aria-hidden="true" />;
    case 'reports':
      return <BarChart3 className={cls} aria-hidden="true" />;
    case 'audit':
      return <Shield className={cls} aria-hidden="true" />;
    case 'onboarding':
      return <GitBranch className={cls} aria-hidden="true" />;
    case 'platform':
      return <Server className={cls} aria-hidden="true" />;
    case 'crm':
      return <Users className={cls} aria-hidden="true" />;
    case 'distribution':
      return <Briefcase className={cls} aria-hidden="true" />;
    case 'servicedesk':
      return <Headphones className={cls} aria-hidden="true" />;
    case 'profile':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'leads':
      return <UserCheck className={cls} aria-hidden="true" />;
    case 'transactions':
      return <FileSpreadsheet className={cls} aria-hidden="true" />;
    case 'staffAccount':
      return <BookOpen className={cls} aria-hidden="true" />;
    case 'staffActivities':
      return <Activity className={cls} aria-hidden="true" />;
  }
}

export function LayoutShell({
  user,
  activeNavId,
  onSelectNav,
  sessionExpiresAt,
  onLogout,
  onSimulateTimeout,
  children,
}: {
  user: UserAccount;
  activeNavId: string;
  onSelectNav: (id: string) => void;
  sessionExpiresAt: number;
  onLogout: () => void;
  onSimulateTimeout: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000))
  );

  const roleConfig = ROLE_NAVIGATION_CONFIG[user.role];

  const groupedNav = useMemo(() => {
    const groups: Array<{ section: string; items: RoleNavItem[] }> = [];
    for (const item of roleConfig.navItems) {
      const existing = groups.find((g) => g.section === item.section);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ section: item.section, items: [item] });
      }
    }
    return groups;
  }, [roleConfig.navItems]);

  useEffect(() => {
    const update = () => {
      setRemainingSeconds(Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000)));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [sessionExpiresAt]);

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTimeout = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const activeItem = roleConfig.navItems.find((n) => n.id === activeNavId);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
          Lendrixventech
        </div>
        <div className="text-xs font-medium text-blue-300 mt-1 truncate">
          {roleConfig.dashboardTitle}
        </div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">
          {user.role === 'FRANCHISEE' || user.role === 'FRANCHISEE_STAFF'
            ? user.franchiseeName || roleConfig.workspaceSubtitle
            : roleConfig.workspaceSubtitle}
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
        aria-label={roleConfig.dashboardTitle}
      >
        {groupedNav.map((group) => (
          <div key={group.section} className="space-y-1">
            <div className="px-3 pb-1 text-xs font-medium text-slate-400">
              {group.section}
            </div>
            {group.items.map((item) => {
              const active = item.id === activeNavId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNav(item.id);
                    setMobileOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    active
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4 space-y-2 text-xs">
        <div className="space-y-0.5">
          <div className="font-medium text-white truncate">{user.name}</div>
          <div className="text-slate-400 truncate">{user.roleLabel}</div>
          {user.role === 'FRANCHISEE_STAFF' && (
            <div className="text-amber-300/90 truncate">
              Scoped under {user.franchiseeName}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-slate-400 pt-2 border-t border-slate-800">
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>MFA Challenge Passed</span>
          </span>
          <span className="font-mono tabular-nums text-amber-300">
            {user.configuredSessionTimeoutMinutes ? formattedTimeout : 'Pending'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-68 shrink-0 border-r border-slate-200 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 h-full shrink-0">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className="flex-1 bg-slate-950/50"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <span className="font-medium text-slate-700 whitespace-nowrap">
                {roleConfig.dashboardTitle}
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {activeItem?.label ?? ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onSimulateTimeout}
              title="Trigger session timeout policy enforcement"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {user.configuredSessionTimeoutMinutes
                  ? `Idle ${formattedTimeout}`
                  : 'Timeout: Pending Confirmation'}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
