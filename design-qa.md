# FLOWFRAME 第三视觉检查点

检查日期：2026-08-27

## 检查范围和方法

- 主页继续以 `docs/references/home-option-1.png` 为视觉方向，视口 1586×992。
- 详情的动态机制以 TAO TAJIMA《Waxing Moon》官网运行行为、公开加载脚本和 WebGL 结构为研究依据。
- `docs/references/tao-detail-reference.png` 只核对全屏影像、左中文案、右侧 PLAY 和底部 Prev/Next 的静态位置关系。
- 静态截图不用于推断滚轮物理、Shader 进度、波浪或纹理生命周期。
- 额外检查 1280×720、1440×900、1920×1080，以及 1100×800 的电脑端提示。
- 所有未完成公开许可核验的媒体继续显示 `PLACEHOLDER MEDIA`。

## 最新证据

| 检查项 | 文件 |
| --- | --- |
| 主页参考左 / 实现右 | `output/qa/home-comparison-source-left-implementation-right.png` |
| 主页实现 | `output/qa/home-implementation-1586x992.png` |
| 主页网络形态切换中段 | `output/qa/home-network-morph-1586x992.png` |
| 可读滚动 MOTION 控制台（1280×720） | `output/qa/control-home-1280x720.png` |
| 缩放笔记本控制台（1512×982） | `output/qa/control-home-1512x982.png` |
| 2K 控制台（2560×1440） | `output/qa/control-home-2560x1440.png` |
| 可读滚动 MEDIA 控制台 | `output/qa/control-media-1280x720.png` |
| 详情页保留控制台 | `output/qa/control-detail-1280x720.png` |
| 详情静态构图参考左 / 实现右 | `output/qa/detail-layout-comparison-source-left-implementation-right.png` |
| 详情稳定态 1440×900 | `output/qa/work-detail-implementation-1440x900.png` |
| 连续滚动中间态 1440×900 | `output/qa/work-detail-scroll-partial-1440x900.png` |
| 连续滚动中间态 1280×720 | `output/qa/work-detail-scroll-partial-1280x720.png` |
| 连续滚动中间态 1920×1080 | `output/qa/work-detail-scroll-partial-1920x1080.png` |
| INFO | `output/qa/work-detail-info-1440x900.png` |
| PLAY | `output/qa/work-detail-player-1440x900.png` |
| PLAY 墨滴扩散 | `output/qa/work-detail-play-ink-1440x900.png` |
| WebGL 丢失后的静态回退 | `output/qa/work-detail-webgl-fallback-1440x900.png` |
| reduced-motion | `output/qa/work-detail-reduced-motion-1440x900.png` |
| Studio | `output/qa/studio-implementation-1586x992.png` |
| 电脑端提示 | `output/qa/desktop-guard-1100x800.png` |
| EVA 三片段检查 | `output/qa/processed-media/eva/contact-sheet.png` |
| 超时空辉夜姬三片段检查 | `output/qa/processed-media/kaguya/contact-sheet.png` |
| 利兹与青鸟三片段检查 | `output/qa/processed-media/liz-and-blue-bird/three-segment-contact-sheet.png` |
| Ave Mujica 三片段检查 | `output/qa/processed-media/ave-mujica/three-segment-contact-sheet.png` |

## 详情动态结论

- 详情现在只有一个全屏 WebGL Canvas，不再使用两个 DOM 媒体层的固定 `clip-path` timeline。
- Canvas 内只保留 current 和 next 两张活动纹理。每个视频纹理复用同一个 `<video>` 元素，并在当前主题的 3 个精选片段之间依次循环；换片不会增加纹理或 DOM 视频。
- 滚轮输入逐帧改变连续 `position`、`velocity` 和 Shader `progress`；小幅滚动只产生部分过渡，hash 不提前变化。
- 输入停止后速度衰减并吸附到唯一作品；半程反向会降低进度或返回原作品，不创建第二个动画控制器。
- Shader 使用物理像素坐标计算纵向错峰，过渡中段加入受速度约束的 UV 波浪，并使用镜像 UV 防止黑边。
- 作品首尾循环保持方向连续；从第一项向上回绕时，媒体准备期间的后续滚轮增量会缓存并合并回同一控制器，不会丢失。
- 外部 hash 在任何中间态都直接组成 current/target 媒体对，不逐项经过中间作品；旧异步纹理请求由 token 废弃。
- 文案在主导进度跨过中点后切换；滚轮导航只在最终吸附时写入 hash。

## 界面与媒体结论

- 1280×720 时 PLAY 为 150px；1920×1080 时 PLAY 为 164px。两个视口均无横向或纵向溢出。
- INFO 为暖白底黑字。INFO 和 PLAY 互斥；INFO 打开后只冻结作品切换，背景短片、三片段循环和 BGM 继续运行。
- PLAY 打开当前作品的真实本地媒体；可见浏览器中 `readyState=4`，`currentTime` 从 1.164 秒增长到 1.688 秒，关闭后视频暂停并清理。
- 背景视频静音循环，独立于 PLAY；作品 01–05 各有独立 BGM。SOUND 默认显示开启，浏览器首次用户操作后播放；用户手动关闭后保持关闭。BGM 跟随稳定作品切换。
- PLAY 使用与背景相同的当前主题 3 片段列表。当前片段结束后自动接续下一段，最后一段回到第一段。
- WebGL 上下文丢失时显示可读静态媒体、标题和 PLAY；恢复后重新上传纹理并继续使用 WebGL。
- reduced-motion 关闭长惯性、逐行延迟和波浪，但保留作品顺序、hash、INFO 和 PLAY。

## 路由和真实交互结论

- 五个默认作品全部通过 hash 直达、真实滚轮整轮循环、Prev 回绕、快速连续输入限速、半程反向和最终吸附。
- 通过从主页进入详情、浏览器前进/后退、刷新恢复、无效 ID、坏编码和外部 hash 中途接管。
- 可见浏览器在 1280×720 从主页进入作品 01；部分滚动时进度为 0.047，hash 保持作品 01；中段进度达到 0.366，并可见逐行波浪形变。
- 可见浏览器吸附到作品 02 后，INFO、PLAY 和关闭顺序正确。
- 可见浏览器在 1920×1080 直达作品 04；当前纹理为 `glass`，下一纹理为 `signal`，页面溢出为 0，控制台错误为 0。

## 第一检查点回归

- 主页仍为真实 Three.js 三维空间，五张默认海报、雪面、光照、投影、鼠标反馈和短路径镜头保留。
- 主页默认海报数改为 5。旧 AI“轨道切片”卡已删除；Studio 仍允许用户增加第 6 个自定义作品。
- 主页保留 12 个三维节点和 21 条动态连线。五个默认作品分别使用云团、弧线、螺旋、扇形和环形拓扑；封面切换时节点沿 Z 轴曲线穿梭，网络整体旋转，旧新连线交叉淡变并重新连接活动海报。
- 活动画框、相邻画框和远端画框按 100% / 45% / 18% 响应鼠标，增加 X/Y 吸附、倾斜和 Z 轴前移；鼠标离开后通过弹簧阻尼回到轨道。
- 主海报右下角编号、英文名和署名已放大并加入线段与圆形节点，使信息成为节点系统的一部分。
- 三片段 Lab 仍只保留 current/next 两个视频层，三个裁切片段均可读并显示 `LAB / PLACEHOLDER MEDIA`。
- 全局控制台在主页、详情和实验页之间保持挂载。控制台按桌面视口使用约 440–580px 宽度，参数文字约 11–12px；MOTION 的 36 个参数保留双列分组并允许内容区滚动，MEDIA 一次展开一个作品和一个片段。封面、短片和音乐的 IndexedDB 保存、刷新恢复、删除清理和缺失回退通过。
- Studio 的保存、未保存刷新、JSON 导入/导出、添加、删除、排序、作品数量、恢复默认和 36 个动效参数纳入本轮回归。
- 1100×800 显示电脑端提示；项目没有扩展手机页面。

## 本轮素材原型结论

- 作品 01 页面名称已改为“尼古喵喵 / YANI NEKO”；“香烟与她”只保留为 MAD 来源标题。
- 作品 01–05 的主页封面均改用对应官方作品站或官方发行页的主视觉。没有使用 Bilibili 缩略图或视频截图作为封面。
- EVA、超时空辉夜姬、利兹与青鸟、Ave Mujica 各接入 3 个无声 H.264 片段和 1 条独立 AAC BGM。
- EVA 按用户确认保留完整 16:9 构图、Bilibili/上传者水印和画面内部字幕，不再为去水印裁坏画面。
- 另外三个主题已按多时间点检查结果去除稳定的上下留白、字幕区和平台标记。Ave Mujica 的自动裁切候选因仍含字幕被人工否决。
- 所有动漫海报、视频和音频仍是 `placeholder`，页面持续显示 `PLACEHOLDER MEDIA`。

## 问题分级

- P0：无。
- P1：无。
- P2：无。
- P3：主 JS chunk 约 743kB，后续可把控制台、首页和详情 Three.js 场景按路由拆包；这不影响当前运行。
- P3：作品 01–05 已使用对应动漫测试媒体，但许可仍未核验，不能用于公开发布。不同 MAD 的色彩、字幕和水印风格不统一；作为原型可用，正式版本仍需授权素材和统一调色。
- P3：旧 AI 海报和测试视频仍保留在磁盘以兼容旧 Studio 配置，但不再进入默认页面。

## 运行结果

- `pnpm build`：通过。只有主 JS chunk 超过 500kB 的非阻塞警告。
- `pnpm verify:media`：通过。覆盖四个 4K H.264 源文件、五张主页封面、12 个新增短片、四条新增 BGM 和详情封面。
- `pnpm verify:ui`：通过。覆盖画框吸附、网络三维换形、紧凑控制台、IndexedDB 媒体 CRUD、连续滚动物理、INFO 后台播放、PLAY 墨滴、WebGL、路由、覆盖层、多视口、Lab、Studio 和电脑端提示。
- 真实 Chromium 自动验证：通过。作品 01–05 的 PLAY 实际播放对应短片；主页作品切换会同步 BGM；1280×720 和 1920×1080 均完成真实操作；错误日志为 0。
- 自动测试浏览器均已准确回收。最终视觉确认使用单独记录 PID 的本地 Vite 服务；用户确认后再停止该准确进程。

final result: passed
