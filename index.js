// SillyTavern 模块导入
import { getRequestHeaders } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// ==========================================================
//  1. 定义所有工具函数和常量
// ==========================================================

const extensionName = 'my-update-checker';
const extensionPath = `third-party/${extensionName}`; // SillyTavern API 需要的路径

// --- 配置区 ---
const LOCAL_VERSION = '1.0.2'; // 你的本地版本
const GITHUB_REPO = 'yuncengfeihou/st-plugin-example'; // 你的仓库
const REMOTE_CHANGELOG_PATH = 'CHANGELOG.md'; // 日志文件名
const REMOTE_MANIFEST_PATH = 'manifest.json';
// ----------------

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
 * 从 GitHub 获取远程文件内容 (通用函数)
 * @param {string} filePath - 仓库中的文件路径
 */
async function getRemoteFileContent(filePath) {
    const url = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/${filePath}`;
    console.log(`[${extensionName}] Fetching remote file: ${url}`);
    
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`[${extensionName}] Failed to fetch remote file ${filePath}:`, error);
        throw error;
    }
}

/**
 * 解析 manifest 内容以获取版本号
 */
function parseVersionFromManifest(content) {
    try {
        const manifest = JSON.parse(content);
        return manifest?.version || '0.0.0';
    } catch (error) {
        console.error(`[${extensionName}] Failed to parse version from manifest:`, error);
        return '0.0.0';
    }
}

/**
 * 从完整的更新日志中，提取从当前版本到最新版本之间的内容
 * @param {string} changelogContent - 完整的日志文本
 * @param {string} currentVersion - 用户当前的本地版本
 * @param {string} latestVersion - 远程的最新版本
 */
function extractRelevantChangelog(changelogContent, currentVersion, latestVersion) {
    try {
        // 找到最新版本的日志开头
        const startMarker = `## [${latestVersion}]`;
        const startIndex = changelogContent.indexOf(startMarker);

        if (startIndex === -1) {
            return "无法找到最新版本的更新日志。";
        }

        // 找到当前版本的日志开头，作为结束标志
        const endMarker = `## [${currentVersion}]`;
        let endIndex = changelogContent.indexOf(endMarker, startIndex);
        
        // 如果找不到当前版本的日志（可能是跳版本更新），就截取到文件末尾
        if (endIndex === -1) {
            endIndex = changelogContent.length;
        }

        // 截取并清理
        return changelogContent.substring(startIndex, endIndex).trim();
    } catch (error) {
        console.error("Error extracting changelog:", error);
        return "解析更新日志失败。";
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
 * 处理更新流程：获取日志 -> 弹窗确认 -> 调用API更新
 */
async function handleUpdate() {
    toastr.info("正在获取更新日志...");
    try {
        // 1. 获取远程更新日志
        const changelog = await getRemoteFileContent(REMOTE_CHANGELOG_PATH);
        const relevantLog = extractRelevantChangelog(changelog, LOCAL_VERSION, remoteVersion);

        // 将 Markdown 转换为 HTML 以在弹窗中更好地显示
        // 简单的替换，对于复杂的 markdown 需要引入库，但这里足够了
        const logHtml = relevantLog
            .replace(/### (.*)/g, '<strong>$1</strong>') // h3 -> strong
            .replace(/\n/g, '<br>'); // newlines -> <br>

        // 2. 弹窗确认
        await callGenericPopup(
            `<h3>发现新版本: ${remoteVersion}</h3><hr><div style="text-align:left; max-height: 300px; overflow-y: auto;">${logHtml}</div>`,
            POPUP_TYPE.CONFIRM,
            { okButton: '立即更新', cancelButton: '稍后' }
        );

        // 3. 用户确认后，执行真正的更新
        toastr.info("正在请求后端更新插件，请稍候...");
        const response = await fetch("/api/extensions/update", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: extensionPath, // 使用 "third-party/plugin-name" 格式
                global: false, // 通常为 false
            })
        });

        if (!response.ok) {
            throw new Error(`更新失败，服务器返回状态: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.isUpToDate) {
            toastr.warning("插件已经是最新版本。");
        } else {
            toastr.success(`更新成功！3秒后将自动刷新页面...`);
            setTimeout(() => location.reload(), 3000);
        }

    } catch (error) {
        // 如果用户点击“取消”或发生错误
        if (error.message.includes("更新失败")) {
            toastr.error(error.message);
        } else {
            toastr.info("更新已取消。");
        }
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
        
        const remoteManifest = await getRemoteFileContent(REMOTE_MANIFEST_PATH);
        remoteVersion = parseVersionFromManifest(remoteManifest);
        console.log(`[${extensionName}] Remote version found: ${remoteVersion}`);
        
        isUpdateAvailable = compareVersions(remoteVersion, LOCAL_VERSION) > 0;
        
        if(isUpdateAvailable) {
            console.log(`[${extensionName}] New version available!`);
        } else {
            console.log(`[${extensionName}] You are on the latest version.`);
        }

    } catch (error) {
        // 静默失败，不打扰用户
        $('#my_update_checker_status').text(`当前版本: ${LOCAL_VERSION}`);
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
    $('#my_update_checker_update_button').on('click', handleUpdate);
    
    // 执行检查
    await check_for_updates();
});
