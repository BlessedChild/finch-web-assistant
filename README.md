# Kimi Web Assistant

**Kimi Web Assistant is a community mini tool that lets Finch drive the websites in your Chrome browser. It is powered by Kimi WebBridge — Kimi's browser-automation component.**

Adding this mini tool to Finch does two things on your machine:

1. It installs or starts the local **Kimi WebBridge** component (a local bridge service bound to `127.0.0.1:10086`).
2. It opens the Chrome Web Store so you can add the **Kimi WebBridge Chrome extension** with one confirmation click.

After that, browser operations run in your real, already signed-in Chrome session.

> This is a community mini tool, built by a third-party author — not an official Kimi product. Kimi, Chrome, and related trademarks belong to their respective owners.

You can ask Finch to:

- "Open this website and find the registration link."
- "Fill in this form, but ask me before submitting."
- "Capture a screenshot of this webpage."
- "Save this page as a PDF."

## Installation

Install `finch-web-assistant` with Finch's mini tool manager after it is published to npm. Once approved for the community catalog, it can also be discovered and installed directly from Finch Toolbox.

## First-time connection

1. Install and enable **Kimi Web Assistant** in Finch.
2. Choose **Connect Chrome** in the onboarding prompt — this installs or starts the local **Kimi WebBridge** component.
3. Confirm **Add extension** for **Kimi WebBridge** in the Chrome Web Store page that opens automatically.

Kimi Web Assistant completes the remaining setup automatically. Users do not need to open a terminal, copy commands, or understand the local service.

If you choose **Not Now**, use the Kimi Web Assistant button near the Composer at any time to:

- Check Connection
- Connect Chrome
- Open Help

## Connection states

- **Connected**: browser operations are ready.
- **Waiting**: confirm that the Kimi WebBridge browser extension is installed and enabled.
- **Reconnect**: select the browser connection action to recover automatically.
- **Offline**: choose Connect Chrome to complete setup.

## Safety boundaries

- Kimi Web Assistant operates only tabs created for the current task by default.
- It uses the tab you are currently viewing or closes tabs only when you explicitly ask.
- Final actions with external impact—such as sending, publishing, paying, deleting, or submitting forms—still require your confirmation.
- CAPTCHAs, banking websites, and interactions with strict trusted-event checks may require manual input.
- Operations happen in your real Chrome browser and reuse its existing signed-in state, so page and tab changes remain visible.

## Technical details

Kimi WebBridge provides browser connectivity and runs only on the local machine:

- The local service is fixed at `http://127.0.0.1:10086` and is not exposed to the LAN.
- The local daemon and the Kimi WebBridge Chrome extension must use compatible versions.
- Kimi Web Assistant never runs `stop`, `restart`, `uninstall`, or forced upgrades automatically.
- When the connection fails, it safely attempts to start the local Kimi WebBridge service once. If recovery fails, it provides the official help page.
- Official installation sources:
  - Windows: `https://cdn.kimi.com/webbridge/install.ps1`
  - macOS / Linux: `https://cdn.kimi.com/webbridge/install.sh`
  - Help: <https://www.kimi.com/zh-cn/features/webbridge>

The internal `kimi-webbridge` ID, the Composer action ID, and the npm package name `finch-web-assistant` remain unchanged for compatibility.

## Privacy and permissions

- No API key is required, and Kimi Web Assistant does not store website credentials.
- `network` accesses the local Kimi WebBridge service and official Kimi installation sources.
- `shell` installs or starts the local component and opens browser help or extension pages.
- Browser operations reuse the existing browser session. Verify the page and target account before sensitive actions.

## Tool surface

Kimi Web Assistant registers **one** Agent tool, `kimi_webbridge_browser`, whose `action` parameter selects the capability:

`navigate | find_tab | snapshot | click | fill | evaluate | cdp | screenshot | network | upload | save_pdf | list_tabs | close_tab | close_session`

Connection status, starting the local component, and installing it are **not** model-callable tools. They run from the Composer menu ("Check Connection" / "Connect Chrome"), the onboarding dialog, and a single automatic recovery attempt inside the browser tool when a call fails.

## Development

```bash
npm install
npm run check
npm run build
npx @finchtoys/minitools doctor .
```
