import { useEffect } from 'react';

/** Shared presentational primitives used across every page. */

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-500 ${className}`}>
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function Button({ as: Tag = 'button', variant = 'primary', size = 'md', loading, className = '', children, ...rest }) {
  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm disabled:bg-brand-300',
    dark: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
    subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition
                  disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </Tag>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function Input({ label, error, hint, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className={`input ${error ? 'border-rose-400' : ''}`} {...rest} />
    </Field>
  );
}

export function Select({ label, error, hint, children, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <select className={`input ${error ? 'border-rose-400' : ''}`} {...rest}>{children}</select>
    </Field>
  );
}

export function Textarea({ label, error, hint, rows = 3, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <textarea rows={rows} className={`input ${error ? 'border-rose-400' : ''}`} {...rest} />
    </Field>
  );
}

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-violet-100 text-violet-800',
  arrived: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-200 text-slate-600',
  paid: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-amber-100 text-amber-800',
  refunded: 'bg-slate-200 text-slate-600',
  active: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  inactive: 'bg-slate-200 text-slate-600',
  blocked: 'bg-rose-100 text-rose-800',
};

export const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', confirmed: 'Confirmed', en_route: 'En route',
  arrived: 'Arrived', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled',
  paid: 'Paid', unpaid: 'Unpaid', refunded: 'Refunded', active: 'Active', rejected: 'Rejected',
  inactive: 'Inactive', blocked: 'Blocked',
};

export function Badge({ status, children, className = '' }) {
  return (
    <span className={`chip ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'} ${className}`}>
      {children || STATUS_LABELS[status] || status}
    </span>
  );
}

export function Stars({ value = 0, count, size = 'sm' }) {
  const full = Math.round(value);
  const cls = size === 'lg' ? 'text-lg' : 'text-sm';
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <span className="text-amber-400" aria-hidden>
        {'★'.repeat(Math.max(0, full))}<span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - full))}</span>
      </span>
      <span className="font-semibold text-slate-700">{Number(value || 0).toFixed(1)}</span>
      {count !== undefined && <span className="text-slate-400">({count})</span>}
    </span>
  );
}

export function EmptyState({ icon = '🗂️', title, body, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {body && <p className="max-w-md text-sm text-slate-500">{body}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-fade-up rounded-2xl bg-white shadow-lift`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">×</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusTimeline({ timeline = [] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {timeline.map((s, i) => (
        <li key={s.status} className="flex items-center gap-2">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold
              ${s.active ? 'bg-brand-500 text-white ring-4 ring-brand-100'
                : s.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
          >
            {s.done && !s.active ? '✓' : i + 1}
          </span>
          <span className={`text-xs font-semibold ${s.active ? 'text-brand-700' : s.done ? 'text-slate-700' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < timeline.length - 1 && <span className="mx-1 hidden h-px w-6 bg-slate-300 sm:block" />}
        </li>
      ))}
    </ol>
  );
}

export function StatCard({ label, value, sub, tone = 'slate', icon }) {
  const tones = {
    slate: 'text-slate-900', brand: 'text-brand-600', emerald: 'text-emerald-600',
    amber: 'text-amber-600', sky: 'text-sky-600', rose: 'text-rose-600', indigo: 'text-indigo-600',
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-extrabold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/** Simple SVG sparkline-free bar chart used on the admin dashboard. */
export function BarChart({ data = [], valueKey = 'value', labelKey = 'month', height = 150 }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-slate-400">No chart data yet.</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => {
        const h = Math.max(6, (Number(d[valueKey]) || 0) / max * (height - 34));
        return (
          <div key={d[labelKey]} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">{Number(d[valueKey] || 0).toLocaleString('en-IN')}</span>
            <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-400 to-brand-500" style={{ height: h }} title={`${d[labelKey]}: ${d[valueKey]}`} />
            <span className="text-[11px] text-slate-400">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}
