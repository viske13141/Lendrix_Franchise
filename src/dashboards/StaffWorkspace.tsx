import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LayoutShell } from '../components/LayoutShell';
import {
  EmptyState,
  MetricGrid,
  NoticeBanner,
  PendingValue,
  SectionHeader,
  StatusLabel,
} from '../components/SharedUI';
import type { DashboardPayload } from '../shared/types';

export function StaffWorkspace({
  data,
  activeNav,
  onSelectNav,
  routeNotice,
  onLogout,
  onSimulateTimeout,
}: {
  token: string;
  data: DashboardPayload;
  activeNav: string;
  onSelectNav: (id: string) => void;
  routeNotice: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onSimulateTimeout: () => void;
}) {
  const parentFranchisee = data.franchises[0];
  const perms = data.user.staffPermissions;

  return (
    <LayoutShell
      user={data.user}
      activeNavId={activeNav}
      onSelectNav={(id) => {
        onSelectNav(id);
      }}
      sessionExpiresAt={data.sessionExpiresAt}
      onLogout={onLogout}
      onSimulateTimeout={onSimulateTimeout}
    >
      {routeNotice && (
        <NoticeBanner tone="warning" title="Route Protection" message={routeNotice} />
      )}

      <NoticeBanner
        tone="info"
        title="FR-06 Sub-User Scope (Should Have)"
        message={data.customerVisibilityNote}
      />

      {activeNav === 'account' && (
        <div className="space-y-6">
          <SectionHeader
            title="Staff Account"
            subtitle={`Restricted Franchisee Staff sub-user workspace operating within ${parentFranchisee?.businessName ?? 'Parent Franchisee'} (${parentFranchisee?.franchiseeCode ?? ''}).`}
          />

          <MetricGrid
            items={[
              {
                label: 'Parent Franchisee',
                value: parentFranchisee?.franchiseeCode || 'FRN-101',
                note: parentFranchisee
                  ? `${parentFranchisee.businessName} · ${parentFranchisee.tier} Tier`
                  : undefined,
              },
              {
                label: 'Assigned Leads Access',
                value: 'Pending',
                note: perms?.assignedLeadsAccess || 'Pending Confirmation',
              },
              {
                label: 'Customer Follow-Up Access',
                value: 'Pending',
                note: perms?.customerFollowUpAccess || 'Pending Confirmation',
              },
              {
                label: 'FR-06 Permission Matrix',
                value: 'Pending',
                note: perms?.permissionModelStatus || 'Pending Confirmation',
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Staff Sub-User Information</h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">Account Name</span>
                  <span className="font-medium text-slate-900 text-right">{data.user.name}</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="font-mono text-slate-700 text-right">{data.user.email}</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">Account Classification</span>
                  <span className="text-right text-slate-800">
                    Franchisee Staff Sub-User (Not an independent party)
                  </span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">Parent Franchisee</span>
                  <span className="text-right text-slate-800">
                    {parentFranchisee
                      ? `${parentFranchisee.businessName} (${parentFranchisee.franchiseeCode})`
                      : data.user.franchiseeName || 'Parent Franchisee'}
                  </span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">MFA Mode</span>
                  <span className="text-right text-slate-800">{data.user.mfaMode}</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-500">Session Timeout Policy</span>
                  <PendingValue
                    label={
                      data.user.configuredSessionTimeoutMinutes
                        ? `Configured: ${data.user.configuredSessionTimeoutMinutes} mins (Policy Pending Confirmation)`
                        : data.user.sessionTimeoutPolicy
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Permission Matrix Status (FR-06)</h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Assigned Franchisee Leads</span>
                  <PendingValue label={perms?.assignedLeadsAccess || 'Pending Confirmation'} />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Assigned Customer Follow-Ups</span>
                  <PendingValue label={perms?.customerFollowUpAccess || 'Pending Confirmation'} />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Staff Approval Rights</span>
                  <StatusLabel text={perms?.approvalRights || 'Not Permitted'} tone="danger" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Commission, Company & Lendrixventech Admin</span>
                  <StatusLabel text={perms?.commissionAndAdminAccess || 'Not Permitted'} tone="danger" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Permission Configuration</span>
                  <PendingValue label={perms?.permissionModelStatus || 'Pending Confirmation'} />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-slate-500">
                {perms?.configurationLockedReason ||
                  'Permission configuration is locked until the authorised FR-06 permission model is confirmed.'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Activities (FR-06)</h2>
              <p className="text-slate-600">
                Lead and customer follow-up permissions are currently <span className="font-medium text-amber-700">Pending Confirmation</span> until the authorised Franchisee staff permission model is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectNav('activities')}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <span>View Assigned Activities Status</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {activeNav === 'activities' && (
        <div className="space-y-6">
          <SectionHeader
            title="Assigned Activities (FR-06)"
            subtitle="Sub-user activity permissions remain Pending Confirmation until the authorised Franchisee staff permission model is confirmed."
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Leads</h2>
              <PendingValue label="Access Pending Confirmation" />
            </div>
            {data.leads.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Assigned Lead Access Pending Confirmation"
                  description="FR-06 does not automatically approve assigned lead access. Lead records and actions remain locked until the authorised staff permission matrix is confirmed."
                />
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Prospect</th>
                    <th className="py-2.5 px-3 font-semibold">Territory & Source</th>
                    <th className="py-2.5 px-3 font-semibold">Product Interest</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.leads.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-3 font-medium text-slate-900">{l.customerName}</td>
                      <td className="py-3 px-3 text-slate-600">{l.territory} · {l.source}</td>
                      <td className="py-3 px-3 text-slate-800">{l.productInterest}</td>
                      <td className="py-3 px-3"><StatusLabel text={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Customer Follow-Ups</h2>
              <PendingValue label="Access Pending Confirmation" />
            </div>
            {data.customers.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Customer Follow-Up Access Pending Confirmation"
                  description="FR-06 does not automatically approve customer follow-up access. Follow-up actions and permission configuration are locked until the authorised FR-06 permission model is confirmed."
                />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {data.customers.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>{' '}
                        <span className="text-slate-500">· {c.city} · Stage: {c.pipelineStage}</span>
                      </div>
                      <StatusLabel text={`KYC ${c.kycStatus}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
