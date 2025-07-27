// 注意：这次我们不再使用顶层的 import 语句，
// 而是等待 DOM 加载完毕后从全局对象获取所需函数和变量。

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

// 全局变量，用于存储从 ST 获取的函数
let callGenericPopup;
let POPUP_TYPE;

/**
 * 比较两个语义化版本号 (e.g., "1.2.3")
 * @param {string} versionA
 * @param {string} versionB
 * @returns {number} 1 if versionA > versionB, -1 if versionA < versionB, 0 if equal
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
 * @returns {Promise<string>} 文件内容的字符串
 */
async function getRemoteManifestContent() {
    const url = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/${REMOTE_MANIFEST_PATH}`;
    console.log(`[${extensionName}] Fetching remote manifest from: ${url}`);
    
    try {
        const response = await fetch(url, { cache: 'no-store' }); // "no-store" 确保获取最新版本
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
 * @param {string} content manifest.json 的文件内容
 * @returns {string} 版本号字符串
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
 */
async function performUpdate() {
    try {
        // 确保 callGenericPopup 已经加载
        if (typeof callGenericPopup !== 'function') {
            toastr.error('弹窗功能未准备好！');
            return;
        }

        await callGenericPopup(
            `正在模拟更新到版本 ${remoteVersion}...`,
            POPUP_TYPE.TEXT,
            null,
            { okButton: '我知道了' }
        );
        
        // 为了演示，我们只在前端修改版本号并刷新UI
        localVersion = remoteVersion;
        isUpdateAvailable = false;
        updateUI();
        toastr.success(`插件已“更新”到 ${localVersion}！`);

    } catch (error) {
        // 用户关闭了弹窗
    }
}

/**
 * 检查更新的主函数 (修正版)
 */
async function check_for_updates() {
    console.log(`[${extensionName}] Checking for updates...`);
    $('#my_update_checker_status').text('正在检查更新...');

    try {
        // 1. 获取本地版本 (从 SillyTavern 加载的插件信息中读取)
        // 这种方式兼容性更强
        if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
            throw new Error('SillyTavern 全局对象或 getContext 方法未找到。');
        }
        const stContext = SillyTavern.getContext();
        // 在新版 ST 中，插件信息在 stContext.extensions.extension_types
        // 在一些旧版中，可能直接是 stContext.extension_types
        const extensionTypes = stContext.extensions ? stContext.extensions.extension_types : stContext.extension_types;
        
        if (!extensionTypes) {
            throw new Error('无法找到插件类型定义对象 (extension_types)。');
        }

        const pluginKey = Object.keys(extensionTypes).find(key => key.endsWith(extensionName));
        if (!pluginKey || !extensionTypes[pluginKey].version) {
            throw new Error(`无法在 ST 的插件列表中找到 "${extensionName}" 的信息。`);
        }
        localVersion = extensionTypes[pluginKey].version;
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

/**
 * 插件初始化函数
 */
async function initialize() {
    console.log(`[${extensionName}] Initializing...`);
    
    // 从 SillyTavern 全局上下文中获取需要的函数
    const stContext = SillyTavern.getContext();
    callGenericPopup = stContext.popup.callGenericPopup;
    POPUP_TYPE = stContext.popup.POPUP_TYPE;

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
}


// 使用 jQuery(async () => { ... }) 确保在 DOM 加载完成后执行
jQuery(async () => {
    // 借鉴 quest-system 脚本的稳健做法，等待核心 API 准备就绪
    function runWhenReady() {
        if (typeof jQuery !== 'undefined' && typeof SillyTavern !== 'undefined' && SillyTavern.getContext && SillyTavern.getContext().popup) {
            initialize();
        } else {
            setTimeout(runWhenReady, 100);
        }
    }
    runWhenReady();
});
