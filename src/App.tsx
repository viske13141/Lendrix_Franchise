/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  apiRequest,
  authorizeRoute,
  fetchDashboardState,
  type AuthSessionResponse,
} from './api/client';
import { AuthGate } from './components/AuthGate';
import { CompanyDashboard } from './dashboards/CompanyDashboard';
import { FranchiseeDashboard } from './dashboards/FranchiseeDashboard';
import { LendrixventechDashboard } from './dashboards/LendrixventechDashboard';
import { StaffWorkspace } from './dashboards/StaffWorkspace';
import {
  ROLE_NAVIGATION_CONFIG,
  isPathRestrictedToOtherRole,
  resolveNavIdFromPath,
} from './shared/navigation';
import type { DashboardPayload } from './shared/types';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [activeNavId, setActiveNavId] = useState<string>('overview');
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (isPathRestrictedToOtherRole(path, undefined)) {
      return `Direct access to ${path} is protected. Sign in with an authorised role account to continue.`;
    }
    return null;
  });

  const loadDashboard = useCallback(async (authToken: string) => {
    try {
      const payload = await fetchDashboardState(authToken);
      setDashboardData(payload);
      return payload;
    } catch (err) {
      const status = (err as Error & { status?: number })?.status;
      if (status === 401) {
        setToken(null);
        setDashboardData(null);
        window.history.replaceState(null, '', '/');
        setSessionNotice(err instanceof Error ? err.message : 'Session expired. Please sign in again.');
      } else {
        setSessionNotice(err instanceof Error ? err.message : 'Unable to load dashboard.');
      }
      return null;
    }
  }, []);

  async function handleAuthenticated(session: AuthSessionResponse) {
    setSessionNotice(null);
    setRouteNotice(null);
    setLoading(true);
    setToken(session.token);
    const payload = await loadDashboard(session.token);
    if (payload) {
      const currentPath = window.location.pathname;
      const roleConfig = ROLE_NAVIGATION_CONFIG[payload.user.role];
      let targetNavId = roleConfig.defaultNavId;

      if (isPathRestrictedToOtherRole(currentPath, payload.user.role)) {
        // Confirm server-side rejection and redirect to authorised role home
        await authorizeRoute(session.token, currentPath).catch((err) => {
          setRouteNotice(err instanceof Error ? err.message : 'Restricted route redirected.');
        });
      } else {
        targetNavId = resolveNavIdFromPath(payload.user.role, currentPath);
      }

      const targetItem =
        roleConfig.navItems.find((i) => i.id === targetNavId) ?? roleConfig.navItems[0];
      setActiveNavId(targetItem.id);
      window.history.replaceState(null, '', targetItem.path);
    }
    setLoading(false);
  }

  const handleSelectNav = useCallback(
    async (navId: string) => {
      if (!dashboardData || !token) return;
      const roleConfig = ROLE_NAVIGATION_CONFIG[dashboardData.user.role];
      const item = roleConfig.navItems.find((i) => i.id === navId);
      if (!item) return;

      setRouteNotice(null);
      setActiveNavId(item.id);
      if (window.location.pathname !== item.path) {
        window.history.pushState(null, '', item.path);
      }
    },
    [dashboardData, token]
  );

  // Protect browser Back/Forward navigation against cross-role URL tampering
  useEffect(() => {
    if (!token || !dashboardData) return;
    const onPopState = async () => {
      const path = window.location.pathname;
      const role = dashboardData.user.role;
      const roleConfig = ROLE_NAVIGATION_CONFIG[role];

      if (isPathRestrictedToOtherRole(path, role)) {
        try {
          await authorizeRoute(token, path);
        } catch (err) {
          setRouteNotice(
            err instanceof Error
              ? err.message
              : `Direct access to ${path} is not authorised for your role.`
          );
        }
        const fallback = roleConfig.navItems.find((i) => i.id === activeNavId) ?? roleConfig.navItems[0];
        window.history.replaceState(null, '', fallback.path);
        return;
      }

      const resolved = resolveNavIdFromPath(role, path);
      setActiveNavId(resolved);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [token, dashboardData, activeNavId]);

  async function handleLogout() {
    if (token) {
      await apiRequest(token, '/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    }
    setToken(null);
    setDashboardData(null);
    setRouteNotice(null);
    window.history.replaceState(null, '', '/');
    setSessionNotice('Signed out cleanly.');
  }

  async function handleSimulateTimeout() {
    if (token) {
      await apiRequest(token, '/api/auth/expire-session', { method: 'POST' }).catch(() => undefined);
    }
    setToken(null);
    setDashboardData(null);
    setRouteNotice(null);
    window.history.replaceState(null, '', '/');
    setSessionNotice('Session timed out per idle timeout security policy (Section 10). Please re-authenticate with MFA.');
  }

  // Client-side timer guard matching server session expiration
  useEffect(() => {
    if (!dashboardData?.sessionExpiresAt) return;
    const msLeft = dashboardData.sessionExpiresAt - Date.now();
    if (msLeft <= 0) {
      setToken(null);
      setDashboardData(null);
      window.history.replaceState(null, '', '/');
      setSessionNotice('Session expired due to idle timeout.');
      return;
    }
    const timer = window.setTimeout(() => {
      setToken(null);
      setDashboardData(null);
      window.history.replaceState(null, '', '/');
      setSessionNotice('Session expired due to idle timeout.');
    }, msLeft + 500);
    return () => window.clearTimeout(timer);
  }, [dashboardData?.sessionExpiresAt]);

  if (!token || !dashboardData) {
    if (loading) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-xs text-slate-600">
            Loading role-scoped dashboard...
          </div>
        </div>
      );
    }
    return <AuthGate sessionNotice={sessionNotice} onAuthenticated={handleAuthenticated} />;
  }

  const refresh = async () => {
    await loadDashboard(token);
  };

  switch (dashboardData.user.role) {
    case 'COMPANY':
      return (
        <CompanyDashboard
          token={token}
          data={dashboardData}
          activeNav={activeNavId}
          onSelectNav={handleSelectNav}
          routeNotice={routeNotice}
          onRefresh={refresh}
          onLogout={handleLogout}
          onSimulateTimeout={handleSimulateTimeout}
        />
      );
    case 'LENDRIXVENTECH':
      return (
        <LendrixventechDashboard
          token={token}
          data={dashboardData}
          activeNav={activeNavId}
          onSelectNav={handleSelectNav}
          routeNotice={routeNotice}
          onRefresh={refresh}
          onLogout={handleLogout}
          onSimulateTimeout={handleSimulateTimeout}
        />
      );
    case 'FRANCHISEE':
      return (
        <FranchiseeDashboard
          token={token}
          data={dashboardData}
          activeNav={activeNavId}
          onSelectNav={handleSelectNav}
          routeNotice={routeNotice}
          onRefresh={refresh}
          onLogout={handleLogout}
          onSimulateTimeout={handleSimulateTimeout}
        />
      );
    case 'FRANCHISEE_STAFF':
      return (
        <StaffWorkspace
          token={token}
          data={dashboardData}
          activeNav={activeNavId}
          onSelectNav={handleSelectNav}
          routeNotice={routeNotice}
          onRefresh={refresh}
          onLogout={handleLogout}
          onSimulateTimeout={handleSimulateTimeout}
        />
      );
  }
}
