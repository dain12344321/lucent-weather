# Lucent Weather

Read /home/dain0/AGENTS.md first. This is the sole Git source tree for the native Windows app.

- Keep Git and node_modules on the Linux filesystem.
- Build with `npm ci`, `npm test`, then `npm run build:release`; the native helper bridge invokes the Windows C# compiler.
- Keep app runtime modules in the explicit package allowlist in scripts/package.cjs. Include any new runtime module there and verify the actual asar.
- The Windows handoff folder is C:\Users\dain0\Documents\ChatGPT\Weather PC App. See LUCENTWEATHER-WSL-MAP.md.
- Preserve the original Windows user-data path `%APPDATA%\clear-weather`. QA uses an isolated profile.
- Before publishing, run the automated suite and native Windows QA, inspect screenshots, and compare package/installed hashes. Build into a fresh directory rather than merging runtime trees.
- Update README, release notes and the Windows continuation/receipt when shipping a version.
- No sub-agents for the current refinement task, per Dain's latest instruction.
