"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string | string[];
  className?: string;
  children: React.ReactNode;
}

export function Field({
  name,
  label,
  required,
  error,
  className,
  children,
}: FieldProps) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </div>
  );
}
