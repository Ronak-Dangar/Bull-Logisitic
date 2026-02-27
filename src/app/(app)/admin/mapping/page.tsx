import { Header } from "@/components/layout/Header";
import { getMappings, getUsers, getCenters } from "@/actions/admin";
import { MappingClient } from "@/components/admin/MappingClient";

export default async function MappingPage() {
  const [mappings, users, centers] = await Promise.all([
    getMappings(),
    getUsers(),
    getCenters(),
  ]);

  return (
    <>
      <Header title="User-Center Mapping" />
      <div className="p-4 md:p-6">
        <MappingClient
          mappings={JSON.parse(JSON.stringify(mappings))}
          users={JSON.parse(JSON.stringify(users))}
          centers={JSON.parse(JSON.stringify(centers))}
        />
      </div>
    </>
  );
}
