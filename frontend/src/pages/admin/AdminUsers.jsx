import { useEffect, useState } from 'react';
import { api, prettyDate, qs } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge, EmptyState, Spinner } from '../../components/ui';

const ROLES = ['all', 'admin', 'owner', 'customer'];

export default function AdminUsers() {
  const toast = useToast();
  const [role, setRole] = useState('all');
  const [rows, setRows] = useState(null);

  const load = () => { setRows(null); api(`/admin/users${qs({ role: role === 'all' ? '' : role })}`).then((r) => setRows(r.data)).catch(() => setRows([])); };
  useEffect(load, [role]);

  const setStatus = async (id, status) => {
    try { const r = await api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }); toast.success(r.message); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Users</h1>
        <p className="mt-2 text-sm text-slate-500">Customer, owner and admin accounts. Blocking an account immediately invalidates its API access.</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${role === r ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {r}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="👥" title="No users in this view" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Phone</th><th className="th">Bookings</th><th className="th">Joined</th><th className="th">Status</th><th className="th text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="td font-semibold text-slate-800">{u.name}</td>
                    <td className="td text-slate-600">{u.email}</td>
                    <td className="td"><Badge status={u.role === 'admin' ? 'confirmed' : u.role === 'owner' ? 'accepted' : 'completed'}>{u.role}</Badge></td>
                    <td className="td text-slate-500">{u.phone || '-'}</td>
                    <td className="td">{u.bookings}</td>
                    <td className="td text-slate-500">{prettyDate(u.created_at)}</td>
                    <td className="td"><Badge status={u.status} /></td>
                    <td className="td text-right">
                      {u.role !== 'admin' && (
                        u.status === 'active'
                          ? <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setStatus(u.id, 'blocked')}>Block</button>
                          : <button className="text-xs font-semibold text-emerald-600 hover:underline" onClick={() => setStatus(u.id, 'active')}>Reactivate</button>
                      )}
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
