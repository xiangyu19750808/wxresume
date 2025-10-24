````markdown
# wxresume · API & Templates (MVP)

## Docs & Links
- Notion（项目笔记）: https://lunar-parade-c96.notion.site/27e4168855f780d8b9e6dc83b0bcd4a6

---

## Quick Start (Dev)

### 1) 安装依赖
```bash
pnpm install
````

### 2) 配置环境变量（本地）

在项目根目录创建 `.env`（如不存在），示例：

```ini
PORT=8080
JWT_SECRET=dev-secret-please-change
WXPAY_FAKE_CALLBACK_SIGNATURE=wxpay-fake-signature
```

### 3) 启动开发服务

```bash
pnpm -C apps/api dev
```

默认在 `http://localhost:8080` 启动。

### 4) 快速自检

* `GET /v1/health` → `{"code":0,"msg":"ok"}`
* `GET /v1/openapi.json` → OpenAPI 文档
* Postman 集合：`apps/api/postman/wxresume.postman_collection.json`

---

## 模板渲染与字体

本仓库已将简历模板抽成独立包，解决了「可切换模板」「中文无方块字」。

### 包结构

```
packages/templates/
  ├─ package.json
  └─ src/
     ├─ index.js
     ├─ classic/
     ├─ modern/
     └─ shared-fonts/
        ├─ loader.js
        ├─ install.js
        └─ fonts/
```

### 使用方式

* HTTP：`POST /v1/render/pdf?templateId=classic|modern`

  * Body（可选）：`{ "resume": { ... }, "templateId": "classic|modern" }`
  * 响应：`application/pdf` 二进制
* 代码：

  ```js
  import { render } from '@wxresume/templates';
  const pdfBuffer = await render(resumeData, { templateId: 'classic' });
  ```

### 字体与缺字回退

* 字体优先级：系统本地字体 → Noto Sans CJK SC（思源黑体）
* 如缺失中文字体：

  ```bash
  node packages/templates/src/shared-fonts/install.js
  ```
* `loader.js` 启动时会打印字体目录与缺失项

---

## 订单 & 回调

### 支付回调重放防抖（P5-004）

* `POST /v1/order/callback`
* 需请求头 `Wechatpay-Signature`（默认允许值取自 `.env` 的 `WXPAY_FAKE_CALLBACK_SIGNATURE`，缺省为 `wxpay-fake-signature`）
* 幂等键：`out_trade_no + status`；同一状态仅首次生效，其余仅累计计数
* 审计日志：`data/logs/wxpay-callback-audit.log`（示例见 `samples/logs/wxpay-callback-audit.sample.log`）

### 退款占位接口（P5-003）

* `POST /v1/order/refund`（**admin-only**，需 `role=admin` 的 JWT）
* 目前对接 `packages/adapters/wxpay` 的假实现，返回“受理中”占位；上线前需替换为真实网关与签名校验

### 对账脚本（Mock）

* `node jobs/reconcile.js` 演示对账流程（生产需改为真实账单拉取与规则化对比）

---

## 接口一览（节选）

* `GET /v1/health`：健康检查
* `GET /v1/templates`：模板列表
* `POST /v1/render/pdf?templateId=classic|modern`：按模板渲染 PDF
* `POST /v1/order/create`：创建订单（mock）
* `GET /v1/order/status?out_trade_no=...`：订单状态（含回调重放统计）
* `POST /v1/order/callback`：支付回调（签名校验+重放防抖+审计）
* `POST /v1/order/refund`：退款（mock，占位；**admin-only**）
* `POST /v1/users/profile`：模拟登录换取 JWT
* `GET /v1/users/profile`：通过 JWT 获取用户信息
* `GET /v1/openapi.json`：OpenAPI 规范

---

## 身份与鉴权（JWT）

* 模拟登录：

  ```http
  POST /v1/users/profile
  Content-Type: application/json

  { "user_id": "admin" }
  ```
* 生成本地 admin Token（PowerShell）：

  ```powershell
  $env:JWT_SECRET = "dev-secret-please-change"
  $token = node -e "const h={alg:'HS256',typ:'JWT'};const p={uid:'admin',role:'admin',exp:Math.floor(Date.now()/1000)+3600};const k=process.env.JWT_SECRET||'dev';const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const d=b(h)+'.'+b(p);const s=require('crypto').createHmac('sha256',k).update(d).digest('base64url');console.log(d+'.'+s);"
  ```

---

## 本地联调小抄

* **回调重放**：`order.create` → 多次 `order.callback`（带签名）→ 查 `order.status` 与审计日志
* **退款（admin-only）**：

  ```powershell
  $body = @{ out_trade_no='test-001'; amount=1 } | ConvertTo-Json
  Invoke-RestMethod -Method POST -Uri "http://localhost:8080/v1/order/refund" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" -Body $body
  ```
* **模板渲染**：

  ```bash
  curl -X POST "http://localhost:8080/v1/render/pdf?templateId=classic" \
       -H "Content-Type: application/json" \
       -d '{"resume":{"basics":{"name":"张三"}}}' \
       --output resume.pdf
  ```

---

## 风险与上线须知

* 禁用仓库内**假签名/内存存储/mock 适配器**于生产
* 上线前必须完成：真实支付网关与签名校验、幂等/重放/告警策略、对账与差错处理自动化、字体版权与排版回归

---

## 目录速览

```
apps/
  api/
    src/
      server.js
      openapi.json
    postman/
      wxresume.postman_collection.json
jobs/
  reconcile.js
packages/
  adapters/
    wxpay/
      src/index.js
  templates/
    package.json
    src/
      index.js
      classic/
      modern/
      shared-fonts/
        loader.js
        install.js
        fonts/
data/
  logs/
    wxpay-callback-audit.log
samples/
  logs/
    wxpay-callback-audit.sample.log
```

---

## 许可

本项目仅供学习与内部评审使用，发布与商业化前请完成合规审查与安全审计。

```
```
