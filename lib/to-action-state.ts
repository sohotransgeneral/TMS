import type { ActionResult } from "@/lib/action-helpers";

/**
 * Adapts a server action `(FormData) => Promise<ActionResult>` to the
 * `(state, FormData) => Promise<ActionResult>` shape required by React's
 * `useActionState` hook.
 */
export function toActionState<T = unknown>(
  fn: (formData: FormData) => Promise<ActionResult<T>>,
) {
  return async (_prev: ActionResult<T> | null, formData: FormData) => fn(formData);
}
