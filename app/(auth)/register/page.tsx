"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registerAction,
    null,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Create company account</h1>
      <p className="text-sm text-muted-foreground mb-6">
        30-day free trial. No credit card required.
      </p>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            name="companyName"
            required
            placeholder="SC Transport SRL"
          />
          {state && !state.ok && state.fieldErrors?.companyName && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.companyName[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" required placeholder="John Smith" />
          {state && !state.ok && state.fieldErrors?.name && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.name[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
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
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
          <p className="text-xs text-muted-foreground">
            At least 8 characters, one uppercase letter and one number.
          </p>
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
          {pending ? "Creating..." : "Create Account"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary hover:underline font-medium"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}
