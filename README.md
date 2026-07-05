# FLOWFRAME 3D Gallery

基于作品规划书实现的初步开发版本：一个 Web 可交互视效流媒体展示原型。

## 已实现

- Three.js 全屏 3D 立体画廊
- GSAP ScrollTrigger 滚动镜头叙事
- Raycaster 封面悬停、发光、点击进入画册
- 粒子、雾效、Bloom 后期视觉
- 画册详情页、图片切换与响应式布局
- 声音开关与轻量交互反馈

## 运行

```bash
pnpm install
pnpm dev
```

如果当前 shell 找不到 `node`，可先使用本机 Codex 运行时：

```bash
export PATH=/Users/ruo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
/Users/ruo/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm install
/Users/ruo/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm dev
```
