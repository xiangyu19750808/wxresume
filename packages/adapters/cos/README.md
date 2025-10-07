# @wxresume/adapters-cos

用于在不同环境下接入腾讯云 COS 的适配器集合。当前提供一个可本地使用的 `CosFakeAdapter`，并预留了生产环境接入腾讯云的 `CosTencentAdapter` 构造参数。

## StorageAdapter 接口

所有适配器都会实现如下接口：

- `putObject(key, body)`：写入对象内容。
- `getSignedUrl(key, options?)`：生成带过期时间的下载链接。
- `headObject(key)`：读取对象元数据（大小、最后更新时间）。
- `deleteObject(key)`：删除对象。

## CosFakeAdapter

`CosFakeAdapter` 主要面向本地开发环境：

- 将文件写入到仓库内的 `apps/api/paid/` 目录。
- 返回 `http://localhost:8080/mock/<key>` 的访问链接。
- 下载链接默认 180 秒后过期，可通过 `expiresIn` 参数调整。

```js
import { CosFakeAdapter } from '@wxresume/adapters-cos';

const adapter = new CosFakeAdapter();

const key = 'offers/简历 示例.pdf';
await adapter.putObject(key, Buffer.from('resume')); // 写入文件

const { url } = await adapter.getSignedUrl(key); // http://localhost:8080/mock/offers/%E7%AE%80%E5%8E%86%20%E7%A4%BA%E4%BE%8B.pdf
const meta = await adapter.headObject(key); // { key, size, lastModified }

await adapter.deleteObject(key);
```

在测试环境可以自定义存储目录和访问域名：

```js
const adapter = new CosFakeAdapter({
  baseDir: '/tmp/cos-fake',
  publicBaseUrl: 'http://localhost:8081/files/',
});
```

## CosTencentAdapter

`CosTencentAdapter` 预留了构造参数（`secretId`、`secretKey`、`bucket`、`region`），以便后续接入腾讯云官方 SDK。当前暂未实现具体逻辑。
