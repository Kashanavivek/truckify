import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, prettyDate, todayISO } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, EmptyState, Input, Modal, Select, Spinner, Stars, Textarea } from '../components/ui';

const EVENT_TYPES = ['Birthday Party', 'Wedding', 'College Fest', 'Corporate Event', 'Private Party', 'Housing Society Event', 'Food Festival', 'Other'];

/** Mini month calendar with booked dates disabled (static Google-Maps-style map block below). */
function AvailabilityCalendar({ bookedDates, onPick, selected }) {
  const [cursor, setCursor] = useState(() => new Date());
  const booked = new Set(bookedDates || []);

  const { cells, label } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startPad; i += 1) arr.push(null);
    for (let d = 1; d <= days; d += 1) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ d, iso, booked: booked.has(iso), past: iso < todayISO() });
    }
    return { cells: arr, label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  }, [cursor, bookedDates]);

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</button>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}${i}`}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <span key={`pad${i}`} />;
          const disabled = c.booked || c.past;
          return (
            <button
              key={c.iso}
              disabled={disabled}
              onClick={() => onPick(c.iso)}
              title={c.booked ? 'Already booked' : c.past ? 'Past date' : 'Available'}
              className={`aspect-square rounded-lg text-xs font-semibold transition
                ${selected === c.iso ? 'bg-brand-500 text-white'
                  : disabled ? 'cursor-not-allowed bg-slate-100 text-slate-300 line-through'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
            >
              {c.d}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-100" /> Available</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-slate-200" /> Booked / past</span>
      </div>
    </div>
  );
}

export default function TruckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isCustomer } = useAuth();
  const toast = useToast();

  const [truck, setTruck] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    package_id: '', event_date: '', event_type: 'Private Party',
    area_name: '', venue_address: '', guests: 100, notes: '',
  });

  const load = () => {
    api(`/trucks/${id}`).then((r) => setTruck(r.data)).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  const selectedPkg = truck?.packages.find((p) => String(p.id) === String(form.package_id));

  const startBooking = () => {
    if (!user) return navigate('/login', { state: { from: `/trucks/${id}` } });
    if (!isCustomer) { toast.error('Only customer accounts can send booking requests.'); return; }
    setForm((f) => ({ ...f, package_id: truck.packages[0]?.id || '', area_name: truck.areas[0]?.area_name || '', guests: truck.packages[0]?.min_guests || 50 }));
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api('/bookings', { method: 'POST', body: { ...form, truck_id: Number(id), package_id: Number(form.package_id), guests: Number(form.guests) } });
      toast.success(r.message || 'Booking request sent.');
      setOpen(false);
      navigate(`/bookings/${r.data.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState icon="🚫" title="Truck unavailable" body={error} action={<Button as={Link} to="/trucks">Back to search</Button>} /></div>;
  if (!truck) return <Spinner label="Loading truck profile…" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/trucks" className="text-sm font-semibold text-slate-500 hover:text-brand-600">← Back to all trucks</Link>

      {/* ------------------------------------------------------ header card */}
      <div className="card mt-4 overflow-hidden">
        <div className="relative h-64 bg-slate-100 sm:h-80">
          {truck.image_url
            ? <img src={truck.image_url} alt={truck.name} className="h-full w-full object-cover" />
            : <div className="grid h-full place-items-center text-6xl">🚚</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-white/95 text-slate-700">{truck.cuisine}</span>
                <span className="chip bg-white/95 text-slate-700">{truck.price_range}</span>
                {truck.status !== 'active' && <Badge status={truck.status} />}
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">{truck.name}</h1>
              <p className="mt-1 text-sm text-slate-200">{truck.tagline}</p>
            </div>
            <div className="rounded-2xl bg-white/95 px-5 py-4 text-center shadow-lift">
              <Stars value={truck.rating_avg} count={truck.rating_count} size="lg" />
              <p className="mt-1 text-xs text-slate-500">{truck.events_completed} events completed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* about */}
          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">About this truck</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{truck.description || 'No description provided yet.'}</p>
            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{truck.owner_name}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Base city</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{truck.base_city || '-'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Starting price</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{truck.starting_price ? `${money(truck.starting_price)} / event` : 'On request'}</dd></div>
            </dl>
          </section>

          {/* packages */}
          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Event packages</h2>
            <p className="mt-1 text-sm text-slate-500">A package is booked for the whole event - the price is per event, not per plate.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {truck.packages.length === 0 && <p className="text-sm text-slate-400">No packages published yet.</p>}
              {truck.packages.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 p-5 transition hover:border-brand-300 hover:shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                    <p className="whitespace-nowrap text-lg font-extrabold text-brand-600">{money(p.price_per_event)}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{p.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {(p.includes || []).map((inc) => (
                      <li key={inc} className="flex items-start gap-2 text-xs text-slate-600"><span className="mt-0.5 text-emerald-500">✓</span>{inc}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs font-semibold text-slate-500">{p.min_guests}-{p.max_guests} guests</p>
                  <Button className="mt-4 w-full" size="sm" onClick={() => {
                    if (!user) return navigate('/login', { state: { from: `/trucks/${id}` } });
                    if (!isCustomer) return toast.error('Only customer accounts can send booking requests.');
                    setForm({ ...form, package_id: p.id, guests: p.min_guests, area_name: truck.areas[0]?.area_name || '' });
                    setOpen(true);
                  }}>Book this package</Button>
                </div>
              ))}
            </div>
          </section>

          {/* menu */}
          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Menu</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200"><tr><th className="th">Item</th><th className="th">Category</th><th className="th text-right">Price</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {truck.menu.map((m) => (
                    <tr key={m.id}>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-sm ${m.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`} title={m.is_veg ? 'Veg' : 'Non-veg'} />
                          <div>
                            <p className="font-semibold text-slate-800">{m.name}</p>
                            {m.description && <p className="text-xs text-slate-400">{m.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="td text-slate-500">{m.category}</td>
                      <td className="td text-right font-semibold">{money(m.price)}</td>
                    </tr>
                  ))}
                  {truck.menu.length === 0 && <tr><td className="td text-slate-400" colSpan={3}>Menu not published yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* service areas + map */}
          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Service areas</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {truck.areas.map((a) => <span key={a.id} className="chip bg-slate-100 text-slate-700">📍 {a.area_name}{a.radius_km ? ` · ${a.radius_km} km` : ''}</span>)}
              {truck.areas.length === 0 && <p className="text-sm text-slate-400">No service areas defined - contact the owner.</p>}
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="relative h-56 bg-[linear-gradient(45deg,#eef2f7_25%,transparent_25%,transparent_75%,#eef2f7_75%),linear-gradient(45deg,#eef2f7_25%,#f8fafc_25%,#f8fafc_75%,#eef2f7_75%)] bg-[length:22px_22px] bg-[position:0_0,11px_11px]">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="rounded-2xl bg-white/95 px-5 py-3 text-center shadow-card">
                    <p className="text-2xl">📍</p>
                    <p className="text-sm font-bold text-slate-800">{truck.base_city || 'Bengaluru'} service region</p>
                    <p className="text-xs text-slate-500">Static map representation (Maps module)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* reviews */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Verified reviews</h2>
              <Stars value={truck.rating_avg} count={truck.review_count} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Only customers whose event was marked completed can review this truck.</p>
            <div className="mt-4 space-y-4">
              {truck.reviews.length === 0 && <p className="text-sm text-slate-400">No reviews yet.</p>}
              {truck.reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{r.customer_name}</p>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.comment}</p>}
                  <p className="mt-1.5 text-[11px] text-slate-400">Verified booking · {String(r.created_at).slice(0, 10)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ------------------------------------------------------- booking rail */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Starting from</p>
            <p className="text-2xl font-extrabold text-slate-900">{truck.starting_price ? money(truck.starting_price) : 'On request'}</p>
            <p className="text-xs text-slate-500">per event · whole truck</p>
            <Button className="mt-4 w-full" size="lg" onClick={startBooking}>Send booking request</Button>
            {!user && <p className="mt-2 text-center text-xs text-slate-400">You will be asked to log in.</p>}
            {user && !isCustomer && <p className="mt-2 text-center text-xs text-amber-600">Signed in as {user.role} - switch to a customer account to book.</p>}
            <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <li>✓ Owner accepts or declines your request</li>
              <li>✓ Pay only after acceptance (simulated in this demo)</li>
              <li>✓ One truck is never double-booked on a date</li>
            </ul>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">Availability</p>
            <p className="mt-1 text-xs text-slate-500">Booked dates are struck out.</p>
            <div className="mt-3">
              <AvailabilityCalendar
                bookedDates={truck.booked_dates}
                selected={form.event_date}
                onPick={(iso) => { setForm((f) => ({ ...f, event_date: iso })); if (!open) startBooking(); }}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* -------------------------------------------------------- booking modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Book ${truck.name}`}
        wide
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="booking-form" type="submit" loading={saving}>Send request</Button>
        </>}
      >
        <form id="booking-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Select label="Package" value={form.package_id} required
            onChange={(e) => { const p = truck.packages.find((x) => String(x.id) === e.target.value); setForm({ ...form, package_id: e.target.value, guests: p?.min_guests || form.guests }); }}>
            <option value="">Select a package</option>
            {truck.packages.map((p) => <option key={p.id} value={p.id}>{p.name} - {money(p.price_per_event)} ({p.min_guests}-{p.max_guests} guests)</option>)}
          </Select>
          <Select label="Event type" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Event date" type="date" required min={todayISO()} value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          <Select label="Service area" required value={form.area_name} hint="Only areas this truck serves are listed." onChange={(e) => setForm({ ...form, area_name: e.target.value })}>
            <option value="">Select an area</option>
            {truck.areas.map((a) => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
          </Select>
          <Input label="Expected guests" type="number" required min={1} max={5000} value={form.guests}
            hint={selectedPkg ? `Allowed: ${selectedPkg.min_guests}-${selectedPkg.max_guests}` : ''} onChange={(e) => setForm({ ...form, guests: e.target.value })} />
          <Input label="Venue address" value={form.venue_address} placeholder="Society / hall / campus name" onChange={(e) => setForm({ ...form, venue_address: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Notes for the owner" rows={3} value={form.notes} placeholder="Timings, cuisine preferences, power/water availability…" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {selectedPkg && (
            <div className="sm:col-span-2 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="flex items-center justify-between text-sm font-bold text-brand-800">
                <span>Estimated total (per event)</span><span>{money(selectedPkg.price_per_event)}</span>
              </div>
              <p className="mt-1 text-xs text-brand-700">
                Payment is only collected after the owner accepts your request. In this demo the payment step is simulated -
                no real transaction is performed.
              </p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
