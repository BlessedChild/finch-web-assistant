# Web Assistant v1.0.3 实施报告

- 日期：2026-09-19
- 依据：官方仓库 `finchtoys/finch-releases` **Issue #65** 复审意见（Finch-Paia，2026-09-06 14:58 UTC）
- 实施对象：`BlessedChild/finch-web-assistant`
- 提交：`ec2d408`（main）；Release：`v1.0.3`
- 当前状态：**代码与文案整改完成并已通过全部本地校验；npm 1.0.3 尚未发布（npm 凭据受阻）**

## 一、官方要求 → 实施结果

### 1) 用户面明确 Kimi 依赖 —— 完成
- `package.json`
  - `version`: 1.0.2 → **1.0.3**
  - `description`: `Kimi-powered browser tool: let Finch operate websites in your Chrome browser through Kimi WebBridge.`
  - `finch.name`: `Web Assistant` → **`Kimi Web Assistant`**
  - `finch.description`: 明确"安装或启动本机 Kimi WebBridge 组件、使用 Kimi WebBridge Chrome 扩展、仅访问 127.0.0.1:10086"
  - `finch.contributes.composerActions[].tooltip`: → `Kimi Web Assistant`
- `README.md`：标题、首段、安装、首次连接、连接状态、技术细节、工具面全部重写；首段即说明"由 Kimi WebBridge 驱动"，并列出"安装本机 Kimi 组件 + 打开 Chrome 应用店确认安装 Kimi WebBridge 扩展"两步
- `i18n/en-US.json`、`i18n/zh-CN.json`：新增/更新应用内 `name` 与 `description`（均含 Kimi WebBridge）；onboarding、toast、menu 文案改为明确 Kimi WebBridge 与 Chrome 扩展；新增 `tools.browser.*`
- `skills/kimi-webbridge/SKILL.md`：说明 Kimi WebBridge 依赖与"社区工具、非 Kimi 官方产品"

### 2) 收敛工具面 —— 完成
- 删除 3 个生命周期工具：`kimi_webbridge_check_status`、`kimi_webbridge_start_daemon`、`kimi_webbridge_install_bridge`
- 14 个动作工具合并为 **1 个** `kimi_webbridge_browser`：
  - 必填 `session` + `action`
  - `action` 枚举：`navigate | find_tab | snapshot | click | fill | evaluate | cdp | screenshot | network | upload | save_pdf | list_tabs | close_tab | close_session`
  - 参数并集 + 按 action 的必填校验（缺参直接返回错误，不发请求）
  - 映射：`save_pdf` → 桥接动作 `save_as_pdf`，其余同名
- 生命周期能力改为 UI 驱动：Composer 菜单（检查连接 / 连接 Chrome / 帮助）、onboarding 弹窗、`callBridge` 的单次幂等自动恢复
- **注册工具数：17 → 1**
- 兼容性保持不变：`finch.id`（`kimi-webbridge`）、npm 包名（`finch-web-assistant`）、Composer action id（`kimi-webbridge-status`）

## 二、本地验证结果（全部通过）

| 校验 | 结果 |
|---|---|
| `npm run check` | ✅ `tsc --noEmit` 无输出 |
| `npm run build` | ✅ `dist/index.js` 18.2 kB 生成 |
| `npx @finchtoys/minitools doctor .` | ✅ `Finch mini tool: Kimi Web Assistant / id: kimi-webbridge / version: 1.0.3 / ✓ No issues found.` |
| `npm pack --dry-run` | ✅ 10 files，38.6 kB（dist、i18n、skills、icon.png、README、LICENSE、package.json） |
| JSON 解析 | ✅ package.json / en-US.json / zh-CN.json |

## 三、发布执行情况

1. `git commit ec2d408` + `git push origin main` ✅
2. GitHub Release `v1.0.3` 创建 ✅ → 触发 `.github/workflows/publish.yml`
3. 发布 workflow run `35417355851` ❌ 失败：
   ```
   npm error code ENEEDAUTH
   npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
   ```
   （与 09-01 的三次失败同因：npm 侧未生效的 OIDC trusted publisher / 缺少令牌）
4. 本地 npm 凭据排查结论：
   - `~/.npmrc` 中的 `//registry.npmjs.org/:_authToken` **已失效**（直接请求 `https://registry.npmjs.org/-/whoami` 返回 HTTP 401）
   - macOS Keychain 条目 `npm.finch-web-assistant.publisher`（账号 `arthurslog`，创建于 2026-09-01）**存在但密码为空**，`security -w` 取不到值
   - `~/Downloads/npm_recovery_codes.txt` 为 5 行 2FA 恢复码，**不能用于发布**
   - `~/.finch`、`~/.finchnest`、`~/finchnest`、Downloads 均未发现可用的 npm 发布令牌

**结论**：npm 1.0.3 发布被凭据阻断，需要以下任一条件：
- (a) 一个新的 npm 令牌（Automation / Granular access token，具备 `finch-web-assistant` 写权限）；或
- (b) 在 npmjs.com 为仓库 `BlessedChild/finch-web-assistant` + workflow `publish.yml` 配置 Trusted Publisher

## 四、后续动作

1. 拿到新令牌后：本地 `npm publish --access public` 或重跑 `publish.yml`
2. 验证：`npm view finch-web-assistant version` == `1.0.3`
3. 在 Issue #65 回帖请求复审（草稿见下）

### #65 回帖草稿

```
Thanks for the review — both points are addressed in v1.0.3 (commit ec2d408):

1. Kimi dependency is now explicit everywhere user-facing: npm description, README intro/installation,
   `finch.name` / `finch.description`, English + Simplified Chinese in-app copy (onboarding, status,
   toasts, menu), and the bundled skill. Copy now states that installing the mini tool installs/starts
   the local Kimi WebBridge component and requires the Kimi WebBridge Chrome extension, and that the
   tool only talks to 127.0.0.1:10086.

2. Tool surface collapsed from 17 tools to one `kimi_webbridge_browser` tool with a required `action`
   enum (navigate | find_tab | snapshot | click | fill | evaluate | cdp | screenshot | network | upload |
   save_pdf | list_tabs | close_tab | close_session). Lifecycle operations (check status / start daemon /
   install bridge) are no longer model-callable; they are UI-driven via the Composer menu, the onboarding
   dialog, and a single automatic recovery attempt inside the browser tool.

Validation: `npm run check`, `npm run build`, `npx @finchtoys/minitools doctor .`, and `npm pack --dry-run`
all pass locally.
```

## 五、产物清单（本地）

- 变更方案：`web-assistant-1.0.3-change-plan.md`
- 补丁片段：`work/patches/v103-browser-consts.ts`、`work/patches/v103-browser-tool.ts`、`work/patches/apply_v103.py`
- 本报告：仓库 `reports/2026-09-19-kimi-branding-and-tool-collapse.md`，另有工作区根目录副本 `web-assistant-1.0.3-implementation-report.md`
- 代码：`work/finch-web-assistant`（main @ ec2d408）

## 六、发布与复审（2026-09-19 03:12 UTC 更新）

发布通道已打通，1.0.3 已上线：

1. 在 npmjs.com 为包 `finch-web-assistant` 配置 **Trusted Publisher**（GitHub Actions）：
   - Organization or user：`BlessedChild`
   - Repository：`finch-web-assistant`
   - Workflow filename：`publish.yml`
   - Environment name：留空
   - Permissions：**npm publish**（表单默认未勾选 Allow npm publish，已手动勾选）
   - 页面确认："Successfully added new Trusted Publisher connection."
2. 触发 `Publish to npm` workflow（workflow_dispatch, ref `main`）：run `35417826009` ✅ 成功（publish job 21s），`npm publish --access public --provenance` 通过 OIDC 完成。
3. registry 验证：
   - `dist-tags.latest = 1.0.3`；`versions = [1.0.1, 1.0.2, 1.0.3]`；`time["1.0.3"] = 2026-09-19T03:12:21.680Z`
   - `description = "Kimi-powered browser tool: let Finch operate websites in your Chrome browser through Kimi WebBridge."`
   - `finch.name = "Kimi Web Assistant"`；`finch.description` 说明安装会安装/启动本地 Kimi WebBridge 组件、需要 Kimi WebBridge Chrome 扩展、仅与本机 `127.0.0.1:10086` 通信
   - `dist.attestations` 存在（provenance 已生成）
4. 已在 Issue #65 回帖请求复审：comment `5738905983`（作者 BlessedChild，2026-09-19T03:12:56Z），issue 仍为 OPEN，等待官方合并条目 `kimi-webbridge` 到社区目录。

回帖文本存档：工作区 `issue-65-review-followup.md`
