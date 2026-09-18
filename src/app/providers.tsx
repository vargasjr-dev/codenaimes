"use client";

import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        {children}
      </AuthProvider>
    </TooltipProvider>
  );
}
