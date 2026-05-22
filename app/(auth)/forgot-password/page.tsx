"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    null,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Reset Password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        We’ll send a reset link to your email.
      </p>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        {state?.ok && (
          <p className="text-sm text-emerald-600">{state.message}</p>
        )}
        {state && !state.ok && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending..." : "Send Link"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        <Link href="/login" className="text-primary hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
