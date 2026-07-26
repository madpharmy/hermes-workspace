export type ContractVerdict = { valid: true } | { valid: false; errors: string[] }

export function validate3dProductJobCore(value: unknown): ContractVerdict {
  const errors: string[] = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["job must be an object"] }
  }
  const job = value as Record<string, unknown>
  if (job.schema !== "3d-product-job.v1") errors.push("invalid schema")
  if (typeof job.job_id !== "string" || !job.job_id) errors.push("missing job_id")
  const profile = job.profile
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    errors.push("missing profile")
  } else {
    const p = profile as Record<string, unknown>
    if (p.kind === "FABRICATION") {
      if (p.schema !== "print-anything-design-contract.v1") {
        errors.push("invalid fabrication contract")
      }
      if (p.stage_ledger_schema !== "print-anything-stage-gates.v1") {
        errors.push("invalid fabrication stage ledger")
      }
      if (typeof p.physical_evidence_required !== "boolean") {
        errors.push("missing physical evidence policy")
      }
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true }
}
