"use client";

import Image from "next/image";
import { UserButton } from "@clerk/nextjs";

import SchoolSwitcher from "./SchoolSwitcher";
import SessionSwitcher from "./SessionSwitcher";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user, loading } = useAuth();

  const displayName = user?.name ?? (loading ? "Loading..." : "Unknown user");
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SchoolSwitcher />
          <SessionSwitcher />
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-300 px-2">
          <Image src="/search.png" alt="" width={14} height={14} />
          <input type="text" placeholder="Search..." className="w-[200px] p-2 bg-transparent outline-none" />
        </div>
      </div>
      <div className="flex items-center gap-6 justify-end w-full md:w-auto">
        <div className="bg-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer">
          <Image src="/message.png" alt="" width={20} height={20} />
        </div>
        <div className="bg-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer relative">
          <Image src="/announcement.png" alt="" width={20} height={20} />
          <div className="absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center bg-purple-500 text-white rounded-full text-xs">1</div>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs leading-3 font-medium" suppressHydrationWarning>
            {displayName}
          </span>
          {roleLabel && (
            <span className="text-[10px] text-gray-500" suppressHydrationWarning>
              {roleLabel}
            </span>
          )}
        </div>
        <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
      </div>
    </div>
  );
};

export default Navbar;
