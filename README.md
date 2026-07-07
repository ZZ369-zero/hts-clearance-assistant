# 美国 HTS 清关税金助手

一个网页版 MVP，参考“微信 AI 清关宝”的核心流程：查询美国 HTS CODE 和税率、按章节浏览全品类、估算进口税金，并通过 USITC 官方 HTS 接口刷新数据。

## 运行

```powershell
node server.js
```

打开：

```text
http://localhost:4173
```

## 数据源

- HTS 查询、章节数据、版本信息来自 USITC HTS：`https://hts.usitc.gov/`
- 服务端对官方接口做短时缓存，点击页面右上角刷新按钮会清空缓存并重新拉取。

## 已实现

- 商品名 / HTS CODE 查询。
- 常见中文品名简单映射到英文关键词。
- 商品描述中英双语展示；中文为内置词典辅助翻译，英文保留 USITC 原文。
- 清关方案切换：T01 Formal Entry / T11 Informal Entry。
- 运输方式切换：海运 / 空运，海运默认纳入 HMF，空运默认关闭 HMF。
- 01-99 章全品类浏览。
- 税率详情、单位、脚注、附加税字段展示。
- 从脚注提取 Chapter 99 附加税编码，并在选中商品后单独展示附加税税率。
- 进口税金估算：普通从价税、手动附加税、固定税额、MPF、HMF。
- 可录入清关服务费，并在总额中单独体现。

## 注意

HTS 中存在复合税率、数量税率、Chapter 99 附加税、配额、反倾销/反补贴等情形。本工具会自动解析简单百分比税率；其他情形需要人工确认后录入计算器。

## GitHub Pages + GitHub Actions 静态部署

本项目已支持 GitHub Pages 静态部署模式。部署后页面不再依赖常驻 Node 后台，而是读取 `public/data/*.json` 快照数据。

静态数据生成命令：

```powershell
npm run export:static
```

已配置 `.github/workflows/static-pages.yml`：

- HTS / 普通税率 / Chapter 99：每 1 小时刷新。
- 232 Metals HTS List：每 6 小时刷新。
- AD/CVD 官方站点监控：每 24 小时刷新。
- 棉费 Import Assessment：每 24 小时刷新。
- 中文翻译缓存：每周刷新或按新增数据触发。

Actions 会生成并提交 `public/data`，然后部署 `public` 到 GitHub Pages。页面在 GitHub Pages 上会自动切换到静态数据模式；本地或云服务器运行 `server.js` 时仍优先使用动态 API。

手动测试静态模式：

```text
http://localhost:4173/?static=1
```
