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

各作品目录包含主页封面、详情封面、一个带原音轨的完整 1080p 播放版，以及三个无声测试片段。详情背景只循环使用三个片段；用户点击 PLAY 后才加载完整播放版。EVA 按用户要求保留完整 16:9 画面及 Bilibili/上传者水印；其他主题的背景片段按人工检查结果去除稳定的上下空白和字幕区。

运行 `pnpm prepare:publish-media` 可从 `media/source/` 中的原视频和发布母版重新生成发布文件。完整视频始终从 4K 原片压缩；封面和背景片段从 `media/source/publish-posters/`、`media/source/publish-segments/` 的母版生成，不把上次发布输出再次当作输入。统一使用 H.264 High、slow、animation 调优、`yuv420p` 和 faststart。完整视频分别使用 CRF32、30、38、43、40，并保留双声道 AAC 音轨；15 个背景片段使用独立的 `FLOWFRAME_PREVIEW_CRF` 默认28，保持无声，最低实测样本 SSIM 约0.97。

控制台或 Studio 中选择的 IndexedDB 本地文件只用于浏览器预览与配置。浏览器不会自动执行 ffmpeg。把这些文件正式发布前，仍需放入可追溯的源目录并运行发布压缩与校验命令。

加工参数、哈希、官方来源和素材状态以根目录 `ASSET_REPORT.md` 及 `output/qa/processed-media/*/processing-report.json` 为准。未经许可核验，以上文件全部是 `placeholder`。
