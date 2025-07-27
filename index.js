// SillyTavern 模块导入
import { getRequestHeaders } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// ==========================================================
//  1. 定义所有工具函数和常量
// ==========================================================

// 插件的唯一名称，用于日志和UI元素ID
const extensionName = 'my-update-checker';
const extensionPath = `third-party/${extensionName}`; // SillyTavern API 需要的路径

// --- 配置区 ---
const LOCAL_VERSION = '1.0.4'; // 你的本地版本
const GITHUB_REPO = 'yuncengfeihou/st-plugin-example'; // 你的仓库
const REMOTE_CHANGELOG_PATH = 'CHANGELOG.md'; // 日志文件名
const REMOTE_MANIFEST_PATH = 'manifest.json';
// ----------------

// 全局变量
let remoteVersion = '0.0.0';
let latestCommitHash = ''; // 用于存储最新的 commit hash 以绕过CDN缓存
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
 * 从 GitHub API 获取 main 分支最新的 commit hash
 */
async function getLatestCommitHash() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
    console.log(`[${extensionName}] Fetching latest commit hash from: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`GitHub API error! status: ${response.status}`);
        const data = await response.json();
        if (!data.sha) throw new Error('Invalid response from GitHub API, "sha" not found.');
        return data.sha;
    } catch (error) {
        console.error(`[${extensionName}] Failed to fetch latest commit hash:`, error);
        throw error;
    }
}

/**
 * 从 jsDelivr 获取指定 commit 的远程文件内容
 * @param {string} filePath - 仓库中的文件路径
 * @param {string} commitHash - 要获取的 commit hash
 */
async function getRemoteFileContent(filePath, commitHash) {
    const url = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${commitHash}/${filePath}`;
    console.log(`[${extensionName}] Fetching remote file: ${url}`);
    
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`jsDelivr error! status: ${response.status}`);
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
 */
function extractRelevantChangelog(changelogContent, currentVersion, latestVersion) {
    try {
        const startMarker = `## [${latestVersion}]`;
        const startIndex = changelogContent.indexOf(startMarker);

        if (startIndex === -1) {
            return "无法找到最新版本的更新日志。";
        }

        const endMarker = `## [${currentVersion}]`;
        let endIndex = changelogContent.indexOf(endMarker, startIndex);
        
        if (endIndex === -1) {
            endIndex = changelogContent.length;
        }

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
 * 处理更新流程，使用正确的 API 调用方式
 */
async function handleUpdate() {
    try {
        // (可选) 增加一个确认弹窗
        await callGenericPopup(
            `确定要更新 ${extensionName} 到 ${remoteVersion} 版本吗？`,
            POPUP_TYPE.CONFIRM,
            { okButton: '确定', cancelButton: '取消' }
        );

        toastr.info("正在请求后端更新插件，请稍候...");
        
        // 【关键修正】API 调用
        const response = await fetch("/api/extensions/update", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({
                // 使用正确的插件文件夹名，而不是完整路径
                extensionName: extensionName, 
                // 对于 third-party 插件, global 通常是 false
                global: false, 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            // 抛出更详细的错误，包括后端返回的信息
            throw new Error(`更新失败，服务器返回状态: ${response.status}. 详情: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.isUpToDate) {
            toastr.warning("插件已经是最新版本。");
        } else {
            toastr.success(`更新成功！请刷新页面以应用新版本。`, "更新完成", {timeOut: 5000});
            // 也可以选择自动刷新
            // setTimeout(() => location.reload(), 3000);
        }

    } catch (error) {
        // 检查错误信息是否是我们自定义的，以避免显示 "取消" 操作的错误
        if (error.message && error.message.includes("更新失败")) {
            toastr.error(error.message, '更新出错');
        } else {
            toastr.info("更新已取消。");
        }
    }
}

/**
 * 检查更新的主函数 (采用两步验证法)
 */
async function check_for_updates() {
    console.log(`[${extensionName}] Checking for updates...`);
    $('#my_update_checker_status').text('正在检查更新...');

    try {
        console.log(`[${extensionName}] Local version is defined as: ${LOCAL_VERSION}`);
        
        // 步骤 1: 获取最新的 commit hash
        latestCommitHash = await getLatestCommitHash();
        console.log(`[${extensionName}] Latest commit hash: ${latestCommitHash}`);

        // 步骤 2: 使用 commit hash 获取 manifest
        const remoteManifest = await getRemoteFileContent(REMOTE_MANIFEST_PATH, latestCommitHash);
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
