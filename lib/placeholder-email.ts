// User.email is required and unique, but a driver can be created without one
// (they log in through a magic link until credentials are added later). Such
// drivers get an internal address that is never shown in the UI.
const PLACEHOLDER_DOMAIN = "no-email.invalid";

export function makePlaceholderEmail(): string {
  return `driver-${crypto.randomUUID()}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${PLACEHOLDER_DOMAIN}`));
}

/** The email to show to a person: empty when it's only an internal placeholder. */
export function visibleEmail(email: string | null | undefined): string {
  return !email || isPlaceholderEmail(email) ? "" : email;
}
