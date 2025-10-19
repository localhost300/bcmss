"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LogoutPage = () => {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.error("[Logout] Failed to end session", error);
      } finally {
        router.replace("/sign-in");
        router.refresh();
      }
    };

    logout().catch((error) => {
      console.error("[Logout] Unexpected error", error);
      router.replace("/sign-in");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
      Signing you out...
    </div>
  );
};

export default LogoutPage;
