import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyForm } from "@/components/company/company-form";
import { notFound } from "next/navigation";

export const metadata = { title: "Date companie" };

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("company:read");
  const { id } = await params;

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description="Informații fiscale, bancare și setări de facturare."
      />
      <CompanyForm
        companyId={company.id}
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
        }}
      />
    </div>
  );
}
