# FLOWFRAME TAO 式作品页复刻开发书

本文档用于指导 `#/works/:id` 详情页的下一轮重构。目标不是复制参考站源码、素材、品牌或文案，而是复刻其作品页的构成逻辑、视觉秩序和动效节奏，并把它转译为动漫混剪展示页。

参考页：[Gurun Gurun - Itsuka no Hoshi | TAO TAJIMA](https://taotajima.jp/works/itsuka-no-hoshi/)

本地调研截图：

- `/Users/ruo/Desktop/小学期作业/output/playwright/tao-reference-desktop-ready.png`
- `/Users/ruo/Desktop/小学期作业/output/playwright/tao-reference-mobile-ready.png`
- `/Users/ruo/Desktop/小学期作业/output/playwright/tao-reference-play.png`

## 1. 复刻目标

当前详情页仍然偏“暗黑 HUD 展示页”，和参考页的真实气质存在明显偏差。新的目标应调整为：

- 底层影像是页面主体，UI 只是薄覆盖。
- 首屏不做章节滚动，不堆卡片，不做复杂信息解释。
- 文案层保持固定、清晰、克制，依赖影像和镜头运动制造沉浸感。
- PLAY 是最明显的交互中心，信息按钮和前后导航退到次级层。
- 作品切换像影片镜头切换，而不是网页组件切换。
- 移动端优先展示标题、information、PLAY 和底部编号导航，隐藏长描述。

目标相似度约 80%：

- 70% 来自页面构成、信息密度、按钮/导航位置、媒体层比例和状态切换节奏。
- 10% 来自动效节奏和缓动曲线。
- 10% 来自字体、字距、线条、圆形 PLAY 和响应式布局。
- 10% 保留 FLOWFRAME 自身的动漫混剪气质，避免照搬。

## 2. 参考站构成拆解

### 2.1 页面骨架

参考站公开 DOM 结构可归纳为：

- `canvas#three`：固定全屏主视觉层，承载作品影像、列表、切换和黑场遮罩。
- `#slideWorks`：作品文字层，覆盖在画面中部。
- `#slideNavi`：底部前后作品导航。
- `#list`：作品总列表，点击菜单后进入。
- `#slideInfo`：信息层，白底黑字，从右侧进入。
- `#slideVimeo`：播放层，黑底全屏，嵌入视频。

对 FLOWFRAME 的转译：

- 首页 3D 画廊可以继续存在，但详情页必须从“章节页面”改成“单个影片场景”。
- 详情页 DOM 只保留媒体层、文字层、播放层、信息层、导航层。
- 不要把 `Synopsis / Frame Notes / Mix Direction / Next Mix` 作为默认首屏内容；这些只进入 `INFO` 面板。

### 2.2 桌面首屏布局

在 1440 x 920 截图中，参考站稳定状态的关键参数：

- 主视觉：全屏铺满，画面被轻微压暗但仍保持影像原色。
- 顶部左侧：站点名和 About，字号约 14px，强字距。
- 顶部右侧：社交链接，字号约 14px。
- 左侧中部菜单：三条线，位于视口左侧约 40px，垂直居中。
- 文案容器：宽约 900px，居中；实际内容从左侧约 270px 起排。
- 编号和类型：`#007 / client work`，字号约 22px。
- 标题：约 45px，行高约 1.25，衬线字体，字距轻微拉开。
- 描述：约 15px，行高约 1.9，最多 3 到 4 行。
- PLAY：160 x 160 圆形，放在文案右侧，半透明浅色底，黑字和箭头。
- 底部导航：左右两端分别是上一部/下一部，居中靠底，带细箭头线。

FLOWFRAME 桌面参数建议：

- `.work-copy`：`width: min(900px, calc(100vw - 160px))`，左侧内容宽 720px。
- `.work-copy` 位置：`left: 50%; top: 50%; transform: translate(-50%, -48%)`，内部按左对齐。
- 标题：42px 到 48px，行高 1.18 到 1.25。
- 描述：14px 到 16px，行高 1.8，限制 2 到 4 行。
- `.work-play`：桌面 150px 到 164px，圆形，放在 copy 容器右侧。
- `.work-navi`：底部 48px 到 56px，宽度跟 copy 容器一致。

### 2.3 移动端布局

在 390 x 844 截图中，参考站稳定状态的关键参数：

- 菜单在左上角，About 在右上角。
- 文案从顶部约 86px 开始，不再垂直居中。
- 标题大且换行明显，约 29px，宽度约 343px。
- 描述和分享隐藏。
- `information` 显示在标题下方，带下划线。
- PLAY 是 100px 左右圆形，位于标题下方左侧。
- 底部只显示前后编号和长线箭头，不显示长标题。

FLOWFRAME 移动端参数建议：

- `.work-copy`：`top: 86px; left: 24px; right: 24px; transform: none`。
- 标题：30px 到 36px，允许两到三行。
- 描述默认隐藏，只保留一行短标签或完全隐藏。
- `.work-info-button`：显示为文字下划线，不做卡片按钮。
- `.work-play`：96px 到 112px，放在标题/信息下方。
- `.work-navi`：固定底部 24px，左右只显示 `#002` 这种编号，中间细斜线或计数。

## 3. 视觉系统重定向

### 3.1 背景影像

参考站的舒服感来自“真实影像作为底色”，不是来自复杂 HUD。

FLOWFRAME 应采用：

- 有视频时：`videoSrc` 全屏播放，`object-fit: cover`。
- 无视频时：使用 `posterSrc` 或 `coverImage` 生成全屏视觉，不要只用抽象渐变。
- 动漫素材未填入前，可用本地生成式海报占位，但必须模拟“影片帧”而不是科技背景。
- 每个作品允许轻微色彩罩层，但不要把所有作品统一压成深蓝/黑紫。

影像层样式建议：

```css
.work-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-visual-stage::after {
  background:
    linear-gradient(90deg, rgba(0,0,0,.18), rgba(0,0,0,.02) 48%, rgba(0,0,0,.16)),
    linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06) 45%, rgba(0,0,0,.24));
}
```

重点：

- 暗化幅度保持在 18% 到 35%，不能长期压到 45% 以上。
- 颗粒和扫描线只能作为极轻纹理，不应成为视觉主题。
- 若封面是动漫人物，文本区域要避开面部核心，默认放左中或左上。

### 3.2 字体与文字质感

参考站使用高字距、衬线、强节制字号，形成“导演作品集”质感。

FLOWFRAME 建议：

- 标题使用衬线或高对比字体栈：`Georgia`, `Times New Roman`, `Noto Serif SC`, serif。
- 英文小标签用 0.12em 到 0.22em 字距。
- 中文说明用较低字距，避免中文被过度拉散。
- 标题不做逐字动画，使用整块或整行滑入。
- 不使用粗重无衬线大字作为主视觉标题。

### 3.3 颜色

参考页在截图中是蓝灰天空影像 + 白字 + 浅色 PLAY 圆。

FLOWFRAME 应从当前偏暗科幻改为：

- 背景由作品素材决定。
- 全局 UI 主色：暖白 `#f6f1e8`。
- PLAY 圆：`rgba(246, 241, 232, .82)`。
- PLAY 字和箭头：`#050505`。
- 信息面板：白底或暖白底，黑字。
- 辅助线：1px 白线，透明度 0.75 左右。

不要使用：

- 大面积紫蓝渐变。
- 强 Bloom 光晕。
- 多色 HUD。
- 大块黑色信息卡片。

## 4. 交互状态机

参考站状态可抽象为：

```text
list
  -> zoomIn
  -> slide
  -> slideText
  -> slideNavi
  -> slideInfo
  -> slideVimeo
```

FLOWFRAME 应实现为：

```text
gallery
  -> focusCard
  -> detail:intro
  -> detail:idle
  -> detail:switching
  -> detail:info
  -> detail:playing
```

状态约束：

- `detail:intro`：0.9s 到 1.2s，禁止输入。
- `detail:idle`：允许 Prev/Next、PLAY、INFO、Escape。
- `detail:switching`：0.75s 到 1s，禁止重复切换。
- `detail:info`：暂停作品切换，Escape 关闭信息层。
- `detail:playing`：隐藏文案和导航，Escape 先关闭播放层。

必须避免：

- 滚轮快速触发导致多条 timeline 并发。
- 切换中 hash 更新和 DOM 更新互相抢状态。
- PLAY 层打开时背景详情页继续响应滚轮。
- Info 层和 Player 层同时打开。

## 5. 动效拆解与实现规格

### 5.1 进入详情

参考感受：

- 从列表/作品进入后，媒体先稳定铺满。
- 文案不是同时出现，而是编号、标题、说明、按钮、导航错峰出现。
- 动画短，但有明确缓动。

FLOWFRAME 规格：

1. 卡片中心点击后，当前封面以 0.9s 扩展到全屏。
2. 媒体层从 `scale(1.05)` 到 `scale(1)`，opacity 从 0 到 1。
3. 黑场遮罩从 0.45 到 0.08 后稳定为轻暗角。
4. 文案错峰：
   - 编号/类型：0.20s 后进入。
   - 标题：0.32s 后进入。
   - 描述：0.44s 后进入。
   - PLAY：0.54s 后进入。
   - 底部导航：0.66s 后进入。

缓动建议：

- 位置/缩放：`power3.out` 或自定义接近 `cubic-bezier(.19,1,.22,1)`。
- 退场：`power2.in` 或接近 `cubic-bezier(.755,.05,.855,.06)`。

### 5.2 作品切换

参考站切换不是组件滑页，而是画面纹理和文本同步换场。

FLOWFRAME 规格：

- 保留双媒体层：current / next。
- 切换时 next 预先渲染，`scale(1.035)`，opacity 0。
- current 从 `scale(1)` 到 `scale(0.985)`，opacity 降到 0。
- next 从 `scale(1.035)` 到 `scale(1)`，opacity 升到 1。
- 叠加一条斜向遮罩或黑场扫过，持续 0.35s 到 0.5s。
- 文案整块先退 12px 到 20px 并淡出，再用新内容进入。
- 总时长控制在 0.75s 到 0.95s。

切换方向：

- Next：遮罩从右下向左上轻扫，文本从右侧微入。
- Prev：遮罩从左下向右上轻扫，文本从左侧微入。
- 大跨度 hash 直达：不走多次 next，而是直接交叉到目标作品。

### 5.3 PLAY 层

参考站 PLAY 后进入全屏黑色视频层。

FLOWFRAME 规格：

- 点击 PLAY 后：
  - 详情文案、导航、顶部 HUD 在 0.2s 内退场。
  - 黑色播放层 0.4s 内覆盖全屏。
  - 有视频时播放视频；无视频时显示 poster + loading/placeholder。
- 播放层只保留：
  - 右上关闭按钮。
  - 极小状态文字，例如 `MIX 001 / PLAYING`。
- Escape 或关闭按钮返回 `detail:idle`。

### 5.4 INFO 层

参考站信息层是白底黑字，从右侧滑入，不是暗色弹窗。

FLOWFRAME 规格：

- 桌面：右侧或全屏白底 92% 到 96% 不透明，内容从右向左进入。
- 移动端：全屏白底，从下方进入。
- 内容包括：
  - 编号、类型、标题。
  - 长说明。
  - frame notes。
  - mix direction。
- INFO 层打开时，底层影像可轻微暂停或继续低速播放，但不能抢输入。

## 6. 当前项目重构任务书

### 6.1 HTML 改造

目标结构：

```html
<section id="detailPage" class="detail-page">
  <div id="workVisualStage" class="work-visual-stage">
    <div id="workMediaCurrent" class="work-media-layer is-active"></div>
    <div id="workMediaNext" class="work-media-layer"></div>
    <div id="workVisualMask" class="work-visual-mask"></div>
  </div>

  <header class="work-hud">
    <button id="detailBack">FLOWFRAME</button>
    <button id="detailSound">Sound</button>
  </header>

  <div id="workCopy" class="work-copy">
    <div class="work-copy-header">
      <span id="detailKicker">#001</span>
      <span id="detailCategory">AMV / anime mix</span>
    </div>
    <h1 id="detailTitle"></h1>
    <p id="detailLogline"></p>
    <button id="detailInfoToggle">information</button>
    <button id="detailPlay">PLAY</button>
  </div>

  <nav class="work-navi">
    <button id="detailPrev"></button>
    <span id="detailCount"></span>
    <button id="detailNext"></button>
  </nav>

  <aside id="workInfo"></aside>
  <div id="workPlayer"></div>
</section>
```

注意：

- `detailInfoToggle` 在桌面可低调，移动端必须明显。
- `detailPlay` 需要在 DOM 中靠近标题，但视觉上可通过 grid 放到右侧。
- 不要在主详情页保留多段 section。

### 6.2 CSS 改造优先级

第一优先级：

- 重做媒体层亮度和颜色，不再默认暗黑。
- 还原参考页的中部文案容器和圆形 PLAY 位置。
- 移动端改成顶部文案 + 大圆 PLAY + 底部编号。
- INFO 改白底黑字。

第二优先级：

- 字体栈和字距。
- 斜线分隔符。
- 底部箭头线。
- hover 下划线和箭头微动效。

第三优先级：

- 媒体粒子/颗粒。
- 细微 mask 扫场。
- 不同作品 transitionMood 的轻参数化。

### 6.3 JavaScript 改造优先级

第一优先级：

- 统一 `detailState`，不要只靠多个布尔值拼状态。
- 所有 detail timeline 由一个 `detailTimeline` 管理，开始新切换前必须 kill 旧 timeline。
- `transitionWorkDetail(nextIndex, direction)` 负责 hash、媒体、文案和 nav 同步。
- 输入锁在 timeline 完全结束后释放。

第二优先级：

- 媒体层预加载，避免切换白屏。
- PLAY 层单独控制 video 播放和暂停。
- Info 层打开时暂停切换输入。

第三优先级：

- 根据素材亮度自动给文案加轻微 text-shadow 或局部暗角。
- 根据 `transitionMood` 调整遮罩方向、grain 强度、切换时长。

## 7. 数据字段

`works` 数据应保留并标准化：

```js
{
  id: 'afterglow',
  number: '001',
  title: 'Afterglow Sequence',
  meta: 'AMV / Character Cut / 2026',
  coverImage: '/media/works/afterglow/cover.jpg',
  posterSrc: '/media/works/afterglow/poster.jpg',
  videoSrc: '/media/works/afterglow/mix.mp4',
  shortDescription: '两行以内的作品说明。',
  infoDescription: 'INFO 面板使用的完整说明。',
  frameNotes: [
    { timecode: '00:12', image: '/media/works/afterglow/frame-01.jpg', note: '关键帧说明。' }
  ],
  mixDirection: '节奏、色彩、音乐情绪说明。',
  accentColor: '#d9a86c',
  transitionMood: 'soft'
}
```

字段使用规则：

- 详情页主视觉优先级：`videoSrc` > `posterSrc` > `coverImage` > fallback。
- 首页卡片优先使用 `coverImage`。
- `shortDescription` 不超过 90 个中文字符或 180 个英文字符。
- `infoDescription` 可以更长，但不要进入首屏。
- `transitionMood` 只影响克制参数，不允许触发复杂特效堆叠。

## 8. 动漫混剪转译方式

参考站是城市短片作品页，FLOWFRAME 是动漫混剪，因此不能简单照搬“纪录片天空感”。应转译为：

- 底层是动漫封面、角色插画或混剪视频帧。
- UI 保持导演作品集式克制。
- PLAY 进入后才真正展示混剪视频，不在详情 idle 态过度打扰。
- 每个作品用一张最强视觉图建立气质，不用多张卡片堆叠。
- 若角色脸位于中心，文字默认靠左；若角色靠左，文字自动偏右或加局部遮罩。

作品气质映射：

- 热血/战斗：更短切换时长，遮罩线更锋利，保留少量速度拖影。
- 治愈/日常：更慢交叉淡化，色彩更亮，遮罩更软。
- 暗黑/悬疑：暗角略强，grain 略高，红色只作瞬间残影。
- 科幻/机甲：轻扫描线，冷色高光，但不做大面积 HUD。
- 恋爱/青春：浅色光晕、柔边遮罩、较高画面亮度。

## 9. 验收标准

桌面端必须通过：

- `#/works/:id` 首屏只有一个全屏作品场景，没有多段 section。
- 媒体层铺满视口，截图中非黑屏、非空白、非抽象纯渐变。
- 文案位置接近参考：左中主标题 + 右侧圆形 PLAY + 底部左右导航。
- PLAY 圆形按钮是主要交互焦点，尺寸接近 150px 到 164px。
- Prev/Next 连续切换 6 次无白屏、无错位、无控制台错误。
- 播放层打开后黑底全屏，文案和导航隐藏。
- INFO 是白底/暖白底黑字，不是暗色卡片弹窗。

移动端必须通过：

- 顶部保留菜单/返回和 About/Sound 类入口。
- 标题位于上半屏，描述隐藏或压缩。
- `information` 明显可点击。
- PLAY 圆在标题下方，约 96px 到 112px。
- 底部只显示前后编号或极短文字，不挤压画面。
- 文字不遮挡角色脸或主视觉核心。

自动化建议：

- `pnpm build`
- `pnpm verify:ui`
- 新增截图断言：
  - `.work-play` 宽高在期望区间。
  - `.work-copy` 的 x/y 在参考比例范围内。
  - `.work-info` 打开时背景色亮度高于 0.85。
  - `.work-player` 打开时 `.work-copy` 与 `.work-navi` 不可见。
  - 连续切换时 `.work-media-layer.is-active` 始终有内容。

## 10. 分阶段执行路线

### Phase 1: 视觉回正

- 将详情页从深色 HUD 改为影像主导。
- 重做 `.work-copy`、`.work-play`、`.work-navi` 的桌面和移动布局。
- 修改 fallback，让占位更像影片帧。
- INFO 改白底黑字。

完成标准：静态截图与参考页构图相似，能一眼看出同类作品页。

### Phase 2: 状态机与切换

- 统一 `detailState`。
- 重写 intro、switch、play、info 的 timeline。
- 增加输入锁和 hash 同步保护。
- 调整 Prev/Next 和滚轮切换时长。

完成标准：连续切换无错位，PLAY/INFO/Escape 逻辑稳定。

### Phase 3: 媒体体验

- 接入真实 `videoSrc` 或测试视频。
- 支持 idle 态静音背景播放或 poster 稳定展示。
- PLAY 层真正播放混剪视频。
- 根据作品素材调节局部暗角。

完成标准：未填素材有稳定占位，填素材后播放体验完整。

### Phase 4: 细节打磨

- 衬线字体、字距、斜线、底部箭头线。
- hover 动效和按钮微动效。
- 移动端防遮挡。
- Playwright 截图对比和人工复核。

完成标准：相似度达到 80% 左右，同时保留 FLOWFRAME 动漫混剪定位。

## 11. 反向清单

以下做法会降低相似度，应避免：

- 在详情页继续使用滚动章节。
- 加入大面积卡片、玻璃拟态面板或多层 HUD。
- 强行使用暗黑背景和荧光边框。
- 把所有作品都做成同一种抽象渐变占位。
- 让 PLAY 只是普通文字按钮。
- 让 INFO 成为黑色弹窗。
- 文案和导航一起乱飞或逐字乱跳。
- 切换作品时按序列逐张绕远路。
- 移动端保留桌面长说明导致标题和按钮挤压。

## 12. 下一轮代码修改建议

下一轮不应直接微调当前详情页，而应按以下顺序动手：

1. 先改 CSS：恢复参考站式明亮影像页构图。
2. 再改 fallback 媒体：让没有视频时也呈现影片帧质感。
3. 再改 JS 状态机：收敛 detail 布尔状态，统一锁输入。
4. 最后补 verifier：用位置、尺寸、可见性和截图亮度约束相似度。

这样能避免继续在错误风格上局部修补。
