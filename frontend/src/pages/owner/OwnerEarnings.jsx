import { useEffect, useMemo, useState } from 'react';
import { api, money } from '../../api/client';
import { Badge, Spinner, StatCard } from '../../components/ui';

/** Owner earnings - derived from the bookings ledger (simulated payments). */
export default function OwnerEarnings() {
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api('/bookings?status=all').then((r) => setRows(r.data)).catch(() => setRows([]));
    api('/bookings/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const monthly = useMemo(() => {
    const m = {};
    (rows || []).filter((b) => b.payment_status === 'paid').forEach((b) => {
      const k = String(b.event_date).slice(0, 7);
      m[k] = (m[k] || 0) + Number(b.amount || 0);
    });
    return Object.entries(m).sort().slice(-6).map(([month, value]) => ({ month, value }));
  }, [rows]);

  const max = Math.max(...monthly.map((d) => d.value), 1);

  if (rows === null) return <Spinner label="Loading earnings…" />;

  const paid = rows.filter((b) => b.payment_status === 'paid');
  const completed = rows.filter((b) => b.status === 'completed');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Earnings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Booking values from the ledger. Payments are <strong>simulated</strong> in this project - no real money is
          transferred; only the payment status and reference are recorded.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected (paid)" value={money(summary?.counters?.revenue_paid)} tone="emerald" icon="💰" />
        <StatCard label="Completed events value" value={money(summary?.counters?.revenue_completed)} tone="brand" icon="🏁" />
        <StatCard label="Upcoming confirmed value" value={money(summary?.counters?.upcoming_value)} tone="indigo" icon="📅" />
        <StatCard label="Paid bookings" value={paid.length} icon="🧾" />
      </div>

      <section className="card mt-6 p-6">
        <h2 className="text-base font-bold text-slate-900">Value by event month</h2>
        {monthly.length === 0 ? <p className="mt-4 text-sm text-slate-400">No paid bookings yet.</p> : (
          <div className="mt-5 flex h-40 items-end gap-4">
            {monthly.map((d) => (
              <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">{money(d.value)}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-400 to-brand-500" style={{ height: Math.max(6, (d.value / max) * 120) }} />
                <span className="text-[11px] text-slate-400">{d.month}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 overflow-x-auto">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-sm font-bold text-slate-800">Completed events ({completed.length})</p>
        </div>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-200"><tr><th className="th">Code</th><th className="th">Truck</th><th className="th">Customer</th><th className="th">Event date</th><th className="th">Guests</th><th className="th">Payment</th><th className="th text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {completed.map((b) => (
              <tr key={b.id}>
                <td className="td font-mono text-xs">{b.code}</td>
                <td className="td">{b.truck?.name}</td>
                <td className="td text-slate-600">{b.customer?.name}</td>
                <td className="td">{b.event_date}</td>
                <td className="td">{b.guests}</td>
                <td className="td"><Badge status={b.payment_status} /></td>
                <td className="td text-right font-semibold">{money(b.amount)}</td>
              </tr>
            ))}
            {completed.length === 0 && <tr><td className="td text-slate-400" colSpan={7}>No completed events yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
