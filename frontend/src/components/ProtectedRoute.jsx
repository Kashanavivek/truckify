import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

/** Route guard with role-based access control on the client. */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Not available for your role</h1>
        <p className="mt-2 text-sm text-slate-500">
          This area is restricted to <strong>{roles.join(' / ')}</strong> accounts. You are signed in as <strong>{user.role}</strong>.
        </p>
        <a href="/" className="mt-6 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Back to marketplace
        </a>
      </div>
    );
  }
  return children;
}
