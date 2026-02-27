import { Header } from "@/components/layout/Header";
import { getActivityLogs } from "@/actions/admin";
import { ActivityClient } from "@/components/admin/ActivityClient";

export default async function ActivityPage() {
  const logs = await getActivityLogs();
  return (
    <>
      <Header title="Activity Log" />
      <div className="p-4 md:p-6">
        <ActivityClient logs={JSON.parse(JSON.stringify(logs))} />
      </div>
    </>
  );
}
