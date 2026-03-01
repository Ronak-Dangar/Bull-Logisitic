import { Header } from "@/components/layout/Header";
import { getDeliveries } from "@/actions/deliveries";
import { DeliveriesClient } from "@/components/deliveries/DeliveriesClient";

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const deliveries = await getDeliveries();

  return (
    <>
      <Header title="Deliveries" />
      <div className="p-4 md:p-6">
        <DeliveriesClient
          deliveries={JSON.parse(JSON.stringify(deliveries))}
          initialFilter={params.status || "ALL"}
        />
      </div>
    </>
  );
}
