# FLOWFRAME 3D Gallery

基于作品规划书实现的初步开发版本：一个 Web 可交互视效流媒体展示原型。

## 已实现

- Three.js 全屏 3D 立体画廊
- GSAP ScrollTrigger 滚动镜头叙事
- Raycaster 封面悬停、发光、点击镜头聚焦
- 粒子、雾效、Bloom 后期视觉
- 大跨度作品跳转短路径镜头
- 聚焦卡片鼠标方向跟随微交互
- 响应式桌面与移动端布局
- 声音开关与轻量交互反馈

## 项目解析

答辩和二次开发说明见 [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)，其中包含：

- 文件结构和运行方式
- Three.js 场景、卡片、镜头、交互的基础逻辑
- 滚动镜头、点击聚焦、大跨度跳转的实现说明
- 自动化测试验证内容
- 答辩讲解提纲和常见追问

## 在线地址

GitHub Pages 部署后访问：

```text
https://ruo1024.github.io/XXQ/
```

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

## 验证

启动开发服务后，可运行 UI 自动化验证：

```bash
pnpm verify:ui
```

该脚本会检查桌面端和移动端截图、卡片是否被裁切、镜头跳转是否平滑、聚焦卡片是否完整显示。

## 部署

推送到 `main` 后，GitHub Actions 会自动构建并部署到 GitHub Pages。部署配置在 `.github/workflows/deploy-pages.yml`。
