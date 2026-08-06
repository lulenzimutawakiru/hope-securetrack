import { describe, expect, it } from "vitest";
import {
  CONTROL_PLANE_CAPABILITIES,
} from "@/lib/platform/control-plane-registry";
import { classifyAssistantIntent } from "@/lib/platform/admin-console";

describe("admin console capabilities", () => {
  const expected = [
    { id: "analytics", href: "/platform/analytics", roles: ["Platform Owner", "CTO", "Compliance"] },
    { id: "assistant", href: "/platform/assistant", roles: ["Platform Owner", "CTO", "Security", "DevOps", "Compliance"] },
    { id: "audit", href: "/platform/audit", roles: ["Security", "Compliance", "Platform Owner"] },
    { id: "sessions", href: "/platform/sessions", roles: ["Security", "Platform Owner"] },
    { id: "billing", href: "/platform/billing", roles: ["Platform Owner"] },
    { id: "usage", href: "/platform/usage", roles: ["Platform Owner", "DevOps", "CTO"] },
    { id: "roles", href: "/platform/roles", roles: ["Platform Owner", "Security", "CTO"] },
    { id: "access-reviews", href: "/platform/access-reviews", roles: ["Platform Owner", "Security", "Compliance"] },
  ] as const;

  it("registers every admin-console capability with the right href", () => {
    for (const cap of expected) {
      const found = CONTROL_PLANE_CAPABILITIES.find((c) => c.id === cap.id);
      expect(found, `capability ${cap.id} must be registered`).toBeDefined();
      expect(found!.href).toBe(cap.href);
    }
  });

  it("assigns the expected roles to each admin-console capability", () => {
    for (const cap of expected) {
      const found = CONTROL_PLANE_CAPABILITIES.find((c) => c.id === cap.id)!;
      expect(found.roles.sort()).toEqual([...cap.roles].sort());
    }
  });

  it("keeps every capability href canonical", () => {
    for (const cap of CONTROL_PLANE_CAPABILITIES) {
      expect(cap.href.startsWith("/platform"), cap.id).toBe(true);
      expect(cap.href.endsWith("/"), `${cap.id} trailing slash`).toBe(false);
    }
  });

  it("exposes assistant and analytics to every staff role via nav targets", () => {
    const assistant = CONTROL_PLANE_CAPABILITIES.find((c) => c.id === "assistant")!;
    const analytics = CONTROL_PLANE_CAPABILITIES.find((c) => c.id === "analytics")!;
    expect(assistant.roles).toHaveLength(5);
    expect(analytics.roles.length).toBeGreaterThanOrEqual(3);
  });
});

describe("classifyAssistantIntent", () => {
  it("detects overdue billing queries", () => {
    expect(classifyAssistantIntent("Show tenants with overdue payments")).toBe("overdue_billing");
    expect(classifyAssistantIntent("which tenants are past due?")).toBe("overdue_billing");
  });

  it("detects security risk queries", () => {
    expect(classifyAssistantIntent("Find security risks")).toBe("security_risks");
    expect(classifyAssistantIntent("any suspicious activity or threats?")).toBe("security_risks");
  });

  it("detects revenue queries", () => {
    expect(classifyAssistantIntent("Generate revenue report")).toBe("revenue");
    expect(classifyAssistantIntent("what is our monthly recurring revenue?")).toBe("revenue");
  });

  it("detects resource usage queries", () => {
    expect(classifyAssistantIntent("Which tenants use the most resources?")).toBe("resource_usage");
    expect(classifyAssistantIntent("who is consuming the most storage?")).toBe("resource_usage");
  });

  it("detects failed integration queries", () => {
    expect(classifyAssistantIntent("Show failed integrations")).toBe("failed_integrations");
    expect(classifyAssistantIntent("any webhook failures?")).toBe("failed_integrations");
  });

  it("falls back to help for unknown queries", () => {
    expect(classifyAssistantIntent("what is the meaning of life?")).toBe("help");
    expect(classifyAssistantIntent("")).toBe("help");
  });
});