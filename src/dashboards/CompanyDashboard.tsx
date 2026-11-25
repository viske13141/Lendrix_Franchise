import React, { useMemo, useState } from 'react';
import { Download, Plus, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../api/client';
import { LayoutShell } from '../components/LayoutShell';
import {
  HorizontalBarChart,
  MetricGrid,
  NoticeBanner,
  PendingValue,
  SectionHeader,
  StatusLabel,
  formatInr,
} from '../components/SharedUI';
import {
  DOCUMENTED_FR_PRIORITIES,
  DOCUMENTED_RACI_MATRIX,
  OPEN_DECISIONS,
  TIER_DEFINITIONS,
  type DashboardPayload,
  type FranchiseTier,
  type ProductCategory,
  type UserAccount,
} from '../shared/types';

export function CompanyDashboard({
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

  // Filters & inline form state
  const [franchiseQuery, setFranchiseQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | FranchiseTier>('ALL');
  const [newApp, setNewApp] = useState({ name: '', businessName: '', city: '', region: 'West', tier: 'Starter' as FranchiseTier });
  const [newProduct, setNewProduct] = useState({
    category: 'Mutual Funds' as ProductCategory,
    name: '',
    partnerName: '',
    eligibilityRules: '',
    rateCardSummary: '',
  });
  const [newMarketing, setNewMarketing] = useState({
    title: '',
    type: 'Brand Asset' as 'Brand Asset' | 'Marketing Material' | 'Communication Template' | 'Product Circular',
    summary: '',
  });
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});
  const [ticketStatus, setTicketStatus] = useState<Record<string, 'Open' | 'In Review' | 'Escalated' | 'Resolved'>>({});
  const [timeoutInput, setTimeoutInput] = useState<string>(
    data.securityConfig?.configurableTimeoutMinutes ? String(data.securityConfig.configurableTimeoutMinutes) : ''
  );
  const [selectedReport, setSelectedReport] = useState<
    | 'Franchise Network'
    | 'Franchise Activation'
    | 'Sales'
    | 'AUM'
    | 'Loan Disbursals'
    | 'Insurance Premiums'
    | 'Franchisee Churn'
    | 'Commission by Product'
  >('Franchise Network');

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
      setFeedback({ tone: 'danger', msg: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  }

  const filteredFranchises = useMemo(() => {
    return data.franchises.filter((f) => {
      if (tierFilter !== 'ALL' && f.tier !== tierFilter) return false;
      const q = franchiseQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        f.franchiseeCode.toLowerCase().includes(q) ||
        f.businessName.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q)
      );
    });
  }, [data.franchises, franchiseQuery, tierFilter]);

  function exportReportCsv() {
    const headers = ['Code', 'Business Name', 'Tier', 'Status', 'Activation', 'Certification', 'Suspension'];
    const rows = data.franchises.map((f) => [
      f.franchiseeCode,
      f.businessName,
      f.tier,
      f.onboardingStatus,
      f.platformActivationStatus,
      f.certificationStatus,
      f.suspensionStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company-report-${selectedReport.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const user: UserAccount = data.user;

  return (
    <LayoutShell
      user={user}
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
          title={feedback.tone === 'danger' ? 'Action Blocked' : 'Updated'}
          message={feedback.msg}
        />
      )}

      {activeNav === 'overview' && (
        <div className="space-y-6">
          <SectionHeader
            title="Company Management Overview"
            subtitle="Franchisor & Product Provider governance across network size, activation, product volume, churn, and commission (FR-50)."
          />

          <MetricGrid
            items={[
              {
                label: 'Franchise Count',
                value: String(data.fr50Summary.franchiseCount),
                note: 'Total registered franchise records',
              },
              {
                label: 'Franchise Activation',
                value: `${data.fr50Summary.franchiseActivationCount} (${data.fr50Summary.activeFranchiseRatioPct}%)`,
                note: 'Activated & non-suspended',
              },
              {
                label: 'Sales',
                value: formatInr(data.fr50Summary.totalSalesVolume),
                note: 'Recorded non-rejected transactions',
              },
              {
                label: 'AUM',
                value: formatInr(data.fr50Summary.totalAum),
                note: 'Mutual Funds & Venture Capital Services',
              },
            ]}
          />

          <MetricGrid
            items={[
              {
                label: 'Loan Disbursals',
                value: formatInr(data.fr50Summary.totalLoanDisbursals),
                note: 'Disbursed partner loan volume',
              },
              {
                label: 'Insurance Premiums',
                value: formatInr(data.fr50Summary.totalInsurancePremiums),
                note: 'Issued policy premium volume',
              },
              {
                label: 'Franchisee Churn',
                value: String(data.fr50Summary.franchiseeChurnCount),
                note: 'Suspended or exit initiated',
              },
              {
                label: 'Commission by Product',
                value: formatInr(
                  data.fr50Summary.commissionByProduct.reduce((sum, item) => sum + item.amount, 0)
                ),
                note: 'Commercial split % Pending Confirmation',
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizontalBarChart
              title="Commission by Product (FR-50)"
              subtitle="Accrued gross commission across documented product lines"
              rows={data.fr50Summary.commissionByProduct.map((c) => ({
                label: c.category,
                value: c.amount,
              }))}
            />

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Franchisor Governance & Compliance Snapshot
                  </h2>
                  <p className="text-xs text-slate-500">
                    Supporting operational indicators (supplemental to mandatory FR-50 metrics)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectNav('compliance')}
                  className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                >
                  Open Compliance & Licences
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-600">Verified Regulatory Licences</span>
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    {data.licences.filter((l) => l.verificationStatus === 'Verified').length} / {data.licences.length}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-600">Blocked Product Licences (Expired / Unverified / Missing)</span>
                  <span className="font-mono font-semibold text-red-700 tabular-nums">
                    {data.licences.filter((l) => l.verificationStatus !== 'Verified').length}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-600">Marketing Assets Pending Brand Sign-Off</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {data.marketingAssets.filter((m) => m.approvalStatus === 'Pending Company Approval').length}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-600">Open / Escalated Grievances (Company Accountable)</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {data.tickets.filter((t) => t.ticketType === 'Complaint / Grievance' && t.status !== 'Resolved').length}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-600">Product Shelf Offerings Active</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {data.products.filter((p) => p.availabilityStatus !== 'Inactive').length} / {data.products.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Documented Open Commercial & Legal Decisions (Section 16)
              </h2>
              <PendingValue label="7 Open Items" />
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 list-decimal pl-4">
              {OPEN_DECISIONS.map((item) => (
                <li key={item} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ol>
          </div>

          <NoticeBanner
            tone="info"
            title="Customer Data Boundary"
            message={data.customerVisibilityNote}
          />
        </div>
      )}

      {activeNav === 'franchises' && (
        <div className="space-y-6">
          <SectionHeader
            title="Franchise Management"
            subtitle="Franchisee applications, eligibility screening, KYC/KYB verification, tier assignment, activation, and suspension/exit oversight."
            raci={raciMap['Franchisee KYC and onboarding']}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={franchiseQuery}
              onChange={(e) => setFranchiseQuery(e.target.value)}
              placeholder="Search code, business, owner, or city..."
              className="w-full sm:w-72 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
            />
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['ALL', 'Starter', 'Professional', 'Premier'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    tierFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? 'All Tiers' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Tier</th>
                  <th className="py-2.5 px-3 font-semibold">Screening & KYC/KYB</th>
                  <th className="py-2.5 px-3 font-semibold">Agreement & Fee</th>
                  <th className="py-2.5 px-3 font-semibold">Licence & Cert</th>
                  <th className="py-2.5 px-3 font-semibold">Platform & Exit</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Company Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredFranchises.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">{f.franchiseeCode}</div>
                      <div className="font-medium text-slate-900">{f.businessName}</div>
                      <div className="text-slate-500">{f.name} · {f.city}</div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <select
                        aria-label={`Tier for ${f.franchiseeCode}`}
                        value={f.tier}
                        disabled={busy}
                        onChange={(e) =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                method: 'PATCH',
                                body: JSON.stringify({ action: 'change_tier', tier: e.target.value }),
                              }),
                            `Updated ${f.franchiseeCode} tier to ${e.target.value}.`
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      >
                        <option value="Starter">Starter</option>
                        <option value="Professional">Professional</option>
                        <option value="Premier">Premier</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div>Eligibility: <StatusLabel text={f.eligibilityStatus} /></div>
                      <div>KYC/KYB: <StatusLabel text={f.kycKybStatus} /></div>
                      <div>Business: <StatusLabel text={f.businessVerificationStatus} /></div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div><StatusLabel text={f.agreementStatus} /></div>
                      <div className="text-slate-500">Fee: {f.feePaymentStatus}</div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div>Licences: <StatusLabel text={f.licenceSummaryStatus} /></div>
                      <div>Cert: <StatusLabel text={f.certificationStatus} /></div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div><StatusLabel text={f.platformActivationStatus} /></div>
                      <div className="text-slate-500">Exit: {f.exitStatus}</div>
                      {f.suspensionReason && (
                        <div className="text-red-700 max-w-xs">{f.suspensionReason}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top text-right space-y-1.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {f.kycKybStatus !== 'Verified' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ action: 'approve_kyc' }),
                                  }),
                                `Approved KYC/KYB for ${f.franchiseeCode}.`
                              )
                            }
                            className="rounded border border-blue-700 bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                          >
                            Approve KYC/KYB
                          </button>
                        )}
                        {f.suspensionStatus === 'None' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      action: 'suspend',
                                      suspensionReason: 'Company compliance suspension',
                                    }),
                                  }),
                                `Suspended ${f.franchiseeCode}.`
                              )
                            }
                            className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/franchises/${f.id}/manage`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ action: 'reinstate' }),
                                  }),
                                `Reinstated ${f.franchiseeCode}.`
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
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
                  await apiRequest(token, '/api/franchises', {
                    method: 'POST',
                    body: JSON.stringify(newApp),
                  });
                  setNewApp({ name: '', businessName: '', city: '', region: 'West', tier: 'Starter' });
                },
                'Franchise application created.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-900">Record New Franchise Application (FR-01)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                required
                placeholder="Applicant Name"
                value={newApp.name}
                onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Business / Firm Name"
                value={newApp.businessName}
                onChange={(e) => setNewApp({ ...newApp, businessName: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                required
                placeholder="City"
                value={newApp.city}
                onChange={(e) => setNewApp({ ...newApp, city: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newApp.tier}
                onChange={(e) => setNewApp({ ...newApp, tier: e.target.value as FranchiseTier })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Starter">Starter</option>
                <option value="Professional">Professional</option>
                <option value="Premier">Premier</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Application</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'agreements' && (
        <div className="space-y-6">
          <SectionHeader
            title="Franchise Agreement Management"
            subtitle="Agreement records, digital signing status, and fee payment status. Signing authority remains Pending Confirmation per Section 16."
            raci={raciMap['Franchise sales and agreements']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Code & Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Agreement Document</th>
                  <th className="py-2.5 px-3 font-semibold">Digital Status</th>
                  <th className="py-2.5 px-3 font-semibold">Signing Authority</th>
                  <th className="py-2.5 px-3 font-semibold">Franchise & Platform Fees</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.agreements.map((agr) => (
                  <tr key={agr.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-900">{agr.franchiseeCode}</div>
                      <div className="text-slate-600">{agr.franchiseeName}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-800">{agr.documentTitle}</td>
                    <td className="py-3 px-3"><StatusLabel text={agr.digitalStatus} /></td>
                    <td className="py-3 px-3"><PendingValue label={agr.signingAuthority} /></td>
                    <td className="py-3 px-3 space-y-0.5">
                      <div>One-time Fee: <span className="text-amber-700 font-medium">{agr.franchiseFeeStatus}</span></div>
                      <div>Recurring Fee: <span className="text-amber-700 font-medium">{agr.recurringFeeStatus}</span></div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {agr.digitalStatus !== 'Digitally Signed' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                apiRequest(token, `/api/franchises/${agr.franchiseeId}/manage`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ action: 'issue_or_sign_agreement' }),
                                }),
                              `Updated digital agreement status for ${agr.franchiseeCode}.`
                            )
                          }
                          className="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                        >
                          {agr.digitalStatus === 'Not Issued' ? 'Issue Digital Agreement' : 'Record Digital Signature'}
                        </button>
                      ) : (
                        <span className="text-slate-400">Executed · {agr.updatedAt}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'products' && (
        <div className="space-y-6">
          <SectionHeader
            title="Product Catalogue Management (FR-10)"
            subtitle="The Company owns and controls the five documented product lines, partner details, eligibility rules, required documents, and rate cards."
            raci={raciMap['Product shelf and partner contracts']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Category & Product</th>
                  <th className="py-2.5 px-3 font-semibold">Partner Details</th>
                  <th className="py-2.5 px-3 font-semibold">Eligibility & Documents</th>
                  <th className="py-2.5 px-3 font-semibold">Rate Card / Basis</th>
                  <th className="py-2.5 px-3 font-semibold">Availability</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 align-top">
                      <div className="font-semibold text-slate-900">{p.category}</div>
                      <div className="text-slate-700 mt-0.5">{p.name}</div>
                    </td>
                    <td className="py-3 px-3 align-top text-slate-700">{p.partnerName}</td>
                    <td className="py-3 px-3 align-top space-y-1 max-w-xs">
                      <div className="text-slate-700">{p.eligibilityRules}</div>
                      <div className="text-slate-500">Docs: {p.requiredDocuments.join(' · ')}</div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-xs">
                      <div className="text-slate-700">{p.rateCardSummary}</div>
                      <div className="text-slate-500 mt-0.5">{p.commissionBasis}</div>
                    </td>
                    <td className="py-3 px-3 align-top"><StatusLabel text={p.availabilityStatus} /></td>
                    <td className="py-3 px-3 align-top text-right">
                      <select
                        aria-label={`Availability for ${p.name}`}
                        value={p.availabilityStatus}
                        disabled={busy}
                        onChange={(e) =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/products/${p.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ availabilityStatus: e.target.value }),
                              }),
                            `Updated ${p.name} availability to ${e.target.value}.`
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="Available">Available</option>
                        <option value="Restricted">Restricted</option>
                        <option value="Inactive">Inactive</option>
                      </select>
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
                  await apiRequest(token, '/api/products', {
                    method: 'POST',
                    body: JSON.stringify(newProduct),
                  });
                  setNewProduct({
                    category: 'Mutual Funds',
                    name: '',
                    partnerName: '',
                    eligibilityRules: '',
                    rateCardSummary: '',
                  });
                },
                'Added product to Company catalogue.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-900">Add Shelf Offering</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as ProductCategory })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Mutual Funds">Mutual Funds</option>
                <option value="Loans">Loans</option>
                <option value="Insurance">Insurance</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Venture Capital Services">Venture Capital Services</option>
              </select>
              <input
                required
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                required
                placeholder="Manufacturer / Partner"
                value={newProduct.partnerName}
                onChange={(e) => setNewProduct({ ...newProduct, partnerName: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                placeholder="Eligibility Rules"
                value={newProduct.eligibilityRules}
                onChange={(e) => setNewProduct({ ...newProduct, eligibilityRules: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Add to Shelf
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'tiers' && (
        <div className="space-y-6">
          <SectionHeader
            title="Franchise Tier Management (FR-04)"
            subtitle="Documented three-tier product unlock structure. Fees remain Pending Confirmation per Section 4.1."
            raci={raciMap['Franchise sales and agreements']}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIER_DEFINITIONS.map((t) => {
              const count = data.franchises.filter((f) => f.tier === t.tier).length;
              return (
                <div key={t.tier} className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900">{t.tier}</h2>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">{count} Franchisees</span>
                    </div>
                    <p className="text-xs text-slate-600">{t.intendedFor}</p>
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="text-xs font-medium text-slate-700">Products Unlocked</div>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {t.productsUnlocked.map((prod) => (
                          <li key={prod}>· {prod}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Franchise Fee</span>
                      <PendingValue label={t.franchiseFee} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monthly Platform Fee</span>
                      <PendingValue label={t.monthlyPlatformFee} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeNav === 'compliance' && (
        <div className="space-y-6">
          <SectionHeader
            title="Compliance and Licence Oversight (FR-05)"
            subtitle="Product distribution is automatically blocked when a required licence is missing, expired, or unverified."
            raci={raciMap['Regulatory licences of Franchisee']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold">Product Line</th>
                  <th className="py-2.5 px-3 font-semibold">Licence Category & Jurisdiction</th>
                  <th className="py-2.5 px-3 font-semibold">Reg. Number</th>
                  <th className="py-2.5 px-3 font-semibold">Expiry Date</th>
                  <th className="py-2.5 px-3 font-semibold">Status & Distribution Gate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Company Verification (A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.licences.map((lic) => {
                  const blocked = lic.verificationStatus !== 'Verified';
                  return (
                    <tr key={lic.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-medium text-slate-900">{lic.franchiseeName}</td>
                      <td className="py-3 px-3 text-slate-700">{lic.productCategory}</td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700">{lic.licenceType}</div>
                        <div className="text-amber-700">{lic.jurisdictionScope}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800">{lic.registrationNumber}</td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-600">{lic.expiryDate}</td>
                      <td className="py-3 px-3 space-y-0.5">
                        <div><StatusLabel text={lic.verificationStatus} /></div>
                        <div className={`text-xs ${blocked ? 'text-red-700 font-medium' : 'text-slate-500'}`}>
                          {blocked ? 'Product Distribution Blocked' : 'Eligible for Tier Distribution'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex gap-1.5">
                          {lic.verificationStatus !== 'Verified' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiRequest(token, `/api/licences/${lic.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ verificationStatus: 'Verified' }),
                                    }),
                                  `Verified ${lic.licenceType} for ${lic.franchiseeName}.`
                                )
                              }
                              className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                            >
                              Verify
                            </button>
                          )}
                          {lic.verificationStatus === 'Verified' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiRequest(token, `/api/licences/${lic.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ verificationStatus: 'Expired' }),
                                    }),
                                  `Marked ${lic.licenceType} expired; product blocked per FR-05.`
                                )
                              }
                              className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                            >
                              Mark Expired
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'commissions' && (
        <div className="space-y-6">
          <SectionHeader
            title="Commission Oversight"
            subtitle="The Company is Accountable (A) for commission calculation and payout. Commercial split percentages and manufacturer commission recipient remain Pending Confirmation."
            raci={raciMap['Commission calculation and payout']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Commission Rule Schema (FR-30)</h2>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Product</th>
                  <th className="py-2.5 px-3 font-semibold">Tier</th>
                  <th className="py-2.5 px-3 font-semibold">Company %</th>
                  <th className="py-2.5 px-3 font-semibold">Lendrixventech %</th>
                  <th className="py-2.5 px-3 font-semibold">Franchisee %</th>
                  <th className="py-2.5 px-3 font-semibold">Manufacturer Recipient</th>
                  <th className="py-2.5 px-3 font-semibold">Clawback Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.commissionRules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{r.productCategory}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.tier}</td>
                    <td className="py-2.5 px-3"><PendingValue label={r.companySharePct} /></td>
                    <td className="py-2.5 px-3"><PendingValue label={r.lendrixSharePct} /></td>
                    <td className="py-2.5 px-3"><PendingValue label={r.franchiseeSharePct} /></td>
                    <td className="py-2.5 px-3"><PendingValue label={r.manufacturerRecipient} /></td>
                    <td className="py-2.5 px-3 text-slate-600">{r.clawbackWindow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Statements, Reconciliation, Clawbacks & Payout Status</h2>
              <span className="text-xs text-slate-500">Illustrative baseline amounts; commercial split % and payout dates remain Pending Confirmation</span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Invoice & Period</th>
                  <th className="py-2.5 px-3 font-semibold">Franchisee</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Clawbacks / Adj</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Final Payable</th>
                  <th className="py-2.5 px-3 font-semibold">Reconciliation</th>
                  <th className="py-2.5 px-3 font-semibold">Payout Stage & Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.commissionStatements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-900">{s.invoiceNumber}</div>
                      <div className="text-slate-500">{s.periodLabel}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-800">{s.franchiseeName}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{formatInr(s.grossManufacturerCommission)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      -{formatInr(s.clawbacks)} / {formatInr(s.adjustments)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatInr(s.finalPayableAmount)}
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <StatusLabel text={s.reconciliationStatus} />
                      {s.discrepancyNote && <div className="text-red-700 max-w-xs">{s.discrepancyNote}</div>}
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <StatusLabel text={s.makerCheckerStage} />
                      <div className="text-slate-500">Payout Date: {s.payoutDate}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'training' && (
        <div className="space-y-6">
          <SectionHeader
            title="Training and Certification Oversight (FR-40)"
            subtitle="The Company is Accountable (A) for training content and certification standards; Lendrixventech is Responsible (R) for delivery."
            raci={raciMap['Training content and certification']}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Approved Training Content & Modules</h2>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Module</th>
                    <th className="py-2 px-3 font-semibold">Type</th>
                    <th className="py-2 px-3 font-semibold text-right">Pass Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.trainingModules.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{m.title}</div>
                        <div className="text-slate-500">{m.category} · {m.duration}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {m.isRefresher ? 'Compliance Refresher' : 'Core Certification'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{m.passScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Franchisee Completion & Certification Records</h2>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Franchisee</th>
                    <th className="py-2 px-3 font-semibold">Module</th>
                    <th className="py-2 px-3 font-semibold">Completion</th>
                    <th className="py-2 px-3 font-semibold">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.trainingProgress.map((tp) => (
                    <tr key={tp.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{tp.franchiseeName}</td>
                      <td className="py-2.5 px-3 text-slate-700">{tp.moduleTitle}</td>
                      <td className="py-2.5 px-3"><StatusLabel text={tp.completionStatus} /></td>
                      <td className="py-2.5 px-3"><StatusLabel text={tp.certificateStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeNav === 'complaints' && (
        <div className="space-y-6">
          <SectionHeader
            title="Complaints and Grievances"
            subtitle="Company is Accountable (A) for resolution; Lendrixventech and Franchisee are Responsible (R) for operational & local handling."
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
                <div className="border-t border-slate-100 pt-2 space-y-1.5">
                  {t.responses.map((r, idx) => (
                    <div key={idx} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{r.actor}</span> ({r.timestamp}): {r.message}
                    </div>
                  ))}
                </div>
                {t.status !== 'Resolved' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      placeholder="Add response or resolution note..."
                      value={ticketReply[t.id] || ''}
                      onChange={(e) => setTicketReply({ ...ticketReply, [t.id]: e.target.value })}
                      className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <select
                      aria-label={`Ticket status for ${t.id}`}
                      value={ticketStatus[t.id] || t.status}
                      onChange={(e) =>
                        setTicketStatus({
                          ...ticketStatus,
                          [t.id]: e.target.value as 'Open' | 'In Review' | 'Escalated' | 'Resolved',
                        })
                      }
                      className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="Open">Open</option>
                      <option value="In Review">In Review</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const targetStatus = ticketStatus[t.id] || 'In Review';
                        runAction(
                          async () => {
                            await apiRequest(token, `/api/tickets/${t.id}/respond`, {
                              method: 'POST',
                              body: JSON.stringify({
                                message: ticketReply[t.id] || `Status updated to ${targetStatus}.`,
                                status: targetStatus,
                              }),
                            });
                            setTicketReply({ ...ticketReply, [t.id]: '' });
                          },
                          `Updated ticket ${t.id} to ${targetStatus}.`
                        );
                      }}
                      className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                    >
                      Update Ticket
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
            title="Marketing and Brand Control (FR-42, FR-43)"
            subtitle="The Company retains brand control (A/R). Only compliance-checked, Company-approved assets are released to Franchisees."
            raci={raciMap['Marketing and brand control']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Asset / Template</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Compliance Check</th>
                  <th className="py-2.5 px-3 font-semibold">Brand Approval</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Company Control</th>
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
                    <td className="py-3 px-3">
                      <StatusLabel text={m.complianceChecked ? 'Verified' : 'Pending'} />
                    </td>
                    <td className="py-3 px-3"><StatusLabel text={m.approvalStatus} /></td>
                    <td className="py-3 px-3 text-right">
                      {m.approvalStatus === 'Pending Company Approval' ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/marketing/${m.id}/approve`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ approve: true }),
                                  }),
                                `Approved marketing asset: ${m.title}.`
                              )
                            }
                            className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/marketing/${m.id}/approve`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ approve: false }),
                                  }),
                                `Rejected marketing asset: ${m.title}.`
                              )
                            }
                            className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500">{m.approvedBy}</span>
                      )}
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
                    body: JSON.stringify(newMarketing),
                  });
                  setNewMarketing({ title: '', type: 'Brand Asset', summary: '' });
                },
                'Published compliance-checked brand material.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Publish Approved Brand Material / Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                required
                placeholder="Asset Title"
                value={newMarketing.title}
                onChange={(e) => setNewMarketing({ ...newMarketing, title: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newMarketing.type}
                onChange={(e) =>
                  setNewMarketing({
                    ...newMarketing,
                    type: e.target.value as typeof newMarketing.type,
                  })
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Brand Asset">Brand Asset</option>
                <option value="Marketing Material">Marketing Material</option>
                <option value="Communication Template">Communication Template</option>
                <option value="Product Circular">Product Circular</option>
              </select>
              <input
                required
                placeholder="Compliance Summary"
                value={newMarketing.summary}
                onChange={(e) => setNewMarketing({ ...newMarketing, summary: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Approve & Publish
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'reports' && (
        <div className="space-y-6">
          <SectionHeader
            title="Management Reports (FR-50)"
            subtitle="Standardized management reporting across the eight documented metrics."
            rightAction={
              <button
                type="button"
                onClick={exportReportCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            }
          />

          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
            {(
              [
                'Franchise Network',
                'Franchise Activation',
                'Sales',
                'AUM',
                'Loan Disbursals',
                'Insurance Premiums',
                'Franchisee Churn',
                'Commission by Product',
              ] as const
            ).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedReport(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedReport === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Report: {selectedReport}</h2>
            {selectedReport === 'Commission by Product' ? (
              <HorizontalBarChart
                title="Commission Breakdown by Product Line"
                rows={data.fr50Summary.commissionByProduct.map((c) => ({
                  label: c.category,
                  value: c.amount,
                }))}
              />
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Franchisee</th>
                    <th className="py-2 px-3 font-semibold">Tier</th>
                    <th className="py-2 px-3 font-semibold">Activation</th>
                    <th className="py-2 px-3 font-semibold">Churn / Exit</th>
                    <th className="py-2 px-3 font-semibold text-right">Recorded Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.franchises.map((f) => {
                    const vol = data.transactions
                      .filter((t) => t.franchiseeId === f.id)
                      .filter((t) => {
                        if (selectedReport === 'AUM') {
                          return t.productCategory === 'Mutual Funds' || t.productCategory === 'Venture Capital Services';
                        }
                        if (selectedReport === 'Loan Disbursals') {
                          return t.productCategory === 'Loans' && t.manufacturerStatus === 'Disbursed';
                        }
                        if (selectedReport === 'Insurance Premiums') {
                          return t.productCategory === 'Insurance';
                        }
                        return true;
                      })
                      .reduce((sum, t) => sum + t.amount, 0);
                    return (
                      <tr key={f.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {f.franchiseeCode} · {f.businessName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{f.tier}</td>
                        <td className="py-2.5 px-3"><StatusLabel text={f.platformActivationStatus} /></td>
                        <td className="py-2.5 px-3"><StatusLabel text={f.exitStatus} /></td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatInr(vol)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeNav === 'admin' && (
        <div className="space-y-6">
          <SectionHeader
            title="Administration and Audit (FR-51, FR-53)"
            subtitle="Role-based access reviews, documented RACI matrix, functional requirement priorities (M/S/C), and immutable audit trail."
            rightAction={
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => apiRequest(token, '/api/admin/access-review', { method: 'POST' }),
                    'Recorded periodic access review across platform accounts.'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Complete Periodic Access Review</span>
              </button>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">
                Security, MFA & Configurable Session Timeout (Section 10)
              </h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">MFA Mode</span>
                  <span className="font-medium text-slate-900">{data.securityConfig.mfaVerificationMode}</span>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">External MFA / Authenticator Provider</span>
                  <StatusLabel text={data.securityConfig.mfaIntegrationStatus} tone="warning" />
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <span className="text-slate-600">Session Timeout Policy</span>
                  <PendingValue
                    label={
                      data.securityConfig.configurableTimeoutMinutes
                        ? `Configured: ${data.securityConfig.configurableTimeoutMinutes} mins (Policy Pending Confirmation)`
                        : data.securityConfig.sessionTimeoutPolicy
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="number"
                  min={5}
                  max={240}
                  placeholder="Minutes (5-240)"
                  value={timeoutInput}
                  onChange={(e) => setTimeoutInput(e.target.value)}
                  className="w-36 rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () =>
                        apiRequest(token, '/api/admin/security-config', {
                          method: 'PATCH',
                          body: JSON.stringify({
                            configurableTimeoutMinutes: timeoutInput.trim() ? Number(timeoutInput) : null,
                          }),
                        }),
                      'Updated configurable session timeout parameter.'
                    )
                  }
                  className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  Apply Timeout
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setTimeoutInput('');
                    runAction(
                      () =>
                        apiRequest(token, '/api/admin/security-config', {
                          method: 'PATCH',
                          body: JSON.stringify({ configurableTimeoutMinutes: null }),
                        }),
                      'Reset session timeout parameter to Pending Confirmation.'
                    );
                  }}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Set Pending
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">
                Configurable Maker-Checker Assignments (FR-51)
              </h2>
              <p className="text-slate-500">
                Maker and Checker remain distinct actors for payout approval without fixed named business titles.
              </p>
              <div className="divide-y divide-slate-100">
                {data.staffAccounts
                  .filter((u) => u.role === 'LENDRIXVENTECH')
                  .map((op) => (
                    <div key={op.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{op.name}</div>
                        <div className="font-mono text-slate-500">{op.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={Boolean(op.makerCheckerRole?.canActAsMaker)}
                            onChange={(e) =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/admin/users/${op.id}/maker-checker`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      canActAsMaker: e.target.checked,
                                      canActAsChecker: Boolean(op.makerCheckerRole?.canActAsChecker),
                                    }),
                                  }),
                                `Updated Maker role for ${op.name}.`
                              )
                            }
                          />
                          <span>Maker</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={Boolean(op.makerCheckerRole?.canActAsChecker)}
                            onChange={(e) =>
                              runAction(
                                () =>
                                  apiRequest(token, `/api/admin/users/${op.id}/maker-checker`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      canActAsMaker: Boolean(op.makerCheckerRole?.canActAsMaker),
                                      canActAsChecker: e.target.checked,
                                    }),
                                  }),
                                `Updated Checker role for ${op.name}.`
                              )
                            }
                          />
                          <span>Checker</span>
                        </label>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Documented RACI Matrix (Section 8)</h2>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Activity</th>
                    <th className="py-2 px-3 font-semibold">Company</th>
                    <th className="py-2 px-3 font-semibold">Lendrixventech</th>
                    <th className="py-2 px-3 font-semibold">Franchisee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {DOCUMENTED_RACI_MATRIX.map((r) => (
                    <tr key={r.activity}>
                      <td className="py-2 px-3 font-medium text-slate-800">{r.activity}</td>
                      <td className="py-2 px-3 font-mono">{r.company}</td>
                      <td className="py-2 px-3 font-mono">{r.lendrixventech}</td>
                      <td className="py-2 px-3 font-mono">{r.franchisee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Functional Priorities (M / S / C)</h2>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 sticky top-0">
                      <th className="py-2 px-3 font-semibold">ID</th>
                      <th className="py-2 px-3 font-semibold">Priority</th>
                      <th className="py-2 px-3 font-semibold">Requirement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {DOCUMENTED_FR_PRIORITIES.map((fr) => (
                      <tr key={fr.id}>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{fr.id}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {fr.priority === 'M' ? 'Must Have' : fr.priority === 'S' ? 'Should Have' : 'Could Have'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{fr.requirement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Audit Log (FR-53)</h2>
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
