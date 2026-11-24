import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  USER_ACCOUNTS,
  addAuditLog,
  buildRoleScopedPayload,
  isProductAllowedForFranchisee,
  store,
} from './server/store.ts';
import {
  isPathRestrictedToOtherRole,
} from './src/shared/navigation.ts';
import type {
  FranchiseTier,
  LicenceVerificationStatus,
  OnboardingStepNumber,
  PartyRole,
  ProductCategory,
  UserAccount,
} from './src/shared/types.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

interface ActiveSession {
  token: string;
  userId: string;
  lastActivityAt: number;
  expiresAt: number;
}

interface MfaChallenge {
  challengeId: string;
  userId: string;
  code: string;
  expiresAt: number;
}

const sessions = new Map<string, ActiveSession>();
const mfaChallenges = new Map<string, MfaChallenge>();

interface AuthedRequest extends Request {
  authUser?: UserAccount;
  authSession?: ActiveSession;
}

function getAccountById(id: string): UserAccount | undefined {
  return USER_ACCOUNTS.find((u) => u.id === id);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Session not found or has been signed out.' });
    return;
  }
  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(token);
    const expiredUser = getAccountById(session.userId);
    if (expiredUser) {
      addAuditLog(expiredUser, 'SESSION_TIMEOUT', expiredUser.id, 'Session expired due to idle timeout.');
    }
    res.status(401).json({ error: 'Session expired due to idle timeout. Please sign in again.' });
    return;
  }
  const user = getAccountById(session.userId);
  if (!user) {
    sessions.delete(token);
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  session.lastActivityAt = now;
  session.expiresAt = now + user.sessionTimeoutMinutes * 60 * 1000;
  req.authUser = user;
  req.authSession = session;
  next();
}

function requireRoles(allowed: PartyRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser || !allowed.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Access denied for role ${req.authUser?.role ?? 'UNKNOWN'}. Action not permitted by RACI & RBAC rules.`,
      });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Public documented role directory for the login selector (no Customer login exists)
  app.get('/api/auth/accounts', (_req, res) => {
    res.json({
      accounts: USER_ACCOUNTS.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roleLabel: u.roleLabel,
        franchiseeId: u.franchiseeId,
        franchiseeName: u.franchiseeName,
        sessionTimeoutMinutes: u.sessionTimeoutMinutes,
      })),
    });
  });

  // Step 1: Initiate login -> issues server-side MFA challenge
  app.post('/api/auth/login', (req, res) => {
    const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId : '';
    const user = getAccountById(accountId);
    if (!user) {
      res.status(400).json({ error: 'Invalid documented account selection.' });
      return;
    }
    const challengeId = crypto.randomBytes(16).toString('hex');
    const code = String(crypto.randomInt(100000, 999999));
    mfaChallenges.set(challengeId, {
      challengeId,
      userId: user.id,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    addAuditLog(user, 'MFA_CHALLENGE_ISSUED', user.id, `MFA verification initiated for ${user.role}.`);
    res.json({
      challengeId,
      account: {
        id: user.id,
        name: user.name,
        role: user.role,
        roleLabel: user.roleLabel,
      },
      // Delivered to the in-app authenticator prompt for interactive verification
      authenticatorVerificationCode: code,
    });
  });

  // Step 2: Verify MFA -> issue in-memory Bearer token
  app.post('/api/auth/verify-mfa', (req, res) => {
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const challenge = mfaChallenges.get(challengeId);
    if (!challenge) {
      res.status(400).json({ error: 'MFA challenge not found. Please start sign-in again.' });
      return;
    }
    if (Date.now() > challenge.expiresAt) {
      mfaChallenges.delete(challengeId);
      res.status(401).json({ error: 'MFA verification code expired.' });
      return;
    }
    if (challenge.code !== code) {
      res.status(401).json({ error: 'Invalid MFA verification code.' });
      return;
    }
    mfaChallenges.delete(challengeId);
    const user = getAccountById(challenge.userId);
    if (!user) {
      res.status(401).json({ error: 'Account unavailable.' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + user.sessionTimeoutMinutes * 60 * 1000;
    sessions.set(token, { token, userId: user.id, lastActivityAt: now, expiresAt });
    addAuditLog(user, 'MFA_LOGIN_SUCCESS', user.id, `Signed in to ${user.role} dashboard.`);
    res.json({ token, user, sessionExpiresAt: expiresAt });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.authSession && req.authUser) {
      sessions.delete(req.authSession.token);
      addAuditLog(req.authUser, 'LOGOUT', req.authUser.id, 'User signed out cleanly.');
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/expire-session', requireAuth, (req: AuthedRequest, res) => {
    if (req.authSession && req.authUser) {
      sessions.delete(req.authSession.token);
      addAuditLog(
        req.authUser,
        'SESSION_TIMEOUT_TRIGGERED',
        req.authUser.id,
        'Session terminated via idle timeout verification control.'
      );
    }
    res.status(401).json({ error: 'Session timed out per security policy (Section 10).' });
  });

  // Role-scoped Dashboard State
  app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const payload = buildRoleScopedPayload(req.authUser!, req.authSession!.expiresAt);
    res.json(payload);
  });

  // Server-side direct URL route authorization check
  app.get('/api/auth/authorize-route', requireAuth, (req: AuthedRequest, res) => {
    const requestedPath = typeof req.query?.path === 'string' ? req.query.path : '/';
    const user = req.authUser!;
    if (isPathRestrictedToOtherRole(requestedPath, user.role)) {
      addAuditLog(
        user,
        'UNAUTHORIZED_ROUTE_ACCESS',
        requestedPath,
        `Blocked direct URL access to ${requestedPath} for role ${user.role}.`
      );
      res.status(403).json({
        authorized: false,
        error: `Direct access to ${requestedPath} is restricted. Your account is scoped to ${user.role} only.`,
      });
      return;
    }
    res.json({ authorized: true, role: user.role });
  });

  // FR-01: Online Franchise Application (Company A/R, Lendrixventech R for execution)
  app.post('/api/franchises', requireAuth, requireRoles(['COMPANY', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const businessName = typeof req.body?.businessName === 'string' ? req.body.businessName.trim() : '';
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
    const region = typeof req.body?.region === 'string' ? req.body.region.trim() : 'West';
    const tier = (['Starter', 'Professional', 'Premier'].includes(req.body?.tier)
      ? req.body.tier
      : 'Starter') as FranchiseTier;

    if (!name || !businessName || !city) {
      res.status(400).json({ error: 'Applicant name, business name, and city are required.' });
      return;
    }

    const num = 105 + store.franchises.length;
    const id = `frn-${num}`;
    const code = `FRN-${num}`;
    const today = new Date().toISOString().slice(0, 10);

    store.franchises.push({
      id,
      franchiseeCode: code,
      name,
      businessName,
      city,
      region,
      tier,
      onboardingStep: 1,
      onboardingStatus: 'Applied',
      eligibilityStatus: 'Pending',
      kycKybStatus: 'Pending',
      businessVerificationStatus: 'Pending',
      agreementStatus: 'Not Issued',
      feePaymentStatus: 'Pending Confirmation',
      licenceSummaryStatus: 'Expired / Missing',
      certificationStatus: 'Pending',
      platformActivationStatus: 'Inactive',
      relationshipManager: 'Pending Assignment',
      bankAccountMasked: 'Verification Pending',
      bankVerified: false,
      vcApprovedUser: false,
      suspensionStatus: 'None',
      exitStatus: 'Active',
      pendingCustomerServicingCount: 0,
      finalSettlementStatus: 'Not Applicable',
      joinedAt: today,
    });

    store.agreements.push({
      id: `agr-${num}`,
      franchiseeId: id,
      franchiseeCode: code,
      franchiseeName: businessName,
      documentTitle: `Franchise Distribution Agreement — ${tier} Tier`,
      digitalStatus: 'Not Issued',
      signingAuthority: 'Pending Confirmation',
      franchiseFeeStatus: 'Pending Confirmation',
      recurringFeeStatus: 'Pending Confirmation',
      updatedAt: today,
    });

    addAuditLog(req.authUser!, 'FRANCHISE_APPLICATION_CREATED', id, `Created franchise application ${code} (${businessName}, ${tier}).`);
    res.json({ ok: true, id });
  });

  // Onboarding / KYC / Tier / RM / Suspension / Exit updates (RACI enforced!)
  app.patch('/api/franchises/:id/manage', requireAuth, requireRoles(['COMPANY', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const fr = store.franchises.find((f) => f.id === req.params.id);
    if (!fr) {
      res.status(404).json({ error: 'Franchisee not found.' });
      return;
    }
    const role = req.authUser!.role;
    const { action, tier, relationshipManager, suspensionReason } = req.body ?? {};

    if (action === 'advance_onboarding') {
      const nextStep = Math.min(7, fr.onboardingStep + 1) as OnboardingStepNumber;
      fr.onboardingStep = nextStep;
      if (nextStep >= 2) fr.eligibilityStatus = 'Passed';
      if (nextStep >= 2 && fr.kycKybStatus === 'Pending') fr.kycKybStatus = 'Submitted';
      if (nextStep >= 4) fr.certificationStatus = 'Certified';
      if (nextStep >= 6 && fr.relationshipManager === 'Pending Assignment') {
        fr.relationshipManager = 'Kavita Iyer (RM-West-02)';
      }
      if (nextStep >= 6 && fr.kycKybStatus === 'Verified' && fr.agreementStatus === 'Digitally Signed') {
        fr.platformActivationStatus = 'Activated';
        fr.onboardingStatus = nextStep === 7 ? 'Active' : 'In Progress';
      } else {
        fr.onboardingStatus = 'In Progress';
      }
      addAuditLog(req.authUser!, 'ONBOARDING_STEP_ADVANCED', fr.id, `${fr.franchiseeCode} advanced to Step ${nextStep} of 7.`);
    } else if (action === 'approve_kyc') {
      if (role !== 'COMPANY') {
        res.status(403).json({ error: 'Only The Company is Accountable (A) for final Franchisee KYC/KYB approval.' });
        return;
      }
      fr.kycKybStatus = 'Verified';
      fr.businessVerificationStatus = 'Verified';
      fr.bankVerified = true;
      if (fr.bankAccountMasked === 'Verification Pending') fr.bankAccountMasked = 'BANK •••• 1024 (Verified)';
      addAuditLog(req.authUser!, 'KYC_KYB_APPROVED', fr.id, `Company approved KYC/KYB for ${fr.franchiseeCode}.`);
    } else if (action === 'issue_or_sign_agreement') {
      if (role !== 'COMPANY') {
        res.status(403).json({ error: 'Only The Company is Accountable/Responsible (A/R) for Franchise sales and agreements.' });
        return;
      }
      const agr = store.agreements.find((a) => a.franchiseeId === fr.id);
      if (fr.agreementStatus === 'Not Issued') {
        fr.agreementStatus = 'Pending Signature';
        if (agr) agr.digitalStatus = 'Pending Signature';
      } else {
        fr.agreementStatus = 'Digitally Signed';
        if (agr) agr.digitalStatus = 'Digitally Signed';
      }
      addAuditLog(req.authUser!, 'AGREEMENT_STATUS_UPDATED', fr.id, `Agreement status set to ${fr.agreementStatus}.`);
    } else if (action === 'change_tier') {
      if (role !== 'COMPANY') {
        res.status(403).json({ error: 'Only The Company controls Franchise Tier configuration (FR-04).' });
        return;
      }
      if (['Starter', 'Professional', 'Premier'].includes(tier)) {
        fr.tier = tier;
        addAuditLog(req.authUser!, 'TIER_CHANGED', fr.id, `Updated ${fr.franchiseeCode} tier to ${tier}.`);
      }
    } else if (action === 'assign_rm') {
      if (typeof relationshipManager === 'string' && relationshipManager.trim()) {
        fr.relationshipManager = relationshipManager.trim();
        addAuditLog(req.authUser!, 'RM_ASSIGNED', fr.id, `Assigned RM ${fr.relationshipManager} to ${fr.franchiseeCode}.`);
      }
    } else if (action === 'activate_platform') {
      if (fr.kycKybStatus !== 'Verified' || fr.agreementStatus !== 'Digitally Signed') {
        res.status(400).json({ error: 'Cannot activate platform before KYC/KYB is Verified and Agreement is Digitally Signed.' });
        return;
      }
      fr.platformActivationStatus = 'Activated';
      fr.onboardingStatus = 'Active';
      fr.onboardingStep = 7;
      addAuditLog(req.authUser!, 'PLATFORM_ACTIVATED', fr.id, `Activated platform access for ${fr.franchiseeCode}.`);
    } else if (action === 'suspend') {
      if (role !== 'COMPANY') {
        res.status(403).json({ error: 'Only The Company can authorize Franchisee suspension.' });
        return;
      }
      fr.suspensionStatus = 'Suspended';
      fr.suspensionReason = typeof suspensionReason === 'string' && suspensionReason.trim()
        ? suspensionReason.trim()
        : 'Compliance hold / licence review';
      fr.platformActivationStatus = 'Restricted';
      fr.onboardingStatus = 'Suspended';
      addAuditLog(req.authUser!, 'FRANCHISEE_SUSPENDED', fr.id, `Suspended ${fr.franchiseeCode}: ${fr.suspensionReason}`);
    } else if (action === 'reinstate') {
      if (role !== 'COMPANY') {
        res.status(403).json({ error: 'Only The Company can reinstate a suspended Franchisee.' });
        return;
      }
      fr.suspensionStatus = 'None';
      fr.suspensionReason = undefined;
      fr.platformActivationStatus = 'Activated';
      fr.onboardingStatus = 'Active';
      addAuditLog(req.authUser!, 'FRANCHISEE_REINSTATED', fr.id, `Reinstated ${fr.franchiseeCode}.`);
    } else {
      res.status(400).json({ error: 'Unsupported franchise management action.' });
      return;
    }

    res.json({ ok: true, franchise: fr });
  });

  // FR-05: Regulatory Licences (Franchisee submits/renews R, Company verifies/blocks A)
  app.patch('/api/licences/:id', requireAuth, requireRoles(['COMPANY', 'FRANCHISEE']), (req: AuthedRequest, res) => {
    const lic = store.licences.find((l) => l.id === req.params.id);
    if (!lic) {
      res.status(404).json({ error: 'Licence record not found.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'FRANCHISEE' && lic.franchiseeId !== user.franchiseeId) {
      res.status(403).json({ error: 'Cannot modify another Franchisee’s licence.' });
      return;
    }

    const { verificationStatus, registrationNumber, expiryDate } = req.body ?? {};
    if (user.role === 'FRANCHISEE') {
      // Franchisee submits updated registration -> goes to Unverified for Company verification
      if (typeof registrationNumber === 'string' && registrationNumber.trim()) {
        lic.registrationNumber = registrationNumber.trim();
      }
      if (typeof expiryDate === 'string' && expiryDate.trim()) {
        lic.expiryDate = expiryDate.trim();
      }
      lic.verificationStatus = 'Unverified';
      addAuditLog(user, 'LICENCE_SUBMITTED_FOR_VERIFICATION', lic.id, `Franchisee submitted ${lic.licenceType} (${lic.registrationNumber}) for verification.`);
    } else {
      // Company (A) verifies, marks expired, or marks unverified
      if (['Verified', 'Unverified', 'Expired', 'Missing'].includes(verificationStatus)) {
        lic.verificationStatus = verificationStatus as LicenceVerificationStatus;
      }
      addAuditLog(user, 'LICENCE_VERIFICATION_UPDATED', lic.id, `Company set ${lic.licenceType} for ${lic.franchiseeName} to ${lic.verificationStatus}.`);
    }

    // Recompute summary on Franchisee
    const fr = store.franchises.find((f) => f.id === lic.franchiseeId);
    if (fr) {
      const frLicences = store.licences.filter((l) => l.franchiseeId === fr.id);
      const allVerified = frLicences.every((l) => l.verificationStatus === 'Verified');
      const anyBlocked = frLicences.some((l) => l.verificationStatus === 'Expired' || l.verificationStatus === 'Missing');
      fr.licenceSummaryStatus = allVerified ? 'Verified' : anyBlocked ? 'Expired / Missing' : 'Partial';
    }

    res.json({ ok: true, licence: lic });
  });

  // FR-10: Product Catalogue Management (Company A/R only)
  app.post('/api/products', requireAuth, requireRoles(['COMPANY']), (req: AuthedRequest, res) => {
    const { category, name, partnerName, eligibilityRules, requiredDocuments, rateCardSummary, availabilityStatus, commissionBasis } = req.body ?? {};
    if (!category || !name || !partnerName) {
      res.status(400).json({ error: 'Category, product name, and partner name are required.' });
      return;
    }
    const id = `prd-${Date.now()}`;
    store.products.push({
      id,
      category,
      name: String(name).trim(),
      partnerName: String(partnerName).trim(),
      eligibilityRules: String(eligibilityRules || 'Standard KYC & eligibility rules apply').trim(),
      requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : ['PAN', 'KYC'],
      rateCardSummary: String(rateCardSummary || 'Commercial terms Pending Confirmation').trim(),
      availabilityStatus: availabilityStatus === 'Inactive' ? 'Inactive' : availabilityStatus === 'Restricted' ? 'Restricted' : 'Available',
      commissionBasis: String(commissionBasis || 'Per manufacturer schedule').trim(),
    });
    addAuditLog(req.authUser!, 'PRODUCT_CATALOGUE_ADDED', id, `Company added ${name} under ${category}.`);
    res.json({ ok: true, id });
  });

  app.patch('/api/products/:id', requireAuth, requireRoles(['COMPANY']), (req: AuthedRequest, res) => {
    const prod = store.products.find((p) => p.id === req.params.id);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    if (['Available', 'Restricted', 'Inactive'].includes(req.body?.availabilityStatus)) {
      prod.availabilityStatus = req.body.availabilityStatus;
    }
    if (typeof req.body?.eligibilityRules === 'string' && req.body.eligibilityRules.trim()) {
      prod.eligibilityRules = req.body.eligibilityRules.trim();
    }
    addAuditLog(req.authUser!, 'PRODUCT_CATALOGUE_UPDATED', prod.id, `Updated ${prod.name} availability to ${prod.availabilityStatus}.`);
    res.json({ ok: true, product: prod });
  });

  // FR-20: Lead Capture & Assignment (Franchisee A/R, Lendrixventech ops, Staff assigned)
  app.post('/api/leads', requireAuth, requireRoles(['FRANCHISEE', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const targetFranchiseeId = user.role === 'FRANCHISEE' ? user.franchiseeId! : String(req.body?.franchiseeId || 'frn-101');
    const fr = store.franchises.find((f) => f.id === targetFranchiseeId);
    if (!fr) {
      res.status(400).json({ error: 'Target Franchisee not found.' });
      return;
    }
    const customerName = String(req.body?.customerName || '').trim();
    const territory = String(req.body?.territory || fr.city).trim();
    const source = (['Manual', 'Campaign', 'Referral', 'Web Form'].includes(req.body?.source)
      ? req.body.source
      : 'Manual') as 'Manual' | 'Campaign' | 'Referral' | 'Web Form';
    const productInterest = String(req.body?.productInterest || 'Mutual Funds') as ProductCategory;
    if (!customerName) {
      res.status(400).json({ error: 'Customer lead name is required.' });
      return;
    }

    const assignToStaff = req.body?.assignToStaffId === 'usr-staff-101' && fr.id === 'frn-101';
    const id = `lead-${Date.now()}`;
    store.leads.unshift({
      id,
      franchiseeId: fr.id,
      franchiseeName: fr.businessName,
      source,
      territory,
      assignmentRule: `Territory Rule (${fr.region} / ${territory})`,
      customerName,
      contactMasked: '+91 98••••' + String(Math.floor(1000 + Math.random() * 9000)),
      productInterest,
      status: 'New',
      assignedStaffId: assignToStaff ? 'usr-staff-101' : undefined,
      assignedStaffName: assignToStaff ? 'Riya Kapoor' : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    addAuditLog(user, 'LEAD_CAPTURED', id, `Captured ${source} lead for ${fr.franchiseeCode} (${productInterest}).`);
    res.json({ ok: true, id });
  });

  app.patch('/api/leads/:id', requireAuth, requireRoles(['FRANCHISEE', 'LENDRIXVENTECH', 'FRANCHISEE_STAFF']), (req: AuthedRequest, res) => {
    const lead = store.leads.find((l) => l.id === req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    const user = req.authUser!;
    if ((user.role === 'FRANCHISEE' || user.role === 'FRANCHISEE_STAFF') && lead.franchiseeId !== user.franchiseeId) {
      res.status(403).json({ error: 'Customer & lead isolation: cannot modify another Franchisee’s lead.' });
      return;
    }
    if (user.role === 'FRANCHISEE_STAFF' && lead.assignedStaffId !== user.id) {
      res.status(403).json({ error: 'Staff access restricted to assigned leads only.' });
      return;
    }
    if (['New', 'Contacted', 'KYC Pending', 'Converted', 'Closed'].includes(req.body?.status)) {
      lead.status = req.body.status;
    }
    if (req.body?.assignedStaffId === 'usr-staff-101' && lead.franchiseeId === 'frn-101' && user.role !== 'FRANCHISEE_STAFF') {
      lead.assignedStaffId = 'usr-staff-101';
      lead.assignedStaffName = 'Riya Kapoor';
    }
    addAuditLog(user, 'LEAD_UPDATED', lead.id, `Updated lead ${lead.customerName} status to ${lead.status}.`);
    res.json({ ok: true, lead });
  });

  // FR-16, FR-21, FR-22: Customer CRM, KYC, Risk Profiling, Needs Analysis, Consent & Comms Prefs
  app.post('/api/customers', requireAuth, requireRoles(['FRANCHISEE']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const fId = user.franchiseeId!;
    const name = String(req.body?.name || '').trim();
    const city = String(req.body?.city || '').trim();
    if (!name || !city) {
      res.status(400).json({ error: 'Customer name and city are required.' });
      return;
    }
    const id = `cust-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    store.customers.unshift({
      id,
      franchiseeId: fId,
      name,
      panMasked: String(req.body?.panMasked || 'XXXXX••••X').trim(),
      city,
      kycStatus: req.body?.kycVerified ? 'Verified' : 'Pending',
      riskProfile: req.body?.riskProfile || 'Moderate',
      needsAnalysis: String(req.body?.needsAnalysis || 'Financial planning & protection').trim(),
      recommendedProduct: String(req.body?.recommendedProduct || 'Mutual Fund SIP').trim(),
      recommendationReason: String(req.body?.recommendationReason || 'Aligned with documented risk profile and horizon.').trim(),
      consentGiven: Boolean(req.body?.consentGiven),
      commsPreferences: {
        sms: Boolean(req.body?.sms),
        email: Boolean(req.body?.email ?? true),
        whatsapp: Boolean(req.body?.whatsapp),
      },
      pipelineStage: req.body?.kycVerified ? 'Recommendation Recorded' : 'KYC & Risk Profiling',
      nextFollowUp: String(req.body?.nextFollowUp || '2026-12-10'),
      crossSellPrompt:
        String(req.body?.recommendedProduct || '').toLowerCase().includes('loan')
          ? 'Home/Loan customer prompted for property or protection insurance (FR-23 Could Have).'
          : undefined,
      activityLog: [{ date: today, note: 'Customer profile, consent & suitability record created.', actor: user.name }],
    });
    addAuditLog(user, 'CUSTOMER_RECORD_CREATED', id, `Franchisee ${fId} created customer record (consent=${Boolean(req.body?.consentGiven)}).`);
    res.json({ ok: true, id });
  });

  app.patch('/api/customers/:id', requireAuth, requireRoles(['FRANCHISEE', 'FRANCHISEE_STAFF']), (req: AuthedRequest, res) => {
    const cust = store.customers.find((c) => c.id === req.params.id);
    if (!cust) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }
    const user = req.authUser!;
    if (cust.franchiseeId !== user.franchiseeId) {
      res.status(403).json({ error: 'Customer isolation violation: record belongs to another Franchisee.' });
      return;
    }
    if (user.role === 'FRANCHISEE_STAFF' && cust.assignedStaffId !== user.id) {
      res.status(403).json({ error: 'Staff access restricted to assigned customer follow-ups only.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (typeof req.body?.followUpNote === 'string' && req.body.followUpNote.trim()) {
      cust.activityLog.unshift({ date: today, note: req.body.followUpNote.trim(), actor: user.name });
    }
    if (req.body?.kycStatus === 'Verified' && user.role === 'FRANCHISEE') {
      cust.kycStatus = 'Verified';
    }
    if (req.body?.commsPreferences && user.role === 'FRANCHISEE') {
      cust.commsPreferences = {
        sms: Boolean(req.body.commsPreferences.sms),
        email: Boolean(req.body.commsPreferences.email),
        whatsapp: Boolean(req.body.commsPreferences.whatsapp),
      };
    }
    addAuditLog(user, 'CUSTOMER_RECORD_UPDATED', cust.id, `Updated customer follow-up/CRM record.`);
    res.json({ ok: true, customer: cust });
  });

  // Product Distribution Order / Application Submission (Strictly enforces FR-04 Tier & FR-05 Licence Gate!)
  app.post('/api/transactions', requireAuth, requireRoles(['FRANCHISEE']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const fId = user.franchiseeId!;
    const fr = store.franchises.find((f) => f.id === fId);
    if (!fr) {
      res.status(404).json({ error: 'Franchisee profile not found.' });
      return;
    }

    const productCategory = req.body?.productCategory as ProductCategory;
    const customerId = String(req.body?.customerId || '');
    const productName = String(req.body?.productName || '').trim();
    const amount = Number(req.body?.amount || 0);
    const workflowSummary = String(req.body?.workflowSummary || '').trim();

    const gate = isProductAllowedForFranchisee(fId, productCategory);
    if (!gate.allowed) {
      addAuditLog(user, 'PRODUCT_SALE_BLOCKED', fId, `Blocked ${productCategory} submission: ${gate.reason}`);
      res.status(403).json({ error: gate.reason });
      return;
    }

    const cust = store.customers.find((c) => c.id === customerId && c.franchiseeId === fId);
    if (!cust) {
      res.status(400).json({ error: 'Valid serving customer record is required before transaction submission.' });
      return;
    }
    if (cust.kycStatus !== 'Verified') {
      res.status(400).json({ error: 'Customer KYC must be Verified before submitting product order (Sales Lifecycle Step 2).' });
      return;
    }
    if (!productName || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valid product name and positive amount are required.' });
      return;
    }

    if (productCategory === 'Venture Capital Services') {
      if (!req.body?.vcEligibilityConfirmed || !req.body?.vcSuitabilityConfirmed) {
        res.status(400).json({ error: 'Venture Capital Services requires completed Investor Eligibility & Suitability checks (FR-15).' });
        return;
      }
    }

    const id = `txn-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    store.transactions.unshift({
      id,
      franchiseeId: fId,
      franchiseeName: fr.businessName,
      customerId: cust.id,
      customerName: cust.name,
      productCategory,
      productName,
      amount,
      workflowSummary: workflowSummary || `${productCategory} order submitted to manufacturer`,
      manufacturerStatus: 'Submitted',
      eligibilityStatus: 'Pending',
      commissionAccrued: 0,
      postSaleServicing: {
        type:
          productCategory === 'Mutual Funds'
            ? 'SIP Tracking'
            : productCategory === 'Loans'
              ? 'Repayment Reminder'
              : productCategory === 'Insurance'
                ? 'Renewal Reminder'
                : productCategory === 'Real Estate'
                  ? 'Registration Follow-up'
                  : 'Distribution Notice',
        status: 'Awaiting manufacturer confirmation',
        nextDate: '2026-12-20',
      },
      vcChecklist:
        productCategory === 'Venture Capital Services'
          ? {
              investorEligibilityPassed: true,
              suitabilityPassed: true,
              eoiSubmitted: true,
              dataRoomAccessGranted: true,
              subscriptionStatus: 'EOI Submitted & Data Room Active',
            }
          : undefined,
      createdAt: today,
    });

    cust.pipelineStage = 'Submitted to Manufacturer';
    cust.activityLog.unshift({ date: today, note: `Submitted ${productCategory}: ${productName}`, actor: user.name });
    addAuditLog(user, 'TRANSACTION_SUBMITTED', id, `Submitted ${productCategory} transaction (${productName}) for ${cust.name}.`);
    res.json({ ok: true, id });
  });

  // Update manufacturer status / mark eligible (Lendrixventech Ops or Company)
  app.patch('/api/transactions/:id', requireAuth, requireRoles(['LENDRIXVENTECH', 'COMPANY', 'FRANCHISEE']), (req: AuthedRequest, res) => {
    const txn = store.transactions.find((t) => t.id === req.params.id);
    if (!txn) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'FRANCHISEE') {
      if (txn.franchiseeId !== user.franchiseeId) {
        res.status(403).json({ error: 'Cannot access another Franchisee’s transaction.' });
        return;
      }
      // Franchisee can log post-sale servicing update only
      if (typeof req.body?.servicingStatus === 'string' && req.body.servicingStatus.trim()) {
        txn.postSaleServicing.status = req.body.servicingStatus.trim();
        addAuditLog(user, 'POST_SALE_SERVICING_UPDATED', txn.id, `Updated servicing note: ${txn.postSaleServicing.status}`);
        res.json({ ok: true, transaction: txn });
        return;
      }
      res.status(403).json({ error: 'Manufacturer status & eligibility updates are processed via platform/manufacturer sync.' });
      return;
    }

    if (req.body?.manufacturerStatus) {
      txn.manufacturerStatus = req.body.manufacturerStatus;
    }
    if (req.body?.eligibilityStatus) {
      txn.eligibilityStatus = req.body.eligibilityStatus;
      if (txn.eligibilityStatus === 'Eligible' && txn.commissionAccrued === 0) {
        // Record gross accrued figure without inventing split %
        txn.commissionAccrued = Math.round(txn.amount * 0.01);
      }
    }
    addAuditLog(user, 'TRANSACTION_STATUS_UPDATED', txn.id, `Set manufacturer=${txn.manufacturerStatus}, eligibility=${txn.eligibilityStatus}.`);
    res.json({ ok: true, transaction: txn });
  });

  // Commission Statement Reconciliation & Finance Maker-Checker Flow (FR-31..FR-34)
  app.post('/api/commissions/statements/:id/action', requireAuth, requireRoles(['LENDRIXVENTECH', 'COMPANY']), (req: AuthedRequest, res) => {
    const stmt = store.commissionStatements.find((s) => s.id === req.params.id);
    if (!stmt) {
      res.status(404).json({ error: 'Commission statement not found.' });
      return;
    }
    const user = req.authUser!;
    const { action, clawbackAmount, adjustmentAmount, note } = req.body ?? {};

    if (action === 'reconcile_match') {
      stmt.reconciliationStatus = 'Matched';
      stmt.discrepancyNote = undefined;
      addAuditLog(user, 'COMMISSION_RECONCILED', stmt.id, `Matched manufacturer statement for ${stmt.invoiceNumber}.`);
    } else if (action === 'flag_discrepancy') {
      stmt.reconciliationStatus = 'Discrepancy';
      stmt.discrepancyNote = String(note || 'Variance flagged during manufacturer statement matching (Window: Pending Confirmation).');
      addAuditLog(user, 'COMMISSION_DISCREPANCY_FLAGGED', stmt.id, stmt.discrepancyNote);
    } else if (action === 'record_clawback') {
      const cb = Math.max(0, Number(clawbackAmount || 0));
      const adj = Number(adjustmentAmount || 0);
      stmt.clawbacks += cb;
      stmt.adjustments += adj;
      stmt.finalPayableAmount = Math.max(0, stmt.franchiseeShareAmount - stmt.tdsDeduction - stmt.clawbacks + stmt.adjustments);
      addAuditLog(user, 'COMMISSION_CLAWBACK_ADJUSTMENT', stmt.id, `Recorded clawback=${cb}, adjustment=${adj}.`);
    } else if (action === 'maker_submit') {
      if (stmt.reconciliationStatus !== 'Matched') {
        res.status(400).json({ error: 'Statement must be reconciled (Matched) before Maker submission.' });
        return;
      }
      stmt.makerCheckerStage = 'Maker Submitted';
      stmt.makerActor = `${user.name} (${user.roleLabel})`;
      addAuditLog(user, 'FINANCE_MAKER_SUBMITTED', stmt.id, `Submitted ${stmt.invoiceNumber} to Finance Checker.`);
    } else if (action === 'checker_approve') {
      if (stmt.makerCheckerStage !== 'Maker Submitted') {
        res.status(400).json({ error: 'Statement must be Maker Submitted before Checker approval.' });
        return;
      }
      if (stmt.makerActor && stmt.makerActor.startsWith(user.name)) {
        res.status(403).json({ error: 'Maker-Checker control (FR-51): Checker cannot be the same individual who submitted as Maker.' });
        return;
      }
      stmt.makerCheckerStage = 'Checker Approved';
      stmt.checkerActor = `${user.name} (${user.roleLabel})`;
      addAuditLog(user, 'FINANCE_CHECKER_APPROVED', stmt.id, `Finance Checker approved ${stmt.invoiceNumber}.`);
    } else if (action === 'generate_payout_file') {
      if (stmt.makerCheckerStage !== 'Checker Approved') {
        res.status(400).json({ error: 'Payout file generation requires Finance Checker approval.' });
        return;
      }
      stmt.makerCheckerStage = 'Payout File Generated';
      addAuditLog(user, 'PAYOUT_FILE_GENERATED', stmt.id, `Generated bulk payout file for ${stmt.invoiceNumber}.`);
    } else if (action === 'release_payout') {
      if (stmt.makerCheckerStage !== 'Payout File Generated') {
        res.status(400).json({ error: 'Generate payout file before releasing payment.' });
        return;
      }
      stmt.makerCheckerStage = 'Paid';
      addAuditLog(user, 'PAYOUT_RELEASED', stmt.id, `Released payout for ${stmt.invoiceNumber}; Franchisee notified.`);
    } else {
      res.status(400).json({ error: 'Invalid commission action.' });
      return;
    }
    res.json({ ok: true, statement: stmt });
  });

  // FR-40: Training Completion & Assessment
  app.post('/api/training/complete', requireAuth, requireRoles(['FRANCHISEE', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const progressId = String(req.body?.progressId || '');
    const tp = store.trainingProgress.find((p) => p.id === progressId);
    if (!tp) {
      res.status(404).json({ error: 'Training assignment not found.' });
      return;
    }
    if (user.role === 'FRANCHISEE' && tp.franchiseeId !== user.franchiseeId) {
      res.status(403).json({ error: 'Cannot complete training for another Franchisee.' });
      return;
    }
    const score = Number(req.body?.score ?? 90);
    tp.completionStatus = 'Completed';
    tp.assessmentScore = score;
    tp.certificateStatus = score >= 80 ? 'Issued' : 'Not Issued';
    tp.completedAt = new Date().toISOString().slice(0, 10);
    addAuditLog(user, 'TRAINING_COMPLETED', tp.id, `Completed ${tp.moduleTitle} with score ${score}%.`);
    res.json({ ok: true, trainingProgress: tp });
  });

  // FR-41 & RACI Complaints/Grievances: Service Desk
  app.post('/api/tickets', requireAuth, requireRoles(['FRANCHISEE', 'LENDRIXVENTECH', 'COMPANY']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const fId = user.role === 'FRANCHISEE' ? user.franchiseeId! : String(req.body?.franchiseeId || 'frn-101');
    const fr = store.franchises.find((f) => f.id === fId);
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const ticketType = req.body?.ticketType === 'Complaint / Grievance' ? 'Complaint / Grievance' : 'Service Desk';
    const category = String(req.body?.category || 'Operational Query').trim();

    if (!subject || !description) {
      res.status(400).json({ error: 'Subject and description are required.' });
      return;
    }

    const id = `tkt-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    store.tickets.unshift({
      id,
      franchiseeId: fId,
      franchiseeName: fr?.businessName || fId,
      ticketType,
      category,
      subject,
      description,
      status: 'Open',
      slaFirstResponse: 'Pending Confirmation ([4 hours] draft)',
      slaResolution: 'Pending Confirmation ([2 working days] draft)',
      assignedOwner: ticketType === 'Complaint / Grievance' ? 'Company' : 'Lendrixventech',
      responses: [{ timestamp: now, actor: user.name, role: user.roleLabel, message: description }],
      createdAt: now.slice(0, 10),
    });
    addAuditLog(user, 'TICKET_CREATED', id, `Opened ${ticketType}: ${subject}`);
    res.json({ ok: true, id });
  });

  app.post('/api/tickets/:id/respond', requireAuth, requireRoles(['FRANCHISEE', 'LENDRIXVENTECH', 'COMPANY']), (req: AuthedRequest, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'FRANCHISEE' && ticket.franchiseeId !== user.franchiseeId) {
      res.status(403).json({ error: 'Cannot respond to another Franchisee’s ticket.' });
      return;
    }
    const message = String(req.body?.message || '').trim();
    const nextStatus = req.body?.status;
    if (message) {
      ticket.responses.push({
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        actor: user.name,
        role: user.roleLabel,
        message,
      });
    }
    if (['Open', 'In Review', 'Resolved', 'Escalated'].includes(nextStatus)) {
      if (nextStatus === 'Resolved' && ticket.ticketType === 'Complaint / Grievance' && user.role !== 'COMPANY') {
        res.status(403).json({ error: 'Per RACI, The Company is Accountable (A) for final Complaint & Grievance closure.' });
        return;
      }
      ticket.status = nextStatus;
    }
    addAuditLog(user, 'TICKET_UPDATED', ticket.id, `Updated ticket ${ticket.id} (${ticket.status}).`);
    res.json({ ok: true, ticket });
  });

  // FR-42 & FR-43: Marketing Assets, Brand Control & Read Acknowledgements
  app.post('/api/marketing', requireAuth, requireRoles(['COMPANY', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const title = String(req.body?.title || '').trim();
    const summary = String(req.body?.summary || '').trim();
    const type = req.body?.type || 'Product Circular';
    if (!title || !summary) {
      res.status(400).json({ error: 'Title and summary are required.' });
      return;
    }
    const id = `mkt-${Date.now()}`;
    const isCompany = user.role === 'COMPANY';
    store.marketingAssets.unshift({
      id,
      title,
      type,
      complianceChecked: isCompany,
      approvalStatus: isCompany ? 'Approved' : 'Pending Company Approval',
      approvedBy: isCompany ? 'The Company Brand & Compliance' : 'Pending Confirmation',
      readByFranchiseeIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
      summary,
    });
    addAuditLog(user, 'MARKETING_ITEM_CREATED', id, `${user.role} created ${type}: ${title}.`);
    res.json({ ok: true, id });
  });

  app.patch('/api/marketing/:id/approve', requireAuth, requireRoles(['COMPANY']), (req: AuthedRequest, res) => {
    const asset = store.marketingAssets.find((m) => m.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Marketing asset not found.' });
      return;
    }
    const approve = req.body?.approve !== false;
    asset.approvalStatus = approve ? 'Approved' : 'Rejected';
    asset.complianceChecked = approve;
    asset.approvedBy = approve ? 'The Company Brand & Compliance' : 'Rejected by Company';
    addAuditLog(req.authUser!, 'MARKETING_APPROVAL_DECISION', asset.id, `Company ${asset.approvalStatus} asset: ${asset.title}.`);
    res.json({ ok: true, asset });
  });

  app.post('/api/marketing/:id/acknowledge', requireAuth, requireRoles(['FRANCHISEE']), (req: AuthedRequest, res) => {
    const asset = store.marketingAssets.find((m) => m.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Marketing item not found.' });
      return;
    }
    const fId = req.authUser!.franchiseeId!;
    if (!asset.readByFranchiseeIds.includes(fId)) {
      asset.readByFranchiseeIds.push(fId);
    }
    addAuditLog(req.authUser!, 'MARKETING_READ_ACKNOWLEDGED', asset.id, `Franchisee ${fId} acknowledged ${asset.title}.`);
    res.json({ ok: true, asset });
  });

  // Platform Operations Incidents (Lendrixventech A/R)
  app.post('/api/platform/incidents', requireAuth, requireRoles(['LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const severity = ['Low', 'Medium', 'High'].includes(req.body?.severity) ? req.body.severity : 'Low';
    if (!title) {
      res.status(400).json({ error: 'Incident title is required.' });
      return;
    }
    const id = `inc-${Date.now()}`;
    store.incidents.unshift({
      id,
      title,
      severity,
      status: 'Open',
      rtoRpoStatus: 'RTO / RPO targets: Pending Confirmation',
      breachNotificationWindow: 'Pending Confirmation',
      reportedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });
    addAuditLog(req.authUser!, 'PLATFORM_INCIDENT_LOGGED', id, `Logged ${severity} platform incident: ${title}.`);
    res.json({ ok: true, id });
  });

  // Periodic Access Review (Section 10)
  app.post('/api/admin/access-review', requireAuth, requireRoles(['COMPANY', 'LENDRIXVENTECH']), (req: AuthedRequest, res) => {
    const today = new Date().toISOString().slice(0, 10);
    USER_ACCOUNTS.forEach((u) => {
      u.lastAccessReview = today;
    });
    addAuditLog(req.authUser!, 'PERIODIC_ACCESS_REVIEW_COMPLETED', 'USER_DIRECTORY', `Completed periodic RBAC & MFA access review.`);
    res.json({ ok: true, reviewedAt: today });
  });

  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lendrixventech Platform Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
