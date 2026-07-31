import { unstable_cache as unstableCache } from "next/cache";
import { listUserEnrollments } from "@/db/repositories";

const DASHBOARD_ENROLLMENTS_CACHE_SECONDS = 30;

export function listDashboardUserEnrollments(userId: string) {
  return unstableCache(
    () => listUserEnrollments(userId),
    ["securium-dashboard-enrollments", userId],
    { revalidate: DASHBOARD_ENROLLMENTS_CACHE_SECONDS },
  )();
}
