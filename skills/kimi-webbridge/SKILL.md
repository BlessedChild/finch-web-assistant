---
name: kimi-webbridge
description: Use the user's real Chrome session for website navigation, clicking, filling, reading, screenshots, PDF downloads, and browser automation. Trigger when the user mentions a browser, website, URL, signed-in page, or web automation.
metadata:
  version: "1.11.3-finch.6"
---

# Web Assistant

Use the user's real Chrome session to operate websites. Internally, Kimi WebBridge connects the `kimi_webbridge_*` tools to the local service at `127.0.0.1:10086`; ordinary users do not need these implementation details.

## Required rules

- Choose one short English `session` name per task and reuse it for every call, even when the website changes.
- On the first `navigate` call, use `newTab:true` and provide a `group_title` in the user's language. Tell the user the pages are grouped and can be closed on request.
- Operate only tabs created by the current session by default. Use `find_tab(active:true)` only when the user explicitly asks to use the page they are currently viewing.
- Call `snapshot` first. Prefer stable `@e` references for `click` and `fill`; use `evaluate` only when references are insufficient, and use `cdp` only as a final escape hatch.
- Wrap `evaluate` code in an IIFE and return compact JSON. Do not use `JSON.stringify(data, null, 2)`.
- `fill` clears and replaces the current value. Submit forms by clicking the submit button; do not assume an Enter-key tool exists.
- Screenshot tools return a local file path. Use Finch Read to inspect the image afterward.
- Close tabs or sessions only when the user explicitly asks. Never automatically stop, restart, uninstall, or upgrade the daemon.
- If the connection fails, the browser tool attempts one idempotent start and retry. If recovery still fails, open or provide https://www.kimi.com/zh-cn/features/webbridge.
- If the page reports "Please update the Kimi WebBridge extension," ask the user to update it. Do not coordinate versions automatically.
- Obtain user confirmation before the final click for actions with external impact, including sending, publishing, paying, or deleting.

## Known limitations

- CAPTCHAs, banking websites, and interactions that strictly check `event.isTrusted` may require manual input.
- Tools operate on the top-level frame by default. Navigate directly to a cross-origin iframe URL when necessary.
- WebBridge uses the real browser rather than a headless environment, so tab and page changes are visible to the user.
