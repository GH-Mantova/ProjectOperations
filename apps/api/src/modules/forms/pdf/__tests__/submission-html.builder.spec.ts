import {
  buildSubmissionHtml,
  submissionFooterTemplate,
  submissionHeaderTemplate,
  type SubmissionForPdf
} from "../submission-html.builder";

function makeSubmission(overrides: Partial<SubmissionForPdf> = {}): SubmissionForPdf {
  return {
    id: "sub-abcd1234",
    status: "submitted",
    submittedAt: new Date("2026-06-01T02:15:00Z"),
    submittedBy: { firstName: "Ada", lastName: "Lovelace" },
    gpsLat: -27.24831,
    gpsLng: 153.06841,
    templateVersion: {
      versionNumber: 2,
      template: { name: "Daily Pre-start", code: "PRESTART", category: "prestart" },
      sections: [
        {
          id: "sec-1",
          title: "Site conditions",
          description: "Walk the area and answer honestly.",
          sectionOrder: 1,
          fields: [
            {
              id: "f-weather",
              fieldKey: "weather",
              label: "Weather",
              fieldType: "text",
              fieldOrder: 1
            },
            {
              id: "f-safe",
              fieldKey: "safe_to_start",
              label: "Safe to start?",
              fieldType: "toggle",
              fieldOrder: 2
            }
          ]
        }
      ]
    },
    values: [
      { fieldKey: "weather", valueText: "Overcast, 22°C" },
      { fieldKey: "safe_to_start", valueBoolean: true }
    ],
    attachments: [
      { fieldKey: "hazard_photo", fileName: "hazard.jpg", fileUrl: "https://example/hazard.jpg" }
    ],
    signatures: [
      { fieldKey: "supervisor_sig", signerName: "Grace Hopper", signedAt: new Date("2026-06-01T02:16:00Z") }
    ],
    ...overrides
  };
}

describe("buildSubmissionHtml", () => {
  it("renders answers, evidence and metadata", () => {
    const html = buildSubmissionHtml(makeSubmission());
    expect(html).toContain("Daily Pre-start");
    expect(html).toContain("v2");
    expect(html).toContain("Code PRESTART");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Overcast, 22°C");
    // toggle=true renders as "Yes"
    expect(html).toContain(">Yes<");
    // GPS with 5 decimals
    expect(html).toContain("-27.24831, 153.06841");
    // Evidence list + signatures
    expect(html).toContain("hazard.jpg");
    expect(html).toContain("Grace Hopper");
    // Section title + description
    expect(html).toContain("Site conditions");
    expect(html).toContain("Walk the area and answer honestly.");
  });

  it("escapes user-supplied content to prevent HTML injection", () => {
    const submission = makeSubmission({
      values: [{ fieldKey: "weather", valueText: "<script>alert(1)</script>" }]
    });
    const html = buildSubmissionHtml(submission);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders an em-dash placeholder when GPS coordinates are missing", () => {
    const submission = makeSubmission({ gpsLat: null, gpsLng: null });
    const html = buildSubmissionHtml(submission);
    expect(html).toMatch(/GPS<\/div><div>—<\/div>/);
  });

  it("skips section-header, divider and instructions fields", () => {
    const submission = makeSubmission({
      templateVersion: {
        versionNumber: 1,
        template: { name: "T", code: "T", category: null },
        sections: [
          {
            id: "s",
            title: "S",
            sectionOrder: 1,
            fields: [
              { id: "h", fieldKey: "h", label: "SECTION HEADER", fieldType: "section_header", fieldOrder: 1 },
              { id: "d", fieldKey: "d", label: "DIVIDER LABEL", fieldType: "divider", fieldOrder: 2 },
              { id: "i", fieldKey: "i", label: "INSTRUCTIONS!", fieldType: "instructions", fieldOrder: 3 },
              { id: "t", fieldKey: "t", label: "Real field", fieldType: "text", fieldOrder: 4 }
            ]
          }
        ]
      },
      values: [{ fieldKey: "t", valueText: "kept" }]
    });
    const html = buildSubmissionHtml(submission);
    expect(html).not.toContain("SECTION HEADER");
    expect(html).not.toContain("DIVIDER LABEL");
    expect(html).not.toContain("INSTRUCTIONS!");
    expect(html).toContain("Real field");
    expect(html).toContain("kept");
  });

  it("renders table field values as HTML tables", () => {
    const submission = makeSubmission({
      templateVersion: {
        versionNumber: 1,
        template: { name: "T", code: "T", category: null },
        sections: [
          {
            id: "s",
            title: "Tools",
            sectionOrder: 1,
            fields: [
              { id: "tools", fieldKey: "tools", label: "Tools", fieldType: "table", fieldOrder: 1 }
            ]
          }
        ]
      },
      values: [
        {
          fieldKey: "tools",
          valueJson: [
            { name: "Grinder", serial: "G-1", ok: true },
            { name: "Cutter", serial: "C-9", ok: false }
          ]
        }
      ]
    });
    const html = buildSubmissionHtml(submission);
    expect(html).toContain('class="cell-table"');
    expect(html).toContain("Grinder");
    expect(html).toContain("C-9");
    expect(html).toContain(">Yes<");
    expect(html).toContain(">No<");
  });

  it("emits header and footer templates that include company branding", () => {
    const ctx = {
      tradingName: "TestCo",
      headerRightMeta: "Licence: 123",
      footerAddressLine: "1 Test St · P: 000"
    };
    const header = submissionHeaderTemplate("My Form", "abcd1234", ctx);
    const footer = submissionFooterTemplate(ctx);
    expect(header).toContain("TESTCO");
    expect(header).toContain("Licence: 123");
    expect(header).toContain("My Form · abcd1234");
    expect(footer).toContain("1 Test St · P: 000");
    expect(footer).toContain('class="pageNumber"');
  });
});
