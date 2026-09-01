# Web Assistant 全量中英文 UI 本地化实施报告

日期：2026-09-01

## 目标

修复 Composer 状态徽标在中文界面中显示英文 `Connected` 的问题，并将 Web Assistant 小程序全部面向用户的界面文案接入 Finch 原生 i18n。

## 实施内容

- 新增 `i18n/en-US.json`，保留完整英文文案。
- 新增 `i18n/zh-CN.json`，提供中文界面文案与 manifest 覆盖：
  - 扩展名称、描述和 Composer tooltip
  - Composer 状态：已连接、等待连接、重新连接、离线
  - 状态菜单及说明
  - Toast 提示
  - 首次连接引导弹窗及按钮
  - 工具标题、描述和参数说明
  - 可展示的恢复与输入校验提示
- 将 `src/index.ts` 内用户可见运行时文案改为 `ctx.i18n.t(...)`。
- 增加语言切换监听；切换 Finch App 语言时，Composer 状态徽标会立即刷新。
- 将 `i18n` 加入 `package.json#files`，确保发布包包含语言资源。

## 验证

以下命令均通过：

```sh
npm run check
npm run build
npm run doctor
```

此外已验证：

- `package.json`、`i18n/en-US.json`、`i18n/zh-CN.json` 均为合法 JSON。
- `src/index.ts` 的标题、描述、菜单、Toast、弹窗与状态徽标均通过 i18n key 读取；仅保留技术字段名 `session`。

## 关联反馈

- Issue：[#1 Inconsistent language in the composer toolbar](https://github.com/BlessedChild/finch-web-assistant/issues/1)
- 反馈用户：前端之虎陈随易
