"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    null,
  );

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">Invalid Link</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Missing reset token.
        </p>
        <Link href="/forgot-password" className="text-primary hover:underline">
          Request another link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Set New Password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a strong password you don&apos;t use anywhere else.
      </p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input id="password" name="password" type="password" required />
          {state && !state.ok && state.fieldErrors?.password && (
            <p className="text-xs text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
        {state?.ok && (
          <p className="text-sm text-emerald-600">{state.message}</p>
        )}
        {state && !state.ok && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving..." : "Change Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
