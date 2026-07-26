import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { validate3dProductJobCore } from "./3d-product-job-contract"

const fixtures = path.resolve(
  process.cwd(),
  "..",
  "orcaslicer",
  ".agents",
  "skills",
  "build-printable-decor-models",
  "fixtures",
  "3d-product-job.v1",
)

describe("3d-product-job.v1 cross-language fixtures", () => {
  it("accepts the shared valid fabrication fixture", () => {
    const value = JSON.parse(
      fs.readFileSync(path.join(fixtures, "valid-fabrication.json"), "utf8"),
    )
    expect(validate3dProductJobCore(value)).toEqual({ valid: true })
  })

  it("rejects fabrication without the strict stage ledger binding", () => {
    const value = JSON.parse(
      fs.readFileSync(
        path.join(fixtures, "invalid-fabrication-missing-ledger.json"),
        "utf8",
      ),
    )
    expect(validate3dProductJobCore(value)).toEqual({
      valid: false,
      errors: ["invalid fabrication stage ledger"],
    })
  })
})
