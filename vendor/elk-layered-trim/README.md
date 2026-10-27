# ELK layered-only 裁剪包（飞书离线小组件用）

- `elk-layered-trim.worker.min.js`：用 GWT 从 elkjs 0.9.3 / ELK 0.9.1 重新编译，只注册 `layered` 算法（ChatGPT 风流程图只用它）。
  qa-loop 等样例与站点完整版 elkjs 0.9.3 输出的 SVG 逐字节一致。
- `elk-api.js`：elkjs 0.9.3 的 `lib/elk-api.js`（原样）。
- `lzma-d-min.js`：LZMA-JS 解压器（只含解压，MIT）。

`npm run build:offline` 把这三样 + `src/shared/offline/app.js` 打成一段 lzma+base64 负载，写到 `src/shared/offline/engine-payload.js`（已提交，日常构建无需重跑）。
飞书 HTML 块上限 500KB（按飞书的计量，比文件字节约多 75KB），所以负载要尽量小。
