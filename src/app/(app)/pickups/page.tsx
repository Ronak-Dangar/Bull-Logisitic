import { Header } from "@/components/layout/Header";
import { getPickups, getUserCenters, getFactories } from "@/actions/pickups";
import { PickupsClient } from "@/components/pickups/PickupsClient";

export default async function PickupsPage({ searchParams }: { searchParams: Promise<{ status?: string; highlight?: string }> }) {
  const params = await searchParams;
  const status = params.status || "ALL";
  const [initialPage, centers, factories] = await Promise.all([
    getPickups({ status, ensureId: params.highlight }),
    getUserCenters(),
    getFactories(),
  ]);

  return (
    <>
      <Header title="Pickup Management" />
      <div className="p-4 md:p-6">
        {/* keyed so a new ?status / ?highlight starts from fresh filter state */}
        <PickupsClient
          key={`${status}:${params.highlight ?? ""}`}
          initialPage={initialPage}
          centers={JSON.parse(JSON.stringify(centers))}
          factories={JSON.parse(JSON.stringify(factories))}
          initialStatusFilter={status}
          highlightId={params.highlight}
        />
      </div>
    </>
  );
}
