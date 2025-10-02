export async function getSignedUrl(key) {
  // 占位：返回本机假链接（后续接 COS 再替换）
  return `http://localhost:8080/mock/${encodeURIComponent(key)}?t=${Date.now()}`;
}
