import type { Route } from './+types/home';
import { Scanner } from '../scanner/scanner';

export function loader({ params }: Route.LoaderArgs) {
  const data = { sample: 'test data' };
  return data;
}

export default function Component({ loaderData }: Route.ComponentProps) {
  return <Scanner loaderData={loaderData} />;
}
