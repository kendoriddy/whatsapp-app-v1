import { describe, expect, it } from "vitest";
import { can, permissionMatrix } from "@mmabon/domain";

describe("permission matrix", () => {
  it("covers capabilities", () => {
    expect(can("designer", "send_approve")).toBe(false);
    expect(can("sales", "send_approve")).toBe(true);
    expect(can("admin", "whatsapp_numbers")).toBe(true);
    expect(Object.keys(permissionMatrix).length).toBeGreaterThan(5);
  });
});
