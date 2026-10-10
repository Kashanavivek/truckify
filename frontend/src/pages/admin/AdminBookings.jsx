import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, prettyDate, qs } from '../../api/client';
import { Badge, EmptyState, Input, Spinner, StatCard } from '../../components/ui';

const STATUSES = ['all', 'pending', 'accepted', 'confirmed', 'en_route', 'arrived', 'completed', 'declined', 'cancelled'];

export default function AdminBookings() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => { api('/admin/stats').then((r) => setStats(r.data.counts)).catch(() => {}); }, []);

  useEffect(() => {
    setRows(null);
    api(`/admin/bookings${qs({ status: status === 'all' ? '' : status, q })}`)
      .then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [status, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Monitor bookings</h1>
        <p className="mt-2 text-sm text-slate-500">Every booking on the platform, across all trucks and customers. Admin view is read-only.</p>
      </header>

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total bookings" value={stats.bookings_total} icon="📋" />
          <StatCard label="Awaiting owner" value={stats.bookings_pending} tone="amber" icon="⏳" />
          <StatCard label="Completed" value={stats.bookings_completed} tone="emerald" icon="🏁" />
          <StatCard label="Cancelled" value={stats.bookings_cancelled} tone="rose" icon="🚫" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full sm:w-64">
          <Input placeholder="Search code / truck / customer" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="📋" title="No bookings match" body="Adjust the status filter or clear the search." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr><th className="th">Code</th><th className="th">Truck</th><th className="th">Customer</th><th className="th">Event</th><th className="th">Guests</th><th className="th">Status</th><th className="th">Payment</th><th className="th text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="td"><Link to={`/bookings/${b.id}`} className="font-mono text-xs text-brand-600 hover:underline">{b.code}</Link></td>
                    <td className="td text-slate-700">{b.truck_name}<span className="block text-xs text-slate-400">{b.cuisine}</span></td>
                    <td className="td text-slate-600">{b.customer_name}<span className="block text-xs text-slate-400">{b.customer_email}</span></td>
                    <td className="td text-slate-600">{prettyDate(b.event_date)}<span className="block text-xs text-slate-400">{b.event_type} · {b.area_name}</span></td>
                    <td className="td">{b.guests}</td>
                    <td className="td"><Badge status={b.status} /></td>
                    <td className="td"><Badge status={b.payment_status} />{b.payment_ref && <span className="mt-1 block font-mono text-[10px] text-slate-400">{b.payment_ref}</span>}</td>
                    <td className="td text-right font-semibold">{money(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
