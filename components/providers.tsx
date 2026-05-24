"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { AppProgressBar } from "next-nprogress-bar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NextThemes
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
        <AppProgressBar
          height="3px"
          color="#2563eb"
          options={{ showSpinner: false }}
          shallowRouting
        />
      </NextThemes>
    </SessionProvider>
  );
}
