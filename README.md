# Bilibii Video Dashboard v1.0

基于真实累计 CSV 数据的 Bilibili 创作者表现仪表盘。

## 本地运行

```bash
npm install
npm run dev
```

## 数据源

将数据放在 `public/data/历史累计数据趋势.csv`。首版读取以下字段：

`时间, 播放量, 累计粉丝, 点赞, 收藏, 硬币, 评论, 弹幕, 分享`

程序会自动剥离 `历史累计` 汇总行，按日期计算各字段日增量，并计算互动参考比例。首版不虚构逐视频字段，因此页面聚焦账号累计趋势、周期对比和互动构成。

## 验证

```bash
npm run check
npm run build
```

## Vercel

这是标准 Vite 静态站点：Vercel 项目根目录选择本仓库，构建命令使用 `npm run build`，输出目录使用 `dist`，即可部署。
