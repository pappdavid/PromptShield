import { describe, expect, it } from "vitest";

import { inspectRuntimeAction } from "./runtime-inspection";

describe("inspectRuntimeAction", () => {
  it("allows recognized read-only shell inspection", () => {
    const result = inspectRuntimeAction({
      id: "action_read",
      agentId: "agent_1",
      actionType: "shell_command",
      tool: "Bash",
      command: "git status --short",
    });

    expect(result.decision).toBe("allow");
    expect(result.riskAssessment.level).toBe("low");
  });

  it("blocks recognizable destructive commands", () => {
    const result = inspectRuntimeAction({
      id: "action_block",
      agentId: "agent_1",
      actionType: "shell_command",
      tool: "Bash",
      command: "sudo rm -fr /",
    });

    expect(result.decision).toBe("block");
    expect(result.riskAssessment.level).toBe("critical");
  });

  it("requires approval for declared sensitive action types", () => {
    const result = inspectRuntimeAction({
      id: "action_deploy",
      agentId: "agent_1",
      actionType: "production_deploy",
      description: "Release the reviewed application build.",
    });

    expect(result.decision).toBe("requires_approval");
    expect(result.riskAssessment.level).toBe("high");
  });

  it("requires approval for remote repository mutation", () => {
    const result = inspectRuntimeAction({
      id: "action_push",
      agentId: "agent_1",
      actionType: "shell_command",
      tool: "Bash",
      command: "git push origin feature-branch",
    });

    expect(result.decision).toBe("requires_approval");
    expect(result.riskAssessment.reasons).toContain("remote repository mutation");
  });

  it("defaults unrecognized actions to human review", () => {
    const result = inspectRuntimeAction({
      id: "action_unknown",
      agentId: "agent_1",
      actionType: "tool_use",
      tool: "custom.tool",
      description: "Perform an application-specific operation.",
    });

    expect(result.decision).toBe("requires_approval");
    expect(result.riskAssessment.level).toBe("medium");
  });
});
