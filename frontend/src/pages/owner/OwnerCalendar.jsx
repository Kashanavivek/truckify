import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../../api/client';
import { Badge, Button, Spinner } from '../../components/ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OwnerCalendar() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/bookings/calendar?month=${month}`).then((r) => setData(r.data)).catch(() => setData({ bookings: [] }));
  }, [month]);

  const byDate = useMemo(() => {
    const m = {};
    (data?.bookings || []).forEach((b) => { (m[b.event_date] ||= []).push(b); });
    return m;
  }, [data]);

  const { cells, label } = useMemo(() => {
    const [y, mo] = month.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const days = new Date(y, mo, 0).getDate();
    const arr = [];
    for (let i = 0; i < first.getDay(); i += 1) arr.push(null);
    for (let d = 1; d <= days; d += 1) arr.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return { cells: arr, label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  }, [month]);

  const shift = (n) => {
    const [y, mo] = month.split('-').map(Number);
    const dt = new Date(y, mo - 1 + n, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Event calendar</h1>
          <p className="mt-2 text-sm text-slate-500">All live bookings per date. A date with a live booking cannot be booked again - double-booking is blocked by the API and the database.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>←</Button>
          <span className="min-w-[150px] text-center text-sm font-bold text-slate-700">{label}</span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>→</Button>
        </div>
      </header>

      {data === null ? <Spinner /> : (
        <div className="card mt-6 overflow-hidden p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
            {DOW.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`pad${i}`} />;
              const items = byDate[iso] || [];
              const day = Number(iso.slice(-2));
              return (
                <div key={iso} className={`min-h-[92px] rounded-xl border p-2 ${items.length ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-white'}`}>
                  <p className="text-xs font-bold text-slate-500">{day}</p>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 2).map((b) => (
                      <Link key={b.id} to={`/bookings/${b.id}`} className="block rounded-lg bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-brand-100">
                        <span className="block truncate">{b.truck_name}</span>
                        <span className="text-[9px] font-normal text-slate-400">{money(b.amount)}</span>
                      </Link>
                    ))}
                    {items.length > 2 && <p className="text-[10px] font-semibold text-brand-600">+{items.length - 2} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-sm font-bold text-slate-800">Bookings in {label} ({(data?.bookings || []).length})</p>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-200"><tr><th className="th">Date</th><th className="th">Truck</th><th className="th">Customer</th><th className="th">Event</th><th className="th">Guests</th><th className="th text-right">Amount</th><th className="th">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.bookings || []).map((b) => (
              <tr key={b.id}>
                <td className="td font-semibold">{b.event_date}</td>
                <td className="td">{b.truck_name}</td>
                <td className="td text-slate-600">{b.customer_name}</td>
                <td className="td text-slate-600">{b.event_type}<span className="block text-xs text-slate-400">{b.area_name}</span></td>
                <td className="td">{b.guests}</td>
                <td className="td text-right font-semibold">{money(b.amount)}</td>
                <td className="td"><Badge status={b.status} /></td>
              </tr>
            ))}
            {(data?.bookings || []).length === 0 && <tr><td className="td text-slate-400" colSpan={7}>No bookings this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
