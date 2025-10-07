## Docs & Links
- Notion: https://lunar-parade-c96.notion.site/27e4168855f780d8b9e6dc83b0bcd4a6?v=27e4168855f780c0b577000c5d20281a


\## Quick Start (Dev)



\### 1) 安装依赖

```bash

pnpm install




> protection smoke test

> protection smoke test

> 冒烟脚本（smoke.sh / smoke.cmd）会覆盖“渲染→签名下载→文件存在/bytes>0”的校验

### 环境变量

API 服务使用 `ALLOWED_ORIGINS`（逗号分隔）控制允许的跨域来源，例如：

```bash
export ALLOWED_ORIGINS="http://localhost:3000,https://saas.example.com"
```
