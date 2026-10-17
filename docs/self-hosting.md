# 独立部署 / Independent deployment

当前没有已验证的线上 Cloudflare 地址。`YOUR_DEPLOYED_ORIGIN` 是占位符，必须替换为 Wrangler 实际输出的 HTTPS origin。模块的 GitHub main 地址在 PR 合并后才提供本次修改。

## Workers

```bash
git clone https://github.com/zhihaochena-pixel/wloc.git
cd wloc/worker
npm ci
npm test
npm run build
npx wrangler login
npm run deploy
```

Before merging the PR, check out `feat/independent-cloudflare` after cloning. Node.js 22 or newer is recommended. Wrangler uses `src/index.js`; no Hono, KV, database or secrets are required. The versioned lockfile pins build dependencies. `npm run build` bundles without publishing.

部署后访问 Wrangler 输出的真实地址，检查 `/` 和 `/api/parse?url=40.7%2C-74`。可选：把 Loon `#!openUrl=` 配成自己的真实选点地址。不要把示例域名直接导入模块。

## Pages

```bash
npm run build:pages
npx wrangler pages project create wloc --production-branch main
npm run deploy:pages
```

Pages uses `functions/[[route]].js`, `dist/_routes.json`, and `wrangler.pages.jsonc`. If the project name is taken, change the name in that config and the create command together. In the Pages Git dashboard set root directory `worker`, build command `npm ci && npm test`, output directory `dist`. Functions are compiled by Pages at deploy time; `build:pages` separately validates compilation. Workers and Pages share exactly the same router and parser.

## 快捷指令 / Shortcuts

仓库只含两个 iCloud 共享链接，未包含可检查的快捷指令源文件。因此无法确认共享版本内部所有动作及响应字段；不能宣称已修改云端快捷指令。

- `wloc Set Location`（182f3a014597468eb1b15b99261cdf22）：复制到自己的快捷指令，在编辑器逐个检查 URL、文本和“获取 URL 内容”动作，将 `https://wloc-spoofer.cyberhandyman.workers.dev/api/parse` 替换为部署输出 origin + `/api/parse`。GET 使用 `url` 查询参数；POST JSON 使用 `{"url":"地图分享链接"}`。返回 `success, longitude, latitude`，并兼容 `lon, lat`。检查后续字典取值是否使用这些字段。
- `wloc Clear & Restore Location`（0352d53ed79849d382f50e9adf050662）：检查是否有相同 Worker 域名，若有，按路径替换为自己已部署的 origin。清除设备坐标本身无需 Worker。
- 保存地址保留 `https://gs-loc.apple.com/wloc-settings/save?lon=...&lat=...&acc=25`；查询为 `?action=query`；清除为 `?action=clear`。这三个动作由设备代理 MITM 拦截，不能改为 Worker，否则无法写入代理客户端的本地持久化存储。
- 完成后重命名自己的快捷指令，运行测试，使用快捷指令 App 的共享菜单生成自己的 iCloud 链接，再替换模块说明和 README 中的两个上游模板链接。

Do not use the upstream shortcuts unchanged. Deploy first, inspect all URL actions, update the parser origin, verify dictionary fields, test on your device, then share your own copy. The repository cannot edit an existing iCloud shared shortcut.

## API / Coordinates

兼容原有 `u` 参数、`format=json`、默认文本 `lat=...&lon=...` 和 `cs=none/gcj`。GET `/api/parse?url=...` (also accepts `text`); POST JSON `{url}` or `{text}`. Valid input returns HTTP 200; invalid/unsupported input HTTP 400; unsupported methods 405. Raw coordinates are `latitude,longitude` in WGS84. Amap `location/lnglat` are longitude,latitude; Apple `coordinate/ll` are latitude,longitude. Amap and mainland Apple coordinates are converted GCJ-02 → WGS84, Baidu BD-09 → GCJ-02 → WGS84. Google coordinates remain WGS84. Conversion is approximate and provider/region conventions need device verification. Short URLs are followed only on an explicit map-host allowlist, at most six requests, eight seconds per request. Known-map HTML landing pages use the original coordinate extractor with a 256 KiB response limit; arbitrary hosts remain blocked.

## 依赖与检查 / Audit

- 完整仓库已有 Hono 路由、解析器及页面源码。已消除 Hono 运行时依赖、共享 Workers/Pages 入口、锁定构建依赖；修正会忽略新增 src/package 文件的规则。
- 五种代理模块中的脚本、图标、homepage 已迁往当前仓库；保留 `Yu9191 Rewrite` 署名，MITM、规则、坐标参数、`wloc_settings` 键保持不变。`dist` 两个压缩脚本原样保留，其源码/原构建链未随 fork 提供，不声称可重新生成。
- `src/page.js` 保留页面与交互，地图链接解析改走同域 API。旧内联解析函数保留但不再调用。兼容入口 wloc-worker.js 重新导出完整服务，部署仍使用 src/index.js。
- 保留第三方运行时资源：Leaflet/unpkg、ArcGIS、OSM、Carto、高德瓦片和 Nominatim 搜索；这是地图和搜索的外部依赖，不属于原作者服务器。上游仓库链接和 iCloud 链接用于致谢/模板说明。
- 仓库当前和克隆历史未见 LICENSE 文件；未凭空给上游代码补发 MIT 授权。必须向上游确认许可文本再补入，已有作者信息完整保留。
- 自动化覆盖路由、页面内联 JS 语法、有效/无效解析、受控短链跳转、坐标换算及五客户端设置脚本的 save/query/clear 模拟。
- 未验证：真实 iPhone、五客户端导入/证书/二进制 protobuf 实际响应、系统缓存行为、地图瓦片在线加载、真实短链最新格式、iCloud 内部动作、Cloudflare 线上部署。
