# Rhiz.om Prompt System ― **Comprehensive Requirements v 2025-07-13**

“**Prompts are code**—they live in your repo, run from the shell, and speak seamlessly to either Claude Code or Gemini CLI.”

---

## 0 · Objectives

| #   | Goal                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-1 | **One prompt tree** (`prompts/…`) that also plays nicely with Claude’s legacy `.claude/commands/…` lookup.                                     |
| 0-2 | **Agent-agnostic CLI syntax**—the same `--flag=value` string works with Claude or Gemini.                                                      |
| 0-3 | **Chat-first workflow**—free-form discussion, pasted docs, then `/requirements` (or `prompt-run requirements`) to synthesise output.           |
| 0-4 | **Automation-ready**—Git hooks and CI jobs run the exact same prompts non-interactively and receive deterministic exit codes.                  |
| 0-5 | **No monolithic “coding agent”**—we rely on the *official* CLIs plus a 50-line wrapper, keeping 100 % of logic in version-controlled markdown. |

---

## 1 · Directory & Command Resolution

```
search order        example path
───────────────┬──────────────────────────────────────────────
 1 (project)   │ $PWD/.claude/commands/dev/code-review.md
 2 (parents)   │ $PWD/../.claude/commands/dev/code-review.md
 3 (user)      │ $HOME/.claude/commands/dev/code-review.md
 4 (portable)  │ prompts/commands/dev/code-review.md
───────────────┴──────────────────────────────────────────────
```

* Slash command `/dev:code-review` maps to `dev/code-review.md`.
* Resolution logic is identical for Claude Code and the wrapper.

---

## 2 · Prompt File Format

### 2-1 Metadata block (HTML comment)

```html
<!--
name:              "Requirements Workshop"
interactive:       chat          # false · ask · chat
sentinel:          "^### END"    # regex that ends streaming
context_providers: [git_diff, session_history]
args:
  - name:          scope
    description:   "Short noun phrase (e.g. search)"
    strategy:      ask           # ask · infer · infer_from_context · optional
  - name:          stakeholder
    strategy:      ask
  - name:          base_branch
    strategy:      infer
    default:       main
-->
```

### 2-2 Body

* First line **after** the closing comment is the prompt header.
* `{{var}}` → wrapper substitution.
* `$ARGUMENTS` → entire unparsed arg string (Claude legacy).

---

## 3 · Context Providers

| Name               | Injected variables | Source                                           |
| ------------------ | ------------------ | ------------------------------------------------ |
| `git_diff`         | `diff`             | `git diff --staged` (or `--merge-base <branch>`) |
| `session_history`  | `history`          | Last *N* user+assistant turns (wrapper buffer)   |
| `cwd`              | `path`, `basename` | `$PWD`, basename                                 |
| `clipboard`        | `clip`             | `pbpaste` / `xclip -o`                           |
| `workspace_memory` | `memory`           | First 8 KB of nearest `CLAUDE.md` / `GEMINI.md`  |

> **Custom providers:** executable scripts in `.prompt-run/providers/<name>` that `echo` JSON.

---

## 4 · `prompt-run` Wrapper — Functional Spec

### 4-1 Core flags

```
prompt-run <namespace:command> [args] [--flag=value …]

--agent <claude|gemini>     default gemini
--model <id>                forwarded
--output-format <type>      forwarded
--max-turns <n>             forwarded
--verbose                   forwarded
--stdin -                   read entire STDIN into $previous_chat
--out <file>                write raw LLM output
```

### 4-2 Behaviour

1. **Locate prompt** (§1).

2. **Parse metadata** with `yq`, ignore if absent.

3. **Collect variables**

   | strategy             | resolution order                                   |                                                                                       |
   | -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
   | `infer`              | provider → `default` → blank                       |                                                                                       |
   | `infer_from_context` | provider → “chat memory” regex → `default` → blank |                                                                                       |
   | `ask`                | *If* interactive TTY *and* \`interactive: true     | chat\` → prompt user; else insert model instruction “ask clarifying question inline”. |
   | `optional`           | may remain blank                                   |                                                                                       |

4. **Assemble prompt** = `persona` + `includes` + body → apply substitutions.

5. **Wrap** via `prompts/prompt_config.json`:

   ```json
   {
     "agents": {
       "gemini": { "model": "gemini-1.5-pro", "system_prompt_wrapper": "You are…\n---\n%s" },
       "claude": { "model": "claude-3-opus-20240229", "system_prompt_wrapper": "You are…\n<instructions>\n%s\n</instructions>" }
     }
   }
   ```

6. **Invoke backend**

   * *Claude* → `claude -p "$TEXT" <flags>`
   * *Gemini* → `gemini --prompt "$TEXT" <flags>`

7. **Interactive streaming loop** (`interactive: chat`):

   ```
   while read -r line from backend:
       print line
       if line =~ sentinel: break
       if stdin ready: send user input to CLI --continue
   ```

8. **Exit status** – `0` on success; `1` if response matches sentinel fail-regex or wrapper error.

---

## 5 · Slash-Command Interception for Gemini CLI (Optional Enhancement)

* **Interceptor script** watches Gemini REPL stdout; when a line starts `/cmd`, it calls:

  `prompt-run cmd [args] transcript="$BUFFER"`

  and streams the result back into the REPL.

* Zero-config for the user; gives Claude-style ergonomics until Gemini merges native slash-commands (upstream Issue #2727).

---

## 6 · Model-Context Protocol (MCP) Tool (Advanced)

* Register tool `run_prompt` with Gemini CLI.

* Gemini can call it directly:

  ```json
  {
    "name": "run_prompt",
    "arguments": {
      "name": "requirements",
      "args": { "scope": "Bulk invite" },
      "stdin": "<conversation so far>"
    }
  }
  ```

* Implementation simply shells out to `prompt-run`.

---

## 7 · Usage Scenarios

| Flow                              | Steps                                                                                                                                            |   |          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | - | -------- |
| **Ad-hoc workshop**               | 1️⃣ Chat freely in Gemini REPL (paste docs).<br>2️⃣ Type `/requirements scope="Bulk invite"`. Interceptor pipes last 25 turns into `prompt-run`. |   |          |
| **Pre-commit review**             | Hook:<br>\`prompt-run dev\:pre\_commit --diff="\$(git diff --staged)" --out .tmp/review\.txt                                                     |   | exit 1\` |
| **CI PR review**                  | `prompt-run dev:code-review --branch=$BRANCH --model=gemini-2.5-pro --stdin - < pr-description.md`                                               |   |          |
| **Generate scaffold**             | `prompt-run scaffold --language=ts --name=auth --dir=src/auth` (Claude or Gemini)                                                                |   |          |
| **Requirements, non-interactive** | `prompt-run requirements --scope="Billing export" --stakeholder="Finance"`                                                                       |   |          |

---

## 8 · Acceptance Criteria

1. **Lookup parity** with Claude (project → parents → user → prompts).
2. **Flag parity** (`--model`, `--output-format`, `--max-turns`, `--verbose`, `--out`).
3. **Interactive arg gather** works when `interactive: true|chat` *and* TTY.
4. **Context providers** inject variables as documented.
5. **Session history** appears in prompt when listed in `context_providers`.
6. **Sentinel detection** controls exit 0/1 in both interactive and headless modes.
7. **Slash-command intercept** (if enabled) routes `/cmd` to `prompt-run` inside Gemini REPL.
8. **MCP tool** (if configured) successfully calls `prompt-run` from the model.
9. No regression: Prompts lacking new metadata still execute exactly as in v 1.1.

---

## 9 · Non-Goals

* Replacing official CLIs with a custom agent.
* IDE plug-ins or GUI front-ends.
* Shells other than Bash ≥ 5 (zsh/fish support is welcome but out-of-scope).
* Native Gemini slash-command support (tracked upstream).

---

## 10 · Revision History

| Ver | Date       | Author    | Summary                                                                                                             |
| --- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| 2.0 | 2025-07-13 | @svincent | Added interactive/chat workflow, fuzzy arg strategies, context providers, slash-command intercept, MCP tool option. |
| 1.1 | 2025-07-13 | @svincent | Wrapper parity (Gemini ↔ Claude), `--out`, lookup rules.                                                            |
| 1.0 | 2025-07-12 | @svincent | Initial “prompts as code” spec.                                                                                     |

---

### With v 2.0 you can paste a whiteboard dump, chat for ten minutes, then type `/requirements`, run a fully scripted Git hook, or fire a giant-context Gemini batch job—**all from the exact same markdown prompt and flag syntax.**
