import { describe, it, expect, vi } from "vitest";
import { assertPublicHttpUrl } from "@/lib/security/ssrf";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

describe("assertPublicHttpUrl", () => {
  it("rejects loopback / metadata / private IP literals", async () => {
    expect(await assertPublicHttpUrl("http://127.0.0.1/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://127.0.0.1:3000/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://10.0.0.1/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://172.16.0.1/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://192.168.1.1/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://169.254.169.254/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://0.0.0.0/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://100.64.0.1/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://[::1]/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://[fd00::1]/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://[fe80::1]/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://[::ffff:127.0.0.1]/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://[::ffff:169.254.169.254]/")).toBeTruthy();
  });

  it("allows public IP literals without DNS", async () => {
    expect(await assertPublicHttpUrl("https://8.8.8.8/")).toBeNull();
    expect(await assertPublicHttpUrl("https://1.1.1.1/")).toBeNull();
    expect(await assertPublicHttpUrl("https://93.184.216.34/")).toBeNull();
  });

  it("rejects non-http(s) protocols", async () => {
    expect(await assertPublicHttpUrl("ftp://example.com/file")).toBeTruthy();
    expect(await assertPublicHttpUrl("file:///etc/passwd")).toBeTruthy();
    expect(await assertPublicHttpUrl("gopher://example.com")).toBeTruthy();
    expect(await assertPublicHttpUrl("not a url")).toBeTruthy();
  });

  it("rejects embedded credentials", async () => {
    expect(await assertPublicHttpUrl("https://user:pass@example.com/")).toBeTruthy();
    expect(await assertPublicHttpUrl("https://user@example.com/")).toBeTruthy();
  });

  it("rejects non-default ports", async () => {
    expect(await assertPublicHttpUrl("https://example.com:8080/")).toBeTruthy();
    expect(await assertPublicHttpUrl("https://example.com:22/")).toBeTruthy();
  });

  it("allows explicit default ports", async () => {
    expect(await assertPublicHttpUrl("https://8.8.8.8:443/")).toBeNull();
    expect(await assertPublicHttpUrl("http://8.8.8.8:80/")).toBeNull();
  });

  it("rejects localhost, metadata and internal hostnames", async () => {
    expect(await assertPublicHttpUrl("http://localhost/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://localhost.localhost/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://metadata.google.internal/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://db.internal/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://srv.lan/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://api.local/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://intranet.home.arpa/")).toBeTruthy();
  });

  it("rejects single-label hostnames", async () => {
    expect(await assertPublicHttpUrl("http://internal/")).toBeTruthy();
    expect(await assertPublicHttpUrl("http://router/")).toBeTruthy();
  });
});

describe("assertPublicHttpUrl DNS resolution guard", () => {
  it("rejects hostnames that resolve to private addresses", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
    expect(await assertPublicHttpUrl("https://dns.evil.test/")).toMatch(/private/);

    lookupMock.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    expect(await assertPublicHttpUrl("https://dns.metadata.test/")).toMatch(/private/);

    lookupMock.mockResolvedValueOnce([{ address: "::ffff:10.0.0.5", family: 6 }]);
    expect(await assertPublicHttpUrl("https://dns.mapped.test/")).toMatch(/private/);

    lookupMock.mockResolvedValueOnce([{ address: "fd12::1", family: 6 }]);
    expect(await assertPublicHttpUrl("https://dns.ula.test/")).toMatch(/private/);
  });

  it("allows hostnames that resolve only to public addresses", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    expect(await assertPublicHttpUrl("https://public.example.test/")).toBeNull();
  });

  it("fails closed when a hostname cannot be resolved", async () => {
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    expect(await assertPublicHttpUrl("https://nope.example.test/")).toMatch(/resolve/i);
  });

  it("fails closed on mixed public + private resolution", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.9", family: 4 },
    ]);
    expect(await assertPublicHttpUrl("https://split-horizon.example.test/")).toMatch(/private/);
  });
});
