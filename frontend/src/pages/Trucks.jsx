import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs, todayISO } from '../api/client';
import TruckCard from '../components/TruckCard';
import { Button, EmptyState, Spinner } from '../components/ui';

const SORTS = [
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name A-Z' },
];

export default function Trucks() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState(null);

  const filters = {
    date: params.get('date') || '',
    area: params.get('area') || '',
    cuisine: params.get('cuisine') || '',
    price_range: params.get('price_range') || '',
    q: params.get('q') || '',
    sort: params.get('sort') || 'rating',
    page: Number(params.get('page') || 1),
  };

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => { api('/meta', { auth: false }).then((r) => setLookups(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api(`/trucks${qs(filters)}`, { auth: false })
      .then((r) => { if (alive) { setData(r.data); setMeta(r.meta); } })
      .catch(() => { if (alive) { setData([]); setMeta({ total: 0, pages: 1 }); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.toString()]);

  const activeCount = ['date', 'area', 'cuisine', 'price_range', 'q'].filter((k) => filters[k]).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Browse food trucks</h1>
        <p className="mt-2 text-sm text-slate-500">
          {loading ? 'Searching…' : `${meta.total} truck${meta.total === 1 ? '' : 's'} available${filters.date ? ` for ${filters.date}` : ''}${filters.area ? ` in ${filters.area}` : ''}.`}
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
        {/* ------------------------------------------------------- filters */}
        <aside className="card h-fit p-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Filters</p>
            {activeCount > 0 && (
              <button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="text-xs font-semibold text-brand-600 hover:underline">
                Clear all
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="label">Event date</span>
              <input type="date" min={todayISO()} value={filters.date} className="input"
                onChange={(e) => update({ date: e.target.value })} />
              <span className="mt-1 block text-xs text-slate-400">Trucks already booked on this date are hidden.</span>
            </label>

            <label className="block">
              <span className="label">Service area</span>
              <select value={filters.area} className="input" onChange={(e) => update({ area: e.target.value })}>
                <option value="">Any area</option>
                {(lookups?.areas || []).map((a) => <option key={a.area_name} value={a.area_name}>{a.area_name} ({a.trucks})</option>)}
              </select>
            </label>

            <label className="block">
              <span className="label">Cuisine</span>
              <select value={filters.cuisine} className="input" onChange={(e) => update({ cuisine: e.target.value })}>
                <option value="">Any cuisine</option>
                {(lookups?.cuisines || []).map((c) => <option key={c.cuisine} value={c.cuisine}>{c.cuisine} ({c.trucks})</option>)}
              </select>
            </label>

            <label className="block">
              <span className="label">Budget band</span>
              <select value={filters.price_range} className="input" onChange={(e) => update({ price_range: e.target.value })}>
                <option value="">Any budget</option>
                {(lookups?.price_ranges || []).map((p) => <option key={p.value} value={p.value}>{p.value} - {p.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="label">Keyword</span>
              <input value={filters.q} placeholder="Name, city, dish…" className="input"
                onChange={(e) => update({ q: e.target.value })} />
            </label>
          </div>
        </aside>

        {/* ------------------------------------------------------- results */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Showing {data.length} of {meta.total}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Sort by</span>
              <select value={filters.sort} className="input w-auto py-2" onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <Spinner label="Finding food trucks…" />
          ) : data.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No trucks matched these filters"
              body="Try a different date or area. Trucks already booked on your chosen date are automatically excluded, and some listings may still be awaiting admin approval."
              action={<Button variant="subtle" onClick={() => setParams(new URLSearchParams({ sort: filters.sort }), { replace: true })}>Reset filters</Button>}
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.map((t) => <TruckCard key={t.id} truck={t} />)}
              </div>
              {meta.pages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>← Prev</Button>
                  <span className="text-sm font-semibold text-slate-600">Page {filters.page} of {meta.pages}</span>
                  <Button variant="outline" size="sm" disabled={filters.page >= meta.pages} onClick={() => update({ page: filters.page + 1 })}>Next →</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
