import { Header } from "@/components/layout/Header";
import { getDashboardKPIs, getStatusDistribution, getRecentRequests, getRecentActivity } from "@/actions/dashboard";
import { getPendingUrgentApprovals } from "@/actions/pickups";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const [kpis, statusDist, recentRequests, recentActivity, urgentApprovals] = await Promise.all([
    getDashboardKPIs(),
    getStatusDistribution(),
    getRecentRequests(),
    getRecentActivity(15),
    getPendingUrgentApprovals(),
  ]);

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6">
        <DashboardClient
          kpis={kpis}
          statusDistribution={statusDist}
          recentRequests={JSON.parse(JSON.stringify(recentRequests))}
          recentActivity={JSON.parse(JSON.stringify(recentActivity))}
          urgentApprovals={JSON.parse(JSON.stringify(urgentApprovals))}
        />
      </div>
    </>
  );
}

