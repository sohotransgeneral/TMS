import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyForm } from "@/components/company/company-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Company details" };

export default async function CompanyPage() {
  const me = await requirePermission("company:read");

  // SUPER_ADMIN without an assigned company -> show list of all companies
  if (!me.companyId) {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, taxId: true, city: true, country: true },
    });
    return (
      <div className="space-y-6">
        <PageHeader
          title="Companys"
          description="All companies registered in the system."
          action={
            <Button asChild>
              <Link href="/admin/company/new">
                <Plus className="mr-2 h-4 w-4" /> New Company
              </Link>
            </Button>
          }
        />
        {companies.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No company registered.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Link key={c.id} href={`/admin/company/${c.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="pt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium leading-tight">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.taxId} · {c.city}, {c.country}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: me.companyId },
  });
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company details"
        description="Tax, banking, and invoicing settings."
      />
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
    </div>
  );
}
