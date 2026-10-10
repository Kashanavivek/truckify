import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, prettyDate, qs } from '../api/client';
import { Badge, Button, EmptyState, Spinner, StatCard } from '../components/ui';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Awaiting owner' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function CustomerBookings() {
  const [tab, setTab] = useState('all');
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setRows(null);
    api(`/bookings${qs({ status: tab })}`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [tab]);

  useEffect(() => { api('/bookings/summary').then((r) => setSummary(r.data)).catch(() => {}); }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My bookings</h1>
          <p className="mt-2 text-sm text-slate-500">Every request you sent, its status, payment state and event-day progress.</p>
        </div>
        <Button as={Link} to="/trucks" variant="subtle">+ New booking</Button>
      </header>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total bookings" value={summary.counters.total || 0} icon="📋" />
          <StatCard label="Awaiting owner" value={summary.counters.pending || 0} tone="amber" icon="⏳" />
          <StatCard label="Upcoming confirmed" value={summary.counters.confirmed || 0} tone="indigo" icon="✅" />
          <StatCard label="Amount paid" value={money(summary.counters.revenue_paid)} tone="emerald" icon="💳" />
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="🎪" title="No bookings in this view" body="Search for a food truck, pick a package and send your first booking request."
            action={<Button as={Link} to="/trucks">Browse food trucks</Button>} />
        ) : (
          <div className="space-y-4">
            {rows.map((b) => (
              <div key={b.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {b.truck?.image_url ? <img src={b.truck.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-2xl">🚚</div>}
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/bookings/${b.id}`} className="text-base font-bold text-slate-900 hover:text-brand-600">{b.truck?.name}</Link>
                      <Badge status={b.status} />
                      <Badge status={b.payment_status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {b.code} · {b.event_type} · {prettyDate(b.event_date)} · {b.area_name} · {b.guests} guests
                    </p>
                    {b.package && <p className="mt-1 text-xs text-slate-400">Package: {b.package.name}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">{money(b.amount)}</p>
                    <Link to={`/bookings/${b.id}`} className="text-xs font-semibold text-brand-600 hover:underline">Manage →</Link>
                  </div>
                </div>
                {b.status === 'accepted' && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                    <p className="text-xs font-semibold text-brand-800">The owner accepted your request - complete the simulated payment to confirm.</p>
                    <Button as={Link} to={`/bookings/${b.id}`} size="sm">Pay now</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
