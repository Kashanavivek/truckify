import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, EmptyState, Input, Select, Spinner, Textarea } from '../../components/ui';

const TABS = ['Profile', 'Menu', 'Packages', 'Service areas'];

function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val ? [val] : [];
    }
  }
  return [];
}

export default function OwnerTruckManage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Profile');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [menu, setMenu] = useState({ name: '', description: '', category: 'Main', price: '', is_veg: true });
  const [pkg, setPkg] = useState({ name: '', description: '', price_per_event: '', min_guests: 50, max_guests: 300, includes: '' });
  const [area, setArea] = useState({ area_name: '', radius_km: 15 });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/trucks/${id}`);
      if (r?.data) {
        setTruck(r.data);
        setProfile({
          name: r.data.name || '',
          tagline: r.data.tagline || '',
          description: r.data.description || '',
          cuisine: r.data.cuisine || '',
          price_range: r.data.price_range || '$$',
          base_city: r.data.base_city || '',
          image_url: r.data.image_url || '',
        });
      } else {
        setError('Truck data could not be loaded.');
      }
    } catch (e) {
      setError(e.message || 'Failed to load truck.');
      toast.error(e.message || 'Failed to load truck.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok || r?.message || 'Saved.');
      await load();
      if (refresh) refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Spinner label="Loading truck details…" />
      </div>
    );
  }

  if (error || !truck) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center">
        <div className="card mx-auto max-w-md p-8">
          <span className="text-4xl">🚚</span>
          <h2 className="mt-3 text-lg font-bold text-slate-800">Unable to load truck</h2>
          <p className="mt-2 text-sm text-slate-500">{error || 'Truck not found or you do not have permission to view it.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/owner')}>← Back to Console</Button>
            <Button onClick={load}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const submitForApproval = () => run(() => api(`/trucks/${truck.id}/submit`, { method: 'POST' }), 'Submitted for admin approval.');

  const menuItems = safeArray(truck.menu);
  const packages = safeArray(truck.packages);
  const areas = safeArray(truck.areas);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <button onClick={() => navigate('/owner')} className="text-sm font-semibold text-slate-500 hover:text-brand-600">← Owner console</button>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{truck.name}</h1>
            <Badge status={truck.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {truck.cuisine} · {truck.price_range} · ★ {Number(truck.rating_avg || 0).toFixed(1)} ({truck.rating_count ?? truck.review_count ?? 0} reviews)
          </p>
          {truck.rejection_reason && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Admin feedback: {truck.rejection_reason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/trucks/${truck.id}`} variant="outline" size="sm">Preview profile</Button>
          {truck.status !== 'active' && <Button size="sm" loading={busy} onClick={submitForApproval}>Submit for approval</Button>}
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {/* ------------------------------------------------------- profile */}
        {tab === 'Profile' && profile && (
          <form
            className="card space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/trucks/${truck.id}`, { method: 'PUT', body: profile }));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <Input label="Cuisine" required value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })} />
              <Input label="Tagline" value={profile.tagline} onChange={(e) => setProfile({ ...profile, tagline: e.target.value })} />
              <Select label="Price range" value={profile.price_range} onChange={(e) => setProfile({ ...profile, price_range: e.target.value })}>
                <option value="$">$</option>
                <option value="$$">$$</option>
                <option value="$$$">$$$</option>
              </Select>
              <Input label="Base city" value={profile.base_city} onChange={(e) => setProfile({ ...profile, base_city: e.target.value })} />
              <Input label="Cover image URL" value={profile.image_url} onChange={(e) => setProfile({ ...profile, image_url: e.target.value })} />
            </div>
            <Textarea label="Description" rows={4} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} />
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Editing an already-approved truck sends the listing back to the admin for re-verification.
            </p>
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>Save profile</Button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------------- menu */}
        {tab === 'Menu' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th">Category</th>
                    <th className="th text-right">Price</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {menuItems.map((m) => (
                    <tr key={m.id}>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-sm ${m.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <div>
                            <p className="font-semibold text-slate-800">{m.name}</p>
                            {m.description && <p className="text-xs text-slate-400">{m.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="td text-slate-500">{m.category}</td>
                      <td className="td text-right font-semibold">{money(m.price)}</td>
                      <td className="td text-right">
                        <button
                          className="text-xs font-semibold text-rose-600 hover:underline"
                          onClick={() => run(() => api(`/trucks/menu/${m.id}`, { method: 'DELETE' }), 'Menu item removed.')}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr>
                      <td className="td text-slate-400" colSpan={4}>No menu items yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form
              className="card h-fit space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => api(`/trucks/${truck.id}/menu`, { method: 'POST', body: { ...menu, price: Number(menu.price) } }),
                  'Menu item added.'
                );
                setMenu({ name: '', description: '', category: 'Main', price: '', is_veg: true });
              }}
            >
              <p className="text-sm font-bold text-slate-800">Add a menu item</p>
              <Input label="Item name" required value={menu.name} onChange={(e) => setMenu({ ...menu, name: e.target.value })} />
              <Input label="Description" value={menu.description} onChange={(e) => setMenu({ ...menu, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Category" value={menu.category} onChange={(e) => setMenu({ ...menu, category: e.target.value })} />
                <Input label="Price" type="number" min="0" required value={menu.price} onChange={(e) => setMenu({ ...menu, price: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_veg"
                  checked={menu.is_veg}
                  onChange={(e) => setMenu({ ...menu, is_veg: e.target.checked })}
                  className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                />
                <label htmlFor="is_veg" className="text-xs font-semibold text-slate-700">Vegetarian</label>
              </div>
              <Button type="submit" className="w-full" loading={busy}>Add item</Button>
            </form>
          </div>
        )}

        {/* ----------------------------------------------------- packages */}
        {tab === 'Packages' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {packages.map((p) => {
                const inc = safeArray(p.includes);
                return (
                  <div key={p.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-slate-900">{p.name}</p>
                          {!p.is_active && <Badge status="inactive">Archived</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{p.description}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {p.min_guests}-{p.max_guests} guests{inc.length > 0 ? ` · ${inc.join(' · ')}` : ''}
                        </p>
                      </div>
                      <p className="text-lg font-extrabold text-brand-600">{money(p.price_per_event)}</p>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        className="text-xs font-semibold text-slate-500 hover:underline"
                        onClick={() => run(() => api(`/trucks/packages/${p.id}`, { method: 'PUT', body: { is_active: !p.is_active } }), 'Package updated.')}
                      >
                        {p.is_active ? 'Archive' : 'Reactivate'}
                      </button>
                      <button
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() => run(() => api(`/trucks/packages/${p.id}`, { method: 'DELETE' }), 'Package removed.')}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {packages.length === 0 && (
                <EmptyState icon="📦" title="No packages yet" body="Add at least one event package - the admin approval requires it." />
              )}
            </div>
            <form
              className="card h-fit space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    api(`/trucks/${truck.id}/packages`, {
                      method: 'POST',
                      body: {
                        ...pkg,
                        price_per_event: Number(pkg.price_per_event),
                        min_guests: Number(pkg.min_guests),
                        max_guests: Number(pkg.max_guests),
                        includes: pkg.includes ? pkg.includes.split(',').map((s) => s.trim()).filter(Boolean) : [],
                      },
                    }),
                  'Package added.'
                );
                setPkg({ name: '', description: '', price_per_event: '', min_guests: 50, max_guests: 300, includes: '' });
              }}
            >
              <p className="text-sm font-bold text-slate-800">Add an event package</p>
              <Input label="Package name" required value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} />
              <Input label="Description" value={pkg.description} onChange={(e) => setPkg({ ...pkg, description: e.target.value })} />
              <Input label="Price per event" type="number" min="0" required value={pkg.price_per_event} onChange={(e) => setPkg({ ...pkg, price_per_event: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Min guests" type="number" min="1" value={pkg.min_guests} onChange={(e) => setPkg({ ...pkg, min_guests: e.target.value })} />
                <Input label="Max guests" type="number" min="1" value={pkg.max_guests} onChange={(e) => setPkg({ ...pkg, max_guests: e.target.value })} />
              </div>
              <Input label="Includes (comma separated)" value={pkg.includes} placeholder="4 starters, 2 breads, service staff" onChange={(e) => setPkg({ ...pkg, includes: e.target.value })} />
              <Button type="submit" className="w-full" loading={busy}>Add package</Button>
            </form>
          </div>
        )}

        {/* -------------------------------------------------- service areas */}
        {tab === 'Service areas' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="card p-5">
              <p className="text-sm font-bold text-slate-800">Areas you serve ({areas.length})</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {areas.map((a) => (
                  <span key={a.id} className="chip bg-slate-100 text-slate-700">
                    📍 {a.area_name}{a.radius_km ? ` · ${a.radius_km} km` : ''}
                    <button
                      className="ml-1 text-slate-400 hover:text-rose-600"
                      onClick={() => run(() => api(`/trucks/areas/${a.id}`, { method: 'DELETE' }), 'Service area removed.')}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {areas.length === 0 && (
                  <p className="text-sm text-slate-400">Add at least one service area - customers can only book trucks that serve their area.</p>
                )}
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Customers searching by area will only see trucks that list that area. Bookings outside your service areas
                are rejected by the API.
              </p>
            </div>
            <form
              className="card h-fit space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => api(`/trucks/${truck.id}/areas`, { method: 'POST', body: { ...area, radius_km: Number(area.radius_km) } }),
                  'Service area added.'
                );
                setArea({ area_name: '', radius_km: 15 });
              }}
            >
              <p className="text-sm font-bold text-slate-800">Add a service area</p>
              <Input label="Area name" required value={area.area_name} placeholder="Koramangala" onChange={(e) => setArea({ ...area, area_name: e.target.value })} />
              <Input label="Radius (km)" type="number" min="1" value={area.radius_km} onChange={(e) => setArea({ ...area, radius_km: e.target.value })} />
              <Button type="submit" className="w-full" loading={busy}>Add area</Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
