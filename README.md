# Web Assistant

![Web Assistant icon](./icon.png)

Let Finch operate websites in your Chrome browser.

> This is a community mini tool, not an official Kimi product. Browser connectivity is provided by Kimi WebBridge. Kimi, Chrome, and related trademarks belong to their respective owners.

You can ask Finch to:

- "Open this website and find the registration link."
- "Fill in this form, but ask me before submitting."
- "Capture a screenshot of this webpage."
- "Save this page as a PDF."

## Installation

Install `finch-web-assistant` with Finch's mini tool manager after it is published to npm. Once approved for the community catalog, it can also be discovered and installed directly from Finch Toolcase.

## First-time connection

1. Install and enable **Web Assistant** in Finch.
2. Choose **Connect Chrome** in the onboarding prompt.
3. Confirm **Add extension** in the Chrome Web Store page that opens automatically.

Web Assistant completes the remaining setup automatically. Users do not need to open a terminal, copy commands, or understand the local service.

If you choose **Not Now**, use the Web Assistant button near the Composer at any time to:

- Check Connection
- Connect Chrome
- Open Help

## Connection states

- **Connected**: browser operations are ready.
- **Waiting**: confirm that the browser extension is installed and enabled.
- **Reconnect**: select the browser connection action to recover automatically.
- **Offline**: choose Connect Chrome to complete setup.

## Safety boundaries

- Web Assistant operates only tabs created for the current task by default.
- It uses the tab you are currently viewing or closes tabs only when you explicitly ask.
- Final actions with external impact—such as sending, publishing, paying, deleting, or submitting forms—still require your confirmation.
- CAPTCHAs, banking websites, and interactions with strict trusted-event checks may require manual input.
- Operations happen in your real Chrome browser and reuse its existing signed-in state, so page and tab changes remain visible.

## Technical details

Kimi WebBridge provides browser connectivity and runs only on the local machine:

- The local service is fixed at `http://127.0.0.1:10086` and is not exposed to the LAN.
- The local daemon and Chrome extension must use compatible versions.
- Web Assistant never runs `stop`, `restart`, `uninstall`, or forced upgrades automatically.
- When the connection fails, it safely attempts to start the service once. If recovery fails, it provides the official help page.
- Official installation sources:
  - Windows: `https://cdn.kimi.com/webbridge/install.ps1`
  - macOS / Linux: `https://cdn.kimi.com/webbridge/install.sh`
  - Help: <https://www.kimi.com/zh-cn/features/webbridge>

The internal `kimi-webbridge` ID, Composer action ID, and `kimi_webbridge_*` Agent tool names remain unchanged for compatibility. The npm package name is `finch-web-assistant`.

## Privacy and permissions

- No API key is required, and Web Assistant does not store website credentials.
- `network` accesses the local WebBridge service and official Kimi installation sources.
- `shell` installs or starts the local component and opens browser help or extension pages.
- Browser operations reuse the existing browser session. Verify the page and target account before sensitive actions.

## Development

```bash
npm install
npm run check
npm run build
npx @finchtoys/minitools doctor .
```

## Internal capabilities

Web Assistant provides atomic tools for connection recovery, navigation, tab selection, page reading, clicking, filling, JavaScript, CDP, screenshots, network inspection, file uploads, PDF export, and tab management. Users do not need to select these tools manually; Finch chooses them from natural-language requests.
