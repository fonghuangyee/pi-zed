# pi-zed

A Zed terminal status extension for the [Pi coding agent](https://pi.dev), based on
[yuki-kisaku/pi-agent-status](https://github.com/yuki-kisaku/pi-agent-status).

## Features

- Shows an activity spinner in the Zed terminal tab while Pi is working.
- Rings the terminal bell on completion so Zed can notify when the terminal is unfocused.
- Generates a concise AI title for the session in the language of the conversation.
- Supports `/rename` to regenerate a title from the conversation or set one explicitly.
- Provides `/zed` settings for spinner, completion bell, title generation, naming model,
  title capitalization, and the maximum title length.
- Activates only in Zed terminals and stands down inside tmux.

## Install

Install this package through Pi from its local project path, or publish it and install the resulting
npm package:

```bash
pi install .
```

## Settings

Open the interactive settings menu with:

```text
/zed
```

Use **title-case** to choose Title Case or all lowercase (the default) for generated, restored, and
explicitly renamed titles. Use **title-max-chars** to choose the requested maximum title length. It
defaults to 32 Unicode code points. This limit is guidance for the naming model; longer responses
are preserved rather than truncated into an incomplete title.

Settings are saved at `~/.pi/agent/pi-zed.json`. These naming options can also be edited there:

```json
{
  "naming": {
    "maxChars": 48,
    "caseStyle": "lowercase"
  }
}
```

Set **naming-model** to `provider/model-id` to use a different model for titles, or clear it to use
the model already running in the session.

## Commands

```text
/rename                     regenerate the tab title from the whole conversation
/rename Fix OAuth callback  set the tab title explicitly
/zed                         open the settings menu
```

## Development

```bash
npm install
npm run check
npm test
```

## Credit and license

This project includes work derived from [pi-agent-status](https://github.com/yuki-kisaku/pi-agent-status)
by **yuki-kisaku**. See [NOTICE](NOTICE) for attribution, details of the derived functionality,
and the upstream MIT notice. See [LICENSE](LICENSE) for this project's license.
