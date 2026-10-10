import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, prettyDate } from '../../api/client';
import { Badge, BarChart, Button, Spinner, StatCard, Stars } from '../../components/ui';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => { api('/admin/stats').then((r) => setStats(r.data)).catch(() => {}); }, []);

  if (!stats) return <Spinner label="Loading platform statistics…" />;
  const c = stats.counts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Platform overview</h1>
          <p className="mt-2 text-sm text-slate-500">Verification queue, marketplace health and booking activity across Truckify.</p>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/admin/approvals" variant="subtle">Approvals {c.trucks_pending > 0 && `(${c.trucks_pending})`}</Button>
          <Button as={Link} to="/admin/bookings" variant="outline">All bookings</Button>
        </div>
      </header>

      {c.trucks_pending > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">
            {c.trucks_pending} truck listing{c.trucks_pending === 1 ? '' : 's'} waiting for verification.
          </p>
          <Button as={Link} to="/admin/approvals" size="sm">Review queue</Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value={c.customers} icon="🍽️" />
        <StatCard label="Truck owners" value={c.owners} icon="🚚" />
        <StatCard label="Active trucks" value={`${c.trucks_active}/${c.trucks_total}`} tone="emerald" icon="✅" />
        <StatCard label="Pending approvals" value={c.trucks_pending} tone="amber" icon="🛡️" />
        <StatCard label="Total bookings" value={c.bookings_total} tone="sky" icon="📋" />
        <StatCard label="Completed events" value={c.bookings_completed} tone="emerald" icon="🏁" />
        <StatCard label="Paid booking value" value={money(c.gmv_paid)} tone="brand" icon="💳" />
        <StatCard label="Average rating" value={Number(c.avg_rating || 0).toFixed(2)} sub={`${c.reviews_total} verified reviews`} tone="amber" icon="⭐" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-6">
          <h2 className="text-base font-bold text-slate-900">Bookings & value by month</h2>
          <p className="mt-1 text-xs text-slate-500">Bars show booking value; the booking count is in the tooltip.</p>
          <div className="mt-5"><BarChart data={stats.monthly} valueKey="value" labelKey="month" /></div>
          <table className="mt-5 w-full">
            <thead className="border-b border-slate-200"><tr><th className="th">Month</th><th className="th">Bookings</th><th className="th text-right">Value</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {stats.monthly.map((m) => (
                <tr key={m.month}><td className="td font-semibold">{m.month}</td><td className="td">{m.bookings}</td><td className="td text-right font-semibold">{money(m.value)}</td></tr>
              ))}
              {stats.monthly.length === 0 && <tr><td className="td text-slate-400" colSpan={3}>No bookings yet.</td></tr>}
            </tbody>
          </table>
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-900">Top trucks by bookings</h2>
            <ul className="mt-4 space-y-4">
              {stats.top_trucks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/trucks/${t.id}`} className="block truncate text-sm font-bold text-slate-800 hover:text-brand-600">{t.name}</Link>
                    <p className="text-xs text-slate-500">{t.cuisine} · {t.bookings} bookings</p>
                    <Stars value={t.rating_avg} count={t.rating_count} />
                  </div>
                  <span className="whitespace-nowrap text-sm font-extrabold text-slate-900">{money(t.revenue)}</span>
                </li>
              ))}
              {stats.top_trucks.length === 0 && <li className="text-sm text-slate-400">No trucks registered yet.</li>}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-900">Marketplace by cuisine</h2>
            <ul className="mt-4 space-y-3">
              {stats.by_cuisine.map((c2) => (
                <li key={c2.cuisine} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">{c2.cuisine}</span>
                  <span className="text-slate-500">{c2.trucks} trucks · ★ {Number(c2.avg_rating).toFixed(1)}</span>
                </li>
              ))}
              {stats.by_cuisine.length === 0 && <li className="text-sm text-slate-400">No active trucks yet.</li>}
            </ul>
          </div>
        </aside>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-sm font-bold text-slate-800">Recent bookings</p>
          <Link to="/admin/bookings" className="text-xs font-semibold text-brand-600 hover:underline">View all →</Link>
        </div>
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200"><tr><th className="th">Code</th><th className="th">Truck</th><th className="th">Customer</th><th className="th">Event date</th><th className="th">Status</th><th className="th">Payment</th><th className="th text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {stats.recent_bookings.map((b) => (
              <tr key={b.id}>
                <td className="td"><Link to={`/bookings/${b.id}`} className="font-mono text-xs text-brand-600 hover:underline">{b.code}</Link></td>
                <td className="td">{b.truck_name}</td>
                <td className="td text-slate-600">{b.customer_name}</td>
                <td className="td">{prettyDate(b.event_date)}</td>
                <td className="td"><Badge status={b.status} /></td>
                <td className="td"><Badge status={b.payment_status} /></td>
                <td className="td text-right font-semibold">{money(b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
