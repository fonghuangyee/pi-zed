# Zed Terminal Threads + Pi integration study

## Executive summary

Zed Terminal Threads run Pi's native TUI in a terminal-backed thread. Zed organizes the terminal as a thread; Pi continues to own its authentication, models, tools, instructions, skills, and MCP configuration. Zed explicitly documents a Pi extension that rings the terminal bell on `agent_end`.

`pi-zed` already extends that baseline with session naming, a work spinner, bell settings, and rename/settings commands. The strongest next step is editor-context handoff using Zed Tasks: Zed can pass the current selection, file, cursor location, and worktree path to a launched command. This is mostly a documentation/example opportunity. We should also ensure terminal escape sequences cannot leak into Pi's non-interactive output modes.

## Current `pi-zed` coverage

The current extension already provides the core terminal-host integration:

- Detects Zed terminals and stays inactive under tmux.
- Sets the terminal title from a generated or explicitly chosen session name.
- Shows a configurable spinner by updating the title while Pi is working.
- Rings BEL on completion so Zed can notify for an unfocused terminal.
- Provides `/rename` and `/zed` commands.

These features substantially overlap the upstream [`pi-agent-status`](https://github.com/yuki-kisaku/pi-agent-status) Zed package and extend beyond Zed's documented Pi recipe, which is just a bell-on-completion extension. New work should focus on editor-aware workflows rather than add generic status cosmetics without a clear benefit.

## Existing Terminal Thread integration points

| Integration point | What it provides | Fit for `pi-zed` |
| --- | --- | --- |
| **Terminal Thread** | Native Pi TUI organized in Zed's Threads Sidebar; terminal title and bell can inform the Zed UI. | **Primary target.** |
| **Zed Tasks** | Reusable commands with editor context such as `$ZED_SELECTED_TEXT`, `$ZED_FILE`, `$ZED_ROW`, and `$ZED_WORKTREE_ROOT`. | **Best near-term addition.** Supply tested task recipes. |
| **Pi external editor (`zed --wait`)** | Pi's Ctrl+G editing flow opens the prompt in Zed and waits for the edit to finish. | **Document, don't reimplement.** |
| **Remote Terminal Threads** | The CLI runs in the remote project shell and reads that environment/configuration. | **Test compatibility.** Ensure title, bell, tasks, and Pi's config behave as expected. |

Zed's Terminal Threads documentation says the CLI owns its authentication, model/provider configuration, tools, skills, instructions, and MCP configuration. Zed's `agent.terminal_init_command` setting can start Pi automatically in new Terminal Threads; the terminal remains an ordinary interactive shell after the command exits.

## Opportunities, ranked

### 1. Ship Zed Task recipes for current-editor context — high value, low effort

Zed Tasks can resolve editor variables in `args`, `cwd`, and labels. Pi accepts a positional message as its initial prompt, so a task can start Pi in the project root with a prompt containing the current selection or file location.

Example project-local `.zed/tasks.json`:

```json
[
  {
    "label": "Pi: review selection",
    "command": "pi",
    "args": [
      "Review this selected code. Explain risks and suggest a minimal fix:\n$ZED_SELECTED_TEXT"
    ],
    "cwd": "$ZED_WORKTREE_ROOT",
    "use_new_terminal": true,
    "save": "current"
  },
  {
    "label": "Pi: inspect current file",
    "command": "pi",
    "args": [
      "Inspect $ZED_RELATIVE_FILE near line $ZED_ROW and explain the relevant code."
    ],
    "cwd": "$ZED_WORKTREE_ROOT",
    "use_new_terminal": true,
    "save": "current"
  }
]
```

The selection task is only offered when a selection exists, unless a default is supplied. Zed caches task context on rerun by default; users who bind task reruns should set `reevaluate_context: true` to use the latest selection/file. Keep these as explicit user-invoked tasks, not automatic hooks: running Pi with a positional prompt submits it immediately. `save: "current"` helps Pi see the current saved buffer when it reads files.

**Suggested delivery:** document these in a `pi-zed` guide first. If they prove useful, add an `examples/zed-tasks.json` users can copy; do not silently install project tasks or alter users' Zed config.

### 2. Harden terminal-only output for non-interactive modes — high value, low effort

Pi extensions can load in TUI, RPC, JSON, and print modes. `pi-zed` writes OSC terminal-title sequences directly to `process.stdout`; if it is accidentally active when stdout is redirected, those sequences can pollute machine-readable output. BEL already checks `stdout.isTTY`, but title writes do not.

Add a defense-in-depth guard before terminal effects: require an interactive TUI/TTY in addition to the Zed environment check, and test that redirected stdout receives no OSC/BEL bytes. This should not change normal Zed Terminal Thread behavior. Pi documents `ctx.mode === "tui"` for terminal-only behavior; where context is unavailable at extension load, `process.stdout.isTTY` is a useful additional guard.

### 3. Document `zed --wait` for Pi's external editor — useful, no runtime work

Pi's external-editor flow can use `zed --wait`, so Ctrl+G opens the current input in Zed and returns it to Pi after the editor closes. Add this as a short setup tip, with either Pi's `externalEditor` setting or `VISUAL=zed --wait`. This is more dependable and simpler than creating a Zed-specific editing command in this extension.

### 4. Improve status semantics and title usefulness — medium effort, validate first

The current spinner/title/BEL are a good foundation. Potential follow-ups:

- Test whether the current OSC 2 title is reflected consistently in both terminal tabs and Terminal Thread titles, including local and remote projects.
- Consider an optional title format that keeps the task title readable while indicating busy/idle state; avoid adding branch/model data unless it can be obtained reliably and updated without flicker.
- Check whether completion alerts should use Pi's final `agent_settled` boundary. Zed's own example uses `agent_end`, but Pi documents that `agent_end` may be followed by recovery, retries, compaction, or queued work. Preserve the default unless testing shows duplicate or premature notifications.

### 5. Test the Terminal Thread lifecycle and remote behavior

Test the complete workflow in both ordinary Zed terminals and Terminal Threads: title on startup, title restoration on session resume, spinner start/stop, bell on completion while unfocused, and behavior when Pi is reloaded or interrupted. Repeat in remote projects, where the CLI reads the remote shell environment and configuration. Document that credentials and Pi settings must be available to the shell where Pi runs; Zed does not copy its AI provider keys into Terminal Threads.

## Recommended plan

1. **Now:** add task examples and the `zed --wait` tip to the README/docs; make terminal output TTY/TUI-safe and cover it with tests.
2. **Next:** test titles, spinner, bell, and Zed Tasks in ordinary terminals and Terminal Threads, including remote projects; evaluate `agent_settled` notification timing.
3. **Later:** consider richer status/title configuration only if users ask for it. Keep the extension focused on Pi's native terminal experience.

## Sources

- [Zed: Terminal Threads](https://zed.dev/docs/ai/terminal-threads) — Pi bell example, title/notification behavior, terminal-thread configuration boundary, and remote project notes.
- [Zed: Tasks](https://zed.dev/docs/tasks) — editor variables, argument handling, context reevaluation, and project/global task templates.
- [Pi: CLI](https://pi.dev/docs/latest/cli) — positional initial prompts and CLI modes.
- [Pi: Extensions](https://pi.dev/docs/latest/extensions) — extension lifecycle, non-TUI modes, and `agent_end` versus `agent_settled`.
- [Pi: Keybindings](https://pi.dev/docs/latest/keybindings) — external editor selection; [Pi editor picker](https://pi.dev/packages/pi-editor-picker) documents `zed --wait` setup.
- [`yuki-kisaku/pi-agent-status`](https://github.com/yuki-kisaku/pi-agent-status) — existing Pi terminal-status integration and the upstream basis for this project.
