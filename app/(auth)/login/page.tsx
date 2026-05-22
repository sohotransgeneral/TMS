"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string) ?? "";
    const password = (fd.get("password") as string) ?? "";
    startTransition(async () => {
      const result = await loginAction(null, { email, password });
      setState(result);
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Sign in to your TMS account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@company.com"
          />
          {state && !state.ok && state.fieldErrors?.email && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state && !state.ok && state.fieldErrors?.password && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {state && !state.ok && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        Don't have an account?{" "}
        <Link
          href="/register"
          className="text-primary hover:underline font-medium"
        >
          Register your company
        </Link>
      </p>
    </div>
  );
}
