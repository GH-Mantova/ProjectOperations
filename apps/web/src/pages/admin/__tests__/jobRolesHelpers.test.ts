import { describe, expect, it } from "vitest";
import {
  emptyForm,
  formFromRecord,
  toCreatePayload,
  validateForm,
  type JobRoleRecord
} from "../jobRolesHelpers";

const record: JobRoleRecord = {
  id: "r-1",
  name: "Supervisor",
  description: "On-site",
  colour: "#1f4e8c",
  isActive: true,
  sortOrder: 10,
  requirements: [
    {
      id: "rq-1",
      competencyId: "c-1",
      isMandatory: true,
      competency: { id: "c-1", name: "White Card", code: "COMP-001" }
    },
    {
      id: "rq-2",
      competencyId: "c-2",
      isMandatory: false,
      competency: { id: "c-2", name: "First Aid", code: "COMP-008" }
    }
  ]
};

describe("jobRolesHelpers", () => {
  it("emptyForm starts blank", () => {
    expect(emptyForm()).toEqual({ name: "", description: "", colour: "", requirements: [] });
  });

  it("formFromRecord copies fields and requirements", () => {
    const form = formFromRecord(record);
    expect(form.name).toBe("Supervisor");
    expect(form.colour).toBe("#1f4e8c");
    expect(form.requirements).toEqual([
      { competencyId: "c-1", isMandatory: true },
      { competencyId: "c-2", isMandatory: false }
    ]);
  });

  it("validateForm rejects empty name", () => {
    expect(validateForm({ ...emptyForm(), name: "   " })).toEqual({
      ok: false,
      reason: "Name is required."
    });
  });

  it("validateForm rejects duplicate competency in requirements", () => {
    const result = validateForm({
      ...emptyForm(),
      name: "Role",
      requirements: [
        { competencyId: "c-1", isMandatory: true },
        { competencyId: "c-1", isMandatory: false }
      ]
    });
    expect(result.ok).toBe(false);
  });

  it("validateForm accepts a clean form", () => {
    const result = validateForm({
      name: "Role",
      description: "",
      colour: "",
      requirements: [{ competencyId: "c-1", isMandatory: true }]
    });
    expect(result.ok).toBe(true);
  });

  it("toCreatePayload trims fields and omits empty optionals", () => {
    const payload = toCreatePayload({
      name: "  Role  ",
      description: "   ",
      colour: "",
      requirements: [{ competencyId: "c-1", isMandatory: true }]
    });
    expect(payload.name).toBe("Role");
    expect(payload.description).toBeUndefined();
    expect(payload.colour).toBeUndefined();
    expect(payload.requirements).toEqual([{ competencyId: "c-1", isMandatory: true }]);
  });
});
