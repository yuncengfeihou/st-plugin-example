// SillyTavern 模块导入
import { getRequestHeaders } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// ==========================================================
//  1. 定义所有工具函数和常量
// ==========================================================

// 插件的唯一名称，用于日志和UI元素ID
const extensionName = 'my-update-checker';

// --- 配置区 ---
const LOCAL_VERSION = '1.0.3'; // 你的本地版本
const GITHUB_REPO = 'yuncengfeihou/st-plugin-example'; // 你的仓库
const REMOTE_MANIFEST_PATH = 'manifest.json';
// ----------------

// 全局变量
let remoteVersion = '0.0.0';
let isUpdateAvailable = false;

/**
 * 比较两个语义化版本号
 */
function compareVersions(versionA, versionB) {
    const cleanA = versionA.split('-')[0].split('+')[0];
    const cleanB = versionB.split('-')[0].split('+')[0];
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
 */
function updateUI() {
    const statusEl = $('#my_update_checker_status');
    const updateInfoEl = $('#my_update_checker_update_info');
    const updateButtonEl = $('#my_update_checker_update_button');

    statusEl.text(`当前版本: ${LOCAL_VERSION}`);

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
 */
async function performUpdate() {
    try {
        await callGenericPopup(
            `正在模拟更新到版本 ${remoteVersion}...`,
            POPUP_TYPE.TEXT,
            null,
            { okButton: '我知道了' }
        );
        
        $('#my_update_checker_status').text(`已“更新”到 ${remoteVersion}`);
        isUpdateAvailable = false;
        // 注意：这里为了演示，只在UI上模拟了更新，但 LOCAL_VERSION 常量无法在运行时改变
        // 真实场景下，用户需要手动更新文件并重启
        updateButtonEl.hide();
        updateInfoEl.hide();
        toastr.success(`插件已“更新”到 ${remoteVersion}！请手动更新代码中的版本号并重启。`);

    } catch (error) {
        // 用户关闭了弹窗
    }
}

/**
 * 检查更新的主函数
 */
async function check_for_updates() {
    console.log(`[${extensionName}] Checking for updates...`);
    $('#my_update_checker_status').text('正在检查更新...');

    try {
        console.log(`[${extensionName}] Local version is defined as: ${LOCAL_VERSION}`);

        const remoteContent = await getRemoteManifestContent();
        remoteVersion = parseVersionFromManifest(remoteContent);
        console.log(`[${extensionName}] Remote version found: ${remoteVersion}`);
        
        // 现在调用 compareVersions 时，它肯定已经被定义了
        isUpdateAvailable = compareVersions(remoteVersion, LOCAL_VERSION) > 0;
        
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
    
    updateUI();
}

// ==========================================================
//  2. 插件入口 (DOM Ready)
// ==========================================================
jQuery(async () => {
    // 定义UI
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

    // 注入UI
    $('#extensions_settings').append(settingsHtml);
    
    // 绑定事件
    $('#my_update_checker_update_button').on('click', performUpdate);
    
    // 执行检查
    await check_for_updates();
});
