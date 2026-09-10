# FLOWFRAME 素材报告

更新日期：2026-08-24

本项目是本地原型。素材状态只使用 `final`、`placeholder`、`missing`。当前动漫海报、Bilibili 视频画面和音频未完成公开使用许可核验，因此全部是 `placeholder`，页面继续显示 `PLACEHOLDER MEDIA`。

## 1. 当前作品映射

| 作品 | 路由 ID | 页面名称 | 页面媒体 | 状态 |
| --- | --- | --- | --- | --- |
| 01 | `afterglow` | 尼古喵喵 / YANI NEKO | 《ヤニねこ》动画官网主视觉 + 用户指定《香烟与她》MAD | `placeholder` |
| 02 | `tide` | EVA | EVA 官方海报 + BV1254y187SE | `placeholder` |
| 03 | `ember` | 超时空辉夜姬 | 官方主视觉 + BV1XtFfzMEBm | `placeholder` |
| 04 | `glass` | 利兹与青鸟 | 官方主视觉 + BV1JjPkzjEna | `placeholder` |
| 05 | `signal` | Ave Mujica | 官方主视觉 + BV1PWruYCEVn | `placeholder` |

“香烟与她 / CIGARETTE & HER”只记录作品 01 的 MAD 来源标题，不再作为页面动漫名称。

## 2. 作品 01：尼古喵喵

用户提供的源文件位于 `media/source/user-supplied/`：

- `cigarette-and-her-original.mp4`：3840×2160、30fps、H.264 + AAC、172.605 秒；SHA-256 `959533ac88b9f46b8a73837b980251d4df9af12a49e1526df0ee98682cb6f4aa`。
- `cigarette-and-her-home-poster.webp`：600×840；保留用于来源追溯，不再作为页面封面。

主页改用 [TV 动画《ヤニねこ》官网](https://yanineko-anime.com/)原生第一弹主视觉，不使用 Bilibili 缩略图，也不是对低清图片去水印：

- 官方源：`media/source/reference-covers/cigarette-and-her/yani-neko-official-key-visual-01-portrait.webp`，750×1057。
- 页面副本：`public/media/works/cigarette-and-her/home-poster.webp`，1000×1600，SHA-256 `c95f562729aaf50ca4395a27145feb736e73c1cc91d601b08ca75c9d1e2f215a`。

三个无声短片来自原片 28.4–34.4、68.3–74.3、158.9–165.9 秒。它们裁掉上下黑边、字幕区和右上标记，输出 1280×720。原 AAC 音轨独立封装为 `public/media/audio/cigarette-and-her-bgm.m4a`。

## 3. 作品 02–05：源视频

源文件保存在 `media/source/downloaded/<主题>/source.mp4`，同时保留 `source.info.json`。下载时使用平台列出的最高可用 H.264 视频流并合并最佳 AAC 音轨；页面不使用站点缩略图作为封面。

| 主题 / 来源 | 原片规格 | SHA-256 |
| --- | --- | --- |
| [EVA / BV1254y187SE](https://www.bilibili.com/video/BV1254y187SE/) | 3840×2160、24fps、H.264 High + AAC、282.069 秒 | `d8b943f6d188a259cb30a36570a669ac22a15c31d4711ebf13781b2cac8b1e67` |
| [超时空辉夜姬 / BV1XtFfzMEBm](https://www.bilibili.com/video/BV1XtFfzMEBm/) | 3840×2160、60fps、H.264 High + AAC、248.149 秒 | `f7f242e3ebec28acc45033d7e34f96bb9d0234d73cbecc55a238dd671e6e5bb5` |
| [利兹与青鸟 / BV1JjPkzjEna](https://www.bilibili.com/video/BV1JjPkzjEna) | 3840×2160、60fps、H.264 High + AAC、248.490 秒 | `337e89ce9d10b698f949aaf4e1737b70b0ed56b913620a0112d3e42e80c0afc5` |
| [Ave Mujica / BV1PWruYCEVn](https://www.bilibili.com/video/BV1PWruYCEVn) | 3840×2160、60fps、H.264 High + AAC、160.334 秒 | `1a2c05151fed44ccef50d3bd413f51d3ad3c25d6647ae1b6a4cd32bf4979c587` |

## 4. 官方封面

页面封面都来自对应作品的官方站或官方发行页面。没有使用 Bilibili 视频封面、视频截图、UP 主缩略图或二创图。完整来源、直接资源、尺寸和哈希见 `output/qa/cover-source-candidates.md`。

| 主题 | 官方来源 | 页面副本 |
| --- | --- | --- |
| 尼古喵喵 | [动画官网](https://yanineko-anime.com/) | `cigarette-and-her/home-poster.webp`，1000×1600 |
| EVA | [EVA 官方上映海报发布页](https://www.evangelion.jp/news/shineva-4/) | `eva/home-poster.webp`，1000×1600 |
| 超时空辉夜姬 | [官方作品首页](https://www.cho-kaguyahime.com/) | `kaguya/home-poster.webp`，1000×1600 |
| 利兹与青鸟 | [官方作品首页](https://liz-bluebird.com/) | `liz-and-blue-bird/home-poster.webp`，1000×1600 |
| Ave Mujica | [官方动画首页](https://anime.bang-dream.com/avemujica/) | `ave-mujica/home-poster.webp`，1000×1600 |

EVA 官方海报完整置入安全区域，并用同一海报的柔化延展填充背景，避免截断底部标题和两侧人物。

## 5. 网页短片与 BGM

短片统一为 H.264 High、`yuv420p`、faststart、无音轨。BGM 使用原 AAC 音轨独立封装。短片和 BGM 分离，避免重复播放声音。

每个默认作品的三个短片组成详情背景循环播放列表，最后一段结束后回到第一段。PLAY 不再复用或拼接这些片段；它只加载当前作品独立的完整视频。完整视频缺失时，播放器显示缺失状态，不回退到片段。

| 主题 | 画面处理 | 三个片段范围 | 输出 | BGM |
| --- | --- | --- | --- | --- |
| EVA | **保留完整 16:9 和右上 Bilibili/上传者水印**；不为去水印裁坏画面 | 83–89、159–165、190–196 秒 | 1920×1080、24fps | 从 5.417 秒开始 |
| 超时空辉夜姬 | `crop=3840:1528:0:316`，去上下留白与留白区标记 | 60–66、100–106、180–186 秒 | 1920×764、60fps | 从 1.617 秒开始 |
| 利兹与青鸟 | `crop=3840:1528:0:316`，去上下留白与留白区标记 | 181–187、23–29、121–127 秒 | 1920×764、60fps | 原片开头即有效，不裁音频 |
| Ave Mujica | 人工否决仍含字幕的自动候选；使用 `crop=3840:1600:0:280` | 4–10、28–34、100–106 秒 | 1920×800、60fps | 从 2.750 秒开始 |

EVA 是用户确认的例外：保留水印。第二、第三片段中属于完整构图内部的原片字幕也随全画面保留。其他主题只在不损伤主体的情况下移除空白区、字幕区和平台标记。

精确文件大小、SHA-256、海报参数、音频参数和联系表见：

- `output/qa/processed-media/eva/processing-report.json`
- `output/qa/processed-media/kaguya/processing-report.json`
- `output/qa/processed-media/liz-and-blue-bird/processing-report.json`
- `output/qa/processed-media/ave-mujica/processing-report.json`

`pnpm verify:media` 检查源文件 H.264/4K、海报尺寸、短片编码/尺寸/时长/无音轨/faststart，以及 BGM 仅含 AAC 音轨。

## 6. 保留素材和发布边界

- 全局控制台可把用户选择的本地图片、视频和音频存入浏览器 IndexedDB `flowframe-media-v1/assets`。项目配置只保存 `idb://flowframe/<id>` 引用；JSON 导出不包含二进制，换浏览器后缺失引用会回退为 `missing`。
- 控制台新增的本地素材默认标记为 `placeholder`。显式保存时才清理不再引用的本地 Blob，未保存草稿可以撤销。

- “轨道切片 / ORBITAL CUTS”AI 默认作品已经从主页、详情和默认 Studio 数据中删除。旧文件只保留在磁盘，避免破坏用户可能保存的旧配置，不再作为默认页面内容。
- 作品 02–05 的旧 AI 海报同样只保留为旧配置回退，不再作为默认画面。
- 用户授权这些媒体用于本地原型，不等于获得公开发布许可。
- 正式发布前必须确认视频、音乐、角色画面、海报、字体和剪辑成品的使用范围。
- 许可未核验前不能改成 `final`，不能去掉 `PLACEHOLDER MEDIA`，不能发布或部署。
