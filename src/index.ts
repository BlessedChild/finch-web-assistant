// @ts-nocheck — recovered from the verified 0.3.0 runtime bundle after local source loss.
import { execFile } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const BASE_URL = 'http://127.0.0.1:10086';
const HELP_URL = 'https://www.kimi.com/zh-cn/features/webbridge';
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/kimi-webbridge/fldmhceldgbpfpkbgopacenieobmligc';
const ONBOARDING_KEY = 'onboardingPrompted.0.2';
const BINARY = platform() === 'win32'
    ? join(homedir(), '.kimi-webbridge', 'bin', 'kimi-webbridge.exe')
    : join(homedir(), '.kimi-webbridge', 'bin', 'kimi-webbridge');
function result(value, isError = false) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return { content: [{ type: 'text', text }], isError };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function requestJson(path, init, signal) {
    const timeout = AbortSignal.timeout(30_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetch(`${BASE_URL}${path}`, { ...init, signal: combined });
    const text = await response.text();
    let body = text;
    try {
        body = text ? JSON.parse(text) : {};
    }
    catch { /* keep text */ }
    if (!response.ok)
        throw new Error(`Web Assistant connection failed (HTTP ${response.status}): ${text}`);
    return body;
}
async function getStatus(signal) {
    return await requestJson('/status', undefined, signal);
}
async function runBinary(args) {
    const { stdout, stderr } = await execFileAsync(BINARY, args, {
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join('\n').trim();
}
async function startDaemon() {
    await runBinary(['start']);
}
async function callBridge(action, input, exec) {
    const session = typeof input.session === 'string' && input.session.trim()
        ? input.session.trim()
        : `finch-${exec.sessionId.slice(0, 12)}`;
    const args = { ...input };
    delete args.session;
    if (action === 'upload' && (!Array.isArray(args.files) || args.files.length === 0)) {
        return result({ error: 'files must contain at least one local file path.' }, true);
    }
    const post = () => requestJson('/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, args, session }),
    }, exec.signal);
    try {
        return result(await post());
    }
    catch (firstError) {
        const message = errorMessage(firstError);
        const unreachable = /fetch failed|ECONNREFUSED|connection refused|Could not connect/i.test(message);
        if (!unreachable)
            return result({ error: message, help: HELP_URL }, true);
        try {
            await startDaemon();
            return result(await post());
        }
        catch (retryError) {
            return result({
                error: errorMessage(retryError),
                recovery: 'The local connection recovery attempt failed. Make sure the browser extension is installed and enabled.',
                help: HELP_URL,
            }, true);
        }
    }
}
const sessionProperty = {
    type: 'string',
    description: 'A short English session name reused throughout this browser task. Do not switch sessions mid-task.',
    minLength: 1,
};
function commandTool(ctx, name, title, description, action, properties, required = [], risk = 'high') {
    return ctx.tools.register({
        name,
        title,
        description,
        defaultEnabled: true,
        risk,
        inputSchema: {
            type: 'object',
            properties: { session: sessionProperty, ...properties },
            required: ['session', ...required],
            additionalProperties: false,
        },
        callDisplay: { inline: { mode: 'join', fields: [
                    { path: 'session', label: 'session', format: 'truncate', maxLength: 24 },
                    { path: 'url', format: 'truncate', maxLength: 60 },
                    { path: 'selector', format: 'truncate', maxLength: 36 },
                ] } },
        async execute(input, exec) { return await callBridge(action, input, exec); },
    });
}
async function installBridge() {
    if (platform() === 'win32') {
        const script = 'irm https://cdn.kimi.com/webbridge/install.ps1 | iex';
        const { stdout, stderr } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
            timeout: 180_000,
            maxBuffer: 8 * 1024 * 1024,
        });
        return [stdout, stderr].filter(Boolean).join('\n').trim();
    }
    const script = 'curl -fsSL https://cdn.kimi.com/webbridge/install.sh | bash';
    const { stdout, stderr } = await execFileAsync('/bin/bash', ['-lc', script], {
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join('\n').trim();
}
async function openUrl(url, useChrome = false) {
    if (platform() === 'win32') {
        await execFileAsync('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', url], { timeout: 30_000 });
        return;
    }
    if (platform() === 'darwin') {
        const args = useChrome ? ['-a', 'Google Chrome', url] : [url];
        try {
            await execFileAsync('/usr/bin/open', args, { timeout: 30_000 });
        }
        catch {
            await execFileAsync('/usr/bin/open', [url], { timeout: 30_000 });
        }
        return;
    }
    await execFileAsync('xdg-open', [url], { timeout: 30_000 });
}
async function openExtensionStore() {
    await openUrl(CHROME_STORE_URL, true);
}
async function ensureDaemon() {
    try {
        const status = await getStatus();
        return { installed: false, status };
    }
    catch {
        try {
            await startDaemon();
            return { installed: false, status: await getStatus() };
        }
        catch {
            const output = await installBridge();
            return { installed: true, output, status: await getStatus() };
        }
    }
}
async function waitForExtension(timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    let last = {};
    while (Date.now() < deadline) {
        try {
            last = await getStatus();
            if (last.running && last.extension_connected)
                return last;
        }
        catch { /* keep waiting */ }
        await new Promise(resolve => setTimeout(resolve, 3_000));
    }
    return last;
}
async function setupBridge() {
    const daemon = await ensureDaemon();
    if (daemon.status.running && daemon.status.extension_connected) {
        return { ...daemon, storeOpened: false };
    }
    await openExtensionStore();
    const status = await waitForExtension();
    return { ...daemon, status, storeOpened: true };
}
export function activate(ctx) {
    const tools = [];
    tools.push(ctx.tools.register({
        name: 'kimi_webbridge_check_status',
        title: 'Check Web Assistant',
        description: 'Check Web Assistant, the local connection, and the browser extension. Use after initial setup or when browser operations fail. Read-only.',
        defaultEnabled: true,
        risk: 'low',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async execute(_input, exec) {
            try {
                const status = await getStatus(exec.signal);
                return result({ ...status, ready: status.running === true && status.extension_connected === true, help: HELP_URL });
            }
            catch (error) {
                return result({ running: false, extension_connected: false, error: errorMessage(error), help: HELP_URL }, true);
            }
        },
    }));
    tools.push(ctx.tools.register({
        name: 'kimi_webbridge_start_daemon',
        title: 'Recover Web Assistant Connection',
        description: 'Safely attempt to recover Web Assistant only when the local connection fails, then check status. Never use this tool to restart or stop the service.',
        defaultEnabled: true,
        risk: 'high',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async execute() {
            try {
                await startDaemon();
                return result(await getStatus());
            }
            catch (error) {
                return result({ error: errorMessage(error), help: HELP_URL }, true);
            }
        },
    }));
    tools.push(ctx.tools.register({
        name: 'kimi_webbridge_install_bridge',
        title: 'Connect Web Assistant',
        description: 'When the user explicitly asks to connect Web Assistant, check and configure the local component, open the Chrome Web Store, and wait for the connection. The user only needs to confirm extension installation. Downloads and executes code from official Kimi sources.',
        defaultEnabled: true,
        risk: 'high',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async execute() {
            try {
                const setup = await setupBridge();
                const ready = setup.status.running === true && setup.status.extension_connected === true;
                return result({
                    installed: setup.installed,
                    store_opened: setup.storeOpened,
                    ready,
                    status: setup.status,
                    output: setup.output?.slice(-4000),
                    next_step: ready ? 'Web Assistant is connected and ready for browser operations.' : 'The browser store is open. Click Add extension, and Web Assistant will finish connecting automatically.',
                    help: HELP_URL,
                }, !setup.status.running);
            }
            catch (error) {
                return result({ installed: false, ready: false, error: errorMessage(error), help: HELP_URL }, true);
            }
        },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_navigate', 'Open Website', 'Navigate in the real Chrome browser. On the first call for a task, use newTab:true and provide a localized group_title. Reuse the same session throughout the task.', 'navigate', {
        url: { type: 'string', description: 'A complete http or https URL.', minLength: 1 },
        newTab: { type: 'boolean', description: 'Whether to open a new tab. Usually true for the first page in a task.' },
        group_title: { type: 'string', description: 'A user-facing tab group title for the task.' },
    }, ['url']));
    tools.push(commandTool(ctx, 'kimi_webbridge_find_tab', 'Select Browser Tab', 'Select a tab opened by this session. Set active:true only when the user explicitly asks to use the tab they are currently viewing.', 'find_tab', {
        url: { type: 'string', description: 'Prefer a complete URL returned by list_tabs.' },
        active: { type: 'boolean', description: 'When true, use the tab the user is currently viewing. Requires explicit user authorization.' },
    }, ['url']));
    tools.push(commandTool(ctx, 'kimi_webbridge_snapshot_page', 'Read Page Structure', 'Read the current page accessibility tree and return @e element references. Prefer this tool for page reading and interaction targeting.', 'snapshot', {}, [], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_click_element', 'Click Page Element', 'Click an element on the current page. Prefer an @e reference returned by snapshot. This performs a synthetic DOM click.', 'click', {
        selector: { type: 'string', description: 'An @e reference from snapshot or a CSS selector.' },
    }, ['selector']));
    tools.push(commandTool(ctx, 'kimi_webbridge_fill_element', 'Fill Page Element', 'Clear and replace the content of an input, textarea, or contenteditable element, then dispatch input events.', 'fill', {
        selector: { type: 'string', description: 'An @e reference from snapshot or a CSS selector.' },
        value: { type: 'string', description: 'The complete replacement value.' },
    }, ['selector', 'value']));
    tools.push(commandTool(ctx, 'kimi_webbridge_evaluate_script', 'Run Page JavaScript', 'Run JavaScript on the current page only when snapshot and @e references are insufficient. Use an IIFE and return compact data.', 'evaluate', {
        code: { type: 'string', description: 'JavaScript with async/await support. Prefer an IIFE.' },
    }, ['code']));
    tools.push(commandTool(ctx, 'kimi_webbridge_call_cdp', 'Call Chrome CDP', 'Low-level Chrome DevTools Protocol escape hatch. Use only when standard tools and evaluate cannot complete the task.', 'cdp', {
        method: { type: 'string', description: 'A CDP method such as Page.captureScreenshot.' },
        params: { type: 'object', description: 'CDP parameters.' },
    }, ['method']));
    tools.push(commandTool(ctx, 'kimi_webbridge_capture_screenshot', 'Capture Webpage Screenshot', 'Capture the visible page or a selected element and return a local file path. Use Read to inspect the image afterward.', 'screenshot', {
        format: { type: 'string', enum: ['png', 'jpeg'] },
        quality: { type: 'integer', minimum: 0, maximum: 100 },
        selector: { type: 'string', description: 'Optional @e reference or CSS selector for an element-only capture.' },
        path: { type: 'string', description: 'Optional unique output path. Existing files are overwritten.' },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_inspect_network', 'Inspect Page Network', 'Start, stop, list, or inspect network requests for the current page.', 'network', {
        cmd: { type: 'string', enum: ['start', 'stop', 'list', 'detail'] },
        filter: { type: 'string', description: 'Optional request filter.' },
        requestId: { type: 'string', description: 'Request ID used with the detail command.' },
    }, ['cmd'], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_upload_files', 'Upload Files to Page', 'Set local files on a file input in the current page. The files must be local paths the user has authorized.', 'upload', {
        selector: { type: 'string', description: 'An @e reference or CSS selector for the file input.' },
        files: { type: 'array', items: { type: 'string' }, description: 'At least one absolute local file path.' },
    }, ['selector', 'files']));
    tools.push(commandTool(ctx, 'kimi_webbridge_save_page_pdf', 'Save Page as PDF', 'Print the current page to PDF and return the local file path.', 'save_as_pdf', {
        paper_format: { type: 'string', enum: ['letter', 'a4', 'legal', 'a3', 'tabloid'] },
        landscape: { type: 'boolean' },
        scale: { type: 'number', minimum: 0.1, maximum: 2 },
        print_background: { type: 'boolean' },
        path: { type: 'string', description: 'Optional unique output path. Existing files are overwritten.' },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_list_session_tabs', 'List Task Tabs', 'List the tabs managed by this session, including URLs, titles, and active state.', 'list_tabs', {}, [], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_close_current_tab', 'Close Current Task Tab', 'Close the current tab for this session only when the user explicitly asks.', 'close_tab', {}));
    tools.push(commandTool(ctx, 'kimi_webbridge_close_task_session', 'Close Task Tab Group', 'Close all tabs created by this session only when the user explicitly asks to close or clean up the task pages.', 'close_session', {}));
    ctx.subscriptions.push(...tools);
    let lastBadge = '';
    const statusAction = ctx.composerActions.register('kimi-webbridge-status', {
        async getBadge() {
            try {
                const status = await getStatus();
                if (status.running && status.extension_connected)
                    return { text: 'Connected', active: true };
                if (status.running)
                    return 'Waiting';
                return 'Reconnect';
            }
            catch {
                return 'Offline';
            }
        },
        async getIcon() {
            try {
                const status = await getStatus();
                return status.running && status.extension_connected ? 'globe' : 'puzzle';
            }
            catch {
                return 'puzzle';
            }
        },
        async getMenu() {
            let description = 'Browser not connected';
            try {
                const status = await getStatus();
                description = status.running
                    ? (status.extension_connected ? 'Browser connected' : 'Waiting for browser connection')
                    : 'Connection recovery required';
            }
            catch { /* default */ }
            return [
                { id: 'check', label: 'Check Connection', description, iconName: 'check' },
                { id: 'setup-chrome', label: 'Connect Chrome', description: 'Automatic setup; you only confirm extension installation', iconName: 'zap' },
                { id: 'help', label: 'Help', description: 'Open the official Web Assistant help page', iconName: 'puzzle' },
            ];
        },
        async execute(_actionCtx, itemId) {
            if (itemId === 'check') {
                try {
                    const status = await getStatus();
                    await ctx.ui.showToast({
                        title: status.running && status.extension_connected ? 'Browser Connected' : 'Browser Not Connected',
                        description: status.extension_connected ? 'Web Assistant is ready to use' : 'Choose a browser and confirm extension installation',
                        variant: status.running && status.extension_connected ? 'success' : 'warning',
                    });
                }
                catch {
                    await ctx.ui.showToast({ title: 'Chrome Not Connected', description: 'Choose Connect Chrome and confirm extension installation', variant: 'warning' });
                }
            }
            if (itemId === 'setup-chrome') {
                await ctx.ui.showToast({ title: 'Connecting Browser', description: 'Web Assistant is completing the setup. Please wait.', variant: 'info' });
                try {
                    const setup = await setupBridge();
                    const ready = setup.status.running && setup.status.extension_connected;
                    await ctx.ui.showToast({
                        title: ready ? 'Browser Connected' : 'Confirm Extension Installation',
                        description: ready ? 'Finch can now operate websites in your browser' : 'Web Assistant will connect automatically after you confirm installation',
                        variant: ready ? 'success' : 'info',
                    });
                }
                catch (error) {
                    await ctx.ui.showToast({ title: 'Automatic Setup Incomplete', description: errorMessage(error), variant: 'error' });
                }
                statusAction.notifyUpdate();
            }
            if (itemId === 'help')
                await openUrl(HELP_URL);
        },
    });
    ctx.subscriptions.push(statusAction);
    const timer = setInterval(async () => {
        let badge = 'offline';
        try {
            const status = await getStatus();
            badge = `${status.running}:${status.extension_connected}:${status.version}`;
        }
        catch { /* offline */ }
        if (badge !== lastBadge) {
            lastBadge = badge;
            statusAction.notifyUpdate();
        }
    }, 10_000);
    ctx.subscriptions.push({ dispose: () => clearInterval(timer) });
    const onboardingTimer = setTimeout(async () => {
        try {
            const status = await getStatus();
            if (status.running && status.extension_connected)
                return;
        }
        catch { /* continue to onboarding */ }
        if (await ctx.storage.get(ONBOARDING_KEY))
            return;
        await ctx.storage.set(ONBOARDING_KEY, true);
        const choice = await ctx.ui.showModalDialog({
            title: 'Connect Your Browser',
            description: 'Once connected, Finch can operate websites on your behalf',
            message: 'Web Assistant will configure Chrome automatically.\n\nYou only need to confirm extension installation in the browser.',
            actions: [
                { id: 'chrome', label: 'Connect Chrome', variant: 'primary' },
                { id: 'later', label: 'Not Now', variant: 'secondary' },
            ],
        });
        if (choice.action !== 'chrome')
            return;
        await ctx.ui.showToast({ title: 'Connecting Browser', description: 'Web Assistant is completing the setup. Please wait.', variant: 'info' });
        try {
            const setup = await setupBridge();
            const ready = setup.status.running && setup.status.extension_connected;
            await ctx.ui.showToast({
                title: ready ? 'Browser Connected' : 'Confirm Extension Installation',
                description: ready ? 'Finch can now operate websites in your browser' : 'Web Assistant will connect automatically after you confirm installation',
                variant: ready ? 'success' : 'info',
            });
            statusAction.notifyUpdate();
        }
        catch (error) {
            await ctx.ui.showToast({ title: 'Automatic Setup Incomplete', description: errorMessage(error), variant: 'error' });
        }
    }, 1_500);
    ctx.subscriptions.push({ dispose: () => clearTimeout(onboardingTimer) });
    ctx.logger.info('Finch Web Assistant mini tool activated');
}
export function deactivate() { }
//# sourceMappingURL=index.js.map