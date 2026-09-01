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
async function callBridge(action, input, exec, t) {
    const session = typeof input.session === 'string' && input.session.trim()
        ? input.session.trim()
        : `finch-${exec.sessionId.slice(0, 12)}`;
    const args = { ...input };
    delete args.session;
    if (action === 'upload' && (!Array.isArray(args.files) || args.files.length === 0)) {
        return result({ error: t('runtime.filesRequired') }, true);
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
                recovery: t('runtime.recoveryFailed'),
                help: HELP_URL,
            }, true);
        }
    }
}
function commandTool(ctx, name, title, description, action, properties, required = [], risk = 'high') {
    const t = ctx.i18n.t.bind(ctx.i18n);
    const sessionProperty = {
        type: 'string',
        description: t('tools.inputs.session'),
        minLength: 1,
    };
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
        async execute(input, exec) { return await callBridge(action, input, exec, t); },
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
    const t = ctx.i18n.t.bind(ctx.i18n);
    const tools = [];
    tools.push(ctx.tools.register({
        name: 'kimi_webbridge_check_status',
        title: t('tools.checkStatus.title'),
        description: t('tools.checkStatus.description'),
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
        title: t('tools.startDaemon.title'),
        description: t('tools.startDaemon.description'),
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
        title: t('tools.installBridge.title'),
        description: t('tools.installBridge.description'),
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
                    next_step: ready ? t('runtime.installReady') : t('runtime.installNextStep'),
                    help: HELP_URL,
                }, !setup.status.running);
            }
            catch (error) {
                return result({ installed: false, ready: false, error: errorMessage(error), help: HELP_URL }, true);
            }
        },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_navigate', t('tools.navigate.title'), t('tools.navigate.description'), 'navigate', {
        url: { type: 'string', description: t('tools.inputs.url'), minLength: 1 },
        newTab: { type: 'boolean', description: t('tools.inputs.newTab') },
        group_title: { type: 'string', description: t('tools.inputs.groupTitle') },
    }, ['url']));
    tools.push(commandTool(ctx, 'kimi_webbridge_find_tab', t('tools.findTab.title'), t('tools.findTab.description'), 'find_tab', {
        url: { type: 'string', description: t('tools.inputs.managedUrl') },
        active: { type: 'boolean', description: t('tools.inputs.activeTab') },
    }, ['url']));
    tools.push(commandTool(ctx, 'kimi_webbridge_snapshot_page', t('tools.snapshot.title'), t('tools.snapshot.description'), 'snapshot', {}, [], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_click_element', t('tools.click.title'), t('tools.click.description'), 'click', {
        selector: { type: 'string', description: t('tools.inputs.selector') },
    }, ['selector']));
    tools.push(commandTool(ctx, 'kimi_webbridge_fill_element', t('tools.fill.title'), t('tools.fill.description'), 'fill', {
        selector: { type: 'string', description: t('tools.inputs.selector') },
        value: { type: 'string', description: t('tools.inputs.value') },
    }, ['selector', 'value']));
    tools.push(commandTool(ctx, 'kimi_webbridge_evaluate_script', t('tools.evaluate.title'), t('tools.evaluate.description'), 'evaluate', {
        code: { type: 'string', description: t('tools.inputs.code') },
    }, ['code']));
    tools.push(commandTool(ctx, 'kimi_webbridge_call_cdp', t('tools.cdp.title'), t('tools.cdp.description'), 'cdp', {
        method: { type: 'string', description: t('tools.inputs.cdpMethod') },
        params: { type: 'object', description: t('tools.inputs.cdpParams') },
    }, ['method']));
    tools.push(commandTool(ctx, 'kimi_webbridge_capture_screenshot', t('tools.screenshot.title'), t('tools.screenshot.description'), 'screenshot', {
        format: { type: 'string', enum: ['png', 'jpeg'] },
        quality: { type: 'integer', minimum: 0, maximum: 100 },
        selector: { type: 'string', description: t('tools.inputs.optionalSelector') },
        path: { type: 'string', description: t('tools.inputs.outputPath') },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_inspect_network', t('tools.network.title'), t('tools.network.description'), 'network', {
        cmd: { type: 'string', enum: ['start', 'stop', 'list', 'detail'] },
        filter: { type: 'string', description: t('tools.inputs.networkFilter') },
        requestId: { type: 'string', description: t('tools.inputs.requestId') },
    }, ['cmd'], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_upload_files', t('tools.upload.title'), t('tools.upload.description'), 'upload', {
        selector: { type: 'string', description: t('tools.inputs.fileSelector') },
        files: { type: 'array', items: { type: 'string' }, description: t('tools.inputs.files') },
    }, ['selector', 'files']));
    tools.push(commandTool(ctx, 'kimi_webbridge_save_page_pdf', t('tools.savePdf.title'), t('tools.savePdf.description'), 'save_as_pdf', {
        paper_format: { type: 'string', enum: ['letter', 'a4', 'legal', 'a3', 'tabloid'] },
        landscape: { type: 'boolean' },
        scale: { type: 'number', minimum: 0.1, maximum: 2 },
        print_background: { type: 'boolean' },
        path: { type: 'string', description: t('tools.inputs.outputPath') },
    }));
    tools.push(commandTool(ctx, 'kimi_webbridge_list_session_tabs', t('tools.listTabs.title'), t('tools.listTabs.description'), 'list_tabs', {}, [], 'low'));
    tools.push(commandTool(ctx, 'kimi_webbridge_close_current_tab', t('tools.closeTab.title'), t('tools.closeTab.description'), 'close_tab', {}));
    tools.push(commandTool(ctx, 'kimi_webbridge_close_task_session', t('tools.closeSession.title'), t('tools.closeSession.description'), 'close_session', {}));
    ctx.subscriptions.push(...tools);
    let lastBadge = '';
    const statusAction = ctx.composerActions.register('kimi-webbridge-status', {
        async getBadge() {
            try {
                const status = await getStatus();
                if (status.running && status.extension_connected)
                    return { text: t('runtime.status.connected'), active: true };
                if (status.running)
                    return t('runtime.status.waiting');
                return t('runtime.status.reconnect');
            }
            catch {
                return t('runtime.status.offline');
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
            let description = t('runtime.menu.browserNotConnected');
            try {
                const status = await getStatus();
                description = status.running
                    ? (status.extension_connected ? t('runtime.menu.browserConnected') : t('runtime.menu.waitingForBrowser'))
                    : t('runtime.menu.recoveryRequired');
            }
            catch { /* default */ }
            return [
                { id: 'check', label: t('runtime.menu.checkConnection'), description, iconName: 'check' },
                { id: 'setup-chrome', label: t('runtime.menu.connectChrome'), description: t('runtime.menu.setupDescription'), iconName: 'zap' },
                { id: 'help', label: t('runtime.menu.help'), description: t('runtime.menu.helpDescription'), iconName: 'puzzle' },
            ];
        },
        async execute(_actionCtx, itemId) {
            if (itemId === 'check') {
                try {
                    const status = await getStatus();
                    await ctx.ui.showToast({
                        title: status.running && status.extension_connected ? t('runtime.toast.browserConnected') : t('runtime.toast.browserNotConnected'),
                        description: status.extension_connected ? t('runtime.toast.ready') : t('runtime.toast.chooseBrowser'),
                        variant: status.running && status.extension_connected ? 'success' : 'warning',
                    });
                }
                catch {
                    await ctx.ui.showToast({ title: t('runtime.toast.chromeNotConnected'), description: t('runtime.toast.chooseConnectChrome'), variant: 'warning' });
                }
            }
            if (itemId === 'setup-chrome') {
                await ctx.ui.showToast({ title: t('runtime.toast.connectingBrowser'), description: t('runtime.toast.setupInProgress'), variant: 'info' });
                try {
                    const setup = await setupBridge();
                    const ready = setup.status.running && setup.status.extension_connected;
                    await ctx.ui.showToast({
                        title: ready ? t('runtime.toast.browserConnected') : t('runtime.toast.confirmExtension'),
                        description: ready ? t('runtime.toast.readyToOperate') : t('runtime.toast.connectAfterConfirmation'),
                        variant: ready ? 'success' : 'info',
                    });
                }
                catch (error) {
                    await ctx.ui.showToast({ title: t('runtime.toast.setupIncomplete'), description: errorMessage(error), variant: 'error' });
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
            title: t('runtime.onboarding.title'),
            description: t('runtime.onboarding.description'),
            message: t('runtime.onboarding.message'),
            actions: [
                { id: 'chrome', label: t('runtime.onboarding.connectChrome'), variant: 'primary' },
                { id: 'later', label: t('runtime.onboarding.notNow'), variant: 'secondary' },
            ],
        });
        if (choice.action !== 'chrome')
            return;
        await ctx.ui.showToast({ title: t('runtime.toast.connectingBrowser'), description: t('runtime.toast.setupInProgress'), variant: 'info' });
        try {
            const setup = await setupBridge();
            const ready = setup.status.running && setup.status.extension_connected;
            await ctx.ui.showToast({
                title: ready ? t('runtime.toast.browserConnected') : t('runtime.toast.confirmExtension'),
                description: ready ? t('runtime.toast.readyToOperate') : t('runtime.toast.connectAfterConfirmation'),
                variant: ready ? 'success' : 'info',
            });
            statusAction.notifyUpdate();
        }
        catch (error) {
            await ctx.ui.showToast({ title: t('runtime.toast.setupIncomplete'), description: errorMessage(error), variant: 'error' });
        }
    }, 1_500);
    ctx.subscriptions.push({ dispose: () => clearTimeout(onboardingTimer) });
    ctx.subscriptions.push(ctx.i18n.onDidChangeLocale(() => statusAction.notifyUpdate()));
    ctx.logger.info('Finch Web Assistant mini tool activated');
}
export function deactivate() { }
//# sourceMappingURL=index.js.map