# JD / Role Inventory (from C:\ProjectOperations-Reference\JDs)

Source: 33 files sanity-checked 2026-07-07. Purpose: consolidate duplicate/legacy JDs into a
clean role list feeding the Workflow Studio role set. Context: ISO 9001 / 14001 / 45001 certified;
sister company Redcliffe Skips shares several roles.

## Not roles (reference docs)
- 2026 Employee Handbook.pdf - policy/handbook. Reference.
- Initial Services - Organisation chart.pptx - current org structure.
- Project Manager Job Description - Template.docx - a role-clarification meeting guide, not a JD.

## Consolidated role list (33 files -> 21 distinct roles after merging duplicates)
Senior management / office (8): Director (Sean), Operations Manager (Colin), WHS & Commercial
Compliance / Safety & Compliance Officer (Marco), Estimator (Raj), Project Manager (Beau),
Business Support / Finance & Administration Officer (Amy), People & Culture Coordinator,
Logistics & Warehouse Manager (Lachlan).
Warehouse / transport (3): Warehouse Coordinator, Logistics & Warehouse Support Officer,
Transport Operator / Truck Driver.
Legacy on-site JDs (5): Site Supervisor, Leading Hand, Plant Operator, Carpenter, Labourer.
New CW ladder - Role Profiles, Effective FY27 (5 levels, Casual + Full-Time = same role):
CW1D Demolition Labourer, CW2 Experienced Labourer / Basic Operator, CW3 Tradesperson /
Skilled Operator, CW4 Post-Trade Specialist, CW5 Senior Specialist / Site Manager.

## Duplicates merged
PM (JD + "PM Special"); Logistics & Warehouse Manager (2 copies); Leading Hand + Asbestos
Leading Hand; Transport Operator + Truck Driver; CW Casual/FT pairs -> 5 roles.

## Decisions (locked 2026-07-07)
- Business Support Officer dissolves: high-level items -> Operations Manager; remainder ->
  Finance & Administration Officer (Amy).
- Warehouse Coordinator + Logistics & Warehouse Support Officer: high-level merges up to
  Logistics & Warehouse Manager; mundane duties -> new Warehouse / Logistics Operator.
- People & Culture Coordinator dissolves: high-level -> Director; safety/compliance-biased ->
  WHS & Commercial Compliance (Marco); remainder -> Operations Manager.
- Legacy on-site JDs (Labourer, Plant Operator, Carpenter, Leading Hand, Site Supervisor) fold
  into CW1D-CW5 per the editable mapping below.
- Only Sean (Director), Colin (Ops Mgr), Marco (WHS & Compliance), Raj (Estimator) are fixed
  for now; all others edited/added later (incl. the Lachlan/Matthew warehouse-lead question).

## CW ladder mapping (EDITABLE - Sean/Colin may change)
Must NOT be hardcoded in the ERP - Director-configurable data (same principle as the
authorization config layer).

| Legacy on-site role | Maps to CW level | Notes |
|---|---|---|
| Labourer | CW1D | Demolition Labourer |
| Experienced labourer / basic plant | CW2 | Basic operator |
| Carpenter / Plant Operator / trade demolition | CW3 | Cert III, Class B asbestos |
| Post-trade specialist (Class A, heavy plant) | CW4 | Technical apex on-tools |
| Site Supervisor / senior operators / HR-HC-MC drivers | CW5 | With Lv leadership suffix |
| Leading Hand | Lv suffix on CW3-CW5 | Leadership scope, not a standalone role |
