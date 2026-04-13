import { MasterDataPage } from "./MasterDataPage";

export function TenderClientsPage() {
  return (
    <MasterDataPage
      initialTab="clients"
      allowedTabs={["clients"]}
      title="Clients"
      subtitle="Commercial account records used to anchor deals, award decisions, and tender relationship mapping."
      contextTitle="Tendering client view"
      contextBody="Use this screen to keep tender-facing client accounts clean and ready for deal work. For the full cross-module reference-data hub, open Master Data."
      contextLinks={[
        { to: "/tenders/create", label: "Create tender" },
        { to: "/tenders/pipeline", label: "Open pipeline" },
        { to: "/master-data", label: "Open Master Data hub" }
      ]}
    />
  );
}
