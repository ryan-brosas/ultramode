import { existsSync, readFileSync } from "node:fs";

type ExecResult = {
  stdout?: string;
  code?: number;
};

type ToolCallEvent = {
  toolName?: string;
  input?: {
    path?: unknown;
  };
};


async function getActiveBead(pi: { exec: (cmd: string, args: string[]) => Promise<ExecResult> }) {
  try {
    const result = await pi.exec("br", [
      "list",
      "--status",
      "open",
      "--status",
      "in_progress",
      "--json",
    ]);

    if ((result.code ?? 1) !== 0 || !result.stdout) {
      return null;
    }

    const parsed = JSON.parse(result.stdout);
    const issues = Array.isArray(parsed) ? parsed : parsed?.issues;
    if (!Array.isArray(issues) || issues.length === 0) {
      return null;
    }

    issues.sort((a, b) => {
      const aTime = typeof a?.updated_at === "string" ? a.updated_at : "";
      const bTime = typeof b?.updated_at === "string" ? b.updated_at : "";
      return bTime.localeCompare(aTime);
    });

    return typeof issues[0]?.id === "string" ? issues[0].id : null;
  } catch {
    return null;
  }

}

const MIN_LINES = 600;

function checkDensity(filePath: string): { ok: boolean; lines: number } {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = (content.match(/\n/g) || []).length;
    return { ok: lines >= MIN_LINES, lines };
  } catch {
    return { ok: false, lines: 0 };
  }
}

export default function workflowGate(pi: {
  on: (event: string, handler: (event: ToolCallEvent) => Promise<{ block: boolean; reason: string } | void> | { block: boolean; reason: string } | void) => void;
  exec: (cmd: string, args: string[]) => Promise<ExecResult>;
}) {
  let cachedBeadId: string | null = null;
  let cachedAt = 0;
  const cacheTtlMs = 30_000;

  async function resolveActiveBead() {
    const now = Date.now();
    if (cachedBeadId && now - cachedAt < cacheTtlMs) {
      return cachedBeadId;
    }
    cachedBeadId = await getActiveBead(pi);
    cachedAt = now;
    return cachedBeadId;
  }

  pi.on("tool_call", async (event) => {
    if (process.env.OMP_SKIP_BEADS_WORKFLOW === "1") {
      return;
    }

    const toolName = event.toolName;
    if (toolName !== "edit" && toolName !== "write") {
      return;
    }

    const path = typeof event.input?.path === "string" ? event.input.path : null;
    if (
      !path ||
      path === ".omp" ||
      path === ".beads" ||
      path.startsWith(".omp/") ||
      path.startsWith(".beads/")
    ) {
      return;
    }

    const activeBead = await resolveActiveBead();
    if (!activeBead) {
      return;
    }

    if (path.startsWith(`.beads/artifacts/${activeBead}/`)) {
      return;
    }

    const hasPrd = existsSync(`.beads/artifacts/${activeBead}/prd.md`);
    const hasPlan = existsSync(`.beads/artifacts/${activeBead}/plan.md`);
    if (!hasPrd) {
      return {
        block: true,
        reason: `Workflow gate: active bead ${activeBead} has no PRD. Run /create first.`,
      };
    }

    if (!hasPlan) {
      return {
        block: true,
        reason: `Workflow gate: active bead ${activeBead} has no plan. Run /plan first.`,
      };
    }

    // Density enforcement: artifacts must meet the 600-line minimum
    const prdPath = `.beads/artifacts/${activeBead}/prd.md`;
    const planPath = `.beads/artifacts/${activeBead}/plan.md`;
    const tasksPath = `.beads/artifacts/${activeBead}/tasks.md`;

    if (hasPrd) {
      const density = checkDensity(prdPath);
      if (!density.ok) {
        return {
          block: true,
          reason: `Workflow gate: PRD for ${activeBead} is only ${density.lines} lines (minimum ${MIN_LINES}). Run /create to expand it — every section needs concrete evidence, file paths, API signatures, patterns, and constraints.`,
        };
      }
    }

    if (hasPlan) {
      const density = checkDensity(planPath);
      if (!density.ok) {
        return {
          block: true,
          reason: `Workflow gate: plan for ${activeBead} is only ${density.lines} lines (minimum ${MIN_LINES}). Run /plan to expand it — add code outlines, wave structure, verification gates, and per-task detail.`,
        };
      }
    }

    // Tasks only checked if they exist (created during /plan)
    if (existsSync(tasksPath)) {
      const density = checkDensity(tasksPath);
      if (!density.ok) {
        return {
          block: true,
          reason: `Workflow gate: tasks for ${activeBead} is only ${density.lines} lines (minimum ${MIN_LINES}). Run /plan to expand it — every task needs yaml metadata, concrete steps, and verification checks.`,
        };
      }
    }
  });
}
