import type { Route } from '../+types/root';

export function Scanner({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData?.sample}</h1>;
}
