# 项目解析与答辩说明

这份文档用于快速理解项目的基础逻辑、主要代码结构和答辩时可以讲清楚的实现思路。

## 1. 项目做了什么

本项目是一个 Web 端 3D 作品画廊。用户打开页面后看到全屏 WebGL 画面，滚动页面时镜头沿着画廊移动；点击作品封面或“聚焦当前作品”按钮时，镜头会移动到卡片正前方；再次点击空白区域或按 `Esc` 返回浏览状态。

主要功能包括：

- 全屏 Three.js 3D 画廊
- 页面滚动驱动镜头前进
- 封面悬停发光、放大和标签提示
- 点击封面后镜头靠近卡片
- 跨作品大跳转时使用更短的镜头路径
- 聚焦卡片时根据鼠标方向产生轻微倾斜
- 桌面和移动端响应式适配
- Playwright 自动截图和镜头稳定性验证

## 2. 文件结构

```text
.
├── index.html                    # 页面骨架：canvas、顶部导航、作品信息面板
├── src/
│   ├── main.js                   # 3D 场景、镜头运动、交互逻辑
│   └── styles.css                # 页面布局、面板、按钮、响应式样式
├── scripts/
│   └── verify-ui.mjs             # 自动化 UI 验证脚本
├── docs/
│   └── PROJECT_GUIDE.md          # 当前这份项目解析文档
├── vite.config.js                # Vite 与 GitHub Pages 路径配置
├── package.json                  # 项目依赖和运行脚本
└── .github/workflows/
    └── deploy-pages.yml          # GitHub Pages 自动部署流程
```

## 3. 运行和关闭

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm dev -- --port 5173
```

浏览器访问：

```text
http://127.0.0.1:5173/
```

关闭占用 `5173` 端口的进程：

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
kill <PID>
```

如果只是当前终端里启动的开发服务，也可以在该终端按 `Ctrl + C`。

## 4. 主流程怎么跑起来

入口在 `src/main.js` 的最后：

```js
const app = new GalleryExperience();
app.init();
```

`GalleryExperience` 是整个体验的控制类。`init()` 依次执行：

1. `buildScene()`：创建 Three.js 场景、相机、渲染器、灯光和 Bloom 后期。
2. `buildGallery()`：创建画廊地面、墙体、粒子和六张作品卡片。
3. `buildRail()`：创建右侧作品进度轨道按钮。
4. `updateWorkPanel(0)`：初始化右侧作品文字。
5. `bindEvents()`：绑定鼠标、点击、滚动、键盘和声音按钮事件。
6. `setupScroll()`：用 GSAP ScrollTrigger 监听滚动进度。
7. `resize()`：根据窗口尺寸设置相机和渲染器。
8. `render()`：进入每帧渲染循环。

答辩时可以把这个流程概括为：

```text
数据源 works -> 创建 3D 卡片 -> 绑定用户输入 -> 根据滚动和点击计算镜头 -> 每帧渲染画面
```

## 5. 作品数据在哪里改

作品数据在 `src/main.js` 顶部的 `works` 数组中。每个对象代表一张卡片：

```js
{
  id: 'afterglow',
  index: '01',
  title: '余晖航线',
  meta: 'Cinema Loop / 2026',
  tags: ['Bloom', 'Scroll Camera', 'Raycaster'],
  palette: ['#ff6f4d', '#ffd166', '#1f7a8c', '#101014'],
  description: '...',
  specs: ['片元混合转场', '封面发光反馈', '宽屏画册叙事'],
}
```

`createCoverTexture(work)` 会读取这些字段，并用 Canvas 绘制出封面纹理。也就是说，页面没有依赖外部图片资源，封面视觉由代码动态绘制，再作为 Three.js 的 `CanvasTexture` 贴到卡片模型上。

## 6. Three.js 部分怎么完成

### 场景、相机、渲染器

`buildScene()` 创建三件最基础的东西：

- `scene`：3D 世界，所有物体都放进这里。
- `camera`：用户看到画面的视角。
- `renderer`：把 3D 场景绘制到 `<canvas>` 上。

项目使用 `PerspectiveCamera`，因为它能表现近大远小的空间透视。渲染器使用 `WebGLRenderer`，并设置了 `toneMapping`、`outputColorSpace` 和像素比，让颜色和亮度更接近最终视觉效果。

### 灯光和后期

场景里有三类灯：

- `HemisphereLight`：基础环境光。
- `DirectionalLight`：主光源，让卡片和墙面有明暗关系。
- `PointLight`：左右两侧点光，增加冷暖对比。

`EffectComposer` 串联了：

- `RenderPass`：正常渲染场景。
- `UnrealBloomPass`：给高亮部分加辉光。
- `OutputPass`：输出最终画面。

答辩时可以说：Bloom 不是卡片本身的模型，而是渲染后的屏幕后期效果。

## 7. 卡片是怎么做出来的

`buildGallery()` 遍历 `works`，每个作品创建一个 `THREE.Group`：

- 外层 `card`：控制卡片在画廊中的位置和朝向。
- 内层 `visual`：负责鼠标跟随时的轻微旋转和平移。
- `cover`：真正显示封面的平面模型。
- `framePart`：四条边框。
- `glow`：卡片背后的半透明发光层。

卡片左右交错排列：

```js
const lane = index % 2 === 0 ? -1 : 1;
const row = Math.floor(index / 2);
const x = lane * 2.18;
const z = row * -3.3 + 0.45;
```

这个逻辑的意思是：

- 偶数序号在左边，奇数序号在右边。
- 每两张卡片组成一组，下一组往画廊深处移动。
- 卡片略微朝向走廊中间，方便镜头浏览。

## 8. 滚动镜头怎么完成

`setupScroll()` 使用 GSAP 的 `ScrollTrigger` 监听页面滚动。滚动位置会转换成 `0` 到 `1` 的 `galleryProgress`：

```js
this.galleryProgress = THREE.MathUtils.clamp(self.progress, 0, 1);
```

`getGalleryViewForProgress()` 根据这个进度计算两件事：

- `outPosition`：镜头应该站在哪里。
- `outTarget`：镜头应该看向哪里。

项目没有直接让镜头瞬间跳到新位置，而是在 `syncCamera()` 里用 `lerp` 和指数阻尼慢慢靠近目标：

```js
const cameraDamping = 1 - Math.exp(-delta * 7.2);
this.camera.position.lerp(this.desiredCameraPosition, cameraDamping);
this.cameraTarget.lerp(this.desiredCameraTarget, cameraDamping);
```

这里的关键点是 `delta`。它代表当前帧和上一帧之间的时间差。用 `delta` 计算阻尼，可以让 60 帧和 120 帧屏幕上的动画速度更接近，减少忽快忽慢的问题。

## 9. 点击聚焦怎么完成

点击封面时，`getCoverHit()` 用 `Raycaster` 从鼠标点击位置发出射线：

```js
this.raycaster.setFromCamera(this.clickPointer, this.camera);
const [hit] = this.raycaster.intersectObjects(this.coverMeshes, false);
```

如果射线命中了某个封面，就调用 `focusWork(index)`：

- 记录 `focusedIndex`
- 更新右侧文字
- 把页面滚动同步到该作品
- 给 `body` 加上 `is-focused`
- 把按钮文字改成“返回浏览”

真正的镜头靠近发生在 `updateFocusView()` 和 `syncCamera()`：

- `updateFocusView()` 找到卡片世界坐标和正面方向。
- 根据卡片尺寸、FOV 和屏幕比例计算安全距离。
- `syncCamera()` 用 `focusBlend` 在普通浏览镜头和聚焦镜头之间混合。

所以聚焦不是弹出新层级，而是同一个 3D 场景里的相机移动。

## 10. 大跨度跳转为什么不卡

当用户点击右侧轨道，从第 1 张跳到第 6 张时，如果直接沿着滚动顺序移动，镜头会穿过很长距离，显得拖沓。项目用 `routeToProgress()` 判断目标距离：

- 距离 `0` 或 `1`：使用普通平滑滚动。
- 距离 `2`：使用 `bridge` 路线。
- 距离大于等于 `3`：使用更短的 `skip` 路线。

`startJumpRoute()` 会记录起点、中间点、终点。`updateJumpRoute()` 每帧用两段 `lerp` 组合出类似二次贝塞尔的运动：

```text
起点 -> 中间点 -> 终点
```

这种路径能让镜头先稍微抬起、向走廊中间收拢，再落到目标作品附近，避免大跨度切换时直接横穿整个画廊。

## 11. 鼠标跟随微交互怎么完成

`onPointerMove()` 把鼠标坐标转换成标准设备坐标：

```js
this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
```

这个坐标范围大致是：

- 左边 `-1`，右边 `1`
- 下方 `-1`，上方 `1`

聚焦状态下，`updateFocusedCardTilt()` 会用这个坐标控制当前卡片的旋转和平移：

```js
const targetX = -this.pointer.y * maxTiltX * tiltStrength;
const targetY = this.pointer.x * maxTiltY * tiltStrength;
```

这里的 `tiltStrength` 只在当前聚焦卡片上生效，其他卡片保持不动，避免画面过乱。

## 12. 样式部分怎么理解

`src/styles.css` 主要分四层：

- `#galleryCanvas`：固定在全屏底层，显示 3D 画面。
- `.topbar`：顶部品牌、导航、声音按钮。
- `.intro-panel` 和 `.work-panel`：左下介绍面板和右侧作品信息面板。
- `.progress-rail`：右侧作品进度轨道。

页面处于聚焦状态时，`body` 会有 `is-focused` 类：

```css
.is-focused .intro-panel,
.is-focused .work-panel,
.is-focused .progress-rail,
.is-focused .topbar {
  opacity: 0;
  pointer-events: none;
}
```

这段样式会隐藏界面面板，让用户只看到卡片近景，但并没有创建弹窗或新的页面层级。

## 13. 自动化测试验证什么

`scripts/verify-ui.mjs` 使用 Playwright 打开本地页面，做几类检查：

- 桌面和移动端截图不是空白。
- 每张封面在对应滚动位置没有被视口裁切。
- 大跨度轨道跳转使用了 `skip` 路线。
- 镜头每帧移动距离没有突然过大。
- 聚焦后卡片完整进入画面。
- 聚焦卡片会跟随鼠标方向倾斜。

运行方式：

```bash
pnpm dev -- --port 5173
pnpm verify:ui
```

如果测试失败，通常说明镜头位置、FOV、卡片尺寸或响应式布局需要重新调整。

## 14. 答辩时建议重点讲

可以按下面顺序讲，逻辑比较清楚：

1. 项目目标：做一个 Web 端 3D 作品画廊。
2. 技术选型：Vite 负责开发构建，Three.js 负责 3D，GSAP 负责滚动进度，Playwright 负责测试。
3. 数据驱动：作品信息集中在 `works` 数组里，页面和 3D 卡片都读取同一份数据。
4. 3D 搭建：创建场景、相机、渲染器、灯光、粒子、卡片和后期辉光。
5. 核心交互：滚动控制普通镜头，点击控制聚焦镜头，鼠标控制近景微动。
6. 镜头平滑：通过 `lerp`、`smootherstep` 和基于 `delta` 的阻尼减少卡顿。
7. 稳定性：用自动化脚本检查截图、裁切、跳转路线和聚焦画面。

## 15. 常见追问

**为什么不用弹窗展示作品？**

因为需求希望点击后镜头靠近卡片，保持同一个 3D 空间，不额外叠加 DOM 层级。这样交互更沉浸，也能体现 WebGL 镜头运动。

**为什么要用 Raycaster？**

普通 DOM 点击只能知道点到了哪个 HTML 元素，但 3D 卡片是 WebGL 里的 Mesh。Raycaster 可以把鼠标位置转换成 3D 射线，判断射线命中了哪个卡片。

**为什么镜头不会直接设置到目标位置？**

直接设置会造成跳变。项目用 `lerp` 和阻尼让镜头逐帧靠近目标位置，视觉上更平滑。

**为什么大跨度跳转要设计中间点？**

如果从第一张直接移动到最后一张，镜头会沿很长的顺序路径移动。中间点让镜头先收回到更中间、更高的位置，再落到目标，路径更短。

**如果要换真实作品图片怎么做？**

可以把 `createCoverTexture(work)` 换成 `TextureLoader` 加载图片，也可以在 `works` 里增加图片地址字段，例如 `image: '/covers/xxx.jpg'`，再给封面材质设置对应纹理。

