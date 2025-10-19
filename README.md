## Docs & Links
- Notion（项目笔记）: https://lunar-parade-c96.notion.site/27e4168855f780d8b9e6dc83b0bcd4a6

## Quick Start (Dev)

### 1) 安装依赖
```bash
pnpm install
```

### 模板渲染与字体

- 模板库已拆分为独立包 `packages/templates`，导出 `render(data, { templateId })` 支持 `classic`、`modern` 两套风格。每个模板都会自动引入共享字体栈，保证中文显示无方块字。
- 字体加载优先级：系统本地字体 → `Noto Sans CJK SC` → `思源黑体`。若本机缺失，可运行 `node packages/templates/src/shared-fonts/install.js` 下载 Google Noto Sans SC 的 400/600 字重到 `packages/templates/src/shared-fonts/fonts/`。
- 需要调试渲染时执行：
  ```bash
  pnpm -C apps/api dev
  ```
  再通过 Postman/HTTP 工具调用：
  - `POST /v1/render/pdf?templateId=classic`，Body 传 `{ "resume": { ... } }` JSON Resume；若省略则使用样例数据。
  - `POST /v1/render/pdf?templateId=modern` 渲染现代模板。响应为 `application/pdf`，并附带 `X-Template-Id` 和字体告警头。

> 提示：`packages/templates/src/shared-fonts/loader.js` 会在服务启动时打印字体目录与缺失的字体文件，便于排查字体安装情况。

## 风控说明（对账 & 退款）

- `jobs/reconcile.js` 仅使用假数据模拟微信支付对账流程，正式环境需要替换为真实账单拉取与落库，对比逻辑需结合商户号规则完善。
- `/v1/order/refund` 接口默认需要管理员（JWT `role=admin`）调用，并通过 `packages/adapters/wxpay` 的 `refund` 占位方法返回“受理中”状态，避免误判为已完成退款。
- 请勿在生产环境使用仓库内的假签名或内存订单存储；上线前必须接入正式的签名校验、幂等控制以及风控告警。

### 支付回调重放防抖

- `/v1/order/callback` 要求请求头携带 `Wechatpay-Signature`（或同义大小写），默认值为 `.env` 的 `WXPAY_FAKE_CALLBACK_SIGNATURE`（未配置时为 `wxpay-fake-signature`）。
- 回调处理按 `out_trade_no + status` 做原子更新：同一状态第一次成功才会记账，其余重放只累计计数，便于观察渠道抖动。
- 每一次回调都会记录到 `data/logs/wxpay-callback-audit.log`；仓库中提供 `samples/logs/wxpay-callback-audit.sample.log` 作为审计示例。
- Postman 集合新增 `order.callback replay (mock)` 请求，依赖 `order.create` 设置的 `out_trade_no` 变量，可自动发起两次重放并打印响应。
- `scripts/smoke.sh` / `scripts/smoke.cmd` 均默认附带签名头，并对同一订单回调两次，供本地验证幂等逻辑。
