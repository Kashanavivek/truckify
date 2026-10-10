import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, prettyDate } from '../../api/client';
import { Badge, Button, StatCard, Spinner, EmptyState } from '../../components/ui';

export default function OwnerDashboard() {
  const [trucks, setTrucks] = useState(null);
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api('/trucks/owner/mine').then((r) => setTrucks(r.data)).catch(() => setTrucks([]));
    api('/bookings/summary').then((r) => setSummary(r.data)).catch(() => {});
    api('/bookings?status=pending').then((r) => setRequests(r.data)).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Owner console</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your trucks, respond to booking requests and track event-day progress.</p>
        </div>
        <Button as={Link} to="/owner/new">+ List a new truck</Button>
      </header>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Booking requests" value={summary.counters.pending || 0} tone="amber" icon="📩" />
          <StatCard label="Confirmed events" value={summary.counters.confirmed || 0} tone="indigo" icon="✅" />
          <StatCard label="Completed events" value={summary.counters.completed || 0} tone="emerald" icon="🏁" />
          <StatCard label="Paid booking value" value={money(summary.counters.revenue_paid)} tone="brand" icon="💰" />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">My trucks</h2>
            <Link to="/owner/bookings" className="text-sm font-semibold text-brand-600 hover:underline">All requests →</Link>
          </div>
          <div className="mt-4 space-y-4">
            {trucks === null ? <Spinner /> : trucks.length === 0 ? (
              <EmptyState icon="🚚" title="No trucks listed yet"
                body="Register your food truck, add menus, packages and service areas, then submit it for admin approval."
                action={<Button as={Link} to="/owner/new">List your first truck</Button>} />
            ) : trucks.map((t) => (
              <div key={t.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
                  {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-2xl">🚚</div>}
                </div>
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-slate-900">{t.name}</p>
                    <Badge status={t.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.cuisine} · {t.price_range} · ★ {Number(t.rating_avg || 0).toFixed(1)} ({t.rating_count})</p>
                  <p className="mt-1 text-xs text-slate-400">{t.menu_count} menu items · {t.package_count} packages · {t.area_count} areas · {t.booking_count} bookings</p>
                  {t.status === 'rejected' && t.rejection_reason && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">Rejected: {t.rejection_reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button as={Link} to={`/owner/trucks/${t.id}`} size="sm" variant="outline">Manage</Button>
                  <Button as={Link} to={`/trucks/${t.id}`} size="sm" variant="ghost">Preview</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Pending requests</h2>
              <span className="chip bg-amber-100 text-amber-800">{requests.length}</span>
            </div>
            <div className="mt-3 space-y-3">
              {requests.length === 0 && <p className="text-sm text-slate-400">No requests waiting for your response.</p>}
              {requests.slice(0, 5).map((b) => (
                <Link key={b.id} to={`/bookings/${b.id}`} className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300">
                  <p className="text-sm font-bold text-slate-800">{b.truck?.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{b.event_type} · {prettyDate(b.event_date)} · {b.guests} guests</p>
                  <p className="mt-1 text-xs font-semibold text-brand-600">{money(b.amount)} → respond</p>
                </Link>
              ))}
            </div>
          </div>

          {summary?.upcoming?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-slate-900">Upcoming events</h2>
              <ul className="mt-3 space-y-3">
                {summary.upcoming.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{u.truck_name}</p>
                      <p className="text-xs text-slate-500">{prettyDate(u.event_date)} · {u.area_name}</p>
                    </div>
                    <Badge status={u.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
