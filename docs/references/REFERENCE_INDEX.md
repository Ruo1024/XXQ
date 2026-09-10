# FLOWFRAME 参考索引

更新时间：2026-08-24

## 1. 主页视觉真值

- 文件：`docs/references/home-option-1.png`
- 尺寸：1586×992。
- 状态：用户在旧线程中选定的唯一主页视觉方向。
- 负责：雪白与银白空间、左侧文字、中央偏右主海报、远处海报、细线关系和低对比导航。

旧方案 2 和方案 3 已废弃并移出活动参考目录。

## 2. 作品详情真值

- 文件：`docs/references/tao-detail-reference.png`
- 尺寸：1440×900。
- 来源：TAO TAJIMA 作品页的本地研究截图。
- 负责：全屏影像、左中文案、右侧圆形 PLAY、底部 Prev/Next 和薄 UI 层级。

## 3. 在线参考的固定分工

### Camera WebGI

- 地址：`https://camera-webgi.vercel.app/`
- 只参考：极简主体、连续镜头叙事和滚动节奏。
- 不复制：相机产品、品牌、模型和章节内容。

### Igloo

- 地址：`https://www.igloo.inc/`
- 只参考：鼠标移动时镜头、主体和前后景的轻微空间反馈。
- 不复制：雪屋、雪屋模型、品牌和页面内容。

### TAO TAJIMA《Waxing Moon》

- 页面：`https://taotajima.jp/works/waxing-moon/`
- 公开运行脚本研究入口：`https://taotajima.jp/js/main.js?date=20171208`
- 只参考：连续滚轮位置、速度衰减和吸附、WebGL 双纹理混合、纵向空间延迟、UV 波浪、文字和按钮出现顺序、PLAY、INFO 和 Prev/Next。
- 动态实现依据：官网运行行为和公开加载代码的机制分析；静态截图只用于构图和关键帧核验。
- 不复制：Shader 或业务源码、品牌、视频、图片、字体和文案。FLOWFRAME 使用原创等效算法和本地占位媒体。

## 4. 当前对照证据

- 主页参考与实现：`output/qa/home-comparison-source-left-implementation-right.png`
- 详情静态构图参考与实现：`output/qa/detail-layout-comparison-source-left-implementation-right.png`
- 详情连续滚动中间态：`output/qa/work-detail-scroll-partial-1440x900.png`
- 详情转场状态：`output/qa/work-detail-switching-1440x900.png`
- 详情 1280×720：`output/qa/work-detail-1280x720.png`
- 详情 1920×1080：`output/qa/work-detail-1920x1080.png`
- INFO：`output/qa/work-detail-info-1440x900.png`
- PLAY：`output/qa/work-detail-player-1440x900.png`
- WebGL 上下文丢失回退：`output/qa/work-detail-webgl-fallback-1440x900.png`
- reduced-motion：`output/qa/work-detail-reduced-motion-1440x900.png`

这些截图是当前验证证据，不是新的设计方向。
