## Docs & Links
- Notion: https://lunar-parade-c96.notion.site/27e4168855f780d8b9e6dc83b0bcd4a6?v=27e4168855f780c0b577000c5d20281a


\## Quick Start (Dev)



\### 1) 安装依赖

```bash

pnpm install




> protection smoke test

> protection smoke test

> 冒烟脚本（smoke.sh / smoke.cmd）会覆盖“渲染→签名下载→文件存在/bytes>0”的校验

## 端到端联调测试

通过一条命令即可在本地或 CI 中验证“健康检查 → 登录 → 渲染 → 下载签名 → 订单状态流转”的核心链路：

```bash
npm run test:e2e
```

该脚本会自动启动本地 API 服务，先断言未登录访问会被拒绝，然后模拟微信登录拿到 JWT，继续完成渲染 PDF、校验下载签名有效期，并创建订单直至支付回调更新为 `paid` 状态。


## API 错误码与访问日志规范

所有 API 响应都会携带 `X-Request-ID` 头并返回统一的 `{ code, msg, data, requestId }` 结构：

- 成功时 `code` 固定为 `0`，`msg` 默认为 `ok`，业务数据放在 `data` 内。
- 业务失败或服务异常时调用 `res.fail(code, msg, data?, status?)`，并保证 `requestId` 与请求头一致，方便串联排查。
- 如果手动调用 `res.json()`，中间件会自动补充 `msg`/`data`/`requestId` 字段，保证结构一致。

示例：

```json
{
  "code": 500,
  "msg": "database error",
  "data": null,
  "requestId": "1c2f0d40-9f53-4ae2-8fd0-6be04a6bc4fb"
}
```

访问日志采用 JSON 行格式输出，字段如下：

| 字段 | 说明 |
| --- | --- |
| `timestamp` | ISO8601 时间戳 |
| `requestId` | 与响应中的 `requestId`、请求头 `X-Request-ID` 一致 |
| `ip` | 请求 IP（优先 `X-Forwarded-For`） |
| `ua` | User-Agent |
| `method`/`path` | HTTP 方法与路由 |
| `status` | 响应状态码 |
| `durationMs` | 请求耗时（毫秒，保留三位小数） |

示例访问日志：

```json
{"level":"info","timestamp":"2024-01-01T12:00:00.000Z","requestId":"1c2f0d40-9f53-4ae2-8fd0-6be04a6bc4fb","ip":"127.0.0.1","ua":"curl/8.5.0","method":"GET","path":"/v1/health","status":200,"durationMs":3.215}
```

排查流程：

1. 复制接口返回体中的 `requestId`。
2. 在访问日志中搜索同一个 `requestId`，确认请求路径、状态码与耗时。
3. 若响应为 5xx，可继续在错误日志（`level=error`）中检索同一 `requestId` 获取堆栈信息。

