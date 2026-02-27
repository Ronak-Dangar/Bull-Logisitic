import { Header } from "@/components/layout/Header";
import { getPickups, getUserCenters, getFactories } from "@/actions/pickups";
import { PickupsClient } from "@/components/pickups/PickupsClient";

export default async function PickupsPage() {
  const [pickups, centers, factories] = await Promise.all([
    getPickups(),
    getUserCenters(),
    getFactories(),
  ]);

  return (
    <>
      <Header title="Pickup Management" />
      <div className="p-4 md:p-6">
        <PickupsClient
          pickups={JSON.parse(JSON.stringify(pickups))}
          centers={JSON.parse(JSON.stringify(centers))}
          factories={JSON.parse(JSON.stringify(factories))}
        />
      </div>
    </>
  );
}
