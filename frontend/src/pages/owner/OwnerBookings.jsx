import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, prettyDate, qs } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, EmptyState, Modal, Spinner, Textarea } from '../../components/ui';

const STATUSES = ['all', 'pending', 'accepted', 'confirmed', 'en_route', 'arrived', 'completed', 'declined', 'cancelled'];

export default function OwnerBookings() {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [decline, setDecline] = useState({ open: false, id: null, reason: '' });

  const load = () => { setRows(null); api(`/bookings${qs({ status })}`).then((r) => setRows(r.data)).catch(() => setRows([])); };
  useEffect(load, [status]);

  const act = async (path, body, msg) => {
    setBusy(true);
    try { const r = await api(path, { method: 'POST', body }); toast.success(msg || r.message); setDecline({ open: false, id: null, reason: '' }); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const nextAction = (b) => {
    if (b.status === 'pending') return { label: 'Accept', path: `/bookings/${b.id}/accept`, variant: 'success' };
    if (b.status === 'confirmed') return { label: 'Mark en route', path: `/bookings/${b.id}/status`, body: { status: 'en_route' } };
    if (b.status === 'en_route') return { label: 'Mark arrived', path: `/bookings/${b.id}/status`, body: { status: 'arrived' } };
    if (b.status === 'arrived') return { label: 'Mark completed', path: `/bookings/${b.id}/status`, body: { status: 'completed' }, variant: 'success' };
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Booking requests & events</h1>
        <p className="mt-2 text-sm text-slate-500">Accept or decline requests, then drive the event-day status from en route to completed.</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="📭" title="No bookings in this view" body="Requests from customers appear here the moment they are sent." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Code</th><th className="th">Customer</th><th className="th">Truck</th>
                  <th className="th">Event</th><th className="th">Guests</th><th className="th">Amount</th>
                  <th className="th">Status</th><th className="th">Payment</th><th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => {
                  const na = nextAction(b);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="td font-mono text-xs">{b.code}</td>
                      <td className="td">
                        <p className="font-semibold text-slate-800">{b.customer?.name}</p>
                        <p className="text-xs text-slate-400">{b.customer?.phone || b.customer?.email}</p>
                      </td>
                      <td className="td text-slate-600">{b.truck?.name}</td>
                      <td className="td">
                        <p className="text-slate-700">{b.event_type}</p>
                        <p className="text-xs text-slate-400">{prettyDate(b.event_date)} · {b.area_name}</p>
                      </td>
                      <td className="td">{b.guests}</td>
                      <td className="td font-semibold">{money(b.amount)}</td>
                      <td className="td"><Badge status={b.status} /></td>
                      <td className="td"><Badge status={b.payment_status} /></td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/bookings/${b.id}`} className="text-xs font-semibold text-slate-500 hover:underline">Open</Link>
                          {b.status === 'pending' && (
                            <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setDecline({ open: true, id: b.id, reason: '' })}>Decline</button>
                          )}
                          {na && (
                            <button disabled={busy} className="text-xs font-semibold text-brand-600 hover:underline"
                              onClick={() => act(na.path, na.body, `${na.label} done.`)}>{na.label}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={decline.open} onClose={() => setDecline({ open: false, id: null, reason: '' })} title="Decline this request"
        footer={<><Button variant="outline" onClick={() => setDecline({ open: false, id: null, reason: '' })}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => act(`/bookings/${decline.id}/decline`, { reason: decline.reason }, 'Request declined.')}>Decline request</Button></>}>
        <Textarea label="Reason (sent to the customer)" rows={3} value={decline.reason} onChange={(e) => setDecline({ ...decline, reason: e.target.value })} />
      </Modal>
    </div>
  );
}
