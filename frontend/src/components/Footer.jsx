import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-lg">🚚</span>
            <span className="text-lg font-extrabold text-slate-900">Truck<span className="text-brand-500">ify</span></span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
            An event-based food truck booking platform that connects event organizers with food truck owners -
            search by date and area, book an entire truck for your event, and track everything in one place.
          </p>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Demo build: payments are <strong>simulated</strong>. No real financial transaction is performed.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Customers</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link to="/trucks" className="hover:text-brand-600">Browse food trucks</Link></li>
            <li><Link to="/my-bookings" className="hover:text-brand-600">My bookings</Link></li>
            <li><Link to="/register" className="hover:text-brand-600">Create an account</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Owners</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link to="/owner" className="hover:text-brand-600">Owner console</Link></li>
            <li><Link to="/owner/new" className="hover:text-brand-600">List your truck</Link></li>
            <li><Link to="/owner/calendar" className="hover:text-brand-600">Event calendar</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        Truckify · React + Tailwind CSS · Node.js + Express · SQLite/PostgreSQL · JWT role-based access control
      </div>
    </footer>
  );
}
