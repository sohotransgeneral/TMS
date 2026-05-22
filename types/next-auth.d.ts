import "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    companyId: string | null;
  }
}
