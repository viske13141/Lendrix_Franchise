export type PartyRole = 'COMPANY' | 'LENDRIXVENTECH' | 'FRANCHISEE' | 'FRANCHISEE_STAFF';

export type FranchiseTier = 'Starter' | 'Professional' | 'Premier';

export type ProductCategory =
  | 'Mutual Funds'
  | 'Loans'
  | 'Insurance'
  | 'Real Estate'
  | 'Venture Capital Services';

export type LicenceVerificationStatus = 'Verified' | 'Unverified' | 'Expired' | 'Missing';

export type OnboardingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: PartyRole;
  roleLabel: string;
  franchiseeId?: string;
  franchiseeName?: string;
  mfaEnabled: boolean;
  sessionTimeoutMinutes: number;
  lastAccessReview: string;
  status: 'Active' | 'Restricted';
  staffPermissions?: {
    assignedLeadsView: boolean;
    customerFollowUps: boolean;
    commissionConfig: 'Not Permitted';
    companyAdmin: 'Not Permitted';
    lendrixAdmin: 'Not Permitted';
    undefinedPermissionsStatus: 'Pending Confirmation';
  };
}

export interface RaciRow {
  activity: string;
  company: 'A / R' | 'A' | 'C' | 'I';
  lendrixventech: 'A / R' | 'R' | 'C' | 'I';
  franchisee: 'A / R' | 'R' | 'C' | 'I';
}

export const DOCUMENTED_RACI_MATRIX: RaciRow[] = [
  { activity: 'Franchise sales and agreements', company: 'A / R', lendrixventech: 'C', franchisee: 'I' },
  { activity: 'Franchisee KYC and onboarding', company: 'A', lendrixventech: 'R', franchisee: 'C' },
  { activity: 'Platform build and uptime', company: 'C', lendrixventech: 'A / R', franchisee: 'I' },
  { activity: 'Product shelf and partner contracts', company: 'A / R', lendrixventech: 'C', franchisee: 'I' },
  { activity: 'Training content and certification', company: 'A', lendrixventech: 'R', franchisee: 'C' },
  { activity: 'Customer acquisition and advice', company: 'I', lendrixventech: 'C', franchisee: 'A / R' },
  { activity: 'Regulatory licences of Franchisee', company: 'A', lendrixventech: 'C', franchisee: 'R' },
  { activity: 'Commission calculation and payout', company: 'A', lendrixventech: 'R', franchisee: 'I' },
  { activity: 'Complaints and grievance handling', company: 'A', lendrixventech: 'R', franchisee: 'R' },
  { activity: 'Marketing and brand control', company: 'A / R', lendrixventech: 'C', franchisee: 'R' },
];

export const TIER_PRODUCTS: Record<FranchiseTier, ProductCategory[]> = {
  Starter: ['Mutual Funds', 'Loans', 'Insurance'],
  Professional: ['Mutual Funds', 'Loans', 'Insurance', 'Real Estate'],
  Premier: ['Mutual Funds', 'Loans', 'Insurance', 'Real Estate', 'Venture Capital Services'],
};

export const TIER_DEFINITIONS: Array<{
  tier: FranchiseTier;
  intendedFor: string;
  productsUnlocked: ProductCategory[];
  franchiseFee: string;
  monthlyPlatformFee: string;
}> = [
  {
    tier: 'Starter',
    intendedFor: 'Individuals, small offices',
    productsUnlocked: ['Mutual Funds', 'Loans', 'Insurance'],
    franchiseFee: 'Pending Confirmation',
    monthlyPlatformFee: 'Pending Confirmation',
  },
  {
    tier: 'Professional',
    intendedFor: 'Established advisers, small firms',
    productsUnlocked: ['Mutual Funds', 'Loans', 'Insurance', 'Real Estate'],
    franchiseFee: 'Pending Confirmation',
    monthlyPlatformFee: 'Pending Confirmation',
  },
  {
    tier: 'Premier',
    intendedFor: 'Licensed, high-performing partners with proven AUM',
    productsUnlocked: ['Mutual Funds', 'Loans', 'Insurance', 'Real Estate', 'Venture Capital Services'],
    franchiseFee: 'Pending Confirmation',
    monthlyPlatformFee: 'Pending Confirmation',
  },
];

export const ONBOARDING_WORKFLOW_STEPS: Array<{
  step: OnboardingStepNumber;
  label: string;
  responsible: string;
  accountable: string;
}> = [
  { step: 1, label: 'Enquiry and application on the Lendrixventech portal', responsible: 'Lendrixventech', accountable: 'Company' },
  { step: 2, label: 'Eligibility screening and KYC / KYB (identity, business, bank verification)', responsible: 'Lendrixventech', accountable: 'Company' },
  { step: 3, label: 'Franchise agreement signed digitally and fee paid', responsible: 'Company', accountable: 'Company' },
  { step: 4, label: 'Training modules and certification exams completed', responsible: 'Lendrixventech', accountable: 'Company' },
  { step: 5, label: 'Regulatory registrations obtained or linked (AMFI, insurance, RERA, lender)', responsible: 'Franchisee', accountable: 'Company' },
  { step: 6, label: 'Platform access activated by tier; unique ID and relationship manager assigned', responsible: 'Lendrixventech', accountable: 'Company' },
  { step: 7, label: 'Go-live with brand kit, marketing material and first-90-day plan', responsible: 'Lendrixventech', accountable: 'Company' },
];

export interface FunctionalRequirementItem {
  id: string;
  section: string;
  requirement: string;
  priority: 'M' | 'S' | 'C';
}

export const DOCUMENTED_FR_PRIORITIES: FunctionalRequirementItem[] = [
  { id: 'FR-01', section: 'Onboarding & Management', requirement: 'Online franchise application with document upload and status tracking.', priority: 'M' },
  { id: 'FR-02', section: 'Onboarding & Management', requirement: 'Automated KYC/KYB, PAN/ID, bank account and address verification via approved providers.', priority: 'M' },
  { id: 'FR-03', section: 'Onboarding & Management', requirement: 'Digital signing of franchise agreement and payment of fees online.', priority: 'M' },
  { id: 'FR-04', section: 'Onboarding & Management', requirement: 'Tier configuration controlling which products each Franchisee can access.', priority: 'M' },
  { id: 'FR-05', section: 'Onboarding & Management', requirement: 'Licence and certification register with expiry alerts; block sales when a required licence lapses.', priority: 'M' },
  { id: 'FR-06', section: 'Onboarding & Management', requirement: 'Sub-user accounts for Franchisee staff with role-based permissions.', priority: 'S' },
  { id: 'FR-10', section: 'Product Catalogue & Sales', requirement: 'Central product catalogue with partner details, eligibility rules, documents and rate cards, managed by the Company.', priority: 'M' },
  { id: 'FR-11', section: 'Product Catalogue & Sales', requirement: 'Mutual funds: scheme explorer, SIP and lump-sum order capture, folio and portfolio view, via registered transaction platform integration.', priority: 'M' },
  { id: 'FR-12', section: 'Product Catalogue & Sales', requirement: 'Loans: lead capture, eligibility pre-check, document collection, submission to lender and application status tracking.', priority: 'M' },
  { id: 'FR-13', section: 'Product Catalogue & Sales', requirement: 'Insurance: quote comparison, proposal capture, policy issuance, renewal reminders.', priority: 'M' },
  { id: 'FR-14', section: 'Product Catalogue & Sales', requirement: 'Real estate: inventory listing, site-visit scheduling, booking tracker, document checklist.', priority: 'S' },
  { id: 'FR-15', section: 'Product Catalogue & Sales', requirement: 'Venture capital services: investor eligibility and suitability questionnaire, expression of interest, data room access and subscription workflow, restricted to approved users.', priority: 'S' },
  { id: 'FR-16', section: 'Product Catalogue & Sales', requirement: 'Customer KYC and risk profiling reused across products to avoid repeat data entry.', priority: 'M' },
  { id: 'FR-20', section: 'Lead & Customer CRM', requirement: 'Lead capture from web forms, campaigns, referrals and manual entry; automatic assignment by territory or rule.', priority: 'M' },
  { id: 'FR-21', section: 'Lead & Customer CRM', requirement: 'Pipeline view with stages, follow-up reminders and activity log per customer.', priority: 'M' },
  { id: 'FR-22', section: 'Lead & Customer CRM', requirement: 'Customer consent capture and communication preferences (SMS, email, WhatsApp).', priority: 'M' },
  { id: 'FR-23', section: 'Lead & Customer CRM', requirement: 'Cross-sell prompts, for example, a home loan customer is prompted for property insurance.', priority: 'C' },
  { id: 'FR-30', section: 'Commission Engine', requirement: 'Configurable commission rules by product, partner, tier, slab and effective date.', priority: 'M' },
  { id: 'FR-31', section: 'Commission Engine', requirement: 'Automatic accrual when a transaction reaches eligible status; reconciliation against manufacturer commission statements.', priority: 'M' },
  { id: 'FR-32', section: 'Commission Engine', requirement: 'Clawback and adjustment handling with audit trail.', priority: 'M' },
  { id: 'FR-33', section: 'Commission Engine', requirement: 'Monthly commission statements with tax deductions; invoice generation where required.', priority: 'M' },
  { id: 'FR-34', section: 'Commission Engine', requirement: 'Bulk payout file generation and payment status tracking.', priority: 'M' },
  { id: 'FR-35', section: 'Commission Engine', requirement: 'Real-time earnings dashboard for Franchisee, Lendrixventech and the Company, each seeing only their own share.', priority: 'S' },
  { id: 'FR-40', section: 'Training, Support & Comms', requirement: 'Learning module with courses, assessments and certificates, plus tracking of completion.', priority: 'M' },
  { id: 'FR-41', section: 'Training, Support & Comms', requirement: 'Ticketing and service desk with SLAs for Franchisee queries.', priority: 'M' },
  { id: 'FR-42', section: 'Training, Support & Comms', requirement: 'Marketing asset library with pre-approved, compliance-checked content.', priority: 'S' },
  { id: 'FR-43', section: 'Training, Support & Comms', requirement: 'Announcements and product circulars with read acknowledgement.', priority: 'S' },
  { id: 'FR-50', section: 'Reporting, Admin & Integration', requirement: 'Management dashboards: franchise count, activation, sales, AUM, disbursals, premiums, churn, commission by product.', priority: 'M' },
  { id: 'FR-51', section: 'Reporting, Admin & Integration', requirement: 'Role-based admin console for the Company and Lendrixventech with maker-checker for sensitive changes.', priority: 'M' },
  { id: 'FR-52', section: 'Reporting, Admin & Integration', requirement: 'APIs or integrations with fund transaction platforms, lender and insurer systems, payment gateway, e-sign, KYC provider and accounting software.', priority: 'M' },
  { id: 'FR-53', section: 'Reporting, Admin & Integration', requirement: 'Full audit log of user actions, data changes and approvals, retained for the period regulators require.', priority: 'M' },
  { id: 'FR-54', section: 'Reporting, Admin & Integration', requirement: 'Mobile-responsive web app; native app optional.', priority: 'S' },
];

export const DOCUMENTED_SLAS: Array<{ measure: string; target: string }> = [
  { measure: 'Platform availability', target: 'Pending Confirmation (Draft placeholder: [99.5]% monthly, excluding planned maintenance)' },
  { measure: 'Franchisee onboarding turnaround (complete application to go-live)', target: 'Pending Confirmation' },
  { measure: 'Support ticket first response / resolution', target: 'Pending Confirmation (Draft placeholder: [4 hours] / [2 working days])' },
  { measure: 'Commission statement delivery', target: 'Pending Confirmation (By the [__] of each month)' },
  { measure: 'Active Franchisee ratio (at least one sale in the last 90 days)', target: 'Pending Confirmation' },
  { measure: 'Franchisees onboarded', target: 'Pending Confirmation (6m / 12m / 24m milestones)' },
  { measure: 'Complaints per 1,000 transactions', target: 'Pending Confirmation' },
  { measure: 'Mis-selling incidents', target: 'Zero tolerance; investigated within Pending Confirmation days' },
];

export const OPEN_DECISIONS: string[] = [
  'Confirm each party role: who contracts with Franchisees, who receives manufacturer commission, and who is the legal principal for each product.',
  'Jurisdiction(s) of operation and the regulator for each product line.',
  'Commission split by product and tier, and the franchise and platform fees.',
  'Whether venture capital services will be offered at launch, and through which fund vehicle.',
  'Trail and renewal income treatment after a Franchisee exits.',
  'Ownership of customer data and of jointly built technology.',
  'Pilot regions, target number of Franchisees and success criteria.',
];

export interface FranchiseeRecord {
  id: string;
  franchiseeCode: string;
  name: string;
  businessName: string;
  city: string;
  region: string;
  tier: FranchiseTier;
  onboardingStep: OnboardingStepNumber;
  onboardingStatus: 'Applied' | 'In Progress' | 'Active' | 'Suspended' | 'Exited';
  eligibilityStatus: 'Pending' | 'Passed' | 'Failed';
  kycKybStatus: 'Pending' | 'Submitted' | 'Verified' | 'Rejected';
  businessVerificationStatus: 'Pending' | 'Verified';
  agreementStatus: 'Not Issued' | 'Pending Signature' | 'Digitally Signed';
  feePaymentStatus: 'Pending Confirmation' | 'Unpaid' | 'Paid';
  licenceSummaryStatus: 'Verified' | 'Partial' | 'Expired / Missing';
  certificationStatus: 'Pending' | 'Certified';
  platformActivationStatus: 'Inactive' | 'Activated' | 'Restricted';
  relationshipManager: string;
  bankAccountMasked: string;
  bankVerified: boolean;
  vcApprovedUser: boolean;
  suspensionStatus: 'None' | 'Suspended';
  suspensionReason?: string;
  exitStatus: 'Active' | 'Exit Initiated' | 'Exited';
  pendingCustomerServicingCount: number;
  customerReassignmentTarget?: string;
  finalSettlementStatus?: 'Not Applicable' | 'Pending Clawback Check' | 'Settled';
  clawbackAdjustmentNote?: string;
  joinedAt: string;
}

export interface AgreementRecord {
  id: string;
  franchiseeId: string;
  franchiseeCode: string;
  franchiseeName: string;
  documentTitle: string;
  digitalStatus: 'Not Issued' | 'Pending Signature' | 'Digitally Signed';
  signingAuthority: 'Pending Confirmation';
  franchiseFeeStatus: 'Pending Confirmation' | 'Paid' | 'Invoiced';
  recurringFeeStatus: 'Pending Confirmation';
  updatedAt: string;
}

export interface LicenceRecord {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  productCategory: ProductCategory;
  licenceType: string;
  registrationNumber: string;
  verificationStatus: LicenceVerificationStatus;
  expiryDate: string;
}

export interface ProductItem {
  id: string;
  category: ProductCategory;
  name: string;
  partnerName: string;
  eligibilityRules: string;
  requiredDocuments: string[];
  rateCardSummary: string;
  availabilityStatus: 'Available' | 'Restricted' | 'Inactive';
  commissionBasis: string;
}

export interface LeadRecord {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  source: 'Manual' | 'Campaign' | 'Referral' | 'Web Form';
  territory: string;
  assignmentRule: string;
  customerName: string;
  contactMasked: string;
  productInterest: ProductCategory;
  status: 'New' | 'Contacted' | 'KYC Pending' | 'Converted' | 'Closed';
  assignedStaffId?: string;
  assignedStaffName?: string;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  franchiseeId: string;
  name: string;
  panMasked: string;
  city: string;
  kycStatus: 'Pending' | 'Verified';
  riskProfile: 'Conservative' | 'Moderate' | 'Aggressive' | 'Accredited / HNI' | 'Pending';
  needsAnalysis: string;
  recommendedProduct: string;
  recommendationReason: string;
  consentGiven: boolean;
  commsPreferences: {
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  pipelineStage: 'Lead / Discovery' | 'KYC & Risk Profiling' | 'Recommendation Recorded' | 'Submitted to Manufacturer' | 'Post-Sale Servicing';
  nextFollowUp: string;
  crossSellPrompt?: string;
  assignedStaffId?: string;
  activityLog: Array<{ date: string; note: string; actor: string }>;
}

export interface TransactionRecord {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  customerId: string;
  customerName: string;
  productCategory: ProductCategory;
  productName: string;
  amount: number;
  workflowSummary: string;
  manufacturerStatus: 'Submitted' | 'Under Review' | 'Approved / Issued' | 'Disbursed' | 'Booked' | 'Rejected';
  eligibilityStatus: 'Pending' | 'Eligible' | 'Ineligible' | 'Reversed';
  commissionAccrued: number;
  postSaleServicing: {
    type: 'SIP Tracking' | 'Renewal Reminder' | 'Repayment Reminder' | 'Top-up Review' | 'Registration Follow-up' | 'Distribution Notice';
    status: string;
    nextDate: string;
  };
  vcChecklist?: {
    investorEligibilityPassed: boolean;
    suitabilityPassed: boolean;
    eoiSubmitted: boolean;
    dataRoomAccessGranted: boolean;
    subscriptionStatus: string;
  };
  createdAt: string;
}

export interface CommissionRule {
  id: string;
  productCategory: ProductCategory;
  partnerName: string;
  tier: FranchiseTier;
  slabDescription: string;
  effectiveDate: string;
  companySharePct: string;
  lendrixSharePct: string;
  franchiseeSharePct: string;
  manufacturerRecipient: 'Pending Confirmation';
  clawbackWindow: string;
  approvalStatus: 'Active Schema (Commercial % Pending Confirmation)' | 'Maker Proposed';
}

export interface CommissionStatement {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  periodLabel: string;
  grossManufacturerCommission: number;
  franchiseeShareAmount: number;
  companyShareAmount?: number;
  lendrixShareAmount?: number;
  tdsDeduction: number;
  gstComponent: number;
  clawbacks: number;
  adjustments: number;
  finalPayableAmount: number;
  reconciliationStatus: 'Matched' | 'Discrepancy' | 'Pending Reconciliation';
  discrepancyNote?: string;
  makerCheckerStage: 'Draft' | 'Maker Submitted' | 'Checker Approved' | 'Payout File Generated' | 'Paid';
  makerActor?: string;
  checkerActor?: string;
  payoutDate: 'Pending Confirmation';
  invoiceNumber: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  category: string;
  isRefresher: boolean;
  duration: string;
  passScore: number;
  owner: 'The Company';
  administrator: 'Lendrixventech';
}

export interface TrainingProgress {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  moduleId: string;
  moduleTitle: string;
  completionStatus: 'Not Started' | 'In Progress' | 'Completed';
  assessmentScore?: number;
  certificateStatus: 'Not Issued' | 'Issued' | 'Expired';
  completedAt?: string;
}

export interface ServiceTicket {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  ticketType: 'Service Desk' | 'Complaint / Grievance';
  category: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Review' | 'Resolved' | 'Escalated';
  slaFirstResponse: string;
  slaResolution: string;
  assignedOwner: 'Lendrixventech' | 'Company' | 'Franchisee';
  responses: Array<{ timestamp: string; actor: string; role: string; message: string }>;
  createdAt: string;
}

export interface MarketingAsset {
  id: string;
  title: string;
  type: 'Brand Asset' | 'Marketing Material' | 'Communication Template' | 'Product Circular' | 'Announcement';
  complianceChecked: boolean;
  approvalStatus: 'Approved' | 'Pending Company Approval' | 'Rejected';
  approvedBy: string;
  readByFranchiseeIds: string[];
  createdAt: string;
  summary: string;
}

export interface PlatformIntegration {
  id: string;
  name: string;
  category: string;
  status: 'Not Connected';
  notes: string;
}

export interface PlatformIncident {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Mitigated' | 'Resolved';
  rtoRpoStatus: string;
  breachNotificationWindow: 'Pending Confirmation';
  reportedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: PartyRole;
  action: string;
  targetEntity: string;
  detail: string;
}

export interface DashboardPayload {
  user: UserAccount;
  sessionExpiresAt: number;
  franchises: FranchiseeRecord[];
  agreements: AgreementRecord[];
  licences: LicenceRecord[];
  products: ProductItem[];
  leads: LeadRecord[];
  customers: CustomerRecord[];
  transactions: TransactionRecord[];
  commissionRules: CommissionRule[];
  commissionStatements: CommissionStatement[];
  trainingModules: TrainingModule[];
  trainingProgress: TrainingProgress[];
  tickets: ServiceTicket[];
  marketingAssets: MarketingAsset[];
  integrations: PlatformIntegration[];
  incidents: PlatformIncident[];
  auditLogs: AuditLogEntry[];
  staffAccounts: UserAccount[];
  fr50Summary: {
    franchiseCount: number;
    franchiseActivationCount: number;
    activeFranchiseRatioPct: number;
    totalSalesVolume: number;
    totalAum: number;
    totalLoanDisbursals: number;
    totalInsurancePremiums: number;
    franchiseeChurnCount: number;
    commissionByProduct: Array<{ category: ProductCategory; amount: number }>;
  };
  customerVisibilityNote: string;
}
