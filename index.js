// SillyTavern 模块导入
import { eventSource, event_types, getRequestHeaders } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
// 新增导入：我们需要 extension_types 来获取插件信息
import { extension_types } from '../../../extensions.js';


// 插件的唯一名称，必须与文件夹名一致
const extensionName = 'my-update-checker';

// --- 配置区 ---
// 替换成你的 GitHub 用户名和仓库名
const GITHUB_REPO = 'YourUsername/st-plugin-example';
// 要检查的远程文件路径
const REMOTE_MANIFEST_PATH = 'manifest.json';
// ----------------

// 全局变量，用于存储版本信息
let localVersion = '0.0.0';
let remoteVersion = '0.0.0';
let isUpdateAvailable = false;

/**
 * 比较两个语义化版本号 (e.g., "1.2.3")
 * (此函数保持不变)
 */
function compareVersions(versionA, versionB) {
    const cleanA = versionA.split('-')[0].split('+')[0];
    const cleanB = versionB.split('.').map(Number);
    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (isNaN(numA) || isNaN(numB)) return 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

/**
 * 从 GitHub API 获取远程 manifest.json 的内容
 * (此函数保持不变)
 */
async function getRemoteManifestContent() {
    const url = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/${REMOTE_MANIFEST_PATH}`;
    console.log(`[${extensionName}] Fetching remote manifest from: ${url}`);
    
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`[${extensionName}] Failed to fetch remote manifest:`, error);
        throw error;
    }
}

/**
 * 解析 manifest 内容以获取版本号
 * (此函数保持不变)
 */
function parseVersionFromManifest(content) {
    try {
        const manifest = JSON.parse(content);
        if (manifest && typeof manifest.version === 'string') {
            return manifest.version;
        }
        throw new Error("Invalid manifest format or 'version' field is missing.");
    } catch (error) {
        console.error(`[${extensionName}] Failed to parse version from manifest:`, error);
        throw error;
    }
}

/**
 * 更新插件的 UI 状态
 * (此函数保持不变)
 */
function updateUI() {
    // ... (函数内容不变) ...
    const statusEl = $('#my_update_checker_status');
    const updateInfoEl = $('#my_update_checker_update_info');
    const updateButtonEl = $('#my_update_checker_update_button');

    statusEl.text(`当前版本: ${localVersion}`);

    if (isUpdateAvailable) {
        updateInfoEl.text(`发现新版本: ${remoteVersion}`).show();
        updateButtonEl.show();
    } else {
        updateInfoEl.hide();
        updateButtonEl.hide();
    }
}

/**
 * 模拟 SillyTavern 的更新流程
 * (此函数保持不变)
 */
async function performUpdate() {
    // ... (函数内容不变) ...
    try {
        await callGenericPopup(
            `正在模拟更新到版本 ${remoteVersion}...`,
            POPUP_TYPE.TEXT,
            null,
            { okButton: '我知道了' }
        );
        
        localVersion = remoteVersion;
        isUpdateAvailable = false;
        updateUI();
        toastr.success(`插件已“更新”到 ${localVersion}！`);

    } catch (error) {
        // 用户关闭了弹窗
    }
}

// ==========================================================
//  修改从这里开始
// ==========================================================
/**
 * 检查更新的主函数 (修改版)
 */
async function check_for_updates() {
    console.log(`[${extensionName}] Checking for updates...`);
    $('#my_update_checker_status').text('正在检查更新...');

    try {
        // 1. 获取本地版本 (从 SillyTavern 的插件对象中读取)
        // 这是更可靠的方法，不再使用 fetch
        const pluginKey = Object.keys(extension_types).find(key => key.endsWith(extensionName));
        if (!pluginKey || !extension_types[pluginKey].version) {
            throw new Error('无法在 SillyTavern 的 extension_types 中找到插件信息。');
        }
        localVersion = extension_types[pluginKey].version;
        console.log(`[${extensionName}] Local version found: ${localVersion}`);

        // 2. 获取远程版本
        const remoteContent = await getRemoteManifestContent();
        remoteVersion = parseVersionFromManifest(remoteContent);
        console.log(`[${extensionName}] Remote version found: ${remoteVersion}`);
        
        // 3. 比较版本
        isUpdateAvailable = compareVersions(remoteVersion, localVersion) > 0;
        
        if(isUpdateAvailable) {
            console.log(`[${extensionName}] New version available!`);
        } else {
            console.log(`[${extensionName}] You are on the latest version.`);
        }

    } catch (error) {
        console.error(`[${extensionName}] Update check failed.`, error);
        $('#my_update_checker_status').text('更新检查失败!');
        return;
    }
    
    // 4. 更新 UI
    updateUI();
}
// ==========================================================
//  修改到这里结束
// ==========================================================

// 使用 jQuery(async () => { ... }) 确保在 DOM 加载完成后执行
// (此部分保持不变)
jQuery(async () => {
    // 定义插件设置界面的 HTML
    const settingsHtml = `
    <div id="my_update_checker_container" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>${extensionName}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:block; padding:10px;">
            <p>这是一个用于测试检查更新功能的示例插件。</p>
            <div>
                <span id="my_update_checker_status">正在加载...</span>
                <span id="my_update_checker_update_info"></span>
                <button id="my_update_checker_update_button" class="menu_button">更新</button>
            </div>
            <hr class="sysHR">
        </div>
    </div>`;

    // 将 HTML 注入到 SillyTavern 的扩展设置区域
    $('#extensions_settings').append(settingsHtml);

    // 为更新按钮绑定点击事件
    $('#my_update_checker_update_button').on('click', performUpdate);
    
    // 首次加载时立即检查更新
    await check_for_updates();
});
