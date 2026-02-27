import { Header } from "@/components/layout/Header";
import { getCenters } from "@/actions/admin";
import { getFactories } from "@/actions/pickups";
import { FactoriesClient } from "@/components/admin/FactoriesClient";

export default async function FactoriesPage() {
  const factories = await getFactories();
  return (
    <>
      <Header title="Factory Management" />
      <div className="p-4 md:p-6">
        <FactoriesClient factories={JSON.parse(JSON.stringify(factories))} />
      </div>
    </>
  );
}
