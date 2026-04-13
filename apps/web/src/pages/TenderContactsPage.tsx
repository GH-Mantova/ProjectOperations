import { MasterDataPage } from "./MasterDataPage";

export function TenderContactsPage() {
  return (
    <MasterDataPage
      initialTab="contacts"
      allowedTabs={["contacts"]}
      title="Contacts"
      subtitle="People records for client-side communication, clarifications, and follow-up ownership inside Tendering."
      contextTitle="Tendering contact view"
      contextBody="Use this screen to maintain the people you need for deal communication. The shared Master Data hub still owns the broader reusable reference layer across the ERP."
      contextLinks={[
        { to: "/tenders/create", label: "Create tender" },
        { to: "/tenders/pipeline", label: "Open pipeline" },
        { to: "/master-data", label: "Open Master Data hub" }
      ]}
    />
  );
}
