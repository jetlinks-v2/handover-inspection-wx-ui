# 承接查验 H5

独立业务仓库 `jetlinks-v2/handover-inspection-wx-ui`，Node.js 22.18+，Vue 3 + Vant 4。仅包含移动业务页面、浏览器认证和宿主适配；纯业务类型和初始复制的模型由本仓库自行维护，不跨仓导入 PC 或 SaaS 私有代码。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

开发入口 `http://127.0.0.1:9310/handover-h5/?applicationScope=<应用ID>`。设置 `H5_API_PROXY` 指向同源 API 的开发上游；生产 `dist/` 部署至 `/handover-h5/`，PC 构建不更新本 H5。Nginx 示例只发布本路径，部署时保留上一版以便回退；公共 `/api` 应代理至原认证网关。

`public/config.json` 仅包含标题与同源 API 路径，不配置应用 ID、项目编码、用户或凭据。应用 ID 来自具体应用入口；裸入口提示重新从应用打开，不猜测应用或读取历史应用。浏览器只填写应用账号、密码和需要时的安全验证，账号原样提交；公开请求不携带旧 token、应用 Scope 或租户头。取得本人 token 后调用当前应用 Scope 的 `/authorize/me`；具体业务权限与执行资格继续由每个业务接口核验。sessionStorage 键 `handover-h5:session:v2` 独立隔离，401 清理本会话，403 保留会话并展示原因。

APP 使用 `?mode=app` 或加载前注入 `window.handoverHost`。契约见 `src/services/host.ts`：`context()` 提供用户、具体应用、可选平台项目／环境及权限；`request()` 负责认证、Scope、业务项目头、JSON/FormData，返回已解包结果，附件读取使用 `options.responseType='blob'` 返回 Blob；失败抛出带 status 的错误。请求路径有业务白名单，前后核对身份，写入不自动重试。缺少 Bridge、超时或身份变更提示返回 APP，不回退浏览器登录；宿主失败重试卸载旧业务页面。`back()` 可关闭 WebView。宿主安全区可提供 `--h5-app-safe-top`、`--h5-app-safe-bottom`。

真实 Bridge、WebView、上传、附件读取、权限弹窗、存储隔离及过期行为需要 APP 真机验收。测试宿主和浏览器自动测试不能代表真机完成。

业务接口、角色、项目／房屋数据范围、附件权限和重复提交规则沿用原系统。原有离线草稿、照片 Blob、上传回执及请求号流程保留，分区为环境＋应用＋用户＋物业项目，令牌不写入 IndexedDB；登录与刷新须联网核验，离线工作仅适用于已核验的当前会话，静态壳支持已安装后的离线打开，配置与身份仍须联网恢复；不提供离线认证冷启动。

浏览器回归（本机已安装 Chrome）：先 `npm run build`，再 `npm run test:browser`。使用独立临时预览端口与模拟 API／宿主，覆盖 320/390px、登录表单、入口和关键业务控件；截图写入被忽略的 `.agent-runtime/browser/`。真实后端授权、上传和 APP 接入仍需实际环境验收。
