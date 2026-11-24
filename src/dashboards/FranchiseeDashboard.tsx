import React, { useMemo, useState } from 'react';
import { Check, Lock, Plus } from 'lucide-react';
import { apiRequest } from '../api/client';
import { LayoutShell } from '../components/LayoutShell';
import {
  EmptyState,
  MetricGrid,
  NoticeBanner,
  PendingValue,
  SectionHeader,
  StatusLabel,
  formatInr,
} from '../components/SharedUI';
import {
  DOCUMENTED_RACI_MATRIX,
  TIER_PRODUCTS,
  type DashboardPayload,
  type ProductCategory,
} from '../shared/types';

const SALES_LIFECYCLE_STEPS = [
  '1. Lead enters the platform (Franchisee, campaign or referral)',
  '2. Complete customer KYC, risk profile and needs analysis',
  '3. Suitable product recommended and reason recorded',
  '4. Application or order submitted to manufacturer',
  '5. Manufacturer approves, issues or executes; status syncs',
  '6. Transaction marked eligible; commission accrues',
  '7. Post-sale service: renewals, top-ups, SIP tracking, repayments',
];

const ALL_CATEGORIES: ProductCategory[] = [
  'Mutual Funds',
  'Loans',
  'Insurance',
  'Real Estate',
  'Venture Capital Services',
];

export function FranchiseeDashboard({
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

  const franchisee = data.franchises[0];
  const raciMap = useMemo(
    () => Object.fromEntries(DOCUMENTED_RACI_MATRIX.map((r) => [r.activity, r])),
    []
  );

  // Forms state
  const [newLead, setNewLead] = useState({
    customerName: '',
    source: 'Manual' as 'Manual' | 'Campaign' | 'Referral',
    territory: franchisee?.city || 'Mumbai',
    productInterest: 'Mutual Funds' as ProductCategory,
    assignToStaffId: '',
  });
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    city: franchisee?.city || 'Mumbai',
    panMasked: '',
    kycVerified: true,
    riskProfile: 'Moderate' as 'Conservative' | 'Moderate' | 'Aggressive' | 'Accredited / HNI',
    needsAnalysis: '',
    recommendedProduct: '',
    recommendationReason: '',
    consentGiven: true,
    sms: true,
    email: true,
    whatsapp: false,
  });
  const [followUpNote, setFollowUpNote] = useState<Record<string, string>>({});
  const [orderForm, setOrderForm] = useState({
    productCategory: 'Mutual Funds' as ProductCategory,
    customerId: data.customers[0]?.id || '',
    productName: '',
    amount: '',
    workflowSummary: '',
    vcEligibilityConfirmed: false,
    vcSuitabilityConfirmed: false,
  });
  const [servicingNote, setServicingNote] = useState<Record<string, string>>({});
  const [newTicket, setNewTicket] = useState({
    ticketType: 'Service Desk' as 'Service Desk' | 'Complaint / Grievance',
    category: 'Operational Query',
    subject: '',
    description: '',
  });
  const [renewalReg, setRenewalReg] = useState<Record<string, { reg: string; expiry: string }>>({});

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

  const productAccess = useMemo(() => {
    if (!franchisee) return [];
    const tierAllowed = TIER_PRODUCTS[franchisee.tier];
    return ALL_CATEGORIES.map((category) => {
      const inTier = tierAllowed.includes(category);
      const lic = data.licences.find((l) => l.productCategory === category);
      if (franchisee.suspensionStatus === 'Suspended') {
        return { category, unlocked: false, reason: 'Platform access suspended.' };
      }
      if (!inTier) {
        return { category, unlocked: false, reason: `Requires upgrade beyond ${franchisee.tier} tier (FR-04).` };
      }
      if (category === 'Venture Capital Services' && !franchisee.vcApprovedUser) {
        return { category, unlocked: false, reason: 'Restricted to Premier-tier approved users (FR-15).' };
      }
      if (!lic) {
        return { category, unlocked: false, reason: 'Required regulatory licence is Missing (FR-05).' };
      }
      if (lic.verificationStatus !== 'Verified') {
        return {
          category,
          unlocked: false,
          reason: `Blocked: ${lic.licenceType} is ${lic.verificationStatus} (FR-05).`,
        };
      }
      return { category, unlocked: true, reason: `Verified (${lic.registrationNumber})` };
    });
  }, [franchisee, data.licences]);

  const availableProductsCount = productAccess.filter((p) => p.unlocked).length;
  const totalPayableEarned = data.commissionStatements.reduce((s, c) => s + c.finalPayableAmount, 0);

  if (!franchisee) {
    return (
      <LayoutShell
        user={data.user}
        activeNavId={activeNav}
        onSelectNav={onSelectNav}
        sessionExpiresAt={data.sessionExpiresAt}
        onLogout={onLogout}
        onSimulateTimeout={onSimulateTimeout}
      >
        <EmptyState title="Franchisee Profile Unavailable" description="No Franchisee record linked to this session." />
      </LayoutShell>
    );
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
          title={feedback.tone === 'danger' ? 'Action Blocked' : 'Updated'}
          message={feedback.msg}
        />
      )}

      {franchisee.suspensionStatus === 'Suspended' && (
        <NoticeBanner
          tone="danger"
          title="Franchisee Account Suspended"
          message={`${franchisee.suspensionReason || 'Access restricted.'} Pending servicing count: ${franchisee.pendingCustomerServicingCount}.`}
        />
      )}

      {activeNav === 'overview' && (
        <div className="space-y-6">
          <SectionHeader
            title={`${franchisee.businessName} — Practice Overview`}
            subtitle={`Franchisee ID: ${franchisee.franchiseeCode} · Tier: ${franchisee.tier} · RM: ${franchisee.relationshipManager} · Certification: ${franchisee.certificationStatus}`}
            rightAction={
              <button
                type="button"
                onClick={() => onSelectNav('products')}
                className="rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                New Product Application
              </button>
            }
          />

          <MetricGrid
            items={[
              {
                label: 'Franchisee ID & Tier',
                value: `${franchisee.franchiseeCode} · ${franchisee.tier}`,
                note: `Onboarding: ${franchisee.onboardingStatus}`,
              },
              {
                label: 'Eligible Product Lines',
                value: `${availableProductsCount} / 5 Active`,
                note: `Licence posture: ${franchisee.licenceSummaryStatus}`,
              },
              {
                label: 'My Leads & Serving Customers',
                value: `${data.leads.length} Leads · ${data.customers.length} Customers`,
                note: 'Isolated to your practice',
              },
              {
                label: 'Recorded Net Commission',
                value: formatInr(totalPayableEarned),
                note: 'Own statements only · Payout date Pending Confirmation',
              },
            ]}
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                My Product Distribution Gate (Tier FR-04 & Licence FR-05)
              </h2>
              <button
                type="button"
                onClick={() => onSelectNav('compliance')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Manage Licences
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {productAccess.map((pa) => (
                <div
                  key={pa.category}
                  className={`rounded-lg border p-3.5 space-y-2 text-xs ${
                    pa.unlocked ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50/40'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{pa.category}</div>
                  <StatusLabel text={pa.unlocked ? 'Unlocked' : 'Blocked'} tone={pa.unlocked ? 'nominal' : 'danger'} />
                  <div className={pa.unlocked ? 'text-slate-500' : 'text-red-700'}>{pa.reason}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Post-Sale Servicing & Customer Follow-Ups</h2>
                <button
                  type="button"
                  onClick={() => onSelectNav('transactions')}
                  className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                >
                  View All Transactions
                </button>
              </div>
              {data.transactions.length === 0 ? (
                <p className="text-xs text-slate-500">No active customer transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {data.transactions.slice(0, 4).map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {t.customerName} · {t.productCategory}
                        </div>
                        <div className="text-slate-500 truncate">
                          {t.postSaleServicing.type}: {t.postSaleServicing.status}
                        </div>
                      </div>
                      <span className="font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {t.postSaleServicing.nextDate}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Training, Compliance & Circulars</h2>
                <button
                  type="button"
                  onClick={() => onSelectNav('marketing')}
                  className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                >
                  Open Approved Library
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Training Modules Completed</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {data.trainingProgress.filter((t) => t.completionStatus === 'Completed').length} /{' '}
                    {data.trainingProgress.length}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Unread Company Circulars / Assets</span>
                  <span className="font-mono tabular-nums font-medium text-amber-700">
                    {data.marketingAssets.filter((m) => !m.readByFranchiseeIds.includes(franchisee.id)).length} Pending Ack
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Open Service Desk Tickets</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {data.tickets.filter((t) => t.status !== 'Resolved').length}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Latest Statement Payable</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {data.commissionStatements[0]
                      ? formatInr(data.commissionStatements[0].finalPayableAmount)
                      : 'INR 0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeNav === 'profile' && (
        <div className="space-y-6">
          <SectionHeader
            title="Franchise Profile & Suspension / Exit Status"
            subtitle="Business details, digital agreement status, verified bank info, relationship manager, licences, and suspension/exit governance."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Franchisee & Business Information</h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between"><span className="text-slate-500">Franchisee ID</span><span className="font-mono font-semibold">{franchisee.franchiseeCode}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Principal / Owner</span><span className="font-medium">{franchisee.name}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Business Name</span><span className="font-medium">{franchisee.businessName}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Location & Region</span><span>{franchisee.city} ({franchisee.region})</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Franchise Tier</span><span className="font-semibold">{franchisee.tier}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Agreement Status</span><StatusLabel text={franchisee.agreementStatus} /></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Bank Account</span><span className="font-mono">{franchisee.bankAccountMasked}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Relationship Manager</span><span>{franchisee.relationshipManager}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Certification Status</span><StatusLabel text={franchisee.certificationStatus} /></div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Suspension and Exit Information (Section 7.3)</h2>
              <div className="divide-y divide-slate-100">
                <div className="py-2 flex justify-between"><span className="text-slate-500">Suspension Status</span><StatusLabel text={franchisee.suspensionStatus} tone={franchisee.suspensionStatus === 'None' ? 'nominal' : 'danger'} /></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Suspension Reason</span><span>{franchisee.suspensionReason || 'None'}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Exit Status</span><StatusLabel text={franchisee.exitStatus} /></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Pending Customer Servicing</span><span className="font-mono tabular-nums">{franchisee.pendingCustomerServicingCount}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Customer Reassignment</span><span>{franchisee.customerReassignmentTarget || 'Not Applicable'}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Final Settlement</span><span>{franchisee.finalSettlementStatus || 'Not Applicable'}</span></div>
                <div className="py-2 flex justify-between"><span className="text-slate-500">Post-Exit Trail / Clawbacks</span><PendingValue label="Trail income treatment Pending Confirmation" /></div>
              </div>
            </div>
          </div>

          {data.staffAccounts.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Authorised Franchisee Staff Sub-Users (FR-06 · Should Have)</h2>
              {data.staffAccounts.map((st) => (
                <div key={st.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <div>
                    <span className="font-medium text-slate-900">{st.name}</span> · <span className="text-slate-500">{st.email}</span>
                  </div>
                  <PendingValue label="Undefined staff permissions: Pending Confirmation" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeNav === 'leads' && (
        <div className="space-y-6">
          <SectionHeader
            title="Lead Management (FR-20)"
            subtitle="Capture manual, campaign, referral, and assigned leads routed by configured territory rules."
            raci={raciMap['Customer acquisition and advice']}
          />

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
                'Captured new lead.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Capture Lead</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                required
                placeholder="Customer / Prospect Name"
                value={newLead.customerName}
                onChange={(e) => setNewLead({ ...newLead, customerName: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <select
                value={newLead.source}
                onChange={(e) => setNewLead({ ...newLead, source: e.target.value as 'Manual' | 'Campaign' | 'Referral' })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="Manual">Manual</option>
                <option value="Campaign">Campaign</option>
                <option value="Referral">Referral</option>
              </select>
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
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={newLead.assignToStaffId}
                onChange={(e) => setNewLead({ ...newLead, assignToStaffId: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="">Self (Franchisee)</option>
                {data.staffAccounts.map((st) => (
                  <option key={st.id} value={st.id}>Assign: {st.name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Lead</span>
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Prospect</th>
                  <th className="py-2.5 px-3 font-semibold">Source & Territory</th>
                  <th className="py-2.5 px-3 font-semibold">Product Interest</th>
                  <th className="py-2.5 px-3 font-semibold">Assigned Staff</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.leads.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">{l.customerName}</div>
                      <div className="font-mono text-slate-500">{l.contactMasked}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{l.source}</div>
                      <div>{l.assignmentRule}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-800">{l.productInterest}</td>
                    <td className="py-3 px-3 text-slate-600">{l.assignedStaffName || 'Franchisee Principal'}</td>
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
                            `Updated lead ${l.customerName} to ${e.target.value}.`
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="KYC Pending">KYC Pending</option>
                        <option value="Converted">Converted</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeNav === 'crm' && (
        <div className="space-y-6">
          <SectionHeader
            title="Customer and CRM (FR-16, FR-21, FR-22)"
            subtitle="Serving customer records, reusable KYC & risk profiling, needs analysis, recommendation reason, and communication consent."
            raci={raciMap['Customer acquisition and advice']}
          />

          <NoticeBanner tone="info" title="Customer Privacy" message={data.customerVisibilityNote} />

          <div className="space-y-4">
            {data.customers.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {c.name} <span className="font-mono text-xs text-slate-500 font-normal">· {c.panMasked} · {c.city}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Stage: <span className="font-medium text-slate-800">{c.pipelineStage}</span> · Next Follow-up:{' '}
                      <span className="font-mono tabular-nums">{c.nextFollowUp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusLabel text={`KYC ${c.kycStatus}`} tone={c.kycStatus === 'Verified' ? 'nominal' : 'warning'} />
                    <span className="text-slate-700 font-medium">Risk: {c.riskProfile}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-y border-slate-100 py-2.5">
                  <div>
                    <div className="text-slate-500">Needs Analysis & Recommendation</div>
                    <div className="text-slate-800 font-medium mt-0.5">{c.recommendedProduct}</div>
                    <div className="text-slate-600 mt-0.5">Reason: {c.recommendationReason}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-500">Consent & Communication Preferences (FR-22)</div>
                    <div className="text-slate-800">
                      Consent: {c.consentGiven ? 'Captured' : 'Missing'} · SMS: {c.commsPreferences.sms ? 'Opt-In' : 'Opt-Out'} · Email:{' '}
                      {c.commsPreferences.email ? 'Opt-In' : 'Opt-Out'} · WhatsApp: {c.commsPreferences.whatsapp ? 'Opt-In' : 'Opt-Out'}
                    </div>
                    {c.crossSellPrompt && (
                      <div className="text-blue-800 font-medium">{c.crossSellPrompt}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500 font-medium">Activity History</div>
                  {c.activityLog.map((a, idx) => (
                    <div key={idx} className="text-slate-600">
                      <span className="font-mono tabular-nums">{a.date}</span> · {a.note} ({a.actor})
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <input
                    placeholder="Log customer follow-up note..."
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
                              followUpNote: followUpNote[c.id] || 'Follow-up call completed.',
                            }),
                          });
                          setFollowUpNote({ ...followUpNote, [c.id]: '' });
                        },
                        `Logged follow-up for ${c.name}.`
                      )
                    }
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Add Activity Note
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                async () => {
                  await apiRequest(token, '/api/customers', {
                    method: 'POST',
                    body: JSON.stringify(newCustomer),
                  });
                  setNewCustomer({
                    ...newCustomer,
                    name: '',
                    panMasked: '',
                    needsAnalysis: '',
                    recommendedProduct: '',
                    recommendationReason: '',
                  });
                },
                'Created customer record with reusable KYC, risk profile, and consent.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Onboard Customer (KYC, Risk Profile, Recommendation & Consent)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <input
                required
                placeholder="Customer Full Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                placeholder="City"
                value={newCustomer.city}
                onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                placeholder="Masked PAN (e.g. ABCDP••••1K)"
                value={newCustomer.panMasked}
                onChange={(e) => setNewCustomer({ ...newCustomer, panMasked: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <select
                value={newCustomer.riskProfile}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    riskProfile: e.target.value as typeof newCustomer.riskProfile,
                  })
                }
                className="rounded border border-slate-300 px-3 py-1.5"
              >
                <option value="Conservative">Conservative</option>
                <option value="Moderate">Moderate</option>
                <option value="Aggressive">Aggressive</option>
                <option value="Accredited / HNI">Accredited / HNI</option>
              </select>
              <input
                required
                placeholder="Needs Analysis"
                value={newCustomer.needsAnalysis}
                onChange={(e) => setNewCustomer({ ...newCustomer, needsAnalysis: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                placeholder="Recommended Product"
                value={newCustomer.recommendedProduct}
                onChange={(e) => setNewCustomer({ ...newCustomer, recommendedProduct: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                placeholder="Recommendation Reason"
                value={newCustomer.recommendationReason}
                onChange={(e) => setNewCustomer({ ...newCustomer, recommendationReason: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 lg:col-span-2"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newCustomer.consentGiven}
                    onChange={(e) => setNewCustomer({ ...newCustomer, consentGiven: e.target.checked })}
                  />
                  <span>Customer Consent Captured</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newCustomer.sms}
                    onChange={(e) => setNewCustomer({ ...newCustomer, sms: e.target.checked })}
                  />
                  <span>SMS</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.checked })}
                  />
                  <span>Email</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newCustomer.whatsapp}
                    onChange={(e) => setNewCustomer({ ...newCustomer, whatsapp: e.target.checked })}
                  />
                  <span>WhatsApp</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Save Customer Record
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'products' && (
        <div className="space-y-6">
          <SectionHeader
            title="Product Distribution (FR-04 & FR-05 Gated)"
            subtitle={`Products available to ${franchisee.tier} tier with verified regulatory licences. Unavailable or unverified lines are strictly blocked.`}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productAccess.map((pa) => {
              const catalogueItem = data.products.find((p) => p.category === pa.category);
              return (
                <div
                  key={pa.category}
                  className={`rounded-lg border p-4 space-y-2.5 text-xs ${
                    pa.unlocked ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{pa.category}</h3>
                    {pa.unlocked ? (
                      <StatusLabel text="Unlocked" tone="nominal" />
                    ) : (
                      <StatusLabel text="Blocked" tone="danger" />
                    )}
                  </div>
                  <div className="text-slate-600">{catalogueItem?.name}</div>
                  <div className={pa.unlocked ? 'text-slate-500' : 'text-red-700 font-medium'}>
                    {pa.reason}
                  </div>
                  {pa.unlocked && (
                    <div className="pt-2 border-t border-slate-100 text-slate-600">
                      {pa.category === 'Mutual Funds' && 'Capabilities: Scheme explorer · SIP & Lump-sum · Switch & Redemption · Folio & Portfolio view'}
                      {pa.category === 'Loans' && 'Capabilities: Lead capture · Eligibility pre-check · Document collection · Lender submission'}
                      {pa.category === 'Insurance' && 'Capabilities: Quote comparison · Proposal capture · Policy issuance · Renewal reminders'}
                      {pa.category === 'Real Estate' && 'Capabilities: Property inventory · Site-visit scheduling · Booking tracker · Document checklist'}
                      {pa.category === 'Venture Capital Services' && 'Capabilities: Eligibility & Suitability check · EOI · Data room access · Subscription workflow'}
                    </div>
                  )}
                  {!pa.unlocked && (
                    <div className="pt-2 border-t border-red-200/70 inline-flex items-center gap-1.5 text-red-700">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Distribution disabled until Tier / Licence condition is satisfied.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                async () => {
                  await apiRequest(token, '/api/transactions', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...orderForm,
                      amount: Number(orderForm.amount),
                    }),
                  });
                  setOrderForm({ ...orderForm, productName: '', amount: '', workflowSummary: '' });
                },
                'Submitted product application / order to manufacturer.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-900">Submit Product Order / Application (Server Enforces FR-04 & FR-05)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <select
                value={orderForm.productCategory}
                onChange={(e) => setOrderForm({ ...orderForm, productCategory: e.target.value as ProductCategory })}
                className="rounded border border-slate-300 px-3 py-1.5"
              >
                {ALL_CATEGORIES.map((c) => {
                  const unlocked = productAccess.find((p) => p.category === c)?.unlocked;
                  return (
                    <option key={c} value={c}>
                      {c} {unlocked ? '(Verified)' : '(Blocked)'}
                    </option>
                  );
                })}
              </select>
              <select
                value={orderForm.customerId}
                onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              >
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (KYC: {c.kycStatus})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Scheme / Loan / Policy / Unit Name"
                value={orderForm.productName}
                onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5"
              />
              <input
                required
                type="number"
                min={1}
                placeholder="Amount (INR)"
                value={orderForm.amount}
                onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>

            {orderForm.productCategory === 'Venture Capital Services' && (
              <div className="flex flex-wrap gap-4 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={orderForm.vcEligibilityConfirmed}
                    onChange={(e) => setOrderForm({ ...orderForm, vcEligibilityConfirmed: e.target.checked })}
                  />
                  <span>Investor Eligibility Questionnaire Passed (FR-15)</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={orderForm.vcSuitabilityConfirmed}
                    onChange={(e) => setOrderForm({ ...orderForm, vcSuitabilityConfirmed: e.target.checked })}
                  />
                  <span>Mandatory Suitability Questionnaire Completed</span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <input
                placeholder="Order details (SIP / Lump-sum / Switch / Site visit / Quote ref)..."
                value={orderForm.workflowSummary}
                onChange={(e) => setOrderForm({ ...orderForm, workflowSummary: e.target.value })}
                className="flex-1 min-w-[220px] rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Submit Order / Application
              </button>
            </div>
          </form>
        </div>
      )}

      {activeNav === 'transactions' && (
        <div className="space-y-6">
          <SectionHeader
            title="Transactions & Customer Sales Lifecycle"
            subtitle="Track manufacturer status, eligibility, commission accrual, and post-sale servicing across the 7-step documented lifecycle (Section 7.1)."
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-900 mb-2">Documented 7-Step Customer Sales Lifecycle (Section 7.1)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 text-xs text-slate-700">
              {SALES_LIFECYCLE_STEPS.map((step) => (
                <div key={step} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Transaction</th>
                  <th className="py-2.5 px-3 font-semibold">Customer & Product</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Manufacturer & Eligibility</th>
                  <th className="py-2.5 px-3 font-semibold">Post-Sale Servicing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono font-semibold text-slate-900">{t.id.toUpperCase()}</div>
                      <div className="text-slate-500">{t.createdAt}</div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-medium text-slate-900">{t.customerName}</div>
                      <div className="text-slate-700">{t.productCategory} · {t.productName}</div>
                      <div className="text-slate-500">{t.workflowSummary}</div>
                    </td>
                    <td className="py-3 px-3 align-top text-right font-mono tabular-nums font-medium">
                      {formatInr(t.amount)}
                    </td>
                    <td className="py-3 px-3 align-top space-y-1">
                      <div><StatusLabel text={t.manufacturerStatus} /></div>
                      <div>Eligibility: <StatusLabel text={t.eligibilityStatus} /></div>
                    </td>
                    <td className="py-3 px-3 align-top space-y-1.5">
                      <div className="font-medium text-slate-800">{t.postSaleServicing.type}</div>
                      <div className="text-slate-600">{t.postSaleServicing.status} (Next: {t.postSaleServicing.nextDate})</div>
                      <div className="flex gap-1">
                        <input
                          placeholder="Log servicing update..."
                          value={servicingNote[t.id] || ''}
                          onChange={(e) => setServicingNote({ ...servicingNote, [t.id]: e.target.value })}
                          className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              async () => {
                                await apiRequest(token, `/api/transactions/${t.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    servicingStatus: servicingNote[t.id] || 'Servicing check completed',
                                  }),
                                });
                                setServicingNote({ ...servicingNote, [t.id]: '' });
                              },
                              `Updated post-sale servicing for ${t.id}.`
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Save
                        </button>
                      </div>
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
            title="Commission and Earnings (FR-33, FR-35)"
            subtitle="Your Franchisee commission statements, deductions, clawbacks, and payout history. Company and Lendrixventech shares are confidential and not exposed."
            raci={raciMap['Commission calculation and payout']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Statement / Period</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross Commission</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Franchisee Share</th>
                  <th className="py-2.5 px-3 font-semibold text-right">TDS / Deductions</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Clawbacks / Adj</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Final Payable</th>
                  <th className="py-2.5 px-3 font-semibold">Payout Status & Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.commissionStatements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-900">{s.invoiceNumber}</div>
                      <div className="text-slate-500">{s.periodLabel}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{formatInr(s.grossManufacturerCommission)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">{formatInr(s.franchiseeShareAmount)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">-{formatInr(s.tdsDeduction)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      -{formatInr(s.clawbacks)} / {formatInr(s.adjustments)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatInr(s.finalPayableAmount)}
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
            title="Training and Certification (FR-40)"
            subtitle="Complete initial certification modules and ongoing compliance refreshers."
            raci={raciMap['Training content and certification']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Module / Refresher</th>
                  <th className="py-2.5 px-3 font-semibold">Completion Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Assessment Score</th>
                  <th className="py-2.5 px-3 font-semibold">Certification</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.trainingProgress.map((tp) => (
                  <tr key={tp.id}>
                    <td className="py-3 px-3 font-medium text-slate-900">{tp.moduleTitle}</td>
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
                                  body: JSON.stringify({ progressId: tp.id, score: 92 }),
                                }),
                              `Completed assessment for ${tp.moduleTitle}.`
                            )
                          }
                          className="rounded bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                        >
                          Complete Assessment
                        </button>
                      ) : (
                        <span className="text-slate-500">Certified {tp.completedAt}</span>
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
            title="Service Desk (FR-41)"
            subtitle="Raise operational queries or customer grievances and track resolution status."
            raci={raciMap['Complaints and grievance handling']}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                async () => {
                  await apiRequest(token, '/api/tickets', {
                    method: 'POST',
                    body: JSON.stringify(newTicket),
                  });
                  setNewTicket({ ...newTicket, subject: '', description: '' });
                },
                'Created support ticket.'
              );
            }}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-900">Create Service Desk Ticket</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <select
                value={newTicket.ticketType}
                onChange={(e) =>
                  setNewTicket({
                    ...newTicket,
                    ticketType: e.target.value as 'Service Desk' | 'Complaint / Grievance',
                  })
                }
                className="rounded border border-slate-300 px-3 py-1.5"
              >
                <option value="Service Desk">Service Desk Query</option>
                <option value="Complaint / Grievance">Complaint / Grievance</option>
              </select>
              <input
                required
                placeholder="Subject"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 sm:col-span-2"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <input
                required
                placeholder="Describe query or grievance details..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                className="flex-1 min-w-[220px] rounded border border-slate-300 px-3 py-1.5"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-blue-700 px-4 py-1.5 font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                Submit Ticket
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {data.tickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    {t.subject} <span className="font-mono font-normal text-slate-500">· {t.id.toUpperCase()}</span>
                  </div>
                  <StatusLabel text={t.status} />
                </div>
                <p className="text-slate-600">{t.description}</p>
                <div className="text-slate-500">SLA: {t.slaFirstResponse} response / {t.slaResolution} resolution</div>
                {t.responses.map((r, i) => (
                  <div key={i} className="border-t border-slate-100 pt-1.5 text-slate-600">
                    <span className="font-medium text-slate-800">{r.actor}</span> ({r.timestamp}): {r.message}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeNav === 'marketing' && (
        <div className="space-y-6">
          <SectionHeader
            title="Marketing and Communications (FR-42, FR-43)"
            subtitle="Only Company-approved, compliance-checked customer-facing marketing assets, circulars, and announcements are visible here."
            raci={raciMap['Marketing and brand control']}
          />

          <div className="space-y-3">
            {data.marketingAssets.map((m) => {
              const acknowledged = m.readByFranchiseeIds.includes(franchisee.id);
              return (
                <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-slate-500">{m.type} · Approved by {m.approvedBy} · {m.createdAt}</div>
                    <h3 className="text-sm font-semibold text-slate-900">{m.title}</h3>
                    <p className="text-slate-600">{m.summary}</p>
                  </div>
                  <div>
                    {acknowledged ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Read Acknowledged</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiRequest(token, `/api/marketing/${m.id}/acknowledge`, {
                                method: 'POST',
                              }),
                            `Recorded read acknowledgement for ${m.title}.`
                          )
                        }
                        className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        Acknowledge Receipt
                      </button>
                    )}
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
            title="Compliance and Licences (FR-05)"
            subtitle="Manage regulatory registrations and view product lines blocked by missing, expired, or unverified licences."
            raci={raciMap['Regulatory licences of Franchisee']}
          />

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Product Line</th>
                  <th className="py-2.5 px-3 font-semibold">Licence / Registration</th>
                  <th className="py-2.5 px-3 font-semibold">Reg. Number & Expiry</th>
                  <th className="py-2.5 px-3 font-semibold">Verification Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Submit Renewal / Update (R)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.licences.map((lic) => (
                  <tr key={lic.id}>
                    <td className="py-3 px-3 font-medium text-slate-900">{lic.productCategory}</td>
                    <td className="py-3 px-3 text-slate-700">{lic.licenceType}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      <div>{lic.registrationNumber}</div>
                      <div className="text-slate-500">Exp: {lic.expiryDate}</div>
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <StatusLabel text={lic.verificationStatus} />
                      {lic.verificationStatus !== 'Verified' && (
                        <div className="text-red-700 font-medium">Product line blocked until Company verifies</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <input
                          placeholder="Updated Reg #"
                          value={renewalReg[lic.id]?.reg || ''}
                          onChange={(e) =>
                            setRenewalReg({
                              ...renewalReg,
                              [lic.id]: { reg: e.target.value, expiry: renewalReg[lic.id]?.expiry || '2028-11-30' },
                            })
                          }
                          className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                apiRequest(token, `/api/licences/${lic.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    registrationNumber: renewalReg[lic.id]?.reg || lic.registrationNumber,
                                    expiryDate: renewalReg[lic.id]?.expiry || '2028-11-30',
                                  }),
                                }),
                              `Submitted ${lic.licenceType} to Company for verification.`
                            )
                          }
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Submit for Verification
                        </button>
                      </div>
                    </td>
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
