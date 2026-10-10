import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../components/ui';

const DEMOS = [
  ['Customer', 'customer@truckify.test', 'Customer@123'],
  ['Owner', 'owner@truckify.test', 'Owner@123'],
  ['Admin', 'admin@truckify.test', ''],
];

const HOME_BY_ROLE = { customer: '/my-bookings', owner: '/owner', admin: '/admin' };

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || HOME_BY_ROLE[user.role] || '/', { replace: true });
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
        <span className="chip w-fit bg-brand-50 text-brand-700">Role-based access control</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Sign in to Truckify</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          Every account is bound to one role - customer, owner or admin - and the API enforces what each role can see
          and do with JWT-protected routes.
        </p>
        <div className="mt-8 space-y-3">
          {DEMOS.map(([role, email, password]) => (
            <button key={role} onClick={() => setForm({ email, password })}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-card">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{role}</p>
                <p className="font-mono text-xs text-slate-600">{email}</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">use this →</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">Click a demo account to auto-fill the form.</p>
      </div>

      <div className="card mx-auto w-full max-w-md p-7">
        <h2 className="text-xl font-extrabold text-slate-900">Log in</h2>
        <p className="mt-1 text-sm text-slate-500">Welcome back to the marketplace.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input label="Email" type="email" required autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          <Input label="Password" type="password" required autoComplete="current-password" value={form.password}
            error={err} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          <Button type="submit" className="w-full" size="lg" loading={busy}>Log in</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          New to Truckify? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
