import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client';
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
  token,
  data,
  activeNav,
  onSelectNav,
  routeNotice,
  onRefresh,
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
  const [feedback, setFeedback] = useState<{ tone: 'info' | 'danger'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [followUpNote, setFollowUpNote] = useState<Record<string, string>>({});

  const parentFranchisee = data.franchises[0];
  const perms = data.user.staffPermissions;

  async function runAction(fn: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      await onRefresh();
      setFeedback({ tone: 'info', msg: successMsg });
    } catch (err) {
      setFeedback({ tone: 'danger', msg: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <LayoutShell
      user={data.user}
      activeNavId={activeNav}
      onSelectNav={(id) => {
        onSelectNav(id);
        setFeedback(null);
      }}
      sessionExpiresAt={data.sessionExpiresAt}
      onLogout={onLogout}
      onSimulateTimeout={onSimulateTimeout}
    >
      {routeNotice && (
        <NoticeBanner tone="warning" title="Route Protection" message={routeNotice} />
      )}

      {feedback && (
        <NoticeBanner
          tone={feedback.tone === 'danger' ? 'danger' : 'info'}
          title={feedback.tone === 'danger' ? 'Access Denied' : 'Activity Updated'}
          message={feedback.msg}
        />
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
                label: 'Assigned Leads',
                value: String(data.leads.length),
                note: 'Scoped strictly to your assignments',
              },
              {
                label: 'Assigned Customer Follow-Ups',
                value: String(data.customers.length),
                note: 'Serving Franchisee isolated',
              },
              {
                label: 'Additional Staff Permissions',
                value: 'Pending',
                note: perms?.undefinedPermissionsStatus || 'Pending Confirmation',
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
                  <span className="text-slate-500">MFA & Idle Timeout</span>
                  <span className="font-mono tabular-nums text-right">
                    {data.user.mfaEnabled ? 'MFA Enabled' : 'Disabled'} · {data.user.sessionTimeoutMinutes} mins
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Confirmed Permission Boundary (FR-06)</h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Assigned Franchisee Leads</span>
                  <StatusLabel text={perms?.assignedLeadsView ? 'Permitted' : 'Not Permitted'} tone="nominal" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Assigned Customer Follow-Up Logging</span>
                  <StatusLabel text={perms?.customerFollowUps ? 'Permitted' : 'Not Permitted'} tone="nominal" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Commission Rules & Configuration</span>
                  <StatusLabel text={perms?.commissionConfig || 'Not Permitted'} tone="danger" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Company Administration</span>
                  <StatusLabel text={perms?.companyAdmin || 'Not Permitted'} tone="danger" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Lendrixventech Administration</span>
                  <StatusLabel text={perms?.lendrixAdmin || 'Not Permitted'} tone="danger" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Undefined Staff Role & Approval Permissions</span>
                  <PendingValue label={perms?.undefinedPermissionsStatus || 'Pending Confirmation'} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Franchisee Activities</h2>
              <p className="text-slate-600">
                You currently have{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {data.leads.length}
                </span>{' '}
                assigned lead(s) and{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {data.customers.length}
                </span>{' '}
                assigned customer follow-up(s) within {parentFranchisee?.businessName || 'your parent Franchisee'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectNav('activities')}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <span>Open Assigned Activities</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {activeNav === 'activities' && (
        <div className="space-y-6">
          <SectionHeader
            title="Assigned Franchisee Activities"
            subtitle="Only leads and customer follow-up activities explicitly assigned within your parent Franchisee account are accessible."
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Leads</h2>
            </div>
            {data.leads.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No Assigned Leads" description="No leads are currently assigned to your staff account." />
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Prospect</th>
                    <th className="py-2.5 px-3 font-semibold">Territory & Source</th>
                    <th className="py-2.5 px-3 font-semibold">Product Interest</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.leads.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-3 font-medium text-slate-900">{l.customerName}</td>
                      <td className="py-3 px-3 text-slate-600">{l.territory} · {l.source}</td>
                      <td className="py-3 px-3 text-slate-800">{l.productInterest}</td>
                      <td className="py-3 px-3"><StatusLabel text={l.status} /></td>
                      <td className="py-3 px-3 text-right">
                        <select
                          aria-label={`Lead status for ${l.customerName}`}
                          value={l.status}
                          disabled={busy}
                          onChange={(e) =>
                            runAction(
                              () =>
                                apiRequest(token, `/api/leads/${l.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: e.target.value }),
                                }),
                              `Updated assigned lead ${l.customerName} to ${e.target.value}.`
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="KYC Pending">KYC Pending</option>
                          <option value="Converted">Converted</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Assigned Customer Follow-Ups</h2>
            {data.customers.length === 0 ? (
              <EmptyState title="No Assigned Customers" description="No customer records are currently assigned to this staff sub-user." />
            ) : (
              data.customers.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{c.name}</span>{' '}
                      <span className="text-slate-500">· {c.city} · Stage: {c.pipelineStage}</span>
                    </div>
                    <StatusLabel text={`KYC ${c.kycStatus}`} />
                  </div>
                  <div className="text-slate-600">
                    Next Follow-up: <span className="font-mono tabular-nums">{c.nextFollowUp}</span> · Preferences: Email ({c.commsPreferences.email ? 'Y' : 'N'}) / SMS ({c.commsPreferences.sms ? 'Y' : 'N'}) / WA ({c.commsPreferences.whatsapp ? 'Y' : 'N'})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      placeholder="Log assigned customer follow-up note..."
                      value={followUpNote[c.id] || ''}
                      onChange={(e) => setFollowUpNote({ ...followUpNote, [c.id]: e.target.value })}
                      className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          async () => {
                            await apiRequest(token, `/api/customers/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                followUpNote: followUpNote[c.id] || 'Staff follow-up completed.',
                              }),
                            });
                            setFollowUpNote({ ...followUpNote, [c.id]: '' });
                          },
                          `Logged follow-up note for ${c.name}.`
                        )
                      }
                      className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                    >
                      Save Follow-Up
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
