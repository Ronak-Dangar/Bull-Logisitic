import { Header } from "@/components/layout/Header";
import { getDeliveries } from "@/actions/deliveries";
import { getFactories } from "@/actions/pickups";
import { DeliveriesClient } from "@/components/deliveries/DeliveriesClient";
import { auth } from "@/lib/auth";

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status || "ALL";
  const [session, initialPage, factories] = await Promise.all([auth(), getDeliveries({ status }), getFactories()]);
  const isCM = (session?.user as any)?.role === "CM";

  return (
    <>
      <Header title="Deliveries" />
      <div className="p-4 md:p-6">
        {/* keyed so a new ?status starts from fresh filter state */}
        <DeliveriesClient
          key={status}
          initialPage={initialPage}
          factories={JSON.parse(JSON.stringify(factories))}
          initialFilter={status}
          isCM={isCM}
        />
      </div>
    </>
  );
}
