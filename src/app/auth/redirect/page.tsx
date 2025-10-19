import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { normalizeRole, roleDashboardRoutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

const AuthRedirectPage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const role = normalizeRole(user.publicMetadata?.role);

  if (role) {
    redirect(roleDashboardRoutes[role]);
  }

  redirect("/");
};

export default AuthRedirectPage;
