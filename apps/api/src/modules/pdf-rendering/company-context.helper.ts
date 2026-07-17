import { PrismaService } from "../../prisma/prisma.service";
import type { PdfCompanyContext } from "./builders/quote-html.builder";

const FALLBACK: PdfCompanyContext = {
  tradingName: "INITIAL SERVICES",
  headerRightMeta:
    "Demolition Licence: 2328018 | Class A Asbestos Licence: 2320431",
  footerAddressLine:
    "10 Grice St, Clontarf Q 4019 | P: (07) 3888 0539 | E: admin@initialservices.net | A.B.N: 75 631 222 556"
};

/**
 * Resolve the PDF letterhead/footer context from the singleton CompanyProfile
 * plus its active licences. Returns hard-coded IS defaults when the profile
 * is missing so PDF rendering never blocks on branding gaps.
 *
 * Extracted from EstimateExportService so the forms-submission PDF path can
 * share the same branding without pulling in the estimate module.
 */
export async function resolvePdfCompanyContext(
  prisma: PrismaService
): Promise<PdfCompanyContext> {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: "singleton" },
    include: {
      licences: {
        where: { status: "active" },
        orderBy: { licenceType: "asc" }
      }
    }
  });
  if (!profile) return FALLBACK;

  const licenceLine =
    profile.licences.length > 0
      ? profile.licences
          .filter((l) => l.licenceNumber)
          .map((l) => `${l.licenceType}: ${l.licenceNumber}`)
          .join(" | ") || FALLBACK.headerRightMeta!
      : FALLBACK.headerRightMeta!;

  const address = [
    profile.registeredAddressLine1,
    profile.registeredSuburb,
    profile.registeredState,
    profile.registeredPostcode
  ]
    .filter(Boolean)
    .join(" ");

  const footerLine = [
    address || "10 Grice St, Clontarf Q 4019",
    profile.primaryPhone ? `P: ${profile.primaryPhone}` : null,
    profile.primaryEmail ? `E: ${profile.primaryEmail}` : null,
    profile.abn ? `A.B.N: ${profile.abn}` : null
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    tradingName: profile.tradingName,
    headerRightMeta: licenceLine,
    footerAddressLine: footerLine
  };
}
