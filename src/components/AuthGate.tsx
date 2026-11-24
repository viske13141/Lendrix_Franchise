import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import {
  fetchAuthAccounts,
  initiateLogin,
  verifyMfa,
  type AuthSessionResponse,
  type LoginAccountOption,
  type MfaChallengeResponse,
} from '../api/client';

export function AuthGate({
  sessionNotice,
  onAuthenticated,
}: {
  sessionNotice?: string | null;
  onAuthenticated: (session: AuthSessionResponse) => void;
}) {
  const [accounts, setAccounts] = useState<LoginAccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [challenge, setChallenge] = useState<MfaChallengeResponse | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAuthAccounts()
      .then((list) => {
        if (!active) return;
        setAccounts(list);
        if (list.length > 0) setSelectedAccountId(list[0].id);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load role directory.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleStartSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await initiateLogin(selectedAccountId);
      setChallenge(res);
      setOtpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const session = await verifyMfa(challenge.challengeId, otpCode);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 border border-slate-200 bg-white rounded-lg overflow-hidden">
        {/* Left Context Panel */}
        <div className="lg:col-span-5 bg-slate-900 text-slate-100 p-8 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <div className="text-xs font-medium text-slate-400 tracking-wide">
              Franchise Distribution Partnership · Draft v0.1
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Lendrixventech Platform
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Integrated role-based access portal for Franchise governance, distribution operations,
              local Franchisee execution, and authorised Franchisee staff.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-800 pt-5 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Multi-factor authentication (MFA) enforced for all platform logins (Section 10).</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Customer is an end buyer only. No Customer login or self-registration exists in the
                functional specification.
              </span>
            </div>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="lg:col-span-7 p-8 flex flex-col justify-center">
          {sessionNotice && (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              {sessionNotice}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {error}
            </div>
          )}

          {!challenge ? (
            <form onSubmit={handleStartSignIn} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Role-Based Sign In</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Select a documented business party account to authenticate and redirect to its
                  assigned dashboard.
                </p>
              </div>

              <div className="space-y-2">
                {accounts.map((acc) => {
                  const selected = selectedAccountId === acc.id;
                  return (
                    <label
                      key={acc.id}
                      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                        selected
                          ? 'border-blue-700 bg-blue-50/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accountId"
                        value={acc.id}
                        checked={selected}
                        onChange={() => setSelectedAccountId(acc.id)}
                        className="mt-1 accent-blue-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{acc.name}</span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            Timeout: {acc.sessionTimeoutMinutes}m
                          </span>
                        </div>
                        <div className="text-xs font-medium text-blue-800 mt-0.5">{acc.roleLabel}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{acc.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={loading || !selectedAccountId}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <span>{loading ? 'Issuing MFA Challenge...' : 'Continue to MFA Verification'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">MFA Verification Required</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Authenticating <span className="font-semibold text-slate-900">{challenge.account.name}</span>{' '}
                  · {challenge.account.roleLabel}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <KeyRound className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <span>Authenticator 6-Digit Verification Code</span>
                </div>
                <p className="text-xs text-slate-500">
                  Server-issued preview authenticator code:{' '}
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {challenge.authenticatorVerificationCode}
                  </span>
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Enter 6-Digit Code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setError(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setOtpCode(challenge.authenticatorVerificationCode)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Fill Code
                </button>
                <button
                  type="submit"
                  disabled={loading || otpCode.trim().length < 6}
                  className="flex-1 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Verifying...' : 'Verify & Open Dashboard'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
