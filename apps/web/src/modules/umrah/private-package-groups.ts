export type PackageSnapshot = { packageId: string; name: string; origin: string; destination: string; departureDate: string; returnDate: string };
export function privatePackageGroupKey(request: { id: string; package_snapshot?: PackageSnapshot | null }) {
  const p = request.package_snapshot;
  return p ? JSON.stringify([p.packageId, p.origin, p.destination, p.departureDate, p.returnDate]) : `custom:${request.id}`;
}
