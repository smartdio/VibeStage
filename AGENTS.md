# VibeStage Agent instructions

Read AGENT_GUIDE.md before creating scenes and MODEL_GUIDE.md before importing models.

This repository is the public workbench framework. User work belongs in the ignored directories `projects/` and `user-models/`. Keep framework changes separate from scene-specific work.

Use `npm ci`, then `npm run dev`; startup initializes missing local workspace directories and copies public examples only when `projects/` does not yet exist. Never overwrite an existing user project during setup or framework updates.

Create scenes using `npm run create-scene -- <project-id> <scene-id> [empty|room|blocking]`. Edit `projects/<project-id>/scenes/<scene-id>.ts`; put project helpers and resources alongside it. Only direct `.ts` files in `scenes/` are scene entries. Shared user assets and reusable user-defined model code belong in `user-models/`.

Use `@vibestage/core` for shared primitives, mannequins and `loadModel()`. Use `@vibestage/models/...` for private model imports. Do not copy private projects or assets into `examples/`, `lib/`, `templates/`, or `src/` merely to make them load.

Only when selecting, using, adjusting, or extending cinematic camera presets, read [agents/CAMERA_PRESETS.md](agents/CAMERA_PRESETS.md). Follow its research links only when needed; do not preload these guides for unrelated tasks.

Manual camera changes are stored in `projects/<project>/settings/<scene>.camera.json` and override matching code-authored fields after update(t). Inspect this file before changing camera behavior. Preserve unrelated manual settings; use the UI save/reset controls or edit this private JSON intentionally.

Scene code is ordinary Three.js, not a restricted JSON schema. Preserve unrelated objects, poses and cameras when modifying a scene. Implement deterministic `update(timeSeconds)`; keep scene resources owned and disposable. Directions are north -Z, south +Z, east +X, west -X.

Use `npm test` and `npm run build` to validate framework changes. Use `npm run check:projects` and the live preview for user scene changes. Framework builds do not type-check private user projects. Read browser errors and inspect relevant rendered views before declaring visual changes done.

Do not force-add `projects/`, `user-models/`, `exports/`, or `artifacts/` to Git. A user explicitly requesting publication of one of their projects must identify what to publish; ordinary framework publication does not include those directories. Git ignore rules do not remove files already tracked by an existing clone.

Exports stay local. `source.zip` contains the current project and the private model library for reproducibility; do not treat it as a public release archive. Do not publish a repository or push to GitHub unless the user requests that action.

For soundtrack import, audio alignment or audio export, read `agents/AUDIO.md` on demand. Preserve per-scene `.audio.json` settings and project audio assets when changing cameras or animations.
