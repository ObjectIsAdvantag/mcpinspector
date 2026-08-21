import { describe, expect, it } from "vitest";
import { evaluateArtifactOperationApplicability } from "@inspector/core/extensions/artifacts/applicability.js";
import type { ArtifactOperationRequirements } from "@inspector/core/extensions/api/artifacts.js";

const unrestricted: ArtifactOperationRequirements = {
  dataRequirements: { serverDescription: "none", session: "none" },
};

const legacyOnly: ArtifactOperationRequirements = {
  dataRequirements: { serverDescription: "read", session: "none" },
  protocol: {
    negotiatedVersions: ["2025-06-18", "2025-11-25"],
  },
};

describe("evaluateArtifactOperationApplicability", () => {
  it("allows operations without protocol requirements", () => {
    expect(
      evaluateArtifactOperationApplicability("Native session", unrestricted, {
        connected: false,
      }),
    ).toEqual({ status: "applicable" });
  });

  it("reports live requirements as indeterminate before connection", () => {
    expect(
      evaluateArtifactOperationApplicability(
        "MCP Description 0.7",
        legacyOnly,
        {
          connected: false,
        },
      ),
    ).toMatchObject({
      status: "indeterminate",
      code: "artifact.protocol-version-indeterminate",
      supportedVersions: ["2025-06-18", "2025-11-25"],
    });
  });

  it("fails closed when a connection has no negotiated version", () => {
    const result = evaluateArtifactOperationApplicability(
      "MCP Description 0.7",
      legacyOnly,
      { connected: true },
    );
    expect(result).toMatchObject({
      status: "incompatible",
      code: "artifact.protocol-version-incompatible",
    });
    if (result.status === "incompatible") {
      expect(result.message).toContain("no negotiated MCP protocol version");
      expect(result.negotiatedVersion).toBeUndefined();
    }
  });

  it("accepts an exact negotiated-version match", () => {
    expect(
      evaluateArtifactOperationApplicability(
        "MCP Description 0.7",
        legacyOnly,
        {
          connected: true,
          negotiatedProtocolVersion: "2025-11-25",
        },
      ),
    ).toEqual({ status: "applicable" });
  });

  it("rejects an unsupported negotiated version with actionable details", () => {
    const result = evaluateArtifactOperationApplicability(
      "MCP Description 0.7",
      legacyOnly,
      {
        connected: true,
        negotiatedProtocolVersion: "2026-07-28",
      },
    );
    expect(result).toMatchObject({
      status: "incompatible",
      negotiatedVersion: "2026-07-28",
      supportedVersions: ["2025-06-18", "2025-11-25"],
    });
    if (result.status === "incompatible") {
      expect(result.message).toContain("2026-07-28");
      expect(result.message).toContain("2025-11-25");
    }
  });
});
