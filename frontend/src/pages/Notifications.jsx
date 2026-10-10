import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Button, EmptyState, Spinner } from '../components/ui';

const ICONS = { booking_request: '📩', booking_update: '🔄', payment: '💳', event_status: '🚚', approval: '🛡️', review: '⭐', welcome: '👋', info: 'ℹ️' };

export default function Notifications() {
  const [rows, setRows] = useState(null);
  const [unread, setUnread] = useState(0);
  const toast = useToast();

  const load = () => api('/notifications').then((r) => { setRows(r.data); setUnread(r.meta.unread); }).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const readOne = async (id) => { await api(`/notifications/${id}/read`, { method: 'POST' }); load(); };
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); toast.success('All notifications marked as read.'); load(); };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-2 text-sm text-slate-500">Booking requests, approvals, payments and event-day status updates.</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={readAll}>Mark all read ({unread})</Button>}
      </header>

      <div className="mt-6">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications yet" body="You will be notified when a booking request arrives, is accepted, paid, or when the event-day status changes." />
        ) : (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {rows.map((n) => (
              <button key={n.id} onClick={() => !n.is_read && readOne(n.id)}
                className={`flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-lg ring-1 ring-slate-200">
                  {ICONS[n.type] || 'ℹ️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{n.title}</span>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  </span>
                  {n.body && <span className="mt-1 block text-sm leading-relaxed text-slate-500">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-slate-400">{String(n.created_at).slice(0, 16)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
