# Codex 开发者指令（wxresume）
> 目标：首次即绿（本地可跑、`api-check` 通过、PR 自动合并）

## 1) 分支策略
- 日常开发：从 **`codex/dev`** 切出  
  `feat/<name>`｜`fix/<name>`｜`chore/<name>`
- 提交前保持与 `main` 同步（或在 PR 页点 **Update branch**）
```bash
git fetch origin
git switch codex/dev
git pull --ff-only
git switch -c feat/<name>

```
