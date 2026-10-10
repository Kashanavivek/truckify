import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Badge } from './ui';

const linkBase = 'rounded-lg px-3 py-2 text-sm font-semibold transition';

function Bell() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const load = async () => {
    if (!user) return;
    try {
      const r = await api('/notifications?limit=12');
      setItems(r.data);
      setUnread(r.meta.unread);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // light polling for the notification module
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,360px)] animate-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-brand-600 hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Nothing here yet.</p>}
            {items.map((n) => (
              <div key={n.id} className={`px-4 py-3 ${n.is_read ? '' : 'bg-brand-50/50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </div>
                {n.body && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{String(n.created_at).slice(0, 16)}</p>
              </div>
            ))}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-brand-600 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout, isCustomer, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [{ to: '/trucks', label: 'Browse trucks' }];
  if (isCustomer) links.push({ to: '/my-bookings', label: 'My bookings' });
  if (isOwner) {
    links.push({ to: '/owner', label: 'Owner console' });
    links.push({ to: '/owner/bookings', label: 'Requests' });
    links.push({ to: '/owner/calendar', label: 'Calendar' });
  }
  if (isAdmin) links.push({ to: '/admin', label: 'Admin' });

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-lg shadow-sm">🚚</span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            Truck<span className="text-brand-500">ify</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Bell />
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-slate-800">{user.name}</p>
                <Badge status={user.role === 'admin' ? 'confirmed' : user.role === 'owner' ? 'accepted' : 'completed'} className="mt-0.5">
                  {user.role}
                </Badge>
              </div>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Log in</Link>
              <Link to="/register" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Get started</Link>
            </>
          )}
          <button onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Menu">☰</button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
              className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
