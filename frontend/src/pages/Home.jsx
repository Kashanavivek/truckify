import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import TruckCard from '../components/TruckCard';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const HERO = 'https://sspark.genspark.ai/i/RcmkIEALLBkwqpUP?width=1920';

const STEPS = [
  { n: '01', t: 'Search by date + area', d: 'Tell us when and where your event is. We show only trucks that are free and serve that area.' },
  { n: '02', t: 'Compare menus & packages', d: 'Check truck profiles, menus, packages, prices, ratings and verified reviews.' },
  { n: '03', t: 'Send a booking request', d: 'Pick a package, enter event details and send the request to the truck owner.' },
  { n: '04', t: 'Pay & get confirmed', d: 'Once the owner accepts, pay (simulated in this demo) and your event is confirmed.' },
  { n: '05', t: 'Track event day', d: 'Follow the truck from en route to arrived to completed, then leave a review.' },
];

export default function Home() {
  const { user } = useAuth();
  const [featured, setFeatured] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    api('/trucks?limit=6&sort=rating', { auth: false }).then((r) => setFeatured(r.data)).catch(() => setFeatured([]));
    api('/meta', { auth: false }).then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <img src={HERO} alt="Food truck at an event" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/92 via-slate-900/80 to-slate-900/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <span className="chip bg-white/15 text-white backdrop-blur">Event-based food truck booking platform</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white   sm:text-5xl">
              Book an entire food truck<br />for your next event.
            </h1>
            <p className="mt-5 max-w-xl rounded-lg bg-white p-3 text-base leading-relaxed text-slate-900">
              Birthdays, weddings, college fests, corporate events and private parties - Truckify connects event
              organizers with verified food truck owners in one transparent marketplace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/trucks" size="lg">Find a food truck</Button>
              <Button as={Link} to={user?.role === 'owner' ? '/owner' : '/register'} variant="outline" size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                List your food truck
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-6">
              {[['Whole truck', 'not just delivery'], ['Verified', 'admin-approved listings'], ['No double booking', 'one truck, one date']].map(([a, b]) => (
                <div key={a}>
                  <dt className="text-lg font-bold text-white">{a}</dt>
                  <dd className="text-xs text-slate-300">{b}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- searching */}
      <section className="mx-auto -mt-8 max-w-7xl px-4 sm:px-6">
        <div className="card p-5 shadow-lift">
          <p className="text-sm font-bold text-slate-800">Search food trucks for your event</p>
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const params = new URLSearchParams();
            for (const [k, v] of f.entries()) if (v) params.set(k, v);
            window.location.href = `/trucks?${params.toString()}`;
          }}>
            <label className="block">
              <span className="label">Event date</span>
              <input type="date" name="date" className="input" min={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="block">
              <span className="label">Area</span>
              <select name="area" className="input">
                <option value="">Any area</option>
                {(meta?.areas || []).map((a) => <option key={a.area_name} value={a.area_name}>{a.area_name} ({a.trucks})</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Cuisine</span>
              <select name="cuisine" className="input">
                <option value="">Any cuisine</option>
                {(meta?.cuisines || []).map((c) => <option key={c.cuisine} value={c.cuisine}>{c.cuisine} ({c.trucks})</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Search trucks</Button>
            </div>
          </form>
        </div>
      </section>

      {/* -------------------------------------------------------------- steps */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">How Truckify works</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          A request → accept → simulated payment → confirmation workflow, with double-booking prevention at the
          database level.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-4">
              <span className="text-xs font-extrabold tracking-widest text-brand-500">{s.n}</span>
              <p className="mt-2 text-sm font-bold text-slate-800">{s.t}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------ modules */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { i: '🍽️', t: 'Customer module', d: 'Search by date and area, view truck profiles, menus, packages, ratings and reviews, send booking requests, pay (simulated), track booking history, cancel and review.' },
            { i: '🚚', t: 'Owner module', d: 'Register trucks, manage profile, menu, packages and service areas, handle booking requests, use the event calendar and track earnings.' },
            { i: '🛡️', t: 'Admin module', d: 'Verify and approve truck listings, manage trucks, monitor every booking on the platform and watch platform statistics.' },
          ].map((m) => (
            <div key={m.t} className="card p-6">
              <span className="text-3xl">{m.i}</span>
              <h3 className="mt-3 text-base font-bold text-slate-900">{m.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- featured */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Top rated food trucks</h2>
            <p className="mt-2 text-sm text-slate-500">Verified listings, reviewed only by customers who completed an event.</p>
          </div>
          <Link to="/trucks" className="hidden shrink-0 text-sm font-semibold text-brand-600 hover:underline sm:block">Browse all →</Link>
        </div>

        {featured === null ? (
          <Spinner />
        ) : featured.length === 0 ? (
          <p className="card mt-6 p-8 text-center text-sm text-slate-500">
            No trucks are live yet. Sign in as the admin (admin@truckify.test / Admin@123) and approve a pending listing.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => <TruckCard key={t.id} truck={t} />)}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- demo logins */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-800">Demo accounts (seeded)</h3>
            <p className="text-xs text-slate-500">Use these to walk through all three roles in the presentation.</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[
              ['Customer', 'customer@truckify.test', 'Customer@123'],
              ['Owner', 'owner@truckify.test', 'Owner@123'],
              ['Admin', 'admin@truckify.test', 'Admin@123'],
            ].map(([role, email, pw]) => (
              <div key={role} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{role}</p>
                <p className="mt-2 font-mono text-xs text-slate-700">{email}</p>
                <p className="font-mono text-xs text-slate-500">{pw}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
