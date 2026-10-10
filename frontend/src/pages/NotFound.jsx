import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <span className="text-6xl">🚧</span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900">404 - page not found</h1>
      <p className="mt-3 text-sm text-slate-500">
        That route does not exist on Truckify. Maybe the truck has already packed up for the night.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Button as={Link} to="/">Go home</Button>
        <Button as={Link} to="/trucks" variant="outline">Browse trucks</Button>
      </div>
    </div>
  );
}
