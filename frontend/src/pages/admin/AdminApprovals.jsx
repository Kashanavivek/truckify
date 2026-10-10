import { useEffect, useState } from 'react';
import { api, money } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, EmptyState, Modal, Spinner, Stars, Textarea } from '../../components/ui';

/** Admin verification queue - approve or reject truck listings. */
export default function AdminApprovals() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reject, setReject] = useState({ open: false, id: null, name: '', reason: '' });

  const load = () => { setRows(null); api('/admin/trucks?status=pending').then((r) => setRows(r.data)).catch(() => setRows([])); };
  useEffect(load, []);

  const openDetail = async (t) => {
    const r = await api(`/trucks/${t.id}`).catch(() => null);
    setDetail(r ? r.data : { ...t, menu: [], packages: [], areas: [] });
  };

  const approve = async (id) => {
    setBusy(true);
    try { const r = await api(`/admin/trucks/${id}/approve`, { method: 'POST' }); toast.success(r.message); setDetail(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doReject = async () => {
    setBusy(true);
    try {
      const r = await api(`/admin/trucks/${reject.id}/reject`, { method: 'POST', body: { reason: reject.reason } });
      toast.success(r.message);
      setReject({ open: false, id: null, name: '', reason: '' });
      setDetail(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Truck verification queue</h1>
        <p className="mt-2 text-sm text-slate-500">
          Every new or edited listing stays invisible to customers until an admin approves it. Review the profile, menu,
          packages and service areas before activating the truck.
        </p>
      </header>

      <div className="mt-6">
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="🎉" title="Nothing waiting for approval" body="All submitted truck listings have been reviewed. New submissions will appear here." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((t) => (
              <div key={t.id} className="card overflow-hidden">
                <div className="h-40 bg-slate-100">
                  {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl">🚚</div>}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.cuisine} · {t.price_range} · {t.base_city || '-'}</p>
                    </div>
                    <Badge status={t.status} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Owner: <span className="font-semibold text-slate-700">{t.owner_name}</span> ({t.owner_email})</p>
                  <p className="mt-1 text-xs text-slate-400">{t.menu_count} menu items · {t.package_count} packages · {t.area_count} service areas</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openDetail(t)}>Review listing</Button>
                    <Button size="sm" variant="success" loading={busy} onClick={() => approve(t.id)}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => setReject({ open: true, id: t.id, name: t.name, reason: '' })}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Review: ${detail.name}` : ''} wide
        footer={detail && <>
          <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          <Button variant="danger" onClick={() => setReject({ open: true, id: detail.id, name: detail.name, reason: '' })}>Reject</Button>
          <Button variant="success" loading={busy} onClick={() => approve(detail.id)}>Approve & activate</Button>
        </>}>
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="label">Description</p><p className="text-sm text-slate-600">{detail.description || '-'}</p></div>
              <div>
                <p className="label">Owner</p>
                <p className="text-sm font-semibold text-slate-700">{detail.owner_name}</p>
                <p className="text-xs text-slate-500">{detail.owner_email} · {detail.owner_phone || 'no phone'}</p>
                <p className="mt-2 label">Rating</p><Stars value={detail.rating_avg} count={detail.rating_count} />
              </div>
            </div>

            <div>
              <p className="label">Packages ({detail.packages.length})</p>
              <div className="space-y-2">
                {detail.packages.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{p.name}</p>
                      <p className="text-sm font-extrabold text-brand-600">{money(p.price_per_event)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{p.min_guests}-{p.max_guests} guests · {(p.includes || []).join(' · ')}</p>
                  </div>
                ))}
                {detail.packages.length === 0 && <p className="text-xs text-rose-600">No packages - the listing should not be approved yet.</p>}
              </div>
            </div>

            <div>
              <p className="label">Menu ({detail.menu.length})</p>
              <div className="flex flex-wrap gap-2">
                {detail.menu.map((m) => <span key={m.id} className="chip bg-slate-100 text-slate-700">{m.name} · {money(m.price)}</span>)}
                {detail.menu.length === 0 && <p className="text-xs text-slate-400">No menu published.</p>}
              </div>
            </div>

            <div>
              <p className="label">Service areas ({detail.areas.length})</p>
              <div className="flex flex-wrap gap-2">
                {detail.areas.map((a) => <span key={a.id} className="chip bg-slate-100 text-slate-700">📍 {a.area_name}</span>)}
                {detail.areas.length === 0 && <p className="text-xs text-rose-600">No service areas - the listing should not be approved yet.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={reject.open} onClose={() => setReject({ open: false, id: null, name: '', reason: '' })} title={`Reject: ${reject.name}`}
        footer={<><Button variant="outline" onClick={() => setReject({ open: false, id: null, name: '', reason: '' })}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reject.reason.trim().length < 3} onClick={doReject}>Send rejection</Button></>}>
        <p className="text-sm text-slate-600">The owner is notified with this reason and can edit the listing and re-submit it for approval.</p>
        <Textarea label="Reason (required)" rows={3} className="mt-3" value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} placeholder="Missing packages / service areas not defined / unclear pricing…" />
      </Modal>
    </div>
  );
}
