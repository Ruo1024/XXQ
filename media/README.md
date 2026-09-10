# FLOWFRAME 媒体源文件

`media/source/` 只保存可追溯的源文件，不由浏览器直接加载。页面使用的压缩版本位于 `public/media/`。

GitHub 仓库不直接保存这些成品二进制。新检出可运行 `pnpm fetch:pages-media`，按 `scripts/pages-assets.sha256` 从公开 FLOWFRAME 站点恢复并校验；GitHub Pages 工作流会自动执行。

## 用户指定源文件

- `source/user-supplied/cigarette-and-her-original.mp4`：作品 01 的原始 4K 视频。
- `source/user-supplied/cigarette-and-her-home-poster.webp`：作品 01 的原始竖版图片，只保留用于来源追溯。
- `source/downloaded/eva/source.mp4`：作品 02 的 EVA 4K H.264 源视频。
- `source/downloaded/kaguya/source.mp4`：作品 03 的《超时空辉夜姬》4K H.264 源视频。
- `source/downloaded/liz-and-blue-bird/source.mp4`：作品 04 的《利兹与青鸟》4K H.264 源视频。
- `source/downloaded/ave-mujica/source.mp4`：作品 05 的 Ave Mujica 4K H.264 源视频。

每个下载目录同时保留 `source.info.json` 和站点缩略图，用于来源追溯。站点缩略图不用于页面封面。

## 官方封面源文件

`source/reference-covers/` 保存《ヤニねこ》、EVA、《超时空辉夜姬》、《利兹与青鸟》和 Ave Mujica 的官方主视觉候选。页面封面由这些官方源生成，不使用 Bilibili 视频封面或截图。完整来源见 `output/qa/cover-source-candidates.md`。

## 浏览器素材

- `public/media/works/cigarette-and-her/home-poster.webp`
- `public/media/works/{cigarette-and-her,eva,kaguya,liz-and-blue-bird,ave-mujica}/`
- `public/media/audio/{cigarette-and-her,eva,kaguya,liz-and-blue-bird,ave-mujica}-bgm.m4a`

各作品目录包含主页封面、详情封面和三个无声测试片段。EVA 按用户要求保留完整 16:9 画面及 Bilibili/上传者水印；其他主题按人工检查结果去除稳定的上下空白和字幕区。

加工参数、哈希、官方来源和素材状态以根目录 `ASSET_REPORT.md` 及 `output/qa/processed-media/*/processing-report.json` 为准。未经许可核验，以上文件全部是 `placeholder`。
