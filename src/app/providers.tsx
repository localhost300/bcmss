'use client';

import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type AppProvidersProps = {
  children: React.ReactNode;
  publishableKey: string;
};

export const AppProviders = ({
  children,
  publishableKey,
}: AppProvidersProps) => {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignInUrl="/auth/redirect"
      afterSignUpUrl="/auth/redirect"
    >
      {children}
      <ToastContainer position="bottom-right" theme="dark" />
    </ClerkProvider>
  );
};
