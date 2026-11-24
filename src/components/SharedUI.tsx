import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Lock, ShieldAlert, XCircle } from 'lucide-react';
import type { RaciRow } from '../shared/types';

export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

type StatusTone = 'nominal' | 'warning' | 'danger' | 'neutral';

export function inferTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (
    s.includes('verified') ||
    s.includes('active') ||
    s.includes('activated') ||
    s.includes('approved') ||
    s.includes('issued') ||
    s.includes('matched') ||
    s.includes('paid') ||
    s.includes('completed') ||
    s.includes('resolved') ||
    s.includes('passed') ||
    s.includes('eligible') ||
    s.includes('disbursed') ||
    s.includes('booked') ||
    s.includes('converted') ||
    s.includes('digitally signed') ||
    s.includes('certified')
  ) {
    if (s.includes('unverified') || s.includes('inactive') || s.includes('ineligible')) {
      return 'danger';
    }
    return 'nominal';
  }
  if (
    s.includes('expired') ||
    s.includes('missing') ||
    s.includes('blocked') ||
    s.includes('suspended') ||
    s.includes('rejected') ||
    s.includes('discrepancy') ||
    s.includes('restricted') ||
    s.includes('not connected') ||
    s.includes('failed') ||
    s.includes('escalated') ||
    s.includes('exited')
  ) {
    return 'danger';
  }
  if (
    s.includes('pending') ||
    s.includes('in progress') ||
    s.includes('review') ||
    s.includes('open') ||
    s.includes('partial') ||
    s.includes('submitted') ||
    s.includes('draft') ||
    s.includes('maker') ||
    s.includes('exit initiated')
  ) {
    return 'warning';
  }
  return 'neutral';
}

export function StatusLabel({ text, tone }: { text: string; tone?: StatusTone }) {
  const resolved = tone ?? inferTone(text);
  const colorClass =
    resolved === 'nominal'
      ? 'text-emerald-700'
      : resolved === 'warning'
        ? 'text-amber-700'
        : resolved === 'danger'
          ? 'text-red-700'
          : 'text-slate-600';

  const Icon =
    resolved === 'nominal'
      ? CheckCircle2
      : resolved === 'warning'
        ? Clock
        : resolved === 'danger'
          ? XCircle
          : Lock;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${colorClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function PendingValue({ label = 'Pending Confirmation' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  raci,
  rightAction,
}: {
  title: string;
  subtitle: string;
  raci?: RaciRow;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{subtitle}</p>
        {raci && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">RACI ({raci.activity}):</span>
            <span>Company: {raci.company}</span>
            <span aria-hidden="true">·</span>
            <span>Lendrixventech: {raci.lendrixventech}</span>
            <span aria-hidden="true">·</span>
            <span>Franchisee: {raci.franchisee}</span>
          </div>
        )}
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}

export function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; note?: string }>;
}) {
  return (
    <div className="grid grid-cols-1 border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-lg overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="p-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-slate-500">{item.label}</span>
          <span className="font-mono text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {item.value}
          </span>
          {item.note && <span className="text-xs text-slate-500">{item.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function HorizontalBarChart({
  title,
  subtitle,
  rows,
  valueFormatter = formatInr,
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: number; meta?: string }>;
  valueFormatter?: (v: number) => string;
}) {
  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const pct = Math.max(2, Math.round((row.value / maxVal) * 100));
          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-medium text-slate-700 truncate">{row.label}</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                  {valueFormatter(row.value)}
                  {row.meta ? ` · ${row.meta}` : ''}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-blue-700 transition-all duration-200"
                  style={{ width: `${row.value === 0 ? 0 : pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NoticeBanner({
  tone = 'info',
  title,
  message,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
}) {
  const styles =
    tone === 'danger'
      ? 'border-red-200 bg-red-50/70 text-red-900'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
        : 'border-slate-200 bg-slate-100/80 text-slate-800';
  const Icon = tone === 'danger' ? ShieldAlert : AlertTriangle;

  return (
    <div className={`rounded-lg border p-3.5 flex items-start gap-3 ${styles}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="text-xs leading-relaxed">
        <span className="font-semibold">{title}: </span>
        <span>{message}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center space-y-2">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
