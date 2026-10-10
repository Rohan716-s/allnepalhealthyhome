# Project Git auto-push

This project has a Codex `Stop` hook that checks completed-turn changes, excludes local secrets, credentials, temporary files, and oversized files, then creates a commit and pushes the current branch to the configured `origin`. The hook never force-pushes. If the push fails, its local commit remains intact.

Codex requires a one-time review and trust decision for project hooks. In Codex, open `/hooks`, inspect the project `Stop` hook, and trust it. Codex skips project hooks until the project layer and exact hook definition are trusted. After changing the hook, review it again.

To preview behavior without staging or committing anything, run this from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .codex/hooks/auto-push.ps1 -WhatIf
```

To disable automation, remove the `Stop` hook from `.codex/hooks.json` or disable that hook in Codex's `/hooks` panel.
