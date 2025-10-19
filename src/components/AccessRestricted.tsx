"use client";

import type { ReactNode } from "react";

interface AccessRestrictedProps {
  title?: string;
  message?: string;
  actionSlot?: ReactNode;
}

const AccessRestricted = ({
  title = "Access denied",
  message = "You do not have permission to view this page.",
  actionSlot,
}: AccessRestrictedProps) => {
  return (
    <div className="m-4 mt-0 flex-1 flex items-center justify-center">
      <div className="bg-white border border-gray-100 rounded-md p-10 text-center space-y-3 max-w-md">
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-500 leading-6">
          {message}
          <br />
          <span className="text-gray-400">Contact an administrator if you believe this is a mistake.</span>
        </p>
        {actionSlot}
      </div>
    </div>
  );
};

export default AccessRestricted;
