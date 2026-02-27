import { Header } from "@/components/layout/Header";
import { getUsers } from "@/actions/admin";
import { UsersClient } from "@/components/admin/UsersClient";

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <>
      <Header title="User Management" />
      <div className="p-4 md:p-6">
        <UsersClient users={JSON.parse(JSON.stringify(users))} />
      </div>
    </>
  );
}
