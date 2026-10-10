import { Link } from 'react-router-dom';
import { Badge, Stars } from './ui';
import { money } from '../api/client';

/** Marketplace result card - the unit of the search experience. */
export default function TruckCard({ truck }) {
  return (
    <Link to={`/trucks/${truck.id}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative h-44 overflow-hidden bg-slate-100">
        {truck.image_url ? (
          <img src={truck.image_url} alt={truck.name} loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-4xl">🚚</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="chip bg-white/95 text-slate-700 shadow-sm">{truck.cuisine}</span>
          <span className="chip bg-white/95 text-slate-700 shadow-sm">{truck.price_range}</span>
        </div>
        {truck.status !== 'active' && (
          <span className="absolute right-3 top-3"><Badge status={truck.status} /></span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">{truck.name}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{truck.tagline || truck.cuisine}</p>
          </div>
          <Stars value={truck.rating_avg} count={truck.rating_count} />
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <span>📍</span>
          <span className="truncate">{(truck.areas || []).slice(0, 3).join(' · ') || truck.base_city || 'Service areas on request'}</span>
        </p>

        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starting from</p>
            <p className="text-lg font-extrabold text-slate-900">
              {truck.starting_price ? money(truck.starting_price) : 'On request'}
              <span className="ml-1 text-xs font-medium text-slate-400">/ event</span>
            </p>
          </div>
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
            View & book →
          </span>
        </div>
      </div>
    </Link>
  );
}
