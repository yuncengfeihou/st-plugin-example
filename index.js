// SillyTavern 模块导入
import { getRequestHeaders } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// ==========================================================
//  1. 定义所有工具函数和常量
// ==========================================================

const extensionName = 'my-update-checker'; // 插件文件夹名，API 需要这个

// --- 配置区 ---
const LOCAL_VERSION = '1.0.2'; // 你的本地版本
const GITHUB_REPO = 'yuncengfeihou/st-plugin-example'; // 你的仓库
const REMOTE_CHANGELOG_PATH = 'CHANGELOG.md';
const REMOTE_MANIFEST_PATH = 'manifest.json';
// ----------------

let remoteVersion = '0.0.0';
let latestCommitHash = '';
let isUpdateAvailable = false;

// ... compareVersions, getLatestCommitHash, getRemoteFileContent, parseVersionFromManifest 函数都保持不变 ...

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

async function getLatestCommitHash() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' });
        if (!response.ok) throw new Error(`GitHub API error! status: ${response.status}`);
        const data = await response.json();
        if (!data.sha) throw new Error('Invalid response from GitHub API, "sha" not found.');
        return data.sha;
    } catch (error) {
        console.error(`[${extensionName}] Failed to fetch latest commit hash:`, error);
        throw error;
    }
}

async function getRemoteFileContent(filePath, commitHash) {
    const url = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${commitHash}/${filePath}`;
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`jsDelivr error! status: ${response.status}`);
        return await response.text();
    } catch (error) {
        console.error(`[${extensionName}] Failed to fetch remote file ${filePath}:`, error);
        throw error;
    }
}

function parseVersionFromManifest(content) {
    try {
        const manifest = JSON.parse(content);
        return manifest?.version || '0.0.0';
    } catch (error) {
        return '0.0.0';
    }
}

function extractRelevantChangelog(changelogContent, currentVersion, latestVersion) {
    try {
        const startMarker = `## [${latestVersion}]`;
        const startIndex = changelogContent.indexOf(startMarker);
        if (startIndex === -1) return "无法找到最新版本的更新日志。";
        const endMarker = `## [${currentVersion}]`;
        let endIndex = changelogContent.indexOf(endMarker, startIndex);
        if (endIndex === -1) endIndex = changelogContent.length;
        return changelogContent.substring(startIndex, endIndex).trim();
    } catch (error) {
        console.error("Error extracting changelog:", error);
        return "解析更新日志失败。";
    }
}

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


// ==========================================================
//  修改的核心部分：最终版的 handleUpdate 函数
// ==========================================================
async function handleUpdate() {
    let updatingToast = null;
    try {
        // 步骤 1: 获取并显示更新日志
        const changelog = await getRemoteFileContent(REMOTE_CHANGELOG_PATH, latestCommitHash);
        const relevantLog = extractRelevantChangelog(changelog, LOCAL_VERSION, remoteVersion);
        const logHtml = relevantLog.replace(/### (.*)/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

        await callGenericPopup(
            `<h3>发现新版本: ${remoteVersion}</h3><hr><div style="text-align:left; max-height: 300px; overflow-y: auto;">${logHtml}</div>`,
            POPUP_TYPE.CONFIRM,
            { okButton: '立即更新', cancelButton: '稍后' }
        );

        // 步骤 2: 用户确认后，显示持久化的更新提示
        updatingToast = toastr.info("正在请求后端更新插件，请不要关闭或刷新页面...", "正在更新", {
            timeOut: 0, // timeOut: 0 使其不会自动消失
            extendedTimeOut: 0,
            tapToDismiss: false,
        });
        
        // 步骤 3: 调用后端 API 执行更新
        const response = await fetch("/api/extensions/update", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: extensionName,
                global: true, 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`更新失败，服务器返回状态: ${response.status}. 详情: ${errorText}`);
        }
        
        const result = await response.json();
        
        // 步骤 4: 根据结果处理 UI
        if (result.isUpToDate) {
            toastr.warning("插件已经是最新版本。");
        } else {
            // 成功后，显示成功消息，并准备自动刷新
            toastr.success(`更新成功！3秒后将自动刷新页面...`, "更新完成", { timeOut: 3000 });
            setTimeout(() => location.reload(), 3000);
        }

    } catch (error) {
        // 捕获所有错误，包括用户点击“取消”
        if (error.message && error.message.includes("更新失败")) {
            toastr.error(error.message, '更新出错');
        } else {
            toastr.info("更新已取消。");
        }
    } finally {
        // 步骤 5: 无论成功或失败，都清除“正在更新”的持久化提示
        if (updatingToast) {
            toastr.clear(updatingToast);
        }
    }
}

async function check_for_updates() {
    $('#my_update_checker_status').text('正在检查更新...');
    try {
        latestCommitHash = await getLatestCommitHash();
        const remoteManifest = await getRemoteFileContent(REMOTE_MANIFEST_PATH, latestCommitHash);
        remoteVersion = parseVersionFromManifest(remoteManifest);
        isUpdateAvailable = compareVersions(remoteVersion, LOCAL_VERSION) > 0;
    } catch (error) {
        $('#my_update_checker_status').text(`当前版本: ${LOCAL_VERSION}`);
        return;
    }
    updateUI();
}

// ==========================================================
//  插件入口 (DOM Ready)
// ==========================================================
jQuery(async () => {
    const settingsHtml = `
    <div id="my_update_checker_container" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>${extensionName}</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
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
    $('#extensions_settings').append(settingsHtml);
    $('#my_update_checker_update_button').on('click', handleUpdate);
    await check_for_updates();
});
