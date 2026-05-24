import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ProfileForm,
  PasswordForm,
} from "@/components/settings/settings-forms";
import { CompanyForm } from "@/components/company/company-form";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";
import { User, Lock, Building2 } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { name: true, email: true, phone: true, role: true },
  });
  if (!user) return null;

  const isAdmin = me.role === "COMPANY_ADMIN" || me.role === "SUPER_ADMIN";

  const company =
    isAdmin && me.companyId
      ? await prisma.company.findUnique({ where: { id: me.companyId } })
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and company preferences."
        action={
          <Badge variant="secondary">{ROLE_LABELS[me.role] ?? me.role}</Badge>
        }
      />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>
            Update your name, email and phone number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{ name: user.name, email: user.email, phone: user.phone }}
          />
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change Password
          </CardTitle>
          <CardDescription>
            Choose a strong password you don&apos;t use anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {/* Company — only for admins */}
      {company && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company
            </CardTitle>
            <CardDescription>
              Billing details, invoice settings and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm
              initial={{
                name: company.name,
                taxId: company.taxId,
                regCom: company.registrationNumber,
                address: company.street,
                city: company.city,
                country: company.country,
                phone: company.phone,
                email: company.email,
                website: company.website,
                bankName: company.bankName,
                bankAccount: company.bankAccount,
                invoicePrefix: company.invoicePrefix,
                currency: company.currency,
                vatRate: company.vatRate,
                timezone: company.timezone,
                locale: company.locale,
                logoUrl: company.logoUrl,
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
