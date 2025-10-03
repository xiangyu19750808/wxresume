# Contributing Guide (wxresume)

## 分支策略
- 日常开发：`codex/dev`（从 `main` 切出）
- 每个功能：从 `codex/dev` 再切出 `feat/<name>`、`fix/<name>`、`chore/<name>`

## 提交流程
1. **拉分支**
   ```bash
   git fetch origin
   git switch codex/dev
   git pull --ff-only
   git switch -c feat/<name>

