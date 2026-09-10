const field = (group, key, label, min, max, step, defaultValue, unit = '') => Object.freeze({
  group,
  key,
  label,
  min,
  max,
  step,
  defaultValue,
  unit,
});

export const MOTION_GROUPS = Object.freeze([
  Object.freeze({
    id: 'home',
    label: '主页镜头与画框',
    description: '控制镜头视差、立体画框吸附和空间倾斜。',
    fields: Object.freeze([
      field('home', 'homePointerX', '横向鼠标跟随', 0, 1.6, 0.01, 1),
      field('home', 'homePointerY', '纵向鼠标跟随', 0, 1.3, 0.01, 0.33),
      field('home', 'homeDamping', '跟随响应', 0.02, 0.24, 0.005, 0.055),
      field('home', 'homeCameraTravel', '切换镜头距离', 0.2, 2.4, 0.05, 0.2),
      field('home', 'homePosterAttraction', '画框吸附距离', 0, 1.6, 0.01, 0.36),
      field('home', 'homePosterTilt', '画框倾斜角度', 0, 14, 0.1, 6.5, '°'),
      field('home', 'homePosterDepth', '画框纵深位移', 0, 1.2, 0.01, 0.46),
      field('home', 'homePosterSwitchKick', '切换起始冲量', 0, 2.4, 0.05, 1.2),
      field('home', 'homePosterSpring', '画框回弹强度', 12, 72, 1, 16),
      field('home', 'homePosterDrag', '画框回弹阻尼', 4, 20, 0.5, 11),
      field('home', 'homeOverlayFadeOut', '标记文字淡出', 0.05, 0.8, 0.01, 0.31, 's'),
      field('home', 'homeOverlayDelay', '稳定后显示等待', 0, 0.8, 0.01, 0, 's'),
      field('home', 'homeOverlayFadeIn', '标记文字淡入', 0.05, 1.2, 0.01, 0.74, 's'),
    ]),
  }),
  Object.freeze({
    id: 'network',
    label: '动态网络',
    description: '控制封面切换时节点网络的三维形态变化。',
    fields: Object.freeze([
      field('network', 'networkMorphDelay', '变形启动延迟', 0, 0.8, 0.01, 0.1, 's'),
      field('network', 'networkMorphDuration', '形态切换时长', 0.35, 2.4, 0.05, 1.05, 's'),
      field('network', 'networkMorphDepth', '形态纵深层次', 0, 4.5, 0.1, 1.2),
      field('network', 'networkMorphRotation', '形态空间倾角', 0, 38, 1, 0, '°'),
      field('network', 'networkFloatStrength', '节点浮动强度', 0, 2, 0.01, 2),
      field('network', 'networkFloatSpeed', '节点浮动速度', 0.2, 2.8, 0.05, 1),
      field('network', 'networkPointerInfluence', '鼠标空间牵引', 0, 3, 0.05, 3),
      field('network', 'networkMorphAttack', '最短路径缓动', 0.35, 2.8, 0.05, 1.7),
      field('network', 'networkForegroundDepth', '封面前景穿插', 0, 5, 0.1, 5),
    ]),
  }),
  Object.freeze({
    id: 'transition',
    label: '详情转场',
    description: '控制作品切换的扭曲、缩放、模糊和文字节奏。',
    fields: Object.freeze([
      field('transition', 'transitionDuration', '切换时长', 0.4, 3.2, 0.05, 3.2, 's'),
      field('transition', 'transitionDistortion', '画面扭曲强度', 0, 1.5, 0.01, 1.5),
      field('transition', 'transitionScale', '切换缩放幅度', 1, 1.4, 0.01, 1.2),
      field('transition', 'transitionBlur', '切换模糊程度', 0, 24, 0.5, 15.5, 'px'),
      field('transition', 'transitionMaskAngle', '切面角度', -45, 45, 1, -22, '°'),
      field('transition', 'transitionTextDelay', '文字延迟', 0, 0.8, 0.01, 0.76, 's'),
      field('transition', 'transitionSpring', '滚动回弹强度', 14, 90, 1, 42),
      field('transition', 'transitionDamping', '滚动回弹阻尼', 3, 18, 0.2, 9.2),
      field('transition', 'transitionWaveStrength', '行波形变强度', 0, 2.4, 0.05, 1),
      field('transition', 'transitionWaveFrequency', '行波频率', 0.35, 3, 0.05, 1),
      field('transition', 'transitionRowDelay', '逐行延迟强度', 0, 2.5, 0.05, 1),
      field('transition', 'transitionDepthShift', '画面纵深推进', 0, 2.5, 0.05, 1),
    ]),
  }),
  Object.freeze({
    id: 'play',
    label: 'PLAY 墨滴',
    description: '控制 PLAY 圆形内部墨滴的延迟、扩散与回弹。',
    fields: Object.freeze([
      field('play', 'playInkDelay', '出现延迟', 0, 0.3, 0.01, 0.3, 's'),
      field('play', 'playInkDuration', '扩散时长', 0.18, 1.2, 0.01, 0.81, 's'),
      field('play', 'playInkElastic', '回弹强度', 0, 1.5, 0.01, 0.83),
      field('play', 'playInkDistortion', '边缘变形', 0, 0.45, 0.01, 0.22),
    ]),
  }),
]);

export const MOTION_FIELDS = Object.freeze(MOTION_GROUPS.flatMap((group) => group.fields));

export const DEFAULT_MOTION = Object.freeze(Object.fromEntries(
  MOTION_FIELDS.map((item) => [item.key, item.defaultValue]),
));

export const sanitizeMotion = (input = {}) => Object.fromEntries(MOTION_FIELDS.map((item) => {
  const requested = Number(input?.[item.key]);
  const value = Number.isFinite(requested) ? requested : item.defaultValue;
  return [item.key, Math.min(item.max, Math.max(item.min, value))];
}));
