import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Select } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const user = await register(form);
      toast.success('Account created. Welcome to Truckify!');
      navigate(user.role === 'owner' ? '/owner' : '/trucks', { replace: true });
    } catch (error) {
      setErr(error.message);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
      <div className="hidden flex-col justify-center lg:flex">
        <span className="chip w-fit bg-brand-50 text-brand-700">Two clicks to get started</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Create your Truckify account</h1>
        <div className="mt-8 space-y-5">
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">🍽️ I am organising an event</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Sign up as a <strong>customer</strong> to search trucks by date and area, view menus and packages, send
              booking requests, pay (simulated) and review the truck after your event.
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800">🚚 I own a food truck</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Sign up as an <strong>owner</strong> to register your truck, publish menus, packages and service areas, then
              submit it for admin approval and start accepting event bookings.
            </p>
          </div>
        </div>
      </div>

      <div className="card mx-auto w-full max-w-md p-7">
        <h2 className="text-xl font-extrabold text-slate-900">Sign up</h2>
        <p className="mt-1 text-sm text-slate-500">Admin accounts are provisioned by the platform only.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label">I want to</span>
            <div className="grid grid-cols-2 gap-2">
              {[['customer', 'Book food trucks'], ['owner', 'List my truck']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, role: v })}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${form.role === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </label>
          <Input
  label="Full name"
  required
  value={form.name}
  placeholder="Aditi Sharma"
  pattern="[A-Za-z ]+"
  title="Name can contain only letters and spaces"
  onChange={(e) => setForm({ ...form, name: e.target.value })}
/>
          <Input label="Email" type="email" required autoComplete="email" value={form.email} placeholder="you@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
  label="Phone"
  type="tel"
  required
  value={form.phone}
  placeholder="9876543210"
  maxLength={10}
  pattern="[6-9][0-9]{9}"
  title="Enter a valid 10-digit mobile number"
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, '');
    setForm({ ...form, phone: value });
  }}
/>
          <Input label="Password" type="password" required minLength={6} autoComplete="new-password" value={form.password}
            error={err} hint="At least 6 characters." onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          <Button type="submit" className="w-full" size="lg" loading={busy}>Create account</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
