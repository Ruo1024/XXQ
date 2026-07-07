# FLOWFRAME Anime Mix Gallery

一个 Web 端动漫混剪封面画廊原型：主页以 3D 海报廊组织封面，聚焦后可进入对应混剪展示页。

## 已实现

- Three.js 全屏 3D 动漫封面画廊
- GSAP ScrollTrigger 滚动镜头叙事和短路径跳转
- Raycaster 封面悬停、发光、第一次点击聚焦
- 聚焦后第二次点击封面中心进入 `#/works/:id` 全屏影像作品页
- 详情页采用底层视频/封面常驻、文字和导航浮在上方的作品页结构
- `PLAY` 会进入沉浸播放状态，`INFO` 面板承载关键帧和混剪方向说明
- 视频素材未填入时使用生成式全屏海报和氛围背景占位
- 预留 `coverImage`、`posterSrc`、`videoSrc`、`shortDescription`、`infoDescription`、`frameNotes` 数据字段
- 大跨度作品跳转短路径镜头
- 聚焦卡片鼠标方向跟随微交互
- 响应式桌面与移动端布局
- 声音开关与轻量交互反馈

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
同时会验证第一次点击聚焦、第二次点击进入详情页、详情页全屏媒体层、`PLAY`、`INFO`、连续作品切换和 `Escape` 返回流程。

## 素材替换

后续可把素材放入 `public/media/works/<id>/`，再在 `src/main.js` 的 `works` 数据中填写：

- `coverImage`：主页封面或人物插画
- `posterSrc`：详情页视频封面
- `videoSrc`：混剪视频文件
- `shortDescription`：详情页首屏短说明
- `infoDescription`：INFO 面板说明
- `frameNotes`：关键帧时间码和注释

## 部署

推送到 `main` 后，GitHub Actions 会自动构建并部署到 GitHub Pages。部署配置在 `.github/workflows/deploy-pages.yml`。
