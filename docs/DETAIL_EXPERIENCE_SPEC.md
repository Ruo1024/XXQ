# FLOWFRAME 作品详情技术规范

更新时间：2026-08-24

本文件是 `#/works/:id` 的长期开发契约。产品和视觉目标以 `docs/PRODUCT_AND_DESIGN_REQUIREMENTS.md` 为准。

## 1. 参考边界

详情页的动态机制以 TAO TAJIMA《Waxing Moon》作品页为研究参考：

- 页面：`https://taotajima.jp/works/waxing-moon/`
- 研究对象：连续滚轮输入、惯性和吸附、双媒体 WebGL 混合、纵向延迟与波浪形变、作品语义和界面同步。
- 实现依据优先级：用户最新要求 > 官网运行行为和公开加载代码的机制分析 > 本文件 > 静态截图 > 旧实现。
- 截图只核对构图、裁切和关键帧，不用于推断完整运动逻辑。
- 不复制 TAO 的品牌、文案、字体、图片、视频、Shader 源码或其他受保护素材。
- FLOWFRAME 使用原创等效算法、自己的作品数据和已标记的本地占位媒体。

这不是普通文档滚动。详情容器固定在一个桌面视口中，滚轮输入驱动 WebGL 媒体场景内部的连续位置。

## 2. 页面层级

详情页只包含：

1. 一个全屏 WebGL Canvas，内部只渲染 current 和 next 两张媒体纹理。
2. 轻暗角、轻颗粒和占位媒体状态层。
3. 顶部薄导航。
4. 左中文案、右侧 PLAY、底部 Prev/Next。
5. 暖白 INFO 覆盖层。
6. 全屏 PLAY 覆盖层。

不加入章节滚动、卡片列表、暗黑 HUD、常驻长文、无关粒子、Bloom 或复杂三维模型。

## 3. 共享状态契约

正式详情只使用以下页面状态：

```text
intro -> idle
idle <-> switching
idle -> info -> idle
idle -> playing -> idle
idle -> home
```

连续滚动控制器至少公开：

```text
detailState: intro | idle | switching | info | playing
position: number
velocity: number
settledIndex: number
semanticIndex: number
fromIndex: number
toIndex: number
progress: number        // 0..1
direction: -1 | 0 | 1
isSettled: boolean
transitionToken: number
```

定义：

- `position` 是可连续变化的无界浮点位置；使用安全取模映射到 6 个作品。
- `velocity` 来自归一化后的滚轮或触控板输入。
- `fromIndex` 与 `toIndex` 是当前送入 Shader 的两项作品。
- `progress` 是这两项之间的连续混合进度，不是固定时长 timeline 的播放比例。
- `semanticIndex` 在视觉进度越过中点后更新，用于标题、PLAY、INFO 和无障碍名称。
- `settledIndex` 只在吸附完成后更新。
- `transitionToken` 用于废弃过期的纹理加载和外部直达请求，禁止旧异步结果覆盖新状态。

`switching` 的新含义：

- 当位置离吸附点超过容差时进入 `switching`。
- `switching` 时仍接受滚轮输入，允许加速、减速和反向。
- Prev、Next 和方向键只改变同一个控制器的目标或速度，不创建第二条动画。
- 禁止多个 RAF 控制器、多个 Web Animations timeline 或并发作品切换队列。

冻结规则：

- `info` 和 `playing` 互斥。
- INFO 或 PLAY 打开时冻结底层滚动位置和速度。
- 外部 hash 直达目标作品的媒体接管期间冻结用户切换输入。
- Escape 在 `playing` 和 `info` 中只关闭覆盖层；在已吸附的 `idle` 中返回主页。

## 4. 连续滚动物理

每一帧按同一个 `requestAnimationFrame` 循环更新：

1. 将 `WheelEvent.deltaY` 按 `deltaMode` 和视口高度归一化。
2. 把归一化增量加入 `velocity`，并限制最大绝对速度。
3. 使用 `position += velocity` 积分位置。
4. 使用帧率无关的指数衰减减少速度。
5. 当输入停止且速度低于阈值时，向最近整数吸附。
6. 位置和速度都进入容差后，精确落在整数并转为 `idle`。

必须满足：

- 小幅滚动产生小幅画面变化，不跨过固定阈值后突然播放整段动画。
- 连续滚动可以持续推动场景，但速度必须限幅。
- 过渡中反向滚动可以自然退回，不出现跳帧或新 timeline。
- 停止滚动后自然减速并吸附，不能长期停在半张作品上。
- 6 个作品首尾循环时位置连续，不能在 `0/5` 边界闪白或反向跳变。
- 帧间隔异常时限制最大时间步，防止切回标签页后跨越多个作品。
- `prefers-reduced-motion: reduce` 时降低形变和惯性，但仍保留可理解的短交叉切换。

物理常量必须集中在一处并提供安全范围：

```text
wheelGain
maxVelocity
damping
snapStrength
snapVelocityThreshold
settleEpsilon
maxFrameDelta
```

Studio 可以调节安全范围内的参数，但运行时不能读取未保存的草稿冒充正式配置。

## 5. WebGL 双纹理渲染

### 5.1 渲染器接口

详情媒体层由一个独立渲染器负责。建议接口：

```text
mount(canvas, viewport)
setPair(currentMedia, nextMedia, token)
setProgress(progress, direction, velocity)
resize(width, height, pixelRatio)
setPaused(paused)
dispose()
```

页面状态机不直接操作 Three.js Mesh、Texture 或 Shader uniform。渲染器不直接修改 hash、标题或覆盖层。

### 5.2 媒体优先级

```text
videoSrc > posterSrc > coverImage > fallback
```

- 每项作品只解析出一个背景媒体描述和一个 PLAY 媒体描述。
- 运行时只保留 current 和 next 两项的 GPU 纹理。
- 图片使用 `THREE.Texture`；视频使用静音、循环、`playsInline` 的 `THREE.VideoTexture`。
- 视频在可读帧就绪前继续显示海报或封面，不能显示空黑纹理。
- 与 current/next 无关的视频立即暂停并释放引用。
- 纹理替换必须校验 `transitionToken`，过期加载结果直接释放。
- WebGL 上下文丢失后显示可读的静态媒体回退，并允许恢复。

背景视频静音循环并独立于 PLAY。PLAY 打开独立播放器并实际播放当前作品媒体；点击 PLAY 不是启动背景运动的条件。

### 5.3 Cover UV

每张纹理单独计算 cover 比例：

- 保持原始宽高比。
- 填满视口，不拉伸。
- 默认视觉焦点中央偏右，为左侧文字留出安全空间。
- resize 后同时更新视口分辨率和两张纹理的 cover 参数。

### 5.4 Shader 契约

Fragment Shader 至少接收：

```text
uTextureCurrent
uTextureNext
uProgress
uDirection
uVelocity
uResolution
uCurrentCover
uNextCover
uDistortion
uWaveAmplitude
uWaveFrequency
uEdgeSoftness
uTime
```

原创等效 Shader 必须实现：

1. 根据屏幕纵向位置和少量横向偏移计算空间延迟。
2. 根据 `direction` 生成上下相反的媒体接管方向。
3. 用正弦或平滑噪声产生克制的纵向 UV 波浪。
4. 根据速度调节形变幅度；接近吸附点时形变回零。
5. 分别采样 current 与 next，再按空间延迟后的进度混合。
6. 使用镜像或安全钳制 UV，防止形变露出黑边、透明边或未定义像素。
7. 过渡两端必须精确还原单张纹理，避免静止时持续模糊。

Shader 不复制官网源代码。变量、数学表达和参数均按 FLOWFRAME 的目标重新设计。

## 6. 文案、界面和 hash 同步

- 文案、PLAY、INFO、Prev/Next 是独立 HTML 覆盖层，不随 Canvas 像素变形。
- 视觉进度越过 `0.5` 时，`semanticIndex` 切到接管作品；反向越过时可切回。
- 文案只做短距离错峰和透明度变化，不创建与媒体竞争的长 timeline。
- 滚轮浏览只在吸附完成后用 `history.replaceState` 同步 hash，避免滚动过程中产生大量历史项。
- 用户点击 Prev/Next 使用单次明确导航；完成后写入目标 hash。
- 浏览器前进、后退、刷新或手工 hash 直达时，从当前作品直接与目标作品组成一对并完成一次接管，不逐项绕行。
- 外部直达取消旧纹理请求和旧吸附目标，但不破坏 INFO/PLAY 的关闭顺序。
- 无效 ID 归一到第一项；错误编码不能使路由崩溃。

## 7. INFO、PLAY 和声音

INFO：

- 暖白或白底，黑色文字。
- 包含作品说明、混剪方向、关键帧说明和素材状态。
- 从右侧接管，不与 PLAY 同时出现。

PLAY：

- 打开全屏深色播放器。
- 必须加载 `semanticIndex` 对应的可播放媒体。
- 播放期间 `currentTime` 必须增长；不能只打开空层。
- 占位媒体持续显示 `PLACEHOLDER MEDIA`。
- 关闭时暂停并清理播放器资源，再恢复底层 Canvas。

声音：

- 用户指定视频的音轨作为独立全站 BGM，默认关闭。
- 主页与详情都提供 `SOUND ON / OFF`，路由切换不重置开关。
- 详情背景纹理与 PLAY 测试片段保持静音，避免与 BGM 重叠。

## 8. 桌面构图

- 1440×900：文案与 PLAY 的内容容器约 900px，左侧起点约 270px，PLAY 约 160px。
- 1280×720：标题约 40–44px，说明最多两行，PLAY 150px，底部导航离底约 30–40px。
- 1920×1080：容器可增至约 1040px，PLAY 最大 164px；文字和控件不继续等比放大。
- 影像人物或视觉焦点默认在中央偏右，为左侧文字留出空间。
- 视口窄于 1180px 时使用电脑端提示，不开发手机详情。

## 9. 自动检查和真实浏览器验收

自动检查至少覆盖：

- 六个作品 hash 直达和刷新恢复。
- 六次 Next 循环、Prev 回绕和首尾连续性。
- 小幅滚动只产生部分进度。
- 过渡中反向滚动可退回。
- 连续快速滚动受到限速，不创建并发 timeline。
- 停止输入后减速并吸附到唯一作品。
- 进度跨越中点时标题、PLAY、INFO 和 hash 最终一致。
- 外部 hash 在切换中直接接管目标，不逐项经过中间作品。
- WebGL Canvas 存在，活动纹理不超过 current/next 两项。
- 过渡中无白屏、黑边、错层或未定义纹理。
- INFO、PLAY、Escape 和底层冻结规则。
- PLAY 的 `currentTime` 实际增长。
- resize、WebGL 回退和 `prefers-reduced-motion`。
- 1280×720、1440×900、1920×1080。
- 控制台错误、页面错误和未处理 Promise 为 0。

测试可以读取只读调试快照，例如：

```text
window.__FLOWFRAME_DETAIL_DEBUG__ = {
  getSnapshot(),
  getRendererStats()
}
```

调试接口只能暴露数字、索引和资源计数，不能成为正式运行逻辑的依赖。

## 10. 完成判定

只有同时满足以下条件，才能声称 Waxing Moon 方向已经实现：

- 滚轮距离逐帧影响画面，不是固定阈值触发 CSS 动画。
- 画面由 WebGL 双纹理 Shader 混合，不是两个 DOM 媒体层的 `clip-path` 动画。
- 过渡可以中途反向，停止后自然吸附。
- 六个作品连续循环，无白屏、错层、黑边和控制台错误。
- INFO、PLAY、Escape、Prev/Next、hash、刷新和返回行为一致。
- 生产构建、自动检查和真实浏览器双视口验收通过。

构建通过、按钮可点击或单张截图相似，均不能单独证明本规范完成。
