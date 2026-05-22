import Link from "next/link";
import { Truck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-blue-700 text-primary-foreground p-12 relative overflow-hidden">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-lg z-10"
        >
          <Truck className="h-7 w-7" />
          <span>TMS</span>
        </Link>
        <div className="z-10">
          <h2 className="text-3xl font-bold leading-tight">
            Gestionează-ți flota,
            <br />
            ușor și profesional.
          </h2>
          <p className="mt-3 text-primary-foreground/80 max-w-md">
            Dispatch, șoferi, camioane, GPS, facturare — tot ce ai nevoie
            într-un singur loc.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60 z-10">
          © {new Date().getFullYear()} TMS. Toate drepturile rezervate.
        </p>
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="lg:hidden flex items-center gap-2 font-semibold text-lg mb-8"
          >
            <Truck className="h-6 w-6 text-primary" />
            <span>TMS</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
