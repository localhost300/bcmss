import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { normalizeRole, roleDashboardRoutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

const Homepage = async () => {
  const user = await currentUser();
  const role = normalizeRole(user?.publicMetadata?.role);

  if (role) {
    redirect(roleDashboardRoutes[role]);
  }

  return <div className="">Homepage</div>;
};

export default Homepage;
