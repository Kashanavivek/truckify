import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Select, Textarea } from '../../components/ui';

export default function OwnerTruckForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', tagline: '', description: '', cuisine: '', price_range: '$$', base_city: '', image_url: '',
  });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/trucks', { method: 'POST', body: { ...form, gallery: form.image_url ? [form.image_url] : [] } });
      if (refresh) refresh();
      toast.success('Truck created. Now add packages and service areas, then submit for approval.');
      navigate(`/owner/trucks/${r.data.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">List a new food truck</h1>
      <p className="mt-2 text-sm text-slate-500">
        Step 1 of 3 - truck profile. You will add menus, packages and service areas next, then the listing goes to the
        admin for verification before it becomes visible to customers.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
        <Input label="Truck name" required value={form.name} placeholder="The Rolling Tandoor" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Tagline" value={form.tagline} placeholder="Live-grill North Indian street food" onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        <Textarea label="Description" rows={4} value={form.description} placeholder="What you serve, how many guests you can handle, service style…" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Cuisine" required value={form.cuisine} placeholder="North Indian" onChange={(e) => setForm({ ...form, cuisine: e.target.value })} />
          <Select label="Price range" value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })}>
            <option value="$">$ - Budget friendly</option>
            <option value="$$">$$ - Mid range</option>
            <option value="$$$">$$$ - Premium</option>
          </Select>
          <Input label="Base city" value={form.base_city} placeholder="Bengaluru" onChange={(e) => setForm({ ...form, base_city: e.target.value })} />
        </div>
        <Input label="Cover image URL" value={form.image_url} placeholder="https://…" hint="Shown on the marketplace card and truck profile." onChange={(e) => setForm({ ...form, image_url: e.target.value })} />

        {form.image_url && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <img src={form.image_url} alt="preview" className="h-40 w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
          <Button type="button" variant="outline" onClick={() => navigate('/owner')}>Cancel</Button>
          <Button type="submit" loading={busy}>Create truck & continue</Button>
        </div>
      </form>
    </div>
  );
}
