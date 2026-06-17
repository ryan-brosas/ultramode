import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Native command override.
 *
 * The OMP harness ships two builtins whose names collide with this template's
 * file-based slash commands:
 *
 *   /plan   — builtin SlashCommandSpec (builtin-registry.ts:237). Dispatched by
 *             executeBuiltinSlashCommand in input-controller.ts:520, which runs
 *             BEFORE file-command expansion. Even with `plan.enabled: false` the
 *             builtin still consumes the input (it shows a warning and returns
 *             true), so the template's commands/plan.md never executes.
 *   /review — bundled custom ReviewCommand (loader.ts:163). Dispatched by
 *             AgentSession.#tryExecuteCustomCommand at agent-session.ts:5207,
 *             which runs BEFORE expandSlashCommand. No config setting disables
 *             it.
 *
 * This extension's `input` handler runs at input-controller.ts:496, BEFORE
 * builtin dispatch. For each shadowed name it reads the file-based command
 * body, performs the same $ARGUMENTS / inline-arg substitution the harness
 * would have done in expandSlashCommand, and returns the expanded text. The
 * harness then treats that text as a normal user prompt: builtin dispatch sees
 * a non-slash prefix and skips, and the prompt reaches the model with the full
 * command body inlined.
 *
 * Only the two names that actually collide are intercepted. All other typed
 * input passes through unchanged.
 */

type ExecResult = { stdout?: string; code?: number };

interface InputEventShape {
	text: string;
	images?: unknown;
	source: "interactive" | "rpc" | "extension";
}

interface InputResultShape {
	handled?: boolean;
	text?: string;
	images?: unknown;
}

interface ExtensionApi {
	on: (
		event: "input",
		handler: (event: InputEventShape) => Promise<InputResultShape | void> | InputResultShape | void,
	) => void;
	exec: (cmd: string, args: string[]) => Promise<ExecResult>;
}

/** Command names that the harness ships as builtins and that this template also defines as file commands. */
const SHADOWED_NAMES = ["plan", "review"] as const;

const __dirname = typeof __dirname !== "undefined"
	? __dirname
	: (import.meta.url ? dirname(fileURLToPath(import.meta.url)) : process.cwd());

/**
 * Read the command body for a given name from .omp/commands/<name>.md relative
 * to this extension's directory. Strips the YAML frontmatter so only the
 * prompt body reaches the model. Returns null if the file is missing.
 */
function loadCommandBody(name: string): string | null {
	const path = join(__dirname, "..", "commands", `${name}.md`);
	if (!existsSync(path)) return null;
	const content = readFileSync(path, "utf8");
	// Strip a leading frontmatter block delimited by --- lines, matching the
	// harness parseFrontmatter behavior for file commands.
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
	return match ? match[2] : content;
}

/**
 * Apply the same $ARGUMENTS substitution the harness performs in
 * expandSlashCommand / substituteArgs. Bare $ARGUMENTS and ${ARGUMENTS} are
 * replaced with the raw args string; inline placeholders are left intact for
 * the model to interpret (the harness appendInlineArgsFallback path would
 * append them as a trailing block; we inline to keep one coherent prompt).
 */
function substituteArgs(template: string, args: string): string {
	if (!args) {
		// No args provided. Clear $ARGUMENTS so it does not leak literally.
		return template.replace(/\$\{?ARGUMENTS\}?/g, "");
	}
	return template.replace(/\$\{?ARGUMENTS\}?/g, args);
}

export default function nativeCommandOverride(pi: ExtensionApi): void {
	pi.on("input", async (event) => {
		const text = event.text?.trim();
		if (!text || !text.startsWith("/")) return;

		// Parse command name and trailing args the same way the harness does.
		const spaceIndex = text.indexOf(" ");
		const commandName = spaceIndex === -1
			? text.slice(1)
			: text.slice(1, spaceIndex);
		const argsString = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();

		if (!(SHADOWED_NAMES as readonly string[]).includes(commandName)) return;

		const body = loadCommandBody(commandName);
		if (body === null) return;

		const expanded = substituteArgs(body, argsString);
		// Return the expanded command as plain text. The harness continues with
		// this text as the user prompt: builtin slash dispatch at line 520 sees
		// a non-"/" prefix and returns false, and #tryExecuteCustomCommand at
		// agent-session.ts:5207 likewise finds no matching custom command name.
		return { text: expanded, images: event.images };
	});
}
