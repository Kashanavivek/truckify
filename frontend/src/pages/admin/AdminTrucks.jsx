import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge, EmptyState, Spinner } from '../../components/ui';

const FILTERS = ['all', 'active', 'pending', 'rejected', 'inactive'];

export default function AdminTrucks() {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState(null);

  const load = () => { setRows(null); api(`/admin/trucks${status === 'all' ? '' : `?status=${status}`}`).then((r) => setRows(r.data)).catch(() => setRows([])); };
  useEffect(load, [status]);

  const setTruckStatus = async (id, next) => {
    try { const r = await api(`/admin/trucks/${id}/status`, { method: 'PATCH', body: { status: next } }); toast.success(`Truck marked ${next}.`); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Manage trucks</h1>
        <p className="mt-2 text-sm text-slate-500">Activate, suspend or re-open any listing on the marketplace.</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${status === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="🚚" title="No trucks in this view" body="Try another status filter." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr><th className="th">Truck</th><th className="th">Owner</th><th className="th">Cuisine</th><th className="th">Content</th><th className="th">Rating</th><th className="th">Status</th><th className="th text-right">Moderation</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100">
                          {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center">🚚</div>}
                        </div>
                        <Link to={`/trucks/${t.id}`} className="font-semibold text-slate-800 hover:text-brand-600">{t.name}</Link>
                      </div>
                    </td>
                    <td className="td text-slate-600">{t.owner_name}<span className="block text-xs text-slate-400">{t.owner_email}</span></td>
                    <td className="td text-slate-600">{t.cuisine}<span className="block text-xs text-slate-400">{t.price_range} · {t.base_city || '-'}</span></td>
                    <td className="td text-xs text-slate-500">{t.menu_count} menu · {t.package_count} pkgs · {t.area_count} areas</td>
                    <td className="td">★ {Number(t.rating_avg || 0).toFixed(1)} <span className="text-xs text-slate-400">({t.rating_count})</span></td>
                    <td className="td">
                      <Badge status={t.status} />
                      {t.rejection_reason && <span className="mt-1 block max-w-[180px] text-xs text-rose-600">{t.rejection_reason}</span>}
                    </td>
                    <td className="td text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {t.status !== 'active' && <button className="text-xs font-semibold text-emerald-600 hover:underline" onClick={() => setTruckStatus(t.id, 'active')}>Activate</button>}
                        {t.status === 'active' && <button className="text-xs font-semibold text-amber-600 hover:underline" onClick={() => setTruckStatus(t.id, 'inactive')}>Suspend</button>}
                        {t.status === 'rejected' && <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => setTruckStatus(t.id, 'pending')}>Re-open review</button>}
                      </div>
                    </td>
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
