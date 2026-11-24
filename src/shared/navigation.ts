import type { PartyRole } from './types.ts';

export type NavIconKey =
  | 'overview'
  | 'franchises'
  | 'agreements'
  | 'catalogue'
  | 'tiers'
  | 'compliance'
  | 'commissions'
  | 'training'
  | 'complaints'
  | 'marketing'
  | 'reports'
  | 'audit'
  | 'onboarding'
  | 'platform'
  | 'crm'
  | 'distribution'
  | 'servicedesk'
  | 'profile'
  | 'leads'
  | 'transactions'
  | 'staffAccount'
  | 'staffActivities';

export interface RoleNavItem {
  id: string;
  label: string;
  path: string;
  section: string;
  icon: NavIconKey;
}

export interface RoleWorkspaceConfig {
  role: PartyRole;
  dashboardTitle: string;
  workspaceSubtitle: string;
  basePath: string;
  defaultNavId: string;
  navItems: RoleNavItem[];
}

export const ROLE_NAVIGATION_CONFIG: Record<PartyRole, RoleWorkspaceConfig> = {
  COMPANY: {
    role: 'COMPANY',
    dashboardTitle: 'Company Dashboard',
    workspaceSubtitle: 'Franchisor Governance & Product Shelf',
    basePath: '/company',
    defaultNavId: 'overview',
    navItems: [
      { id: 'overview', label: 'Overview', path: '/company/overview', section: 'Network Governance', icon: 'overview' },
      { id: 'franchises', label: 'Franchise Management', path: '/company/franchises', section: 'Network Governance', icon: 'franchises' },
      { id: 'agreements', label: 'Franchise Agreements', path: '/company/agreements', section: 'Network Governance', icon: 'agreements' },
      { id: 'products', label: 'Product Catalogue', path: '/company/products', section: 'Shelf & Compliance', icon: 'catalogue' },
      { id: 'tiers', label: 'Franchise Tiers', path: '/company/tiers', section: 'Shelf & Compliance', icon: 'tiers' },
      { id: 'compliance', label: 'Compliance & Licences', path: '/company/compliance', section: 'Shelf & Compliance', icon: 'compliance' },
      { id: 'commissions', label: 'Commission Oversight', path: '/company/commissions', section: 'Commercial & Quality', icon: 'commissions' },
      { id: 'training', label: 'Training & Certification', path: '/company/training', section: 'Commercial & Quality', icon: 'training' },
      { id: 'complaints', label: 'Complaints & Grievances', path: '/company/complaints', section: 'Commercial & Quality', icon: 'complaints' },
      { id: 'marketing', label: 'Marketing & Brand Control', path: '/company/marketing', section: 'Commercial & Quality', icon: 'marketing' },
      { id: 'reports', label: 'Management Reports', path: '/company/reports', section: 'Reporting & Audit', icon: 'reports' },
      { id: 'admin', label: 'Administration & Audit', path: '/company/admin', section: 'Reporting & Audit', icon: 'audit' },
    ],
  },

  LENDRIXVENTECH: {
    role: 'LENDRIXVENTECH',
    dashboardTitle: 'Operations Dashboard',
    workspaceSubtitle: 'Technology & Distribution Operations',
    basePath: '/operations',
    defaultNavId: 'overview',
    navItems: [
      { id: 'overview', label: 'Operations Overview', path: '/operations/overview', section: 'Operations Control', icon: 'overview' },
      { id: 'onboarding', label: 'Franchise Onboarding', path: '/operations/onboarding', section: 'Operations Control', icon: 'onboarding' },
      { id: 'platform', label: 'Platform Operations', path: '/operations/platform', section: 'Operations Control', icon: 'platform' },
      { id: 'crm', label: 'Lead & Customer Operations', path: '/operations/crm', section: 'Distribution & CRM', icon: 'crm' },
      { id: 'distribution', label: 'Product Distribution Operations', path: '/operations/distribution', section: 'Distribution & CRM', icon: 'distribution' },
      { id: 'commissions', label: 'Commission Processing', path: '/operations/commissions', section: 'Finance & Enablement', icon: 'commissions' },
      { id: 'training', label: 'Training Operations', path: '/operations/training', section: 'Finance & Enablement', icon: 'training' },
      { id: 'servicedesk', label: 'Service Desk', path: '/operations/servicedesk', section: 'Finance & Enablement', icon: 'servicedesk' },
      { id: 'marketing', label: 'Marketing & Announcements', path: '/operations/marketing', section: 'Finance & Enablement', icon: 'marketing' },
      { id: 'reports', label: 'Operational Reports', path: '/operations/reports', section: 'Reporting & Audit', icon: 'reports' },
      { id: 'admin', label: 'Administration & Audit', path: '/operations/admin', section: 'Reporting & Audit', icon: 'audit' },
    ],
  },

  FRANCHISEE: {
    role: 'FRANCHISEE',
    dashboardTitle: 'Franchisee Dashboard',
    workspaceSubtitle: 'Local Distribution Practice',
    basePath: '/franchisee',
    defaultNavId: 'overview',
    navItems: [
      { id: 'overview', label: 'Overview', path: '/franchisee/overview', section: 'My Practice', icon: 'overview' },
      { id: 'profile', label: 'My Franchise Profile', path: '/franchisee/profile', section: 'My Practice', icon: 'profile' },
      { id: 'leads', label: 'Lead Management', path: '/franchisee/leads', section: 'Customers & Sales', icon: 'leads' },
      { id: 'crm', label: 'Customer Management', path: '/franchisee/crm', section: 'Customers & Sales', icon: 'crm' },
      { id: 'products', label: 'Product Distribution', path: '/franchisee/products', section: 'Customers & Sales', icon: 'distribution' },
      { id: 'transactions', label: 'Transactions', path: '/franchisee/transactions', section: 'Customers & Sales', icon: 'transactions' },
      { id: 'commissions', label: 'Commission & Earnings', path: '/franchisee/commissions', section: 'Earnings & Enablement', icon: 'commissions' },
      { id: 'training', label: 'Training & Certification', path: '/franchisee/training', section: 'Earnings & Enablement', icon: 'training' },
      { id: 'servicedesk', label: 'Service Desk', path: '/franchisee/servicedesk', section: 'Earnings & Enablement', icon: 'servicedesk' },
      { id: 'marketing', label: 'Marketing & Communications', path: '/franchisee/marketing', section: 'Governance & Compliance', icon: 'marketing' },
      { id: 'compliance', label: 'Compliance & Licences', path: '/franchisee/compliance', section: 'Governance & Compliance', icon: 'compliance' },
    ],
  },

  FRANCHISEE_STAFF: {
    role: 'FRANCHISEE_STAFF',
    dashboardTitle: 'Staff Workspace',
    workspaceSubtitle: 'Authorised Sub-User Workspace (FR-06)',
    basePath: '/staff',
    defaultNavId: 'account',
    navItems: [
      { id: 'account', label: 'Staff Account', path: '/staff/account', section: 'Franchisee Sub-User Scope', icon: 'staffAccount' },
      { id: 'activities', label: 'Assigned Activities', path: '/staff/activities', section: 'Franchisee Sub-User Scope', icon: 'staffActivities' },
    ],
  },
};

export const ALL_PROTECTED_PREFIXES = ['/company', '/operations', '/franchisee', '/staff'];

export function isPathRestrictedToOtherRole(pathname: string, role?: PartyRole): boolean {
  const clean = pathname.toLowerCase();
  const isProtected = ALL_PROTECTED_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(prefix + '/'));
  if (!isProtected) return false;
  if (!role) return true;
  const allowedBase = ROLE_NAVIGATION_CONFIG[role].basePath;
  return !(clean === allowedBase || clean.startsWith(allowedBase + '/'));
}

export function resolveNavIdFromPath(role: PartyRole, pathname: string): string {
  const config = ROLE_NAVIGATION_CONFIG[role];
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  const matched = config.navItems.find((item) => item.path === clean);
  return matched ? matched.id : config.defaultNavId;
}
