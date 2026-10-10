import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, prettyDate } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, EmptyState, Input, Modal, Spinner, Stars, StatusTimeline, Textarea } from '../components/ui';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isCustomer, isOwner, isAdmin } = useAuth();
  const toast = useToast();

  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // 'pay' | 'cancel' | 'review' | 'decline'
  const [reason, setReason] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [card, setCard] = useState({ method: 'card', card_name: '', card_last4: '4242' });

  const load = () => {
    api(`/bookings/${id}`)
      .then((r) => setB(r.data))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, [id]);

  const act = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const r = await api(path, { method: 'POST', body });
      toast.success(okMsg || r.message);
      setModal(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  if (error) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState icon="🚫" title="Booking unavailable" body={error} action={<Button as={Link} to="/">Go home</Button>} /></div>;
  if (!b) return <Spinner label="Loading booking…" />;

  const isMine = b.customer?.id === user?.id;
  const terminal = ['declined', 'cancelled', 'completed'].includes(b.status);

  const downloadReceipt = () => {
    api(`/bookings/${b.id}/receipt`).then((r) => {
      const d = r.data;
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.receipt_no}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded (simulated payment).');
    }).catch((e) => toast.error(e.message));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button onClick={() => navigate(-1)} className="text-sm font-semibold text-slate-500 hover:text-brand-600">← Back</button>

      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking {b.code}</p>
            <h1 className="text-xl font-extrabold text-slate-900">{b.truck?.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{b.event_type} · {prettyDate(b.event_date)} · {b.area_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={b.status} />
            <Badge status={b.payment_status} />
          </div>
        </div>

        <div className="px-6 py-5">
          <StatusTimeline timeline={b.timeline} />
          {['declined', 'cancelled'].includes(b.status) && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <strong>{b.status === 'declined' ? 'Declined by owner' : 'Cancelled'}.</strong>{' '}
              {b.decline_reason || b.cancel_reason || 'No reason recorded.'}
              {b.payment_status === 'refunded' && ' · The simulated payment is marked as refunded.'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-6">
            <h2 className="text-base font-bold text-slate-900">Event details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ['Event date', prettyDate(b.event_date)],
                ['Event type', b.event_type],
                ['Service area', b.area_name],
                ['Guests', `${b.guests} guests`],
                ['Venue', b.venue_address || '-'],
                ['Package', b.package ? `${b.package.name}` : '-'],
                ['Package price', b.package ? money(b.package.price_per_event) : '-'],
                ['Requested on', String(b.created_at).slice(0, 16)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            {b.notes && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes to owner</p>
                <p className="mt-1 text-sm text-slate-600">{b.notes}</p>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="text-base font-bold text-slate-900">Payment</h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{money(b.amount)}</p>
                <p className="text-xs text-slate-500">Per event · whole food truck</p>
                {b.payment_ref && <p className="mt-1 font-mono text-xs text-slate-400">Ref: {b.payment_ref}</p>}
              </div>
              <div className="text-right">
                <Badge status={b.payment_status} />
                {b.paid_at && <p className="mt-1 text-xs text-slate-400">Paid {String(b.paid_at).slice(0, 16)}</p>}
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Simulated payment: this project demonstrates a payment <em>workflow</em> only. No real financial transaction
              is performed - the system just records the payment status and reference.
            </p>
            {b.payment_status === 'paid' && (
              <Button variant="outline" size="sm" className="mt-3" onClick={downloadReceipt}>Download receipt (JSON)</Button>
            )}
          </section>

          {b.review && (
            <section className="card p-6">
              <h2 className="text-base font-bold text-slate-900">Your verified review</h2>
              <div className="mt-3"><Stars value={b.review.rating} /></div>
              {b.review.comment && <p className="mt-2 text-sm text-slate-600">{b.review.comment}</p>}
            </section>
          )}
        </div>

        {/* -------------------------------------------------------- actions */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">Actions</p>
            {/* customer */}
            {isCustomer && isMine && b.status === 'accepted' && (
              <Button className="mt-4 w-full" onClick={() => setModal('pay')}>💳 Pay now (simulated)</Button>
            )}
            {isCustomer && isMine && b.status === 'completed' && !b.review && (
              <Button className="mt-4 w-full" variant="success" onClick={() => setModal('review')}>⭐ Submit verified review</Button>
            )}
            {isCustomer && isMine && !terminal && b.status !== 'completed' && (
              <Button className="mt-2 w-full" variant="outline" onClick={() => setModal('cancel')}>Cancel booking</Button>
            )}

            {/* owner */}
            {isOwner && b.status === 'pending' && (
              <>
                <Button className="mt-4 w-full" variant="success" loading={busy} onClick={() => act(`/bookings/${b.id}/accept`, undefined, 'Booking accepted.')}>Accept request</Button>
                <Button className="mt-2 w-full" variant="danger" onClick={() => setModal('decline')}>Decline request</Button>
              </>
            )}
            {isOwner && b.status === 'confirmed' && (
              <Button className="mt-4 w-full" loading={busy} onClick={() => act(`/bookings/${b.id}/status`, { status: 'en_route' }, 'Marked en route.')}>🚚 Mark en route</Button>
            )}
            {isOwner && b.status === 'en_route' && (
              <Button className="mt-4 w-full" loading={busy} onClick={() => act(`/bookings/${b.id}/status`, { status: 'arrived' }, 'Marked arrived.')}>📍 Mark arrived</Button>
            )}
            {isOwner && b.status === 'arrived' && (
              <Button className="mt-4 w-full" variant="success" loading={busy} onClick={() => act(`/bookings/${b.id}/status`, { status: 'completed' }, 'Event completed.')}>✅ Mark completed</Button>
            )}
            {isOwner && ['accepted', 'confirmed'].includes(b.status) && (
              <Button className="mt-2 w-full" variant="outline" onClick={() => setModal('cancel')}>Cancel booking</Button>
            )}

            {terminal && !(isCustomer && b.status === 'completed' && !b.review) && (
              <p className="mt-4 text-sm text-slate-500">This booking is closed - no further actions are available.</p>
            )}
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">Parties</p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
                <p className="font-semibold text-slate-700">{b.customer?.name}</p>
                <p className="text-xs text-slate-500">{b.customer?.email}</p>
                {b.customer?.phone && <p className="text-xs text-slate-500">{b.customer.phone}</p>}
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Truck</p>
                <Link to={`/trucks/${b.truck?.id}`} className="font-semibold text-brand-600 hover:underline">{b.truck?.name}</Link>
                <p className="text-xs text-slate-500">{b.truck?.cuisine}</p>
              </div>
            </div>
            {isAdmin && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Admin view - monitoring only.</p>}
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------------- modals */}
      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title="Simulated payment"
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button loading={busy} onClick={() => act(`/bookings/${b.id}/pay`, card, 'Payment successful - booking confirmed.')}>Pay {money(b.amount)}</Button></>}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          Demo gateway - no real card is charged and no money moves. The system records the payment status and a
          simulated reference number only.
        </div>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="label">Payment method</span>
            <select className="input" value={card.method} onChange={(e) => setCard({ ...card, method: e.target.value })}>
              <option value="card">Card</option><option value="upi">UPI</option>
              <option value="netbanking">Net banking</option><option value="wallet">Wallet</option>
            </select>
          </label>
          <Input label="Name on card" value={card.card_name} placeholder={b.customer?.name} onChange={(e) => setCard({ ...card, card_name: e.target.value })} />
          <Input label="Card number (test)" value={card.card_last4} maxLength={4} onChange={(e) => setCard({ ...card, card_last4: e.target.value.replace(/\D/g, '') })} hint="Only the last 4 digits are stored, for the receipt." />
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Package</span><span className="font-semibold">{b.package?.name}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-slate-500">Event date</span><span className="font-semibold">{prettyDate(b.event_date)}</span></div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2"><span className="font-bold">Total</span><span className="font-extrabold text-brand-600">{money(b.amount)}</span></div>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this booking"
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Keep booking</Button>
          <Button variant="danger" loading={busy} onClick={() => act(`/bookings/${b.id}/cancel`, { reason }, 'Booking cancelled.')}>Confirm cancellation</Button></>}>
        <p className="text-sm text-slate-600">The event date is released immediately and becomes available to other customers. If a simulated payment was recorded it will be marked refunded.</p>
        <Textarea label="Reason (optional)" rows={3} className="mt-3" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal open={modal === 'decline'} onClose={() => setModal(null)} title="Decline request"
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => act(`/bookings/${b.id}/decline`, { reason }, 'Request declined.')}>Decline request</Button></>}>
        <Textarea label="Reason for the customer" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Already booked that weekend / outside our service area…" />
      </Modal>

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title="Verified review"
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button loading={busy} onClick={() => act(`/bookings/${b.id}/review`, review, 'Thanks! Your review is live.')}>Publish review</Button></>}>
        <p className="text-sm text-slate-600">You can review only because this event was completed - that is what makes it a verified review.</p>
        <label className="mt-4 block">
          <span className="label">Rating</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setReview({ ...review, rating: n })}
                className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition ${review.rating >= n ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-300'}`}>★</button>
            ))}
          </div>
        </label>
        <Textarea label="Comment" rows={4} className="mt-3" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} placeholder="How was the food, service and punctuality?" />
      </Modal>
    </div>
  );
}
