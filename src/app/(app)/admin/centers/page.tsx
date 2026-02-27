import { Header } from "@/components/layout/Header";
import { getCenters } from "@/actions/admin";
import { CentersClient } from "@/components/admin/CentersClient";

export default async function CentersPage() {
  const centers = await getCenters();
  return (
    <>
      <Header title="Center Management" />
      <div className="p-4 md:p-6">
        <CentersClient centers={JSON.parse(JSON.stringify(centers))} />
      </div>
    </>
  );
}
