# FLOWFRAME

FLOWFRAME 是一个只面向电脑端的动漫影像作品集。主页使用连续 Three.js 空间中的海报、可变形节点网络和动态连线；作品详情使用滚轮连续驱动的 WebGL 双纹理影像、PLAY、INFO 和 Prev/Next。默认作品集为 5 部，Studio 与全局控制台仍允许扩展到最多 6 部。

## 当前路由

- `#/`：方案 1 风格的正式主页。
- `#/works/:id`：五个默认作品的全屏详情。
- `#/lab/transition`：三片段转场试验。
- `#/studio`：作品数据和动效参数调节。

左上角圆形控制按钮在首页和详情页之间持续保留。MOTION 页提供 36 个关键参数，采用可读双列分组和面板内滚动；MEDIA 页一次编辑一个作品和一个片段，并支持海报、短片、音乐的路径或本地文件 CRUD。本地文件存入当前浏览器 IndexedDB，JSON 导出不包含二进制。

窄于 1180px 时显示电脑端提示；项目不开发完整手机页面。

## 需求与设计依据

- 唯一产品与设计要求：`docs/PRODUCT_AND_DESIGN_REQUIREMENTS.md`
- 详情实现规范：`docs/DETAIL_EXPERIENCE_SPEC.md`
- 参考图索引：`docs/references/REFERENCE_INDEX.md`
- 素材状态：`ASSET_REPORT.md`
- 最新视觉检查：`design-qa.md`

## 本地运行

```bash
pnpm install
pnpm fetch:pages-media
pnpm dev
```

GitHub 仓库不保存约 71 MB 的成品媒体二进制。`fetch:pages-media` 会从当前公开 FLOWFRAME 站点下载同一批海报、视频和音频，并按 `scripts/pages-assets.sha256` 校验。GitHub Pages 工作流会自动执行这一步；已有完整 `public/media/` 的本地工作区会直接通过校验，不重复下载。

如果当前 shell 找不到 Node，可把 Codex 工作区 Node 加入本次命令的 PATH：

```bash
PATH=/Users/ruo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dev
```

## 构建与自动检查

```bash
pnpm build
pnpm verify:media
pnpm verify:ui
```

`verify:ui` 会检查主页画框吸附、网络三维形态切换、全局控制台、IndexedDB 媒体持久化、五作品详情、多片段背景循环、默认声音解锁、连续滚动、PLAY 墨滴、INFO 后台继续播放、Escape、hash、刷新恢复、WebGL 回退、reduced-motion、Studio、三片段 Lab、电脑端提示和主要桌面视口。可用 `VERIFY_SCOPE=home|control|detail|studio|transition|guard` 单独运行一组。

## 素材

- 当前官方动漫海报、Bilibili 派生测试片段和 BGM 均为 `placeholder`；旧 AI 画面只保留为旧配置回退。
- 页面必须持续显示 `PLACEHOLDER MEDIA`，直到素材被明确升级为 `final`。
- 每部作品的 `clips` 组成背景和 PLAY 的循环播放列表；`videoSrc` 保留为第一片段兼容字段。
- 媒体选择顺序为 `clips/videoSrc > posterSrc > coverImage > fallback`。

不要修改或提交 `.claude/` 与 `XXQ本地资料/`。未经用户明确要求，不提交、不推送、不发布。
