import React, { useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { apiRequest } from '../api/client';
import { LayoutShell } from '../components/LayoutShell';
import {
  MetricGrid,
  NoticeBanner,
  PendingValue,
  SectionHeader,
  StatusLabel,
  formatInr,
} from '../components/SharedUI';
import {
  DOCUMENTED_RACI_MATRIX,
  DOCUMENTED_SLAS,
  ONBOARDING_WORKFLOW_STEPS,
  type DashboardPayload,
  type ProductCategory,
} from '../shared/types';

export function LendrixventechDashboard({
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

  const [distCategory, setDistCategory] = useState<'ALL' | ProductCategory>('ALL');
  const [rmInput, setRmInput] = useState<Record<string, string>>({});
  const [newIncident, setNewIncident] = useState({ title: '', severity: 'Low' as 'Low' | 'Medium' | 'High' });
  const [newLead, setNewLead] = useState({
    franchiseeId: 'frn-101',
    customerName: '',
    territory: 'Mumbai South',
    source: 'Campaign' as 'Campaign' | 'Web Form' | 'Referral' | 'Manual',
    productInterest: 'Mutual Funds' as ProductCategory,
  });
  const [clawbackForm, setClawbackForm] = useState<Record<string, { clawback: string; adj: string }>>({});
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});
  const [newCircular, setNewCircular] = useState({
    title: '',
    type: 'Product Circular' as 'Product Circular' | 'Announcement' | 'Marketing Material',
    summary: '',
  });
  const [selectedOpReport, setSelectedOpReport] = useState<
    | 'Franchise Onboarding'
    | 'Product Distribution'
    | 'Customer and Lead Activity'
    | 'Commission Accrual'
    | 'Reconciliation'
    | 'Clawbacks'
    | 'Statements'
    | 'Payouts'
    | 'Training'
    | 'Service Desk'
  >('Franchise Onboarding');

  const raciMap = useMemo(
    () => Object.fromEntries(DOCUMENTED_RACI_MATRIX.map((r) => [r.activity, r])),
    []
  );

  async function runAction(fn: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      await onRefresh();
      setFeedback({ tone: 'info', msg: successMsg });
    } catch (err) {
      setFeedback({ tone: 'danger', msg: err instanceof Error ? err.message : 'Operation failed.' });
    } finally {
      setBusy(false);
    }
  }

  const onboardingCounts = useMemo(() => {
    const active = data.franchises.filter((f) => f.platformActivationStatus === 'Activated').length;
    const inProg = data.franchises.filter((f) => f.onboardingStatus === 'In Progress' || f.onboardingStatus === 'Applied').length;
    return { active, inProg };
  }, [data.franchises]);

  const completedTrainings = data.trainingProgress.filter((t) => t.completionStatus === 'Completed').length;
  const openTickets = data.tickets.filter((t) => t.status !== 'Resolved').length;
  const matchedStatements = data.commissionStatements.filter((s) => s.reconciliationStatus === 'Matched').length;

  function exportOperationalCsv() {
    const lines = [
      ['Report', selectedOpReport],
      ['Generated', new Date().toISOString()],
      ['Franchisees', String(data.franchises.length)],
      ['Transactions', String(data.transactions.length)],
      ['Statements', String(data.commissionStatements.length)],
      ['Tickets', String(data.tickets.length)],
    ];
    const csv = lines.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lendrix-ops-${selectedOpReport.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          title={feedback.tone === 'danger' ? 'Operation Blocked' : 'Operation Recorded'}
          message={feedback.msg}
        />
      )}

      {activeNav === 'overview' && (
        <div className="space-y-6">
          <SectionHeader
            title="Lendrixventech Operations Control Tower"
            subtitle="Technology & distribution partner execution across the 7-step onboarding pipeline, CRM workflows, reconciliation, training, and service desk."
          />

          <MetricGrid
            items={[
              {
                label: 'Onboarding Queue',
                value: `${onboardingCounts.inProg} In Progress`,
                note: `${onboardingCounts.active} Activated · 7-step journey`,
              },
              {
                label: 'Commission Processing',
                value: `${data.commissionStatements.filter((s) => s.makerCheckerStage !== 'Paid').length} Pending Payout`,
                note: `${matchedStatements}/${data.commissionStatements.length} statements matched`,
              },
              {
                label: 'Service Desk Queue',
                value: `${openTickets} Active Tickets`,
                note: 'Target SLA: Pending Confirmation',
              },
              {
                label: 'Platform & Integrations',
                value: `0 / ${data.integrations.length} Connected`,
                note: 'Availability target: Pending Confirmation',
              },
            ]}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                7-Step Franchisee Onboarding Pipeline (Section 4.3)
              </h2>
              <button
                type="button"
                onClick={() => onSelectNav('onboarding')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Manage Onboarding Execution
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
              {ONBOARDING_WORKFLOW_STEPS.map((s) => {
                const countAtStep = data.franchises.filter((f) => f.onboardingStep === s.step).length;
                return (
                  <div key={s.step} className="rounded border border-slate-200 bg-slate-50 p-2.5 flex flex-col justify-between gap-2">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">Step {s.step}</div>
                      <div className="text-slate-600 mt-0.5 leading-snug">{s.label}</div>
                    </div>
                    <div className="font-mono text-xs font-semibold text-blue-700 tabular-nums pt-1 border-t border-slate-200">
                      {countAtStep} Franchisee{countAtStep === 1 ? '' : 's'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Operational Action Queues</h2>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">Lead & Customer Operations</div>
                    <div className="text-slate-500">{data.leads.length} leads routed · {data.customers.length} scoped CRM pipelines</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNav('crm')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Open CRM Ops
                  </button>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">Product Distribution & Eligibility Sync</div>
                    <div className="text-slate-500">
                      {data.transactions.length} transactions ({data.transactions.filter((t) => t.eligibilityStatus === 'Pending').length} pending eligibility)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNav('distribution')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Open Distribution
                  </button>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">Reconciliation & Maker-Checker Payouts</div>
                    <div className="text-slate-500">
                      {data.commissionStatements.filter((s) => s.reconciliationStatus === 'Discrepancy').length} discrepancy · {data.commissionStatements.filter((s) => s.makerCheckerStage === 'Maker Submitted').length} awaiting Checker
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNav('commissions')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Process Commissions
                  </button>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">Training & Certification Delivery</div>
                    <div className="text-slate-500">{completedTrainings} / {data.trainingProgress.length} assigned modules completed</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNav('training')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Training Ops
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Documented SLAs & Targets (Section 12)</h2>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Measure</th>
                    <th className="py-2 px-3 font-semibold">Target Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {DOCUMENTED_SLAS.map((sla) => (
                    <tr key={sla.measure}>
                      <td className="py-2 px-3 font-medium text-slate-800">{sla.measure}</td>
                      <td className="py-2 px-3 text-slate-700">
                        {sla.target.includes('Pending Confirmation') ? (
                          <PendingValue label={sla.target} />
                        ) : (
                          sla.target
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeNav === 'onboarding' && (
        <div className="space-y-6">
          <SectionHeader
            title="Franchise Onboarding Operations (7-Step Documented Journey)"
            subtitle="Lendrixventech is Responsible (R) for onboarding execution; The Company remains Accountable (A) for KYC/KYB and Agreement sign-off."
            raci={raciMap['Franchisee KYC and onboarding']}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-800 mb-2">Documented 7-Step Sequence (Section 4.3)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 text-xs">
              {ONBOARDING_WORKFLOW_STEPS.map((s) => (
                <div key={s.step} className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="font-mono font-semibold text-slate-900">Step {s.step}</div>
                  <div className="text-slate-700 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Current Step</th>
                  <th className="py-2.5 px-3 font-semibold">KYC / Agreement / Fee (Company A)</th>
                  <th className="py-2.5 px-3 font-semibold">Relationship Manager</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Operational Execution (R)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.franchises.map((f) => (
                  <tr key={f.id}>
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono font-semibold text-slate-900">{f.franchiseeCode}</div>
                      <div className="font-medium text-slate-800">{f.businessName}</div>
                      <div className="text-slate-500">Tier: {f.tier}</div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono font-semibold text-slate-900">
                        Step {f.onboardingStep} / 7
                      </div>
                      <div className="text-slate-600">
                        {ONBOARDING_WORKFLOW_STEPS[f.onboardingStep - 1]?.label}
                      </div>
                      <div className="mt-1"><StatusLabel text={f.onboardingStatus} /></div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div>KYC/KYB: <StatusLabel text={f.kycKybStatus} /></div>
                      <div>Agreement: <StatusLabel text={f.agreementStatus} /></div>
                      <div>Fee: <span className="text-amber-700 font-medium">{f.feePaymentStatus}</span></div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1.5">
                      <div className="text-slate-800">{f.relationshipManager}</div>
                      <div className="flex gap-1">
                        <input
                          placeholder="Assign RM..."
                          value={rmInput[f.id] || ''}
                          onChange={(e) => setRmInput({ ...rmInput, [f.id]: e.target.value })}
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    action: 'assign_rm',
                                    relationshipManager: rmInput[f.id] || 'Kavita Iyer (RM-West-02)',
                                  }),
                                }),
                              `Assigned relationship manager for ${f.franchiseeCode}.`
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Assign
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-right space-y-1.5">
                      {f.onboardingStep < 7 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ action: 'advance_onboarding' }),
                                }),
                              `Advanced ${f.franchiseeCode} onboarding step.`
                            )
                          }
                          className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                        >
                          Advance Step
                        </button>
                      )}
                      {f.platformActivationStatus === 'Inactive' && (
                        <div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ action: 'activate_platform' }),
                                  }),
                                `Activated platform for ${f.franchiseeCode}.`
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            Activate Access
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'platform' && (
        <div className="space-y-6">
          <SectionHeader
            title="Platform Operations (FR-52, Section 10 & 12)"
            subtitle="Platform availability, external integration status (unconfigured until connected), incident tracking, and DR/BCP posture."
            raci={raciMap['Platform build and uptime']}
          />

          <MetricGrid
            items={[
              {
                label: 'Platform Availability Target',
                value: 'Pending',
                note: 'Draft placeholder: [99.5]% monthly (Pending Confirmation)',
              },
              {
                label: 'Operational Posture',
                value: 'Operational',
                note: 'Core platform services running',
              },
              {
                label: 'External Integrations (FR-52)',
                value: '0 / 6 Connected',
                note: 'No external provider keys connected',
              },
              {
                label: 'Breach Notification Window',
                value: 'Pending',
                note: 'Hours target Pending Confirmation',
              },
            ]}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">External Provider Integration Status (FR-52)</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Integration System</th>
                  <th className="py-2 px-3 font-semibold">Category</th>
                  <th className="py-2 px-3 font-semibold">Connection Status</th>
                  <th className="py-2 px-3 font-semibold">Operational Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.integrations.map((intg) => (
                  <tr key={intg.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{intg.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{intg.category}</td>
                    <td className="py-2.5 px-3"><StatusLabel text={intg.status} tone="warning" /></td>
                    <td className="py-2.5 px-3 text-slate-600">{intg.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Incident, Backup, DR & Business Continuity Log</h2>
            <div className="space-y-2">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 rounded p-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{inc.title}</div>
                    <div className="text-slate-500">
                      {inc.reportedAt} · Severity: {inc.severity} · {inc.rtoRpoStatus}
                    </div>
                  </div>
                  <StatusLabel text={inc.status} />
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(
                  async () => {
                    await apiRequest(token, '/api/platform/incidents', {
                      method: 'POST',
                      body: JSON.stringify(newIncident),
                    });
                    setNewIncident({ title: '', severity: 'Low' });
                  },
                  'Logged operational incident / DR event.'
                );
              }}
              className="flex flex-wrap gap-2 pt-2"
            >
              <input
                required
                placeholder="Log operational issue, DR drill, or incident..."
                value={newIncident.title}
                onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                className="flex-1 min-w-[220px] rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as 'Low' | 'Medium' | 'High' })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Log Incident / Continuity Event
              </button>
            </form>
          </div>
        </div>
      )}

      {activeNav === 'crm' && (
        <div className="space-y-6">
          <SectionHeader
            title="Lead and Customer Operations (FR-20, FR-21, FR-22)"
            subtitle="Lead routing by territory/rule and operational pipeline visibility. Full customer PII remains restricted to the serving Franchisee."
            raci={raciMap['Customer acquisition and advice']}
          />

          <NoticeBanner tone="info" title="Data Access Restriction" message={data.customerVisibilityNote} />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Lead Capture & Territory Routing Queue</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Lead & Source</th>
                  <th className="py-2 px-3 font-semibold">Serving Franchisee</th>
                  <th className="py-2 px-3 font-semibold">Territory & Rule</th>
                  <th className="py-2 px-3 font-semibold">Product Interest</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.leads.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{l.customerName}</div>
                      <div className="text-slate-500">{l.source} · {l.createdAt}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{l.franchiseeName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{l.assignmentRule}</td>
                    <td className="py-2.5 px-3 text-slate-800">{l.productInterest}</td>
                    <td className="py-2.5 px-3"><StatusLabel text={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                async () => {
                  await apiRequest(token, '/api/leads', {
                    method: 'POST',
                    body: JSON.stringify(newLead),
                  });
                  setNewLead({ ...newLead, customerName: '' });
                },
                'Captured and routed lead to serving Franchisee.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Route Campaign / Web Lead to Territory Franchisee</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={newLead.franchiseeId}
                onChange={(e) => setNewLead({ ...newLead, franchiseeId: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                {data.franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.franchiseeCode} · {f.businessName}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Lead Name"
                value={newLead.customerName}
                onChange={(e) => setNewLead({ ...newLead, customerName: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Territory"
                value={newLead.territory}
                onChange={(e) => setNewLead({ ...newLead, territory: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newLead.productInterest}
                onChange={(e) => setNewLead({ ...newLead, productInterest: e.target.value as ProductCategory })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Mutual Funds">Mutual Funds</option>
                <option value="Loans">Loans</option>
                <option value="Insurance">Insurance</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Venture Capital Services">Venture Capital Services</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Assign Lead</span>
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Scoped Customer Pipeline Operations</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Protected Ref</th>
                  <th className="py-2 px-3 font-semibold">KYC & Risk Profile</th>
                  <th className="py-2 px-3 font-semibold">Consent & Preferences</th>
                  <th className="py-2 px-3 font-semibold">Pipeline Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-3">
                      <StatusLabel text={c.kycStatus} /> · {c.riskProfile}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      Consent: {c.consentGiven ? 'Captured' : 'Pending'} · SMS:{c.commsPreferences.sms ? 'Y' : 'N'} / Email:{c.commsPreferences.email ? 'Y' : 'N'} / WA:{c.commsPreferences.whatsapp ? 'Y' : 'N'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{c.pipelineStage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'distribution' && (
        <div className="space-y-6">
          <SectionHeader
            title="Product Distribution Operations"
            subtitle="Operational tracking across Mutual Funds, Loans, Insurance, Real Estate, and Venture Capital Services."
          />

          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-md">
            {(['ALL', 'Mutual Funds', 'Loans', 'Insurance', 'Real Estate', 'Venture Capital Services'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDistCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    distCategory === cat ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'ALL' ? 'All 5 Product Lines' : cat}
                </button>
              )
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Transaction & Product</th>
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Workflow Details</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Manufacturer & Eligibility</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ops Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.transactions
                  .filter((t) => distCategory === 'ALL' || t.productCategory === distCategory)
                  .map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono font-semibold text-slate-900">{t.id.toUpperCase()}</div>
                        <div className="font-medium text-slate-800">{t.productCategory}</div>
                        <div className="text-slate-500">{t.productName}</div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-700">{t.franchiseeName}</td>
                      <td className="py-3 px-3 align-top max-w-xs text-slate-600">
                        <div>{t.workflowSummary}</div>
                        {t.vcChecklist && (
                          <div className="mt-1 text-slate-500">
                            VC: Eligibility {t.vcChecklist.investorEligibilityPassed ? 'OK' : 'Pending'} · Suitability {t.vcChecklist.suitabilityPassed ? 'OK' : 'Pending'} · Data Room {t.vcChecklist.dataRoomAccessGranted ? 'Granted' : 'Locked'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatInr(t.amount)}
                      </td>
                      <td className="py-3 px-3 align-top space-y-1">
                        <div><StatusLabel text={t.manufacturerStatus} /></div>
                        <div>Eligibility: <StatusLabel text={t.eligibilityStatus} /></div>
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        {t.eligibilityStatus !== 'Eligible' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/transactions/${t.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      manufacturerStatus: t.productCategory === 'Loans' ? 'Disbursed' : 'Approved / Issued',
                                      eligibilityStatus: 'Eligible',
                                    }),
                                  }),
                                `Marked ${t.id} Eligible; commission accrued.`
                              )
                            }
                            className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                          >
                            Confirm Eligible
                          </button>
                        ) : (
                          <span className="font-mono text-slate-500 tabular-nums">
                            Accrued {formatInr(t.commissionAccrued)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'commissions' && (
        <div className="space-y-6">
          <SectionHeader
            title="Commission Processing & Maker-Checker Payouts (FR-30 to FR-34)"
            subtitle="Lendrixventech is Responsible (R) for calculation, statement matching, clawbacks, and payout file generation under Finance Maker-Checker control."
            raci={raciMap['Commission calculation and payout']}
          />

          <NoticeBanner
            tone="info"
            title="Maker-Checker Separation (FR-51)"
            message={`Logged in as ${data.user.name}. A Finance Checker distinct from the Maker must approve submitted statements before payout file generation.`}
          />

          <div className="space-y-3">
            {data.commissionStatements.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {s.invoiceNumber} · {s.periodLabel} · {s.franchiseeName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Payout Date: {s.payoutDate} · Maker: {s.makerActor || 'Not submitted'} · Checker: {s.checkerActor || 'Pending'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusLabel text={s.reconciliationStatus} />
                    <StatusLabel text={s.makerCheckerStage} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-y border-slate-100 py-2.5 text-xs">
                  <div>
                    <div className="text-slate-500">Gross Manufacturer</div>
                    <div className="font-mono font-semibold tabular-nums">{formatInr(s.grossManufacturerCommission)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Franchisee Share</div>
                    <div className="font-mono font-semibold tabular-nums">{formatInr(s.franchiseeShareAmount)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">TDS Deduction</div>
                    <div className="font-mono tabular-nums">-{formatInr(s.tdsDeduction)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Clawbacks / Adj</div>
                    <div className="font-mono tabular-nums">
                      -{formatInr(s.clawbacks)} / {formatInr(s.adjustments)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Final Payable</div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900">{formatInr(s.finalPayableAmount)}</div>
                  </div>
                </div>

                {s.discrepancyNote && (
                  <div className="text-xs text-red-700">{s.discrepancyNote}</div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.reconciliationStatus !== 'Matched' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({ action: 'reconcile_match' }),
                              }),
                            `Matched manufacturer statement for ${s.invoiceNumber}.`
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Resolve & Match Statement
                      </button>
                    )}
                    {s.makerCheckerStage === 'Draft' && s.reconciliationStatus === 'Matched' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({ action: 'maker_submit' }),
                              }),
                            `Maker submitted ${s.invoiceNumber} for Checker approval.`
                          )
                        }
                        className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        Maker Submit
                      </button>
                    )}
                    {s.makerCheckerStage === 'Maker Submitted' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({ action: 'checker_approve' }),
                              }),
                            `Finance Checker approved ${s.invoiceNumber}.`
                          )
                        }
                        className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        Checker Approve
                      </button>
                    )}
                    {s.makerCheckerStage === 'Checker Approved' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({ action: 'generate_payout_file' }),
                              }),
                            `Generated bulk payout file for ${s.invoiceNumber}.`
                          )
                        }
                        className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        Generate Payout File
                      </button>
                    )}
                    {s.makerCheckerStage === 'Payout File Generated' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({ action: 'release_payout' }),
                              }),
                            `Released payout and notified Franchisee.`
                          )
                        }
                        className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        Release Payout & Notify
                      </button>
                    )}
                  </div>

                  {s.makerCheckerStage !== 'Paid' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <input
                        type="number"
                        min={0}
                        placeholder="Clawback INR"
                        value={clawbackForm[s.id]?.clawback || ''}
                        onChange={(e) =>
                          setClawbackForm({
                            ...clawbackForm,
                            [s.id]: { clawback: e.target.value, adj: clawbackForm[s.id]?.adj || '0' },
                          })
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/commissions/statements/${s.id}/action`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  action: 'record_clawback',
                                  clawbackAmount: Number(clawbackForm[s.id]?.clawback || 0),
                                  adjustmentAmount: Number(clawbackForm[s.id]?.adj || 0),
                                }),
                              }),
                            `Recorded clawback/adjustment with audit trail.`
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Apply Clawback
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeNav === 'training' && (
        <div className="space-y-6">
          <SectionHeader
            title="Training Operations (FR-40)"
            subtitle="Lendrixventech is Responsible (R) for module delivery, assessments, and completion tracking; The Company remains Accountable (A)."
            raci={raciMap['Training content and certification']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Module / Refresher</th>
                  <th className="py-2.5 px-3 font-semibold">Completion</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Score</th>
                  <th className="py-2.5 px-3 font-semibold">Certificate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.trainingProgress.map((tp) => (
                  <tr key={tp.id}>
                    <td className="py-3 px-3 font-medium text-slate-900">{tp.franchiseeName}</td>
                    <td className="py-3 px-3 text-slate-700">{tp.moduleTitle}</td>
                    <td className="py-3 px-3"><StatusLabel text={tp.completionStatus} /></td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {tp.assessmentScore !== undefined ? `${tp.assessmentScore}%` : '—'}
                    </td>
                    <td className="py-3 px-3"><StatusLabel text={tp.certificateStatus} /></td>
                    <td className="py-3 px-3 text-right">
                      {tp.completionStatus !== 'Completed' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                apiRequest(token, '/api/training/complete', {
                                  method: 'POST',
                                  body: JSON.stringify({ progressId: tp.id, score: 90 }),
                                }),
                              `Recorded completion & certificate for ${tp.franchiseeName}.`
                            )
                          }
                          className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                        >
                          Record Assessment Pass
                        </button>
                      ) : (
                        <span className="text-slate-400">Completed {tp.completedAt}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'servicedesk' && (
        <div className="space-y-6">
          <SectionHeader
            title="Service Desk Operations (FR-41)"
            subtitle="First-response and resolution SLAs remain Pending Confirmation (Draft placeholders: [4 hours] / [2 working days]). Grievance closure remains Accountable to The Company."
            raci={raciMap['Complaints and grievance handling']}
          />

          <div className="space-y-3">
            {data.tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500 font-mono">
                      {t.id.toUpperCase()} · {t.ticketType} · {t.franchiseeName} · SLA: {t.slaFirstResponse} / {t.slaResolution}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{t.subject}</h3>
                  </div>
                  <StatusLabel text={t.status} />
                </div>
                <p className="text-xs text-slate-600">{t.description}</p>
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  {t.responses.map((r, i) => (
                    <div key={i} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{r.actor}</span> ({r.timestamp}): {r.message}
                    </div>
                  ))}
                </div>
                {t.status !== 'Resolved' && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      placeholder="Operational support response..."
                      value={ticketReply[t.id] || ''}
                      onChange={(e) => setTicketReply({ ...ticketReply, [t.id]: e.target.value })}
                      className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          async () => {
                            await apiRequest(token, `/api/tickets/${t.id}/respond`, {
                              method: 'POST',
                              body: JSON.stringify({
                                message: ticketReply[t.id] || 'Operational response logged.',
                                status: t.ticketType === 'Service Desk' ? 'Resolved' : 'In Review',
                              }),
                            });
                            setTicketReply({ ...ticketReply, [t.id]: '' });
                          },
                          `Updated ticket ${t.id}.`
                        )
                      }
                      className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                    >
                      {t.ticketType === 'Service Desk' ? 'Respond & Resolve' : 'Log Response (Escalate to Company)'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeNav === 'marketing' && (
        <div className="space-y-6">
          <SectionHeader
            title="Marketing and Announcements (FR-42, FR-43)"
            subtitle="Distribute Company-approved assets and product circulars; track Franchisee read acknowledgements. Brand approval remains with The Company."
            raci={raciMap['Marketing and brand control']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Title & Summary</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Company Approval</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Read Acknowledgements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.marketingAssets.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{m.title}</div>
                      <div className="text-slate-500 mt-0.5">{m.summary}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{m.type}</td>
                    <td className="py-3 px-3"><StatusLabel text={m.approvalStatus} /></td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {m.readByFranchiseeIds.length} Franchisees
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                async () => {
                  await apiRequest(token, '/api/marketing', {
                    method: 'POST',
                    body: JSON.stringify(newCircular),
                  });
                  setNewCircular({ title: '', type: 'Product Circular', summary: '' });
                },
                'Submitted item for Company brand & compliance approval.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Draft Product Circular / Announcement (Requires Company Approval)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                required
                placeholder="Circular / Announcement Title"
                value={newCircular.title}
                onChange={(e) => setNewCircular({ ...newCircular, title: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newCircular.type}
                onChange={(e) => setNewCircular({ ...newCircular, type: e.target.value as typeof newCircular.type })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Product Circular">Product Circular</option>
                <option value="Announcement">Announcement</option>
                <option value="Marketing Material">Marketing Material</option>
              </select>
              <input
                required
                placeholder="Summary"
                value={newCircular.summary}
                onChange={(e) => setNewCircular({ ...newCircular, summary: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Submit for Brand Approval
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'reports' && (
        <div className="space-y-6">
          <SectionHeader
            title="Operational Reports"
            subtitle="Documented operational reporting across onboarding, distribution, CRM, commission accrual, reconciliation, clawbacks, statements, payouts, training, and service desk."
            rightAction={
              <button
                type="button"
                onClick={exportOperationalCsv}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            }
          />

          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                'Franchise Onboarding',
                'Product Distribution',
                'Customer and Lead Activity',
                'Commission Accrual',
                'Reconciliation',
                'Clawbacks',
                'Statements',
                'Payouts',
                'Training',
                'Service Desk',
              ] as const
            ).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedOpReport(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  selectedOpReport === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Operational View: {selectedOpReport}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="border border-slate-200 rounded p-3">
                <div className="text-slate-500">Total Records in Scope</div>
                <div className="font-mono text-lg font-semibold text-slate-900 mt-1 tabular-nums">
                  {selectedOpReport === 'Franchise Onboarding'
                    ? data.franchises.length
                    : selectedOpReport === 'Product Distribution' || selectedOpReport === 'Commission Accrual'
                      ? data.transactions.length
                      : selectedOpReport === 'Customer and Lead Activity'
                        ? data.leads.length + data.customers.length
                        : selectedOpReport === 'Training'
                          ? data.trainingProgress.length
                          : selectedOpReport === 'Service Desk'
                            ? data.tickets.length
                            : data.commissionStatements.length}
                </div>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <div className="text-slate-500">Operational SLA Status</div>
                <div className="text-slate-800 font-medium mt-1">
                  {selectedOpReport === 'Service Desk'
                    ? 'Pending Confirmation ([4 hours] / [2 working days] draft)'
                    : 'Timeline Pending Confirmation'}
                </div>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <div className="text-slate-500">RACI Accountability</div>
                <div className="text-slate-800 font-medium mt-1">
                  Lendrixventech (R) · Company (A)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeNav === 'admin' && (
        <div className="space-y-6">
          <SectionHeader
            title="Administration and Audit (FR-51, FR-53)"
            subtitle="Role-based operator directory, periodic access review, and platform audit log."
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Platform Audit Log (FR-53)</h2>
              <span className="text-xs text-slate-500">Retained per regulatory requirement</span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Timestamp</th>
                  <th className="py-2 px-3 font-semibold">Actor</th>
                  <th className="py-2 px-3 font-semibold">Action</th>
                  <th className="py-2 px-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.auditLogs.slice(0, 25).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2 px-3 text-slate-800 whitespace-nowrap">{log.actorName} ({log.actorRole})</td>
                    <td className="py-2 px-3 font-mono text-slate-900 whitespace-nowrap">{log.action}</td>
                    <td className="py-2 px-3 text-slate-600">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
