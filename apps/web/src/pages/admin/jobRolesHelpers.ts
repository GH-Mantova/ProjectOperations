export type Competency = { id: string; name: string; code: string | null };

export type RequirementInput = {
  competencyId: string;
  isMandatory: boolean;
};

export type JobRoleForm = {
  name: string;
  description: string;
  colour: string;
  requirements: RequirementInput[];
};

export type JobRoleRecord = {
  id: string;
  name: string;
  description: string | null;
  colour: string | null;
  isActive: boolean;
  sortOrder: number;
  requirements: Array<{
    id: string;
    competencyId: string;
    isMandatory: boolean;
    competency: { id: string; name: string; code: string | null };
  }>;
};

export type JobRoleValidation = { ok: true } | { ok: false; reason: string };

export function emptyForm(): JobRoleForm {
  return { name: "", description: "", colour: "", requirements: [] };
}

export function formFromRecord(rec: JobRoleRecord): JobRoleForm {
  return {
    name: rec.name,
    description: rec.description ?? "",
    colour: rec.colour ?? "",
    requirements: rec.requirements.map((r) => ({
      competencyId: r.competencyId,
      isMandatory: r.isMandatory
    }))
  };
}

export function validateForm(form: JobRoleForm): JobRoleValidation {
  const name = form.name.trim();
  if (!name) return { ok: false, reason: "Name is required." };
  const seen = new Set<string>();
  for (const req of form.requirements) {
    if (!req.competencyId) return { ok: false, reason: "Each requirement must select a competency." };
    if (seen.has(req.competencyId)) {
      return { ok: false, reason: "A competency cannot appear twice in the same role." };
    }
    seen.add(req.competencyId);
  }
  return { ok: true };
}

export function toCreatePayload(form: JobRoleForm) {
  const trimmedDescription = form.description.trim();
  const trimmedColour = form.colour.trim();
  return {
    name: form.name.trim(),
    description: trimmedDescription || undefined,
    colour: trimmedColour || undefined,
    requirements: form.requirements.map((r) => ({
      competencyId: r.competencyId,
      isMandatory: r.isMandatory
    }))
  };
}
