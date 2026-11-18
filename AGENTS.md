# Lucent Weather

On Dain's Windows PC, read `~\AGENTS.md` first (hard rules, naming, and "Working together": locks, branches, commits). This is the sole Git source tree for the native Windows app. On that PC it lives in `source\` inside the project folder `~\projects\lucent-weather`, which also holds the release, QA and rollback evidence and the handoff notes (`CONTINUATION.md`, not in Git). This is a public repo: no keys, serials or machine details in commits.

- WSL is retired: keep Git and node_modules on the Windows disk (NTFS), inside `source\`.
- Build with `npm ci`, `npm test`, then `npm run build:release`; the native helper bridge invokes the Windows C# compiler.
- Keep app runtime modules in the explicit package allowlist in scripts/package.cjs. Include any new runtime module there and verify the actual asar.
- The Windows handoff folder is the project folder `~\projects\lucent-weather` (one level up from `source\`). LUCENTWEATHER-WSL-MAP.md documents the old WSL layout and is historical.
- Preserve the original Windows user-data path `%APPDATA%\clear-weather`. QA uses an isolated profile.
- Before publishing, run the automated suite and native Windows QA, inspect screenshots, and compare package/installed hashes. Build into a fresh directory rather than merging runtime trees.
- Update README, release notes and the Windows continuation/receipt (`CONTINUATION.md` in the project folder) when shipping a version.
- No sub-agents for the current refinement task, per Dain's latest instruction.
