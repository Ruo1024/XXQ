# FLOWFRAME

FLOWFRAME 是一个只面向电脑端的动漫影像作品集。主页使用连续 Three.js 空间中的海报、可变形节点网络和动态连线；作品详情使用滚轮连续驱动的 WebGL 双纹理影像、PLAY、INFO 和 Prev/Next。默认作品集为 5 部，Studio 与全局控制台仍允许扩展到最多 6 部。

## 当前路由

- `#/`：方案 1 风格的正式主页。
- `#/works/:id`：五个默认作品的全屏详情。
- `#/lab/transition`：三片段转场试验。
- `#/studio`：作品数据和动效参数调节。

左上角圆形控制按钮在首页和详情页之间持续保留，完整视频播放时隐藏。MOTION 页提供 36 个关键参数，采用可读双列分组和面板内滚动；MEDIA 页分别管理海报、背景短片、PLAY 完整视频和音乐。本地文件存入当前浏览器 IndexedDB，JSON 导出不包含二进制。

点击 PLAY 后，黑色圆形从按钮位置扩张，覆盖窗口后进入完整视频。视频保持原始比例并铺满播放器视口。底部只有播放／暂停、进度和音量，默认隐藏，交互时出现。左上角 BACK 复用 PLAY 的样式，以同样的黑色扩张转场返回详情。视频播放期间暂停 BGM，返回后恢复原有音乐开关状态。

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

GitHub 仓库不保存成品媒体二进制。`fetch:pages-media` 会从当前公开 FLOWFRAME 站点下载同一批海报、完整视频、预览短片和音频，并按 `scripts/pages-assets.sha256` 校验。GitHub Pages 工作流会自动执行这一步；已有完整 `public/media/` 的本地工作区会直接通过校验，不重复下载。

如果当前 shell 找不到 Node，可把 Codex 工作区 Node 加入本次命令的 PATH：

```bash
PATH=/Users/ruo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dev
```

## 构建与自动检查

```bash
pnpm build
pnpm verify:media
pnpm verify:playback
pnpm verify:ui
```

`verify:ui` 会检查主页画框吸附、网络三维形态切换、全局控制台、IndexedDB 媒体持久化、五作品详情、多片段背景循环、默认声音解锁、连续滚动、PLAY 墨滴、INFO 后台继续播放、Escape、hash、刷新恢复、WebGL 回退、reduced-motion、Studio、三片段 Lab、电脑端提示和主要桌面视口。可用 `VERIFY_SCOPE=home|control|detail|studio|transition|guard` 单独运行一组。

`verify:playback` 在 Node 中检查完整视频与背景短片的分离、旧配置迁移、播放器状态和控件、转场被导航中断后的清理，以及大视频的跨块读取。它不代替真实浏览器的视觉检查。

Sites 构建会把超过 24 MiB 的 MP4 仅在 `dist/client` 中拆为 16 MiB 数据块，并由 Worker 在原 MP4 地址流式响应 Range 请求。`public/media` 和源片不受影响。GitHub Pages 构建保留完整 MP4。更新公开媒体时，必须先发布 Sites 素材来源，再触发 GitHub Pages，以确保清单校验通过。

## 素材

- 当前官方动漫海报、Bilibili 派生测试片段和 BGM 均为 `placeholder`；旧 AI 画面只保留为旧配置回退。
- 页面必须持续显示 `PLACEHOLDER MEDIA`，直到素材被明确升级为 `final`。
- 每部作品的 `clips` 只用于背景预览循环；`videoSrc` 只用于 PLAY 完整视频，不从背景片段回退。
- 背景媒体选择顺序为 `clips > posterSrc > coverImage > fallback`。完整视频缺失时显示提示并保留 BACK。
- v6 配置仅迁移与旧默认片段地址完全一致的 `videoSrc`，不替换自定义上传地址。

不要修改或提交 `.claude/` 与 `XXQ本地资料/`。未经用户明确要求，不提交、不推送、不发布。
