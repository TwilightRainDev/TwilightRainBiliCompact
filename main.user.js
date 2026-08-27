// ==UserScript==
// @name         Simplified Bilibili Web Homepage~ BiliCompact
// @name:zh-CN   网页端Bilibili主页精简~ BiliCompact
// @name:zh-TW   網頁端Bilibili主頁精簡~ BiliCompact
// @name:ja      Web版Bilibiliのhomepageの簡素化
// @namespace    http://tampermonkey.net/
// @version      2.10.0
// @license MIT
// @description  Tired of Bilibili's cluttered video feed? This plugin limits visible videos per page, supports multi‑page, black/whitelists, and persistent settings. No UI injected, 4 languages supported. Locally, there are 0 network requests.
// @description:zh-CN   厌倦网页视频过多？本插件限制显示数量，支持多页、黑白名单、持久配置。无UI注入，四语言。收藏夹本地重命名，零网络请求。
// @description:zh-TW   厭倦網頁影片過多？本外掛限制顯示數量，支援多頁、黑白名單、持久設定。無UI注入，四語言。收藏夾本地重新命名，零網路請求。
// @description:ja     ビリビリの動画過多？本プラグインは表示制限、多ページ・黑白リスト・設定永続化。UI追加なし、四つの言語。お気に入りローカルリネーム、通信ゼロ。
// @author       TwilightRainDev
// @match        https://www.bilibili.com/
// @match        https://www.bilibili.com/?*
// @match        https://www.bilibili.com/index/*
// @match        https://www.bilibili.com/v/popular/*
// @match        https://www.bilibili.com/v/*/*
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/dynamic*
// @match        https://www.bilibili.com/search*
// @match        https://www.bilibili.com/anime/*
// @match        https://www.bilibili.com/guochuang/*
// @match        https://www.bilibili.com/music/*
// @match        https://www.bilibili.com/dance/*
// @match        https://www.bilibili.com/game/*
// @match        https://www.bilibili.com/technology/*
// @match        https://www.bilibili.com/life/*
// @match        https://www.bilibili.com/food/*
// @match        https://www.bilibili.com/car/*
// @match        https://www.bilibili.com/animal/*
// @match        https://www.bilibili.com/kichiku/*
// @match        https://www.bilibili.com/fashion/*
// @match        https://www.bilibili.com/ent/*
// @match        https://www.bilibili.com/cinephile/*
// @match        https://www.bilibili.com/popular/*
// @match        https://space.bilibili.com/*
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_log
// @icon         https://www.bilibili.com/favicon.ico
// @downloadURL https://update.greasyfork.org/scripts/585777/%E7%BD%91%E9%A1%B5%E7%AB%AFB%E7%AB%99%E4%B8%BB%E9%A1%B5%E7%B2%BE%E7%AE%80~%20BiliCompact.user.js
// @updateURL https://update.greasyfork.org/scripts/585777/%E7%BD%91%E9%A1%B5%E7%AB%AFB%E7%AB%99%E4%B8%BB%E9%A1%B5%E7%B2%BE%E7%AE%80~%20BiliCompact.meta.js
// PS; 根据 哔哩哔哩屏蔽增强器のApache-2.0声明，针对其进行优化适配，已继承其评论屏蔽（关键词/正则）与评论内容替换功能。尊重原始作者byhgz的版权。
// ==/UserScript==

// ======================== 评论规则引擎（纯函数，零 DOM/GM 依赖，node 可测） ========================
// 继承自 哔哩哔哩屏蔽增强器 (byhgz, Apache-2.0) 的评论匹配语义：
//   模糊: value.toLowerCase().includes(item)（大小写不敏感子串）
//   正则: value 去全部空白后 search(规则)，单条异常跳过并记日志
//   关键词替换: includes(find) 且 scope 匹配 → replaceAll
//   表情替换: img alt 全等匹配，replace 为空 = 删除
var CommentRuleEngine = (function() {
    'use strict';
    function fuzzyMatch(ruleList, value) {
        if (!Array.isArray(ruleList) || ruleList.length === 0 || value == null) return null;
        var Lowered = String(value).toLowerCase();
        for (var i = 0; i < ruleList.length; i++) {
            // 规则词与评论内容双向忽略大小写（Blocker 原版仅对 value 小写化，
            // 这里放宽为对规则词也小写，避免用户输入大写词时永不命中）
            if (Lowered.indexOf(String(ruleList[i]).toLowerCase()) !== -1) return ruleList[i];
        }
        return null;
    }
    function regexMatch(ruleList, value, caseInsensitive) {
        if (!Array.isArray(ruleList) || ruleList.length === 0) return { hit: null, error: null };
        var Cleaned = String(value).split(/[\t\r\f\n\s]*/g).join('');
        for (var i = 0; i < ruleList.length; i++) {
            try {
                // caseInsensitive 时编译加 i 标志（预设方案用；手动屏蔽正则保持区分大小写）
                if (Cleaned.search(new RegExp(ruleList[i], caseInsensitive ? 'i' : '')) !== -1) return { hit: ruleList[i], error: null };
            } catch (E) {
                // 单条正则错误：跳过，不中断其他规则（对齐 Blocker 的 try/catch 语义）
                if (typeof console !== 'undefined') console.warn('[BiliCompact] 正则规则异常，已跳过: ' + ruleList[i], E);
            }
        }
        return { hit: null, error: null };
    }
    function blockComment(content, fuzzyList, regexList) {
        if (!content) return { state: false };
        var Hit = fuzzyMatch(fuzzyList || [], content);
        if (Hit !== null) return { state: true, type: '模糊评论', matching: Hit };
        var R = regexMatch(regexList || [], content);
        if (R.hit !== null) return { state: true, type: '正则评论', matching: R.hit };
        return { state: false };
    }
    function replaceKeywords(arr, content, scope) {
        if (!Array.isArray(arr) || arr.length === 0 || !content) return { state: false };
        for (var i = 0; i < arr.length; i++) {
            var V = arr[i];
            if (!V || !V.find || content.indexOf(V.find) === -1) continue;
            if (!V.scopes || V.scopes.indexOf(scope) === -1) continue;
            return { state: true, content: content.split(V.find).join(V.replace || '') };
        }
        return { state: false };
    }
    function replaceEmoticons(arr, alt) {
        if (!Array.isArray(arr) || arr.length === 0 || !alt) return { state: false };
        for (var i = 0; i < arr.length; i++) {
            var V = arr[i];
            if (!V || V.find !== alt) continue;
            if (V.replace === '') return { state: true, model: 'del', content: alt };
            return { state: true, model: 'subStr', content: V.replace };
        }
        return { state: false };
    }
    function replaceRegex(arr, content) {
        // 正则替换/删除：逐条编译（u 标志支持 \p{...} 属性转义；V.ci 时大小写不敏感），
        // 全部命中规则依次应用（每条替换全部出现），空替换 = 删除；单条异常跳过并记日志。
        if (!Array.isArray(arr) || arr.length === 0 || !content) return { state: false };
        var Out = String(content), Changed = false;
        for (var i = 0; i < arr.length; i++) {
            var V = arr[i];
            if (!V || !V.find) continue;
            var Re = null;
            try { Re = new RegExp(V.find, V.ci ? 'giu' : 'gu'); }
            catch (E1) {
                // 旧引擎兼容：u 标志对个别遗留写法（如未转义 { ）报错时回退无 u 编译
                try { Re = new RegExp(V.find, V.ci ? 'gi' : 'g'); }
                catch (E2) {
                    if (typeof console !== 'undefined') console.warn('[BiliCompact] 正则替换规则异常，已跳过: ' + V.find, E2);
                    continue;
                }
            }
            var New = Out.replace(Re, V.replace || '');
            if (New !== Out) { Out = New; Changed = true; }
        }
        return Changed ? { state: true, content: Out } : { state: false };
    }
    return { fuzzyMatch: fuzzyMatch, regexMatch: regexMatch, blockComment: blockComment, replaceKeywords: replaceKeywords, replaceEmoticons: replaceEmoticons, replaceRegex: replaceRegex };
})();

// ======================== 共享面板主题（两模块统一，面板元素打 data-bc-theme 属性） ========================
// 主题变量与基础控件样式唯一来源：信息流精简面板（BiliCompactPanel）与
// 收藏夹重命名面板（favrename-panel/settings）共用；布局专属样式留在各模块内。
var PANEL_THEME_CSS = `
[data-bc-theme] {
    --bg: #1e1e1e;
    --text: #eee;
    --text-secondary: #ccc;
    --text-heading: #fff;
    --input-bg: #2a2a2a;
    --border: #333;
    --border-light: #444;
    --hr: #333;
    --accent: #fb7299;
    --accent-hover: #ff85a8;
    --badge-off: #666;
    --btn-secondary-bg: #444;
    --btn-secondary-hover: #555;
    --btn-secondary-text: #fff;
    --danger: #f25d8e;
    --danger-hover: #4a2430;
    --collapse-hover: #333;
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    font-size: 13px; line-height: 1.6;
}
[data-bc-theme].light-mode {
    --bg: #ffffff;
    --text: #333;
    --text-secondary: #555;
    --text-heading: #111;
    --input-bg: #f5f5f5;
    --border: #ddd;
    --border-light: #e0e0e0;
    --hr: #eee;
    --accent: #00AEEC;
    --accent-hover: #33c0f0;
    --badge-off: #bbb;
    --btn-secondary-bg: #eee;
    --btn-secondary-hover: #ddd;
    --btn-secondary-text: #333;
    --danger: #f25d8e;
    --danger-hover: #fff1f5;
    --collapse-hover: #eee;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}
[data-bc-theme] button.bc-btn {
    border: none; background: var(--btn-secondary-bg); color: var(--btn-secondary-text);
    border-radius: 20px; padding: 3px 14px; cursor: pointer; font-size: 12px; white-space: nowrap;
}
[data-bc-theme] button.bc-btn:hover { background: var(--btn-secondary-hover); }
[data-bc-theme] button.bc-btn-accent { background: var(--accent); color: #fff; }
[data-bc-theme] button.bc-btn-accent:hover { background: var(--accent-hover); }
[data-bc-theme] button.bc-btn-danger { color: var(--danger); background: transparent; border: 1px solid var(--danger); }
[data-bc-theme] button.bc-btn-danger:hover { background: var(--danger-hover); color: var(--danger); }
[data-bc-theme] input.bc-input {
    background: var(--input-bg); color: var(--text);
    border: 1px solid var(--border-light); border-radius: 6px; padding: 4px 8px;
    font-size: 12px; font-family: inherit;
}
[data-bc-theme] input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; }
[data-bc-theme] .bc-hint { font-size: 12px; color: #888; line-height: 1.4; }
[data-bc-theme] .bc-collapse-header {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    padding: 6px 8px; border-radius: 6px; user-select: none;
    font-size: 13px; color: var(--accent); font-weight: 500; transition: background 0.15s;
}
[data-bc-theme] .bc-collapse-header:hover { background: var(--collapse-hover); }
[data-bc-theme] .bc-collapse-arrow { transition: transform 0.2s; font-size: 12px; line-height: 1; }
[data-bc-theme] .bc-collapse-arrow.open { transform: rotate(90deg); }
[data-bc-theme] .bc-collapse-content { display: flex; flex-direction: column; gap: 8px; }
[data-bc-theme] .bc-collapse-content.collapsed { display: none; }
[data-bc-theme] .bc-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-bottom: 1px solid var(--hr);
}
`;

// ======================== 共享面板工厂 ========================
// 外壳创建/主题应用/系统切换监听/销毁；内容区由各模块自行渲染。
// opts: { overlay: boolean, theme: 'system'|'config', colorMode?: 'auto'|'dark'|'light',
//         live?: boolean（system 模式下监听系统切换）, id?: string, className?: string }
// 返回: { el, overlay, destroy }
var createBcPanel = function(opts) {
    var Overlay = opts.overlay ? document.createElement('div') : null;
    var El = document.createElement('div');
    if (opts.id) El.id = opts.id;
    if (opts.className) El.className = opts.className;
    El.setAttribute('data-bc-theme', '');

    var ApplyTheme = function() {
        var Dark;
        if (opts.theme === 'system') {
            Dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            var Mode = (opts.colorMode || 'auto') === 'auto'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : opts.colorMode;
            Dark = Mode === 'dark';
        }
        El.classList.toggle('light-mode', !Dark);
    };
    ApplyTheme();

    // system 模式下可监听系统主题实时切换
    var Listener = null;
    if (opts.theme === 'system' && opts.live) {
        var MQ = window.matchMedia('(prefers-color-scheme: dark)');
        Listener = function(E) { El.classList.toggle('light-mode', !E.matches); };
        if (MQ.addEventListener) MQ.addEventListener('change', Listener);
    }

    if (Overlay) {
        Overlay.className = 'BiliCompactOverlay';
        Overlay.appendChild(El);
        document.body.appendChild(Overlay);
    } else {
        document.body.appendChild(El);
    }

    var Destroyed = false;
    var destroy = function() {
        if (Destroyed) return;
        Destroyed = true;
        if (Overlay && Overlay.parentNode) Overlay.parentNode.removeChild(Overlay);
        if (!Overlay && El.parentNode) El.parentNode.removeChild(El);
        if (Listener) {
            var MQ2 = window.matchMedia('(prefers-color-scheme: dark)');
            if (MQ2.removeEventListener) MQ2.removeEventListener('change', Listener);
        }
    };
    return { el: El, overlay: Overlay, destroy: destroy };
};

// node 单元测试加载入口；浏览器端(Tampermonkey)此分支不执行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommentRuleEngine;
}

(function() {
    'use strict';
    // node --test 环境下跳过整段脚本（无 document/GM_*），保证 require 安全
    if (typeof document === 'undefined') return;

    // 注入共享面板主题（两个模块的面板统一引用 data-bc-theme 变量与控件）
    if (typeof GM_addStyle === 'function') GM_addStyle(PANEL_THEME_CSS);

    // ======================== 国际化：共享语言解析 ========================
    // 浏览器语言 → 脚本语言代码；两个模块共用，保证语言判定一致。
    // 支持: zh_CN | zh_TW | en_US | ja_JP，未知语言回退 zh_CN
    function ResolveUILang() {
        const Nav = (navigator.language || '').toLowerCase();
        if (/^zh-(tw|hk|mo|hant)([_-]|$)/i.test(Nav)) return 'zh_TW';
        if (/^zh/i.test(Nav)) return 'zh_CN';
        if (/^ja/i.test(Nav)) return 'ja_JP';
        if (/^en/i.test(Nav)) return 'en_US';
        return 'zh_CN'; // fallback
    }

    // ======================== 模块路由 ========================
    // 空间站（含收藏夹页）→ 收藏夹重命名模块；其余 B 站页面 → 信息流精简模块
    if (location.hostname === 'space.bilibili.com') {
        InitFavRenameModule();
    } else {
        InitCompactModule();
    }

    // ======================== 模块一：收藏夹重命名（原 BiliFavRename） ========================
    function InitFavRenameModule() {
        'use strict';

        // ======================== 国际化 (i18n) ========================
        // 四语言字典；语言代码与信息流精简模块一致（共享 ResolveUILang）
        const FR_I18N = {
            zh_CN: {
                LogObserverStarted: 'Observer 已启动，挂载点:',
                LogInitFav: 'BiliFavRename 已初始化（收藏夹页）',
                LogInitSpace: 'BiliFavRename 已初始化（空间页，进入收藏夹后启动）',
                LogCleared: '已清空全部重命名映射',
                BtnRename: '改名',
                BtnOK: '确定',
                BtnCancel: '取消',
                BtnClose: '关闭',
                SearchPlaceholder: '搜索视频标题',
                EmptyList: '当前页面没有已加载的视频，滚动页面加载后自动同步',
                SettingsTitle: 'BiliFavRename 设置',
                LabelMarker: '弱标记字符（留空为不标记）',
                LabelToggle: '启用重命名',
                BtnClearAll: '清空全部映射',
                ConfirmClearAll: '确定清空全部重命名映射？此操作不可撤销。',
                MenuOpenPanel: '打开重命名面板',
                MenuSettings: '设置',
            },
            zh_TW: {
                LogObserverStarted: 'Observer 已啟動，掛載點:',
                LogInitFav: 'BiliFavRename 已初始化（收藏夾頁）',
                LogInitSpace: 'BiliFavRename 已初始化（空間頁，進入收藏夾後啟動）',
                LogCleared: '已清空全部重新命名對應',
                BtnRename: '改名',
                BtnOK: '確定',
                BtnCancel: '取消',
                BtnClose: '關閉',
                SearchPlaceholder: '搜尋影片標題',
                EmptyList: '目前頁面沒有已載入的影片，捲動頁面載入後自動同步',
                SettingsTitle: 'BiliFavRename 設定',
                LabelMarker: '弱標記字元（留空為不標記）',
                LabelToggle: '啟用重新命名',
                BtnClearAll: '清空全部對應',
                ConfirmClearAll: '確定清空全部重新命名對應？此操作不可復原。',
                MenuOpenPanel: '開啟重新命名面板',
                MenuSettings: '設定',
            },
            en_US: {
                LogObserverStarted: 'Observer started, mounting point:',
                LogInitFav: 'BiliFavRename initialized (favorites page)',
                LogInitSpace: 'BiliFavRename initialized (space page, starts inside favorites)',
                LogCleared: 'All rename mappings cleared',
                BtnRename: 'Rename',
                BtnOK: 'OK',
                BtnCancel: 'Cancel',
                BtnClose: 'Close',
                SearchPlaceholder: 'Search video titles',
                EmptyList: 'No videos loaded on this page yet — scroll to load, auto-syncs',
                SettingsTitle: 'BiliFavRename Settings',
                LabelMarker: 'Weak marker char (leave empty for none)',
                LabelToggle: 'Enable renaming',
                BtnClearAll: 'Clear All Mappings',
                ConfirmClearAll: 'Clear all rename mappings? This cannot be undone.',
                MenuOpenPanel: 'Open Rename Panel',
                MenuSettings: 'Settings',
            },
            ja_JP: {
                LogObserverStarted: 'Observer 起動、マウントポイント:',
                LogInitFav: 'BiliFavRename を初期化しました（お気に入りページ）',
                LogInitSpace: 'BiliFavRename を初期化しました（スペースページ、お気に入りに入ると開始）',
                LogCleared: 'すべてのリネーム対応を削除しました',
                BtnRename: '改名',
                BtnOK: '確定',
                BtnCancel: 'キャンセル',
                BtnClose: '閉じる',
                SearchPlaceholder: '動画タイトルを検索',
                EmptyList: 'このページに読み込まれた動画がありません。スクロールすると自動的に同期します',
                SettingsTitle: 'BiliFavRename 設定',
                LabelMarker: '弱マーカー文字（空欄でマークなし）',
                LabelToggle: 'リネームを有効化',
                BtnClearAll: 'すべての対応を削除',
                ConfirmClearAll: 'すべてのリネーム対応を削除しますか？この操作は取り消せません。',
                MenuOpenPanel: 'リネームパネルを開く',
                MenuSettings: '設定',
            }
        };

        let FR_Lang = 'zh_CN';

        function FR_T(Key, ...Args) {
            const Map = FR_I18N[FR_Lang] || FR_I18N['zh_CN'];
            let Str = Map[Key];
            if (Str === undefined) Str = FR_I18N['zh_CN'][Key];
            if (Str === undefined) return Key;
            for (let I = 0; I < Args.length; I++) {
                Str = Str.replace('{' + I + '}', Args[I]);
            }
            return Str;
        }

        // ======================== 常量 ========================
        const SEL_LIST = '.space-favlist';              // observer 挂载点（页面根级容器）
        const SEL_ITEM = '.items__item';                // 单视频卡片
        const SEL_TITLE = '.bili-video-card__title';    // 标题容器（含 title 属性）
        const SEL_TITLE_LINK = '.bili-video-card__title > a';   // 标题可见文本
        const SEL_COVER_IMG = '.bili-cover-card img[alt]';      // 原标题来源（脚本不修改 alt）
        const ATTR_APPLIED = 'data-favrename-applied';  // 防重标记
        const ATTR_ORIG = 'data-favrename-orig';        // 兜底原题（替换前快照）
        const KEY_SETTINGS = 'favrename_settings';
        const KEY_RENAMES = 'favrename_renames';
        const DEFAULT_SETTINGS = { marker: '*', enabled: true };
    
        // ======================== 工具与存储封装 ========================
        function Log() {
            const Args = ['[BiliFavRename]'].concat(Array.prototype.slice.call(arguments));
            console.log.apply(console, Args);
        }
    
        function getSettings() {
            try { return Object.assign({}, DEFAULT_SETTINGS, GM_getValue(KEY_SETTINGS, {})); }
            catch (E) { return Object.assign({}, DEFAULT_SETTINGS); }
        }
    
        function saveSettings(S) {
            try { GM_setValue(KEY_SETTINGS, S); } catch (E) {}
        }
    
        function getRenames() {
            try { return GM_getValue(KEY_RENAMES, {}); } catch (E) { return {}; }
        }
    
        function saveRenames(R) {
            try { GM_setValue(KEY_RENAMES, R); } catch (E) {}
        }
    
        // ======================== 标题替换核心 ========================
        function getBvid(Card) {
            const Link = Card.querySelector(SEL_TITLE_LINK);
            if (!Link || !Link.href) return null;
            const M = Link.href.match(/\/video\/(BV[0-9A-Za-z]{10})/);
            return M ? M[1] : null;
        }
    
        // 应用自定义名：marker + 自定义名（前缀直连），替换可见文本与悬停提示
        function applyTitle(Card, Bvid, Renames, Settings) {
            const Custom = Renames[Bvid];
            if (!Custom) return false;
            const TitleEl = Card.querySelector(SEL_TITLE);
            const Link = Card.querySelector(SEL_TITLE_LINK);
            if (!TitleEl || !Link) return false;
            if (!Card.hasAttribute(ATTR_ORIG)) Card.setAttribute(ATTR_ORIG, Link.textContent);
            const Full = (Settings.marker || '') + Custom;
            if (Link.textContent === Full) { Card.setAttribute(ATTR_APPLIED, '1'); return true; }
            Link.textContent = Full;
            TitleEl.setAttribute('title', Full);
            Card.setAttribute(ATTR_APPLIED, '1');
            return true;
        }
    
        // 还原标题：原标题取封面 img alt，兜底取替换前快照
        function revertTitle(Card) {
            const Link = Card.querySelector(SEL_TITLE_LINK);
            const TitleEl = Card.querySelector(SEL_TITLE);
            const Img = Card.querySelector(SEL_COVER_IMG);
            if (!Link || !TitleEl) return false;
            const Orig = (Img && Img.getAttribute('alt')) || Card.getAttribute(ATTR_ORIG) || Link.textContent;
            if (Link.textContent !== Orig) Link.textContent = Orig;
            TitleEl.setAttribute('title', Orig);
            Card.removeAttribute(ATTR_APPLIED);
            return true;
        }
    
        // ======================== 重命名器（扫描 + Observer） ========================
        let CARD_LIST = [];                 // 面板数据源快照: [{bvid, origTitle, el}]
        let Observer = null;
        let DebounceTimer = null;
        let LastRun = 0;
        const THROTTLE_MS = 500;
    
        function scanAll(Renames, Settings) {
            const Items = document.querySelectorAll(SEL_ITEM);
            Items.forEach(function(Item) {
                const Bvid = getBvid(Item);
                if (!Bvid) return;
                // 不做 ATTR_APPLIED 跳过：Vue 就地重渲染会复用节点并重写文本，
                // 必须无条件校验，applyTitle 内部已有文本比对防重复写
                applyTitle(Item, Bvid, Renames, Settings);
            });
            refreshCardList();
        }
    
        function refreshCardList() {
            const Items = document.querySelectorAll(SEL_ITEM);
            CARD_LIST = [];
            Items.forEach(function(Item) {
                const Bvid = getBvid(Item);
                if (!Bvid) return;
                const Img = Item.querySelector(SEL_COVER_IMG);
                CARD_LIST.push({ bvid: Bvid, origTitle: (Img && Img.getAttribute('alt')) || '', el: Item });
            });
            // 面板开着时同步重渲染（SPA 切换收藏夹/滚动加载后清单变化）
            if (PanelEl) renderList(getFilterValue());
        }
    
        function StartObserver() {
            if (Observer) return;
            const Root = document.querySelector(SEL_LIST);
            if (!Root) return;
            Observer = new MutationObserver(function(Mutations) {
                let Should = false;
                for (let i = 0; i < Mutations.length; i++) {
                    const M = Mutations[i];
                    if (M.type !== 'childList') continue;
                    for (let j = 0; j < M.addedNodes.length; j++) {
                        const N = M.addedNodes[j];
                        if (N.nodeType === 1 && N.matches && (N.matches(SEL_ITEM) || N.querySelector(SEL_ITEM))) {
                            Should = true;
                            break;
                        }
                    }
                    if (Should) break;
                    // removedNodes 检查：取消收藏/移除卡片也会触发就地重渲染，
                    // 需要重扫以恢复被 Vue 重写的标题
                    for (let j = 0; j < M.removedNodes.length; j++) {
                        const N = M.removedNodes[j];
                        if (N.nodeType === 1 && N.matches && (N.matches(SEL_ITEM) || N.querySelector(SEL_ITEM))) {
                            Should = true;
                            break;
                        }
                    }
                    if (Should) break;
                }
                if (!Should) return;
                const Now = Date.now();
                if (Now - LastRun < THROTTLE_MS) {
                    clearTimeout(DebounceTimer);
                    DebounceTimer = setTimeout(function() {
                        LastRun = Date.now();
                        scanAll(getRenames(), getSettings());
                    }, 300);
                } else {
                    LastRun = Now;
                    scanAll(getRenames(), getSettings());
                }
            });
            Observer.observe(Root, { childList: true, subtree: true, attributes: false });
            Log(FR_T('LogObserverStarted'), Root);
        }
    
        function StopObserver() {
            if (Observer) { Observer.disconnect(); Observer = null; }
            clearTimeout(DebounceTimer);
        }
    
        function ApplyAll() {
            const S = getSettings();
            if (!S.enabled) { RevertAll(); return; }
            scanAll(getRenames(), S);
            StartObserver();
        }
    
        function RevertAll() {
            StopObserver();
            document.querySelectorAll(SEL_ITEM).forEach(function(Item) { revertTitle(Item); });
            CARD_LIST = [];
        }
    
        // ======================== 浮动面板 ========================
        // 主题变量与基础控件由共享 PANEL_THEME_CSS 提供（data-bc-theme 属性由工厂打上）；
        // 此处仅保留布局与列表专属样式。
        GM_addStyle(`
            #favrename-panel {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                z-index: 99999;
            }
            #favrename-panel { width: 340px; }
            /* 面板主体复用共享折叠结构（bc-collapse-content），去掉 flex gap 保持列表原有分隔 */
            #favrename-panel .favrename-panel-body.bc-collapse-content { gap: 0; }
            #favrename-panel .favrename-panel-head {
                display: flex; align-items: center; gap: 8px; padding: 10px 12px;
                border-bottom: 1px solid var(--border);
            }
            #favrename-panel .favrename-panel-title { font-weight: bold; white-space: nowrap; }
            #favrename-panel .favrename-search { flex: 1; min-width: 0; }
            #favrename-panel .favrename-panel-body { max-height: 60vh; overflow-y: auto; }
            #favrename-panel .favrename-entry {
                display: flex; align-items: center; gap: 8px; padding: 8px 12px;
                border-bottom: 1px solid var(--hr);
            }
            #favrename-panel .favrename-title {
                flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            #favrename-panel .favrename-custom { color: var(--accent); }
            #favrename-panel .favrename-orig { color: var(--text-secondary); margin-left: 6px; }
            #favrename-panel .favrename-input {
                flex: 1; min-width: 0; padding: 3px 6px;
                border-color: var(--accent); /* 行内编辑输入框用强调色边框，与普通输入区分 */
            }
            #favrename-panel .favrename-empty { padding: 16px 12px; color: var(--text-secondary); text-align: center; }
            /* 设置区块（并入面板，位于列表上方）：折叠头复用 bc-collapse-header，
               设置行复用 .bc-row；bc-collapse-content 默认 flex column，去掉 gap 保持行分隔 */
            #favrename-panel .favrename-settings-body.bc-collapse-content { gap: 0; }
            #favrename-panel .favrename-settings-body .bc-row label { flex: 1; }
            #favrename-panel .favrename-marker {
                width: 48px; text-align: center;
            }
        `);
    
        let PanelEl = null;
        let PanelHandle = null;  // 共享工厂句柄（销毁走 destroy 统一清理）
    
        function renderList(Filter) {
            if (!PanelEl) return;
            const Body = PanelEl.querySelector('.favrename-panel-body');
            const Renames = getRenames();
            const Marker = getSettings().marker || '';
            Body.innerHTML = '';
            let Count = 0;
            CARD_LIST.forEach(function(Item) {
                const Custom = Renames[Item.bvid];
                const Show = Custom ? Marker + Custom : Item.origTitle;
                const Kw = (Filter || '').toLowerCase();
                if (Kw && Show.toLowerCase().indexOf(Kw) < 0 && Item.origTitle.toLowerCase().indexOf(Kw) < 0) return;
                Count++;
                const Entry = document.createElement('div');
                Entry.className = 'favrename-entry';
                const Title = document.createElement('span');
                Title.className = 'favrename-title';
                if (Custom) {
                    const CustomSpan = document.createElement('span');
                    CustomSpan.className = 'favrename-custom';
                    CustomSpan.textContent = Show;
                    const OrigSpan = document.createElement('span');
                    OrigSpan.className = 'favrename-orig';
                    OrigSpan.textContent = Item.origTitle;
                    Title.appendChild(CustomSpan);
                    Title.appendChild(OrigSpan);
                } else {
                    Title.textContent = Item.origTitle;
                }
                const Btn = document.createElement('button');
                Btn.className = 'bc-btn';
                Btn.textContent = FR_T('BtnRename');
                Btn.addEventListener('click', function() { openEditRow(Entry, Item); });
                Entry.appendChild(Title);
                Entry.appendChild(Btn);
                Body.appendChild(Entry);
            });
            if (!Count) {
                const Empty = document.createElement('div');
                Empty.className = 'favrename-empty';
                Empty.textContent = FR_T('EmptyList');
                Body.appendChild(Empty);
            }
        }
    
        function openEditRow(Entry, Item) {
            Entry.innerHTML = '';
            const Input = document.createElement('input');
            Input.className = 'bc-input favrename-input';
            // 已改名预填当前自定义名，未改名预填原标题，便于直接裁剪
            Input.value = getRenames()[Item.bvid] || Item.origTitle;
            const Ok = document.createElement('button');
            Ok.className = 'bc-btn bc-btn-accent';
            Ok.textContent = FR_T('BtnOK');
            const Cancel = document.createElement('button');
            Cancel.className = 'bc-btn';
            Cancel.textContent = FR_T('BtnCancel');
            Ok.addEventListener('click', function() {
                renameEntry(Item.bvid, Input.value);
                renderList(getFilterValue());
            });
            Cancel.addEventListener('click', function() {
                renderList(getFilterValue());
            });
            Entry.appendChild(Input);
            Entry.appendChild(Ok);
            Entry.appendChild(Cancel);
            Input.focus();
        }
    
        function getFilterValue() {
            if (!PanelEl) return '';
            const Search = PanelEl.querySelector('input.favrename-search');
            return Search ? Search.value : '';
        }
    
        // 写入映射并立即同步页面与面板
        function renameEntry(Bvid, NewName) {
            const R = getRenames();
            if (NewName === '') { delete R[Bvid]; } else { R[Bvid] = NewName; }
            saveRenames(R);
            const S = getSettings();
            CARD_LIST.forEach(function(Item) {
                if (Item.bvid === Bvid) {
                    revertTitle(Item.el);
                    applyTitle(Item.el, Bvid, R, S);
                }
            });
        }
    
        function OpenPanel() {
            if (PanelEl) { PanelEl.remove(); PanelEl = null; }
            if (PanelHandle) { PanelHandle.destroy(); PanelHandle = null; }
            refreshCardList();
            // 外壳交给共享工厂：主题跟随系统（system）并实时监听切换（live）
            PanelHandle = createBcPanel({ id: 'favrename-panel', theme: 'system', live: true });
            PanelEl = PanelHandle.el;
            const Body = document.createElement('div');
            Body.className = 'favrename-panel-body bc-collapse-content';  // 复用共享折叠结构
            const Head = document.createElement('div');
            Head.className = 'favrename-panel-head';
            // 标题区复用共享折叠头：点击折叠/展开面板主体，箭头旋转
            const CollapseHead = document.createElement('div');
            CollapseHead.className = 'bc-collapse-header';
            CollapseHead.style.flex = '0 0 auto';
            const Arrow = document.createElement('span');
            Arrow.className = 'bc-collapse-arrow open';  // 初始展开：箭头指向下
            Arrow.textContent = ' > ';
            const Title = document.createElement('span');
            Title.className = 'favrename-panel-title';
            Title.textContent = 'BiliFavRename';
            CollapseHead.appendChild(Arrow);
            CollapseHead.appendChild(Title);
            CollapseHead.addEventListener('click', function() {
                const Collapsed = Body.classList.toggle('collapsed');
                Arrow.classList.toggle('open', !Collapsed);
            });
            const Search = document.createElement('input');
            Search.className = 'bc-input favrename-search';
            Search.placeholder = FR_T('SearchPlaceholder');
            Search.addEventListener('input', function() { renderList(Search.value); });
            const Close = document.createElement('button');
            Close.className = 'bc-btn';
            Close.textContent = FR_T('BtnClose');
            Close.addEventListener('click', function() {
                PanelHandle.destroy();
                PanelEl = null;
                PanelHandle = null;
            });
            Head.appendChild(CollapseHead);
            Head.appendChild(Search);
            Head.appendChild(Close);
            PanelEl.appendChild(Head);

            // 设置区块（并入面板，位于列表上方；默认收起，菜单「设置」可展开）
            const S = getSettings();
            const SettingsHead = document.createElement('div');
            SettingsHead.className = 'bc-collapse-header';
            SettingsHead.style.flex = '0 0 auto';
            const SettingsArrow = document.createElement('span');
            SettingsArrow.className = 'bc-collapse-arrow';
            SettingsArrow.textContent = ' > ';
            const SettingsTitleEl = document.createElement('span');
            SettingsTitleEl.textContent = FR_T('SettingsTitle');
            SettingsHead.appendChild(SettingsArrow);
            SettingsHead.appendChild(SettingsTitleEl);
            const SettingsBody = document.createElement('div');
            SettingsBody.className = 'favrename-settings-body bc-collapse-content collapsed';
            SettingsHead.addEventListener('click', function() {
                const Collapsed = SettingsBody.classList.toggle('collapsed');
                SettingsArrow.classList.toggle('open', !Collapsed);
            });
            PanelEl.appendChild(SettingsHead);
            PanelEl.appendChild(SettingsBody);

            // 弱标记字符
            const RowMarker = document.createElement('div');
            RowMarker.className = 'bc-row';
            const LabelMarker = document.createElement('label');
            LabelMarker.textContent = FR_T('LabelMarker');
            const MarkerInput = document.createElement('input');
            MarkerInput.className = 'bc-input favrename-marker';
            MarkerInput.value = S.marker;
            MarkerInput.maxLength = 4;
            MarkerInput.addEventListener('change', function() {
                setMarker(MarkerInput.value);
                renderList(getFilterValue());
            });
            RowMarker.appendChild(LabelMarker);
            RowMarker.appendChild(MarkerInput);
            SettingsBody.appendChild(RowMarker);

            // 总开关
            const RowToggle = document.createElement('div');
            RowToggle.className = 'bc-row';
            const LabelToggle = document.createElement('label');
            LabelToggle.textContent = FR_T('LabelToggle');
            const Toggle = document.createElement('input');
            Toggle.type = 'checkbox';
            Toggle.checked = !!S.enabled;
            Toggle.addEventListener('change', function() {
                setEnabled(Toggle.checked);
                renderList(getFilterValue());
            });
            RowToggle.appendChild(LabelToggle);
            RowToggle.appendChild(Toggle);
            SettingsBody.appendChild(RowToggle);

            // 清空全部映射
            const RowClear = document.createElement('div');
            RowClear.className = 'bc-row';
            const ClearBtn = document.createElement('button');
            ClearBtn.className = 'bc-btn bc-btn-danger';
            ClearBtn.textContent = FR_T('BtnClearAll');
            ClearBtn.addEventListener('click', function() {
                clearAllRenames();
                renderList(getFilterValue());
            });
            RowClear.appendChild(ClearBtn);
            SettingsBody.appendChild(RowClear);

            PanelEl.appendChild(Body);
            renderList('');
        }

        // 弱标记字符修改后，对已应用卡片重跑替换
        function setMarker(Char) {
            const S = getSettings();
            S.marker = Char;
            saveSettings(S);
            const R = getRenames();
            document.querySelectorAll(SEL_ITEM).forEach(function(Item) {
                const Bvid = getBvid(Item);
                if (Bvid && R[Bvid]) {
                    revertTitle(Item);
                    applyTitle(Item, Bvid, R, S);
                }
            });
        }
    
        function setEnabled(On) {
            const S = getSettings();
            S.enabled = On;
            saveSettings(S);
            if (On) {
                scanAll(getRenames(), S);
                StartObserver();
            } else {
                RevertAll();
            }
        }
    
        function clearAllRenames() {
            if (!confirm(FR_T('ConfirmClearAll'))) return;
            GM_setValue(KEY_RENAMES, {});
            document.querySelectorAll(SEL_ITEM).forEach(function(Item) { revertTitle(Item); });
            CARD_LIST = [];
            Log(FR_T('LogCleared'));
        }
    
        // 展开设置区块（面板内）；供菜单「设置」调用
        function ExpandSettings() {
            if (!PanelEl) return;
            const SB = PanelEl.querySelector('.favrename-settings-body');
            const SA = PanelEl.querySelector('.favrename-settings-arrow');
            if (SB) SB.classList.remove('collapsed');
            if (SA) SA.classList.add('open');
        }

        // 菜单「设置」：打开面板并展开设置区块
        function OpenPanelWithSettings() {
            if (!PanelEl) OpenPanel();
            ExpandSettings();
        }

        // ======================== 菜单注册与初始化 ========================
        function RegisterMenu() {
            GM_registerMenuCommand(FR_T('MenuOpenPanel'), OpenPanel);
            GM_registerMenuCommand(FR_T('MenuSettings'), OpenPanelWithSettings);
        }
    
        // 是否处于收藏夹页（SPA 路由，pathname 含 /favlist）
        function isFavlistPage() {
            return location.pathname.indexOf('/favlist') >= 0;
        }
    
        // 路由变化监听：SPA 内切换页面脚本不重载，
        // 进入收藏夹页才启动替换，离开则还原并停止
        function WatchUrlChange() {
            let LastUrl = location.href;
            setInterval(function() {
                if (location.href !== LastUrl) {
                    LastUrl = location.href;
                    setTimeout(function() {
                        if (isFavlistPage()) {
                            ApplyAll();
                        } else {
                            RevertAll();
                        }
                    }, 500);
                }
            }, 1000);
        }
    
        // 初始化：脚本 match 整个空间站，仅在收藏夹页启动替换
        FR_Lang = ResolveUILang();  // 解析语言（必须在任何 FR_T() 调用之前）
        RegisterMenu();
        WatchUrlChange();
        if (isFavlistPage()) {
            ApplyAll();
            Log(FR_T('LogInitFav'));
        } else {
            Log(FR_T('LogInitSpace'));
        }
    }

    // ======================== 模块二：信息流精简（原 BiliCompact） ========================
    function InitCompactModule() {
        'use strict';
    
        // ======================== 国际化 (i18n) ========================
        const I18N = {
            zh_CN: {
                // Log
                LogPrefix: '[Bilibili精简]',
                LogSelectorData: '通过data属性探测到选择器:',
                LogSelectorFound: '探测到选择器:',
                LogSelectorFallback: '通过链接回退探测到选择器:',
                LogNoCards: '未找到视频卡片，跳过',
                LogStillNoCards: '仍未找到视频卡片',
                LogProcessed: '已处理: 总视频 {0}, 显示 {1}, 隐藏 {2}',
                LogErrorLimit: 'limitVideos 出错:',
                LogContainerFound: '探测到容器:',
                LogConfigLoaded: '配置加载完成:',
                LogStatus: '精简状态: {0}',
                LogStatusOn: '已开启',
                LogStatusOff: '已关闭',
                LogQuickSet: '已设置最大数量:',
                LogTimerRetry: '定时器检测到可见视频过多，重新执行限制',
                LogInitDone: '脚本初始化完成，当前配置:',
                LogInitError: '初始化失败:',
                LogObserverStarted: 'MutationObserver 已启动，监听容器:',
                LogUrlChanged: 'URL变化:',
                LogPurifierStarted: '评论净化器已启动',
                LogPurifierBlockerCompat: '（检测到 BilibiliBlocker，兼容模式）',
                LogPurifierStopped: '评论净化器已停止',
                LogPurifierBlocked: '已屏蔽评论（命中: {0}）',
                LogPurifierReplaced: '已替换评论{0}: 原 [{1}] 现 [{2}]',
    
                // Menu
                MenuSettings: 'Bilibili精简设置',
                MenuRefresh: '手动刷新精简',
                MenuToggle: '切换精简状态',
                MenuQuickSet: '快速设数量',
                MenuCommentPurifier: '切换评论净化',
    
                // Panel
                PanelTitle: 'Bilibili精简设置',
                PanelStatusLabel: '当前状态',
                PanelStatusActive: '精简中',
                PanelStatusPaused: '已暂停',
                PanelMaxVideos: '最大显示数量',
                PanelExcludeLive: '排除直播',
                PanelExcludeAd: '排除广告',
                PanelExcludeBangumi: '排除番剧',
                PanelExcludePaid: '排除付费课程',
                PanelKeepPromoted: '保留推广位',
                PanelKeepUpids: '保留UP主ID（逗号分隔）',
                PanelDebug: '调试模式',
                PanelEnableCommentPurifier: '启用评论净化（删除@提及，隐藏短评论）',
                PanelCommentSection: '评论屏蔽',
                CommentFuzzyLabel: '评论屏蔽词（每行一条）',
                CommentRegexLabel: '评论屏蔽正则（每行一条）',
                CommentReplaceLabel: '评论内容替换（关键词=>替换词）',
                EmoticonReplaceLabel: '表情替换（图片alt=>文本，留空删除）',
                EnableReplacement: '启用内容替换',
                ClearEmoticons: '清除评论全部表情',
                ReplaceSearchTerms: '搜索跳转词转普通文本',
                PurifierSectionHint: '规则保存后立即对已加载评论生效',
                RegexReplaceLabel: '正则替换（每行一条：正则=>替换词，留空删除）',
                RegexPresetSection: '预设方案（勾选即生效，命中即隐藏整条评论；大小写不敏感）',
                RegexPresetSpam: '营销广告词',
                RegexPresetMeme: '低质梗评论',
                RegexPresetPunch: '打卡式评论（独立短句）',
                RegexPresetEditHint: '点击栏目名展开，可查看并编辑该预设的正则内容',
                RegexPresetReset: '恢复默认',
                RegexReplaceHint: '正则直接匹配原文（不去空白）、区分大小写；需开启「启用内容替换」',
                PurifierTutorial: '用法：模糊词与正则每行一条，命中即整条评论隐藏；正则写错自动跳过（控制台提示）。替换规则 关键词=>替换词；表情替换留空=删除图片。示例正则：\\d{8,} 屏蔽超长数字评论。',
                PanelLanguage: '界面语言 / Language',
                PanelLanguageAuto: '自动 (Auto)',
                PanelBtnPause: '暂停精简',
                PanelBtnResume: '启用精简',
                PanelBtnReset: '恢复默认',
                PanelBtnSave: '保存并应用',
                PanelBtnClose: '关闭',
                PanelColorMode: '颜色模式',
                PanelColorAuto: '跟随系统',
                PanelColorDark: '深色',
                PanelColorLight: '浅色',
                PanelRemovalSection: '去除元素',
                RmCarousel: '首页轮播图',
                RmRightChannel: '右侧频道导航',
                RmChannelIcons: '频道图标行',
                RmChannelBar: '频道栏（整体）',
                RmCreationEntry: '创作中心入口',
                RmUploadEntry: '投稿入口',
                RmLiveEntry: '直播入口',
                RmDynamicEntry: '动态入口',
                RmVipEntry: '大会员VIP',
                RmAdblockTips: '广告提示条',
                RmLeftEntries: '左侧全部入口',
                RmPaletteBtn: '调色板浮窗',
                RmSpaceNotif: '空间-消息通知',

                // Prompt
                PromptQuickSet: '输入最大显示视频数量（1-100）：',
            },
            zh_TW: {
                // Log
                LogPrefix: '[Bilibili精簡]',
                LogSelectorData: '透過data屬性探測到選擇器:',
                LogSelectorFound: '探測到選擇器:',
                LogSelectorFallback: '透過連結回退探測到選擇器:',
                LogNoCards: '未找到影片卡片，跳過',
                LogStillNoCards: '仍未找到影片卡片',
                LogProcessed: '已處理: 總影片 {0}, 顯示 {1}, 隱藏 {2}',
                LogErrorLimit: 'limitVideos 出錯:',
                LogContainerFound: '探測到容器:',
                LogConfigLoaded: '設定載入完成:',
                LogStatus: '精簡狀態: {0}',
                LogStatusOn: '已開啟',
                LogStatusOff: '已關閉',
                LogQuickSet: '已設定最大數量:',
                LogTimerRetry: '定時器偵測到可見影片過多，重新執行限制',
                LogInitDone: '指令碼初始化完成（非侵入式），目前設定:',
                LogInitError: '初始化失敗:',
                LogObserverStarted: 'MutationObserver 已啟動，監聽容器:',
                LogUrlChanged: 'URL變化:',
                LogPurifierStarted: '評論淨化器已啟動',
                LogPurifierBlockerCompat: '（偵測到 BilibiliBlocker，相容模式）',
                LogPurifierStopped: '評論淨化器已停止',
                LogPurifierBlocked: '已封鎖評論（命中: {0}）',
                LogPurifierReplaced: '已替換評論{0}: 原 [{1}] 現 [{2}]',
    
                // Menu
                MenuSettings: 'Bilibili精簡設定',
                MenuRefresh: '手動重新整理精簡',
                MenuToggle: '切換精簡狀態',
                MenuQuickSet: '快速設數量',
                MenuCommentPurifier: '切換評論淨化',
    
                // Panel
                PanelTitle: 'Bilibili精簡設定',
                PanelStatusLabel: '目前狀態',
                PanelStatusActive: '精簡中',
                PanelStatusPaused: '已暫停',
                PanelMaxVideos: '最大顯示數量',
                PanelExcludeLive: '排除直播',
                PanelExcludeAd: '排除廣告',
                PanelExcludeBangumi: '排除番劇',
                PanelExcludePaid: '排除付費課程',
                PanelKeepPromoted: '保留推廣位',
                PanelKeepUpids: '保留UP主ID（逗號分隔）',
                PanelDebug: '除錯模式',
                PanelEnableCommentPurifier: '啟用評論淨化（刪除@提及，隱藏短評論）',
                PanelCommentSection: '評論屏蔽',
                CommentFuzzyLabel: '評論屏蔽詞（每行一條）',
                CommentRegexLabel: '評論屏蔽正則（每行一條）',
                CommentReplaceLabel: '評論內容替換（關鍵詞=>替換詞）',
                EmoticonReplaceLabel: '表情替換（圖片alt=>文字，留空刪除）',
                EnableReplacement: '啟用內容替換',
                ClearEmoticons: '清除評論全部表情',
                ReplaceSearchTerms: '搜尋跳轉詞轉普通文字',
                PurifierSectionHint: '規則儲存後立即對已載入評論生效',
                RegexReplaceLabel: '正則替換（每行一條：正則=>替換詞，留空刪除）',
                RegexPresetSection: '預設方案（勾選即生效，命中即隱藏整條評論；大小寫不敏感）',
                RegexPresetSpam: '行銷廣告詞',
                RegexPresetMeme: '低質梗評論',
                RegexPresetPunch: '打卡式評論（獨立短句）',
                RegexPresetEditHint: '點擊欄目名展開，可查看並編輯該預設的正則內容',
                RegexPresetReset: '回復預設',
                RegexReplaceHint: '正則直接匹配原文（不去空白）、區分大小寫；需開啟「啟用內容替換」',
                PurifierTutorial: '用法：模糊詞與正則每行一條，命中即整條評論隱藏；正則寫錯自動跳過（主控台提示）。替換規則 關鍵詞=>替換詞；表情替換留空=刪除圖片。範例正則：\\d{8,} 屏蔽超長數字評論。',
                PanelLanguage: '介面語言 / Language',
                PanelLanguageAuto: '自動 (Auto)',
                PanelBtnPause: '暫停精簡',
                PanelBtnResume: '啟用精簡',
                PanelBtnReset: '回復預設',
                PanelBtnSave: '儲存並套用',
                PanelBtnClose: '關閉',
                PanelColorMode: '顏色模式',
                PanelColorAuto: '跟隨系統',
                PanelColorDark: '深色',
                PanelColorLight: '淺色',
                PanelRemovalSection: '去除元素',
                RmCarousel: '首頁輪播圖',
                RmRightChannel: '右側頻道導航',
                RmChannelIcons: '頻道圖示列',
                RmChannelBar: '頻道列（整體）',
                RmCreationEntry: '創作中心入口',
                RmUploadEntry: '投稿入口',
                RmLiveEntry: '直播入口',
                RmDynamicEntry: '動態入口',
                RmVipEntry: '大會員VIP',
                RmAdblockTips: '廣告提示列',
                RmLeftEntries: '左側全部入口',
                RmPaletteBtn: '調色板浮窗',
                RmSpaceNotif: '空間-訊息通知',

                // Prompt
                PromptQuickSet: '輸入最大顯示影片數量（1-100）：',
            },
            en_US: {
                // Log
                LogPrefix: '[BiliCompact]',
                LogSelectorData: 'Selector detected via data attribute:',
                LogSelectorFound: 'Selector detected:',
                LogSelectorFallback: 'Selector detected via link fallback:',
                LogNoCards: 'No video cards found, skipping',
                LogStillNoCards: 'Still no video cards found',
                LogProcessed: 'Processed: total {0}, shown {1}, hidden {2}',
                LogErrorLimit: 'limitVideos error:',
                LogContainerFound: 'Container detected:',
                LogConfigLoaded: 'Config loaded:',
                LogStatus: 'Compact status: {0}',
                LogStatusOn: 'Enabled',
                LogStatusOff: 'Disabled',
                LogQuickSet: 'Max videos set to:',
                LogTimerRetry: 'Timer detected too many visible videos, re-running limit',
                LogInitDone: 'BiliCompact initialized (non-invasive), config:',
                LogInitError: 'Initialization failed:',
                LogObserverStarted: 'MutationObserver started, watching container:',
                LogUrlChanged: 'URL changed:',
                LogPurifierStarted: 'Comment purifier started',
                LogPurifierBlockerCompat: ' (BilibiliBlocker detected, compatibility mode)',
                LogPurifierStopped: 'Comment purifier stopped',
                LogPurifierBlocked: 'Comment blocked (hit: {0})',
                LogPurifierReplaced: 'Comment {0} replaced: [{1}] → [{2}]',
    
                // Menu
                MenuSettings: 'BiliCompact Settings',
                MenuRefresh: 'Refresh Compact',
                MenuToggle: 'Toggle Compact',
                MenuQuickSet: 'Quick Set Count',
                MenuCommentPurifier: 'Toggle Comment Purifier',
    
                // Panel
                PanelTitle: 'BiliCompact Settings',
                PanelStatusLabel: 'Status',
                PanelStatusActive: 'Active',
                PanelStatusPaused: 'Paused',
                PanelMaxVideos: 'Max videos',
                PanelExcludeLive: 'Exclude live streams',
                PanelExcludeAd: 'Exclude ads',
                PanelExcludeBangumi: 'Exclude bangumi',
                PanelExcludePaid: 'Exclude paid courses',
                PanelKeepPromoted: 'Keep promoted items',
                PanelKeepUpids: 'Whitelist UP IDs (comma-separated)',
                PanelDebug: 'Debug mode',
                PanelEnableCommentPurifier: 'Enable comment purifier (remove @mentions, hide short comments)',
                PanelCommentSection: 'Comment Blocking',
                CommentFuzzyLabel: 'Block keywords (one per line)',
                CommentRegexLabel: 'Block regexes (one per line)',
                CommentReplaceLabel: 'Text replace (keyword=>replacement)',
                EmoticonReplaceLabel: 'Emoticon replace (alt=>text, empty deletes)',
                EnableReplacement: 'Enable content replacement',
                ClearEmoticons: 'Clear all emoticons',
                ReplaceSearchTerms: 'Search terms → plain text',
                PurifierSectionHint: 'Rules apply to loaded comments after save',
                RegexReplaceLabel: 'Regex replace (one per line: regex=>replacement, empty deletes)',
                RegexPresetSection: 'Presets (check to enable; a hit hides the whole comment; case-insensitive)',
                RegexPresetSpam: 'Spam & promo keywords',
                RegexPresetMeme: 'Low-effort meme comments',
                RegexPresetPunch: 'Check-in comments (standalone phrases)',
                RegexPresetEditHint: 'Click a preset name to expand, view, and edit its regex',
                RegexPresetReset: 'Reset to default',
                RegexReplaceHint: 'Regex matches raw text (whitespace kept), case-sensitive; requires "Enable content replacement"',
                PurifierTutorial: 'Usage: fuzzy words and regexes are one per line; a match hides the whole comment. Invalid regexes are skipped with a console warning. Replacement: keyword=>replacement; emoticon replacement empty = delete image. Example regex: \\d{8,} hides comments with long digit runs.',
                PanelLanguage: 'Language / 語言',
                PanelLanguageAuto: 'Auto',
                PanelBtnPause: 'Pause',
                PanelBtnResume: 'Resume',
                PanelBtnReset: 'Reset Defaults',
                PanelBtnSave: 'Save & Apply',
                PanelBtnClose: 'Close',
                PanelColorMode: 'Color Mode',
                PanelColorAuto: 'Auto (System)',
                PanelColorDark: 'Dark',
                PanelColorLight: 'Light',
                PanelRemovalSection: 'Element Removal',
                RmCarousel: 'Homepage carousel',
                RmRightChannel: 'Right channel navigation',
                RmChannelIcons: 'Channel icons row',
                RmChannelBar: 'Channel bar (whole)',
                RmCreationEntry: 'Creator center entry',
                RmUploadEntry: 'Upload entry',
                RmLiveEntry: 'Live entry',
                RmDynamicEntry: 'Dynamic entry',
                RmVipEntry: 'VIP badge',
                RmAdblockTips: 'Ad block warning bar',
                RmLeftEntries: 'All left entries',
                RmPaletteBtn: 'Palette button',
                RmSpaceNotif: 'Space - notifications',

                // Prompt
                PromptQuickSet: 'Enter max videos to show (1-100):',
            },
            ja_JP: {
                // Log
                LogPrefix: '[BiliCompact]',
                LogSelectorData: 'data属性からセレクターを検出:',
                LogSelectorFound: 'セレクターを検出:',
                LogSelectorFallback: 'リンクからフォールバックしてセレクターを検出:',
                LogNoCards: '動画カードが見つかりません。スキップします',
                LogStillNoCards: '動画カードがまだ見つかりません',
                LogProcessed: '処理完了: 全動画 {0}, 表示 {1}, 非表示 {2}',
                LogErrorLimit: 'limitVideos エラー:',
                LogContainerFound: 'コンテナーを検出:',
                LogConfigLoaded: '設定を読み込みました:',
                LogStatus: '簡素化ステータス: {0}',
                LogStatusOn: '有効',
                LogStatusOff: '無効',
                LogQuickSet: '最大件数を設定しました:',
                LogTimerRetry: 'タイマーが表示動画の過多を検出したため、制限を再実行します',
                LogInitDone: 'BiliCompact 初期化完了（非侵入型）、現在の設定:',
                LogInitError: '初期化に失敗:',
                LogObserverStarted: 'MutationObserver を起動、監視コンテナー:',
                LogUrlChanged: 'URL変更:',
                LogPurifierStarted: 'コメント浄化を開始しました',
                LogPurifierBlockerCompat: '（BilibiliBlocker 検出、互換モード）',
                LogPurifierStopped: 'コメント浄化を停止しました',
                LogPurifierBlocked: 'コメントを遮断しました（ヒット: {0}）',
                LogPurifierReplaced: 'コメントの{0}を置換: 元 [{1}] → 新 [{2}]',

                // Menu
                MenuSettings: 'BiliCompact設定',
                MenuRefresh: '簡素化を再実行',
                MenuToggle: '簡素化のオン/オフ',
                MenuQuickSet: '件数をすばやく設定',
                MenuCommentPurifier: 'コメント浄化の切り替え',

                // Panel
                PanelTitle: 'BiliCompact設定',
                PanelStatusLabel: '現在の状態',
                PanelStatusActive: '簡素化中',
                PanelStatusPaused: '一時停止中',
                PanelMaxVideos: '最大表示件数',
                PanelExcludeLive: 'ライブ配信を除外',
                PanelExcludeAd: '広告を除外',
                PanelExcludeBangumi: 'バングミを除外',
                PanelExcludePaid: '有料コースを除外',
                PanelKeepPromoted: 'プロモーションを保持（件数に含めない）',
                PanelKeepUpids: '投稿者IDを保持（カンマ区切り）',
                PanelDebug: 'デバッグモード',
                PanelEnableCommentPurifier: 'コメント浄化を有効化（@メンションを削除、短文コメントを非表示）',
                PanelCommentSection: 'コメント遮断',
                CommentFuzzyLabel: '遮断キーワード（1行1件）',
                CommentRegexLabel: '遮断正規表現（1行1件）',
                CommentReplaceLabel: 'コメント文字置換（語=>置換語）',
                EmoticonReplaceLabel: '絵文字置換（alt=>テキスト、空欄は削除）',
                EnableReplacement: '内容置換を有効化',
                ClearEmoticons: 'コメントの絵文字を全削除',
                ReplaceSearchTerms: '検索リンクを通常テキスト化',
                PurifierSectionHint: '保存後、読み込み済みコメントへ即時反映',
                RegexReplaceLabel: '正規表現置換（1行1件：正則=>置換語、空欄は削除）',
                RegexPresetSection: 'プリセット（チェックで有効化、一致でコメント全体を非表示；大小文字不区別）',
                RegexPresetSpam: '広告・プロモーション語',
                RegexPresetMeme: '低質ネタコメント',
                RegexPresetPunch: 'チェックイン系コメント（単独文）',
                RegexPresetEditHint: '欄名をクリックして展開し、正規表現の確認・編集ができます',
                RegexPresetReset: '既定値に戻す',
                RegexReplaceHint: '正規表現は原文そのまま（空白除去なし）で大小文字を区別；「内容置換を有効化」が必要',
                PurifierTutorial: '使い方: キーワードと正規表現は1行1件、一致するとコメント全体を非表示にします。不正な正規表現はスキップされコンソールに警告が出ます。置換: 語=>置換語; 絵文字置換の空欄は画像削除。例: \\d{8,} は長い数字列を非表示にします。',
                PanelLanguage: '言語 / Language',
                PanelLanguageAuto: '自動 (Auto)',
                PanelBtnPause: '一時停止',
                PanelBtnResume: '再開',
                PanelBtnReset: '初期設定に戻す',
                PanelBtnSave: '保存して適用',
                PanelBtnClose: '閉じる',
                PanelColorMode: 'カラーモード',
                PanelColorAuto: 'システムに従う',
                PanelColorDark: 'ダーク',
                PanelColorLight: 'ライト',
                PanelRemovalSection: '要素の除去',
                RmCarousel: 'トップページのカルーセル',
                RmRightChannel: '右側のチャンネルナビ',
                RmChannelIcons: 'チャンネルアイコン列',
                RmChannelBar: 'チャンネルバー（全体）',
                RmCreationEntry: '創作センター入口',
                RmUploadEntry: '投稿入口',
                RmLiveEntry: 'ライブ配信入口',
                RmDynamicEntry: '動態入口',
                RmVipEntry: '大会員VIP',
                RmAdblockTips: '広告警告バー',
                RmLeftEntries: '左側の全入口',
                RmPaletteBtn: 'パレット浮窓',
                RmSpaceNotif: 'スペース-お知らせ',

                // Prompt
                PromptQuickSet: '表示する最大動画数を入力してください（1-100）：',
            }
        };
    
        // 当前生效的语言
        let CurrentLang = 'zh_CN';
    
        function ResolveLanguage() {
            if (Config.Language && Config.Language !== 'auto') {
                return Config.Language;
            }
            return ResolveUILang();
        }
    
        function T(Key, ...Args) {
            const Map = I18N[CurrentLang] || I18N['zh_CN'];
            let Str = Map[Key];
            if (Str === undefined) {
                // Fallback to zh_CN if key missing in current locale
                Str = I18N['zh_CN'][Key];
            }
            if (Str === undefined) return Key; // ultimate fallback: show the key itself
            // Replace placeholders {0}, {1}, {2}...
            for (let I = 0; I < Args.length; I++) {
                Str = Str.replace('{' + I + '}', Args[I]);
            }
            return Str;
        }
    
        // ======================== 配置（默认值，会从GM存储读取） ========================
        // 预设方案 id → 配置键 / i18n 标签键（规则内容用户可编辑，存于 Config）
        const REGEX_PRESET_KEYS = { spam: 'PresetSpam', meme: 'PresetMeme', punch: 'PresetPunch' };
        const PRESET_LABEL_KEYS = { spam: 'RegexPresetSpam', meme: 'RegexPresetMeme', punch: 'RegexPresetPunch' };
        const DEFAULTS = {
            MaxVideos: 10,                 // 最大显示数量
            ExcludeLive: true,             // 排除直播
            ExcludeAd: true,              // 排除广告
            ExcludeBangumi: true,         // 排除番剧
            ExcludePaid: true,            // 排除付费课程
            KeepSpecialUPIDs: [],         // 保留的UP主ID列表（数字）
            KeepPromoted: false,          // 保留推广位（不计入数量）
            Language: 'auto',             // 界面语言: auto | zh_CN | zh_TW | en_US | ja_JP
            Debug: false,                 // 调试模式
            EnableCommentPurifier: false, // 评论净化器 (删除@提及，隐藏短评论)
            // 正则预设方案（勾选 enabled 即生效，命中即隐藏整条评论；大小写不敏感，去空白后匹配）
            // rule 为用户可编辑的正则内容；DEFAULTS 即出厂默认，面板「恢复默认」按钮取此处值
            PresetSpam: { enabled: false, rule: '心流AI助手|Vinsight|传智AI|MilkyAi|UP主加油！看好你噢|求文档|已私|求私|提醒我回来看|回来刷播放|传说榜|给我喜欢的人表白|还在听的是这个|点个赞让我回来再听一遍|对她表白|表白成功|谢谢小狗|中转站' },
            PresetMeme: { enabled: false, rule: '复习到这里|准高一|神人TV|已读乱回|东方是什么动漫|他们为什么打架|不是哥们|发一遍这段文字|躺在这里会比较舒服|这期神了|神在哪|这期拉了|拉在哪|一个赞换一天头像|我想听那一句|我想听那句|一起赤石|VOCAILAND|AI中转站|到底好还是差|绷住挑战|不要做挑战|不要呼吸挑战|绷不住了' },
            PresetPunch: { enabled: false, rule: '(?:^合影$|^见证历史$|别逗你[^姐].{0,5}姐笑了|你看我这.{0,4}级号|看看你的?.{0,6}剪贴板|我想建个只有.{0,20}的楼|请投.{0,20}一票|传说曲时间\\d{1,9}|一起[赤吃]石|做得好好[！!]?$|做得好差[！!]?$|好在哪[！!?？]?$)' },
            CommentKeywords: [],       // 评论屏蔽词（模糊，子串包含，大小写不敏感）
            CommentRegex: [],          // 评论屏蔽正则（去空白后部分匹配）
            SubstituteWords: [],       // 替换规则 [{find, replace, scopes:['content'|'emoticon']}]
            RegexReplaceWords: [],     // 正则替换规则 [{find, replace, scopes:['regex']}]（直接匹配原文，空替换=删除）
            EnableReplacement: false,  // 评论内容替换总开关
            ClearCommentEmoticons: false, // 清除评论中全部表情
            ReplaceCommentSearchTerms: false, // 搜索跳转关键词转普通文本
            RemovedElements: {},          // 元素去除: { presetId: true/false }
            ColorMode: 'auto',            // 颜色模式: auto | dark | light
        };
    
        // ======================== 状态 ========================
        let Config = {};
        let IsActive = true;               // 是否启用精简（切换开关）
        let EffectiveSelector = null;      // 缓存的有效选择器
        let VideoListContainer = null;     // 缓存的列表容器
        let Observer = null;
        let DebounceTimer = null;
        let PurifierStarted = false;         // 评论净化器是否已启动
        let PurifierObservers = [];          // 评论净化器的 MutationObserver 列表
        let LastRun = 0;
        const THROTTLE_INTERVAL = 200;     // 节流间隔（ms）
    
        // ======================== 工具函数 ========================
        function Log(...Args) {
            if (Config.Debug) console.log(T('LogPrefix'), ...Args);
        }
    
        function ErrorLog(...Args) {
            console.error(T('LogPrefix'), ...Args);
        }
    
        // 安全获取存储
        function GetConfig() {
            const Cfg = {};
            for (const [Key, Def] of Object.entries(DEFAULTS)) {
                try {
                    const Val = GM_getValue(Key, Def);
                    Cfg[Key] = Val;
                } catch (E) {
                    Cfg[Key] = Def;
                }
            }
            return Cfg;
        }
    
        function SaveConfig(Cfg) {
            for (const [Key, Val] of Object.entries(Cfg)) {
                try {
                    GM_setValue(Key, Val);
                } catch (E) {}
            }
        }
    
        // ======================== 评论净化器 (Comment Purifier) ========================
    
        /**
         * 检查页面中是否存在 BilibiliBlocker 的标记
         * Blocker 会在 bili-comment-user-info 的 shadowRoot 中插入 button[gz_type]
         * 一次同步检测，不做任何等待；没装就是没装，直接跳过协调。
         */
        function purifierHasBlockerInstalled() {
            try {
                const comments = document.querySelector('bili-comments');
                if (!comments?.shadowRoot) return false;
                const threads = comments.shadowRoot.querySelectorAll('bili-comment-thread-renderer');
                if (threads.length === 0) return false;
                return Array.from(threads).some(thread => {
                    const comment = thread.shadowRoot?.getElementById('comment');
                    if (!comment?.shadowRoot) return false;
                    const userInfo = comment.shadowRoot.querySelector('bili-comment-user-info');
                    if (!userInfo?.shadowRoot) return false;
                    const info = userInfo.shadowRoot.getElementById('info');
                    return !!info?.querySelector('button[gz_type]');
                });
            } catch { return false; }
        }
    
        /**
         * 从 bili-comment-renderer 内部获取 #contents 容器
         * 穿透 2 层 Shadow DOM: bili-comment-renderer -> bili-rich-text
         */
        function purifierGetContentsEl(renderer) {
            try {
                const richText = renderer.shadowRoot.querySelector('bili-rich-text');
                if (richText && richText.shadowRoot) {
                    return richText.shadowRoot.getElementById('contents');
                }
            } catch (_) {}
            return null;
        }
    
        /**
         * 查找页面上所有 <bili-comment-renderer>
         * 从 <bili-comments> 开始穿透 Shadow DOM
         */
        function purifierFindRenderers() {
            const list = [];
            try {
                const comments = document.querySelector('bili-comments');
                if (comments && comments.shadowRoot) {
                    const threads = comments.shadowRoot.querySelectorAll('bili-comment-thread-renderer');
                    for (const thread of threads) {
                        if (thread.shadowRoot) {
                            thread.shadowRoot.querySelectorAll('bili-comment-renderer').forEach(r => list.push(r));
                        }
                    }
                }
            } catch (_) {}
            return list;
        }
    
        /**
         * 处理单条评论：
         *   a. 删除所有 @提及 <a data-type="mention">
         *   b. 清理后有效字符 < 5 -> 隐藏整条评论
         */
        function purifierProcessRenderer(renderer) {
            const doneKey = 'bcPurified';
            if (renderer.dataset[doneKey]) return;
            renderer.dataset[doneKey] = '1';

            const contents = purifierGetContentsEl(renderer);
            if (!contents) return;

            // 1. 屏蔽判定（用含 @提及的原文，对齐 Blocker 数据层语义）
            const RawText = contents.textContent || '';
            const Hit = CommentRuleEngine.blockComment(RawText, Config.CommentKeywords, Config.CommentRegex);
            if (Hit.state) {
                renderer.style.display = 'none';
                renderer.dataset.bcBlocked = '1';
                try {
                    const threadRenderer = renderer.getRootNode().host;
                    if (threadRenderer) threadRenderer.style.display = 'none';
                } catch (_) {}
                Log(T('LogPurifierBlocked', Hit.matching));
                return;
            }
            // 1b. 预设方案命中 → 整条隐藏（去空白后匹配、大小写不敏感；与手动屏蔽正则区分大小写不同）
            const PresetId = purifierPresetBlockHit(RawText);
            if (PresetId !== null) {
                renderer.style.display = 'none';
                renderer.dataset.bcBlocked = '1';
                try {
                    const threadRenderer = renderer.getRootNode().host;
                    if (threadRenderer) threadRenderer.style.display = 'none';
                } catch (_) {}
                Log(T('LogPurifierBlocked', T(PRESET_LABEL_KEYS[PresetId] || PresetId)));
                return;
            }
            // 未命中：恢复之前被屏蔽的评论（规则变更重扫场景）
            if (renderer.dataset.bcBlocked) {
                delete renderer.dataset.bcBlocked;
                renderer.style.display = '';
                try {
                    const threadRenderer = renderer.getRootNode().host;
                    if (threadRenderer) threadRenderer.style.display = '';
                } catch (_) {}
            }

            // 2. 删除所有 @提及标签（原有行为；必须先于搜索词替换，否则会被 a→span 一并吞掉）
            const mentions = contents.querySelectorAll('a[data-type="mention"]');
            for (const m of mentions) {
                m.remove();
            }

            // 3. 内容替换（对齐 Blocker: 表情 → 搜索词 → 关键词；替换元素打 replace 标记防重）
            if (Config.ClearCommentEmoticons) {
                contents.querySelectorAll('img').forEach(function(Img) { Img.remove(); });
            } else if (Config.EnableReplacement) {
                // 3a. 表情替换：img[alt] 全等匹配，replace 为空 → 删除图片
                contents.querySelectorAll('img').forEach(function(Img) {
                    if (Img.hasAttribute('replace')) return;
                    const Alt = Img.getAttribute('alt');
                    if (!Alt) return;
                    const R = CommentRuleEngine.replaceEmoticons(Config.SubstituteWords, Alt);
                    if (!R.state) return;
                    if (R.model === 'del') {
                        Img.remove();
                        Log(T('LogPurifierReplaced', '表情', Alt, ''));
                    } else {
                        const Span = document.createElement('span');
                        Span.setAttribute('replace', '');
                        Span.textContent = R.content;
                        Img.replaceWith(Span);
                        Log(T('LogPurifierReplaced', '表情', Alt, R.content));
                    }
                });
                // 3b. 搜索跳转词：剩余 a 全部转为普通 span（@提及已删，此处都是搜索词）
                if (Config.ReplaceCommentSearchTerms) {
                    contents.querySelectorAll('a').forEach(function(A) {
                        const Span = document.createElement('span');
                        Span.setAttribute('replace', '');
                        Span.textContent = A.textContent;
                        A.replaceWith(Span);
                    });
                }
                // 3c. 关键词替换：span 文本 contains(find) 且 scope 含 'content'
                contents.querySelectorAll('span').forEach(function(Span) {
                    if (Span.getAttribute('replace') !== null) return;
                    const OldText = Span.textContent || '';
                    const R = CommentRuleEngine.replaceKeywords(Config.SubstituteWords, OldText, 'content');
                    if (!R.state) return;
                    Span.textContent = R.content;
                    Span.setAttribute('replace', '');
                    Log(T('LogPurifierReplaced', '内容', OldText, R.content));
                });
                // 3d. 正则替换：手动规则（区分大小写）+ 已勾选预设（大小写不敏感）；空替换=删除
                //      匹配直接作用于原文（不去空白，区别于屏蔽正则）；删除后参与第 4 步字数判定
                const RegexRules = purifierRegexReplaceRules();
                if (RegexRules.length > 0) {
                    contents.querySelectorAll('span').forEach(function(Span) {
                        if (Span.getAttribute('replace') !== null) return;
                        const OldText = Span.textContent || '';
                        const R = CommentRuleEngine.replaceRegex(RegexRules, OldText);
                        if (!R.state) return;
                        Span.textContent = R.content;
                        Span.setAttribute('replace', '');
                        Log(T('LogPurifierReplaced', '正则', OldText, R.content));
                    });
                }
            }

            // 4. 计算剩余有效字符（原有行为）
            const remaining = contents.textContent.replace(/\s+/g, '').trim();

            // 不足5字 -> 隐藏整条评论（原有行为）
            if (remaining.length < 5) {
                renderer.style.display = 'none';
                try {
                    const threadRenderer = renderer.getRootNode().host;
                    if (threadRenderer) threadRenderer.style.display = 'none';
                } catch (_) {}
            }
        }
    
        /**
         * 规则变更后重扫全部已渲染评论：
         * 清除 bcPurified 防重标记后重新处理——屏蔽判定按新规则恢复/隐藏，
         * 替换阶段因元素带 replace 标记而幂等。
         */
        function purifierRescanAll() {
            if (!PurifierStarted) return;
            purifierFindRenderers().forEach(function(R) {
                delete R.dataset.bcPurified;
            });
            purifierFindRenderers().forEach(purifierProcessRenderer);
        }

        /**
         * 生效的正则替换规则 = 手动规则（区分大小写；预设方案已移出替换通道，见 purifierPresetBlockHit）
         */
        function purifierRegexReplaceRules() {
            const Out = [];
            (Config.RegexReplaceWords || []).forEach(function(R) {
                if (R && R.find) Out.push({ find: R.find, replace: R.replace || '' });
            });
            return Out;
        }

        /**
         * 预设方案命中检测：已勾选预设逐条对原文（去空白）做大小写不敏感正则匹配
         * 命中即整条评论隐藏（与手动屏蔽词/正则同层，先于内容替换）
         * 规则内容来自 Config（用户可在面板展开编辑），空规则视为未启用
         */
        function purifierPresetBlockHit(text) {
            for (const Id in REGEX_PRESET_KEYS) {
                const P = Config[REGEX_PRESET_KEYS[Id]];
                if (!P || !P.enabled || !P.rule) continue;
                const R = CommentRuleEngine.regexMatch([P.rule], text, true);
                if (R.hit !== null) return Id;
            }
            return null;
        }

        /**
         * 启动评论净化器
         * - 监听评论区动态加载，自动处理新增评论
         * - 首次扫描零延迟；检测到 Blocker 只在日志中标记，不影响流程
         */
        function startCommentPurifier() {
            if (!Config.EnableCommentPurifier) return;
            if (PurifierStarted) return;
            PurifierStarted = true;
    
            let scanTimer = null;
    
            function scheduleScan() {
                if (scanTimer) clearTimeout(scanTimer);
                scanTimer = setTimeout(() => {
                    purifierFindRenderers().forEach(purifierProcessRenderer);
                    scanTimer = null;
                }, 800);
            }
    
            // MutationObserver 监听 bili-comments 的 shadowRoot
            try {
                const comments = document.querySelector('bili-comments');
                if (comments?.shadowRoot) {
                    const obs = new MutationObserver(() => scheduleScan());
                    obs.observe(comments.shadowRoot, { childList: true, subtree: true });
                    PurifierObservers.push(obs);
                }
            } catch (_) {}
    
            // MutationObserver 监听 document.body（兜底）
            const obsBody = new MutationObserver(() => scheduleScan());
            obsBody.observe(document.body, { childList: true, subtree: true });
            PurifierObservers.push(obsBody);
    
            // 首次扫描——不等待、不轮询，直接执行
            purifierFindRenderers().forEach(purifierProcessRenderer);
    
            const hasBlocker = purifierHasBlockerInstalled();
            Log(T('LogPurifierStarted') + (hasBlocker ? T('LogPurifierBlockerCompat') : ''));
        }
    
        /**
         * 停止评论净化器
         * - 断开所有 MutationObserver
         * - 已处理的评论保持状态不变
         */
        function stopCommentPurifier() {
            PurifierStarted = false;
            for (const obs of PurifierObservers) {
                try { obs.disconnect(); } catch (_) {}
            }
            PurifierObservers = [];
            Log(T('LogPurifierStopped'));
        }
    
        /**
         * 切换评论净化器（供 TM 菜单命令调用）
         * 同时保存配置变更
         */
        function toggleCommentPurifier() {
            Config.EnableCommentPurifier = !Config.EnableCommentPurifier;
            SaveConfig({ EnableCommentPurifier: Config.EnableCommentPurifier });
            if (Config.EnableCommentPurifier) {
                startCommentPurifier();
            } else {
                stopCommentPurifier();
            }
        }
    
        // ======================== 元素去除 (Element Removal) ========================
    
        /**
         * 可去除的元素预设列表
         * 每条包含：唯一 id、适用域名 host、显示名称 name、CSS选择器列表 selectors（多版本兼容）
         */
        const ELEMENT_REMOVAL_PRESETS = [
            {
                id: 'carousel',
                host: 'www.bilibili.com',
                name: '首页轮播图',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > main.bili-feed4-layout:nth-child(3) > div.feed2:last-child > div.recommended-container_floor-aside > div.container.is-version8:first-child > div.recommended-swipe.grid-anchor:first-child > div.recommended-swipe-core > div.recommended-swipe-body:last-child > div.carousel-area > div.carousel',
                    '#app > div.bili-feed4:last-child > main.bili-feed4-layout:nth-child(2) > div.feed2:last-child > div.recommended-container_floor-aside > div.container.is-version8:first-child > div.recommended-swipe:first-child',
                    '#app > div.bili-feed4:last-child > main.bili-feed4-layout:nth-child(3) > div.feed2:last-child > div.recommended-container_floor-aside > div.container.is-version8:first-child > div.recommended-swipe:first-child'
                ]
            },
            {
                id: 'right-channel',
                host: 'www.bilibili.com',
                name: '右侧频道导航',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__channel:nth-child(3) > div.right-channel-container:last-child',
                    '#app > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__channel:last-child > div.right-channel-container:last-child'
                ]
            },
            {
                id: 'channel-icons',
                host: 'www.bilibili.com',
                name: '频道图标行',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__channel:nth-child(3) > div.channel-icons:first-child',
                    '#app > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__channel:last-child > div.channel-icons:first-child'
                ]
            },
            {
                id: 'channel-bar',
                host: 'www.bilibili.com',
                name: '频道栏（整体）',
                selectors: [
                    '#app > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__channel:last-child'
                ]
            },
            {
                id: 'creation-entry',
                host: 'www.bilibili.com',
                name: '创作中心入口',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.left-entry:first-child > li.v-popover-wrap.left-loc-entry:nth-child(8) > div'
                ]
            },
            {
                id: 'upload-entry',
                host: 'www.bilibili.com',
                name: '投稿入口',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.left-entry:first-child > li.v-popover-wrap.left-loc-entry:nth-child(9) > div > a.loc-entry.loc-moveclip'
                ]
            },
            {
                id: 'live-entry',
                host: 'www.bilibili.com',
                name: '直播入口',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.left-entry:first-child > li.v-popover-wrap:last-child'
                ]
            },
            {
                id: 'dynamic-entry',
                host: 'www.bilibili.com',
                name: '动态入口',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.left-entry:first-child > li.v-popover-wrap:nth-child(5)'
                ]
            },
            {
                id: 'vip-entry',
                host: 'www.bilibili.com',
                name: '大会员VIP',
                selectors: [
                    '#i_cecream > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.right-entry:last-child > div.vip-wrap:nth-child(2)'
                ]
            },
            {
                id: 'adblock-tips',
                host: 'www.bilibili.com',
                name: '广告提示条',
                selectors: [
                    '#i_cecream > div.adblock-tips:nth-child(2)'
                ]
            },
            {
                id: 'left-entries',
                host: 'www.bilibili.com',
                name: '左侧全部入口',
                selectors: [
                    '#app > div.bili-feed4:last-child > div.bili-header.large-header:first-child > div.bili-header__bar:first-child > ul.left-entry:first-child'
                ]
            },
            {
                id: 'palette-btn',
                host: 'www.bilibili.com',
                name: '调色板浮窗',
                selectors: [
                    '#app > div.bili-feed4:last-child > div.palette-button-outer.palette-feed4:nth-child(4)'
                ]
            },
            {
                id: 'space-notif',
                host: 'space.bilibili.com',
                name: '空间-消息通知',
                selectors: [
                    '#biliMainHeader > div.bili-header > div.bili-header__bar.mini-header:first-child > ul.left-entry:first-child > li.v-popover-wrap:last-child'
                ]
            }
        ];
    
        // 预设显示名的 i18n 键：id kebab-case → 'Rm' + PascalCase（如 'right-channel' → 'RmRightChannel'）
        // 与 I18N 字典中 Rm* 键一一对应；P.name 保留作为预设自身的可读说明
        function RmNameKey(Id) {
            return 'Rm' + Id.split('-').map(function(W) { return W.charAt(0).toUpperCase() + W.slice(1); }).join('');
        }

        let ElementRemovalStates = {};  // { presetId: { element, originalDisplay } }
    
        /**
         * 应用/恢复元素去除
         * 按配置隐藏勾选的元素，恢复取消勾选的元素
         */
        function applyElementRemoval() {
            const enabled = Config.RemovedElements || {};
            const host = location.hostname;
    
            // 先恢复已取消勾选的元素
            for (const id of Object.keys(ElementRemovalStates)) {
                if (!enabled[id]) {
                    ElementRemovalStates[id].element.style.display = ElementRemovalStates[id].originalDisplay;
                    delete ElementRemovalStates[id];
                }
            }
    
            // 再应用新勾选的元素
            for (const preset of ELEMENT_REMOVAL_PRESETS) {
                if (preset.host !== host) continue;
                if (!enabled[preset.id]) continue;
                if (ElementRemovalStates[preset.id]) continue; // 已隐藏
    
                for (const sel of preset.selectors) {
                    try {
                        const el = document.querySelector(sel);
                        if (el) {
                            ElementRemovalStates[preset.id] = {
                                element: el,
                                originalDisplay: el.style.display || ''
                            };
                            el.style.display = 'none';
                            break; // 找到一个版本即隐藏，不再试其他
                        }
                    } catch (_) {}
                }
            }
        }
    
        // ======================== 选择器探测与缓存 ========================
        function DetectSelector() {
            if (EffectiveSelector) return EffectiveSelector;
    
            // 第一梯队：具体选择器（优先使用，构建联合选择器）
            const SpecificCandidates = [
                '.bili-video-card',
                '.feed-card',
                '.bili-feed-card',
                '.floor-single-card',
                '.floor-card',
                '.video-item',
                '.feed-item'
            ];
    
            // 第二梯队：宽泛选择器（仅在具体选择器全部失败时使用）
            const BroadCandidates = [
                '[class*="video-card"]',
                '[class*="bili-video"]',
                '[class*="feed-card"]',
                '[class*="feed-item"]',
                '[class*="floor-card"]'
            ];
    
            // 收集所有能匹配到元素的具体选择器，构建联合选择器
            const MatchedSelectors = [];
    
            // 首先尝试通过 data 属性查找
            const DataCandidates = [
                '[data-video-id]',
                '[data-aid]'
            ];
            for (const Sel of DataCandidates) {
                const Els = document.querySelectorAll(Sel);
                if (Els.length > 0) {
                    for (const El of Els) {
                        const Card = El.closest('.bili-video-card, .feed-card, .bili-feed-card, .video-item, .feed-item, .floor-single-card, .floor-card, [class*="video-card"], [class*="feed-card"], [class*="feed-item"], [class*="floor-card"]');
                        if (Card) {
                            const CardSel = (Card.tagName === El.tagName) ? Sel :
                                Array.from(Card.classList).map(C => '.' + C).join('');
                            if (!MatchedSelectors.includes(CardSel)) {
                                MatchedSelectors.push(CardSel);
                            }
                        }
                    }
                }
            }
    
            // 遍历具体候选选择器，收集所有匹配到的
            for (const Sel of SpecificCandidates) {
                try {
                    const Els = document.querySelectorAll(Sel);
                    if (Els.length > 0) {
                        if (!MatchedSelectors.includes(Sel)) {
                            MatchedSelectors.push(Sel);
                        }
                    }
                } catch (E) {
                    // 跳过无效选择器
                }
            }
    
            if (MatchedSelectors.length > 0) {
                EffectiveSelector = MatchedSelectors.join(', ');
                Log(T('LogSelectorFound'), EffectiveSelector);
                return EffectiveSelector;
            }
    
            // 具体选择器全部失败时，尝试宽泛选择器（仅取第一个匹配的）
            for (const Sel of BroadCandidates) {
                try {
                    const Els = document.querySelectorAll(Sel);
                    if (Els.length > 0) {
                        EffectiveSelector = Sel;
                        Log(T('LogSelectorFound'), EffectiveSelector);
                        return EffectiveSelector;
                    }
                } catch (E) {
                    // 跳过无效选择器
                }
            }
    
            // 最后回退：查找包含 /video/, /bangumi/ 或 live.bilibili.com 链接的父级卡片
            const LinkSelectors = [
                'a[href*="/video/"]',
                'a[href*="/bangumi/"]',
                'a[href*="live.bilibili.com"]'
            ];
            for (const LinkSel of LinkSelectors) {
                const Links = document.querySelectorAll(LinkSel);
                for (const Link of Links) {
                    let Parent = Link.parentElement;
                    let Depth = 0;
                    while (Parent && Depth < 5) {
                        const Cls = Parent.className || '';
                        if (Cls.includes('card') || Cls.includes('item') || Cls.includes('feed') || Cls.includes('video') || Cls.includes('floor')) {
                            EffectiveSelector = '.' + Cls.split(' ').join('.');
                            Log(T('LogSelectorFallback'), EffectiveSelector);
                            return EffectiveSelector;
                        }
                        Parent = Parent.parentElement;
                        Depth++;
                    }
                }
            }
    
            return null;
        }
    
        // 获取视频列表容器（缩小观察范围）
        function DetectContainer() {
            if (VideoListContainer) return VideoListContainer;
            const Containers = [
                '.bili-feed4',
                '.bili-feed',
                '.feed2',
                '.feed-list',
                '.video-list',
                '.bili-video-list',
                '.recommend-container',
                '.recommended-container_floor-aside'
            ];
            for (const Sel of Containers) {
                const El = document.querySelector(Sel);
                if (El) {
                    VideoListContainer = El;
                    Log(T('LogContainerFound'), Sel);
                    return El;
                }
            }
            VideoListContainer = document.body;
            return VideoListContainer;
        }
    
        // ======================== 卡片显示/隐藏辅助函数 ========================
        // 需要同时隐藏的祖先包装器类名（解决 Bilibili CSS Grid 单元格不塌陷问题）
        const WRAPPER_CLASSES = ['bili-feed-card', 'feed-card'];
    
        function ApplyHideStyles(El) {
            El.classList.add('BiliLimitedHide');
            El.style.display = 'none';
            El.style.visibility = 'hidden';
            El.style.opacity = '0';
            El.style.height = '0';
            El.style.margin = '0';
            El.style.padding = '0';
            El.style.overflow = 'hidden';
            El.style.flex = '0 0 0';
            El.style.position = 'absolute';
        }
    
        function ClearHideStyles(El) {
            El.classList.remove('BiliLimitedHide');
            El.style.display = '';
            El.style.visibility = '';
            El.style.opacity = '';
            El.style.height = '';
            El.style.margin = '';
            El.style.padding = '';
            El.style.overflow = '';
            El.style.position = '';
            El.style.flex = '';
        }
    
        // 隐藏卡片及其祖先包装器（.bili-feed-card, .feed-card）
        function HideCardTree(Card) {
            ApplyHideStyles(Card);
            let Ancestor = Card.parentElement;
            while (Ancestor && Ancestor !== document.body) {
                const Cls = (Ancestor.className || '').toLowerCase();
                let IsWrapper = false;
                for (let W = 0; W < WRAPPER_CLASSES.length; W++) {
                    if (Cls.indexOf(WRAPPER_CLASSES[W]) !== -1) {
                        IsWrapper = true;
                        break;
                    }
                }
                if (IsWrapper) {
                    ApplyHideStyles(Ancestor);
                }
                Ancestor = Ancestor.parentElement;
            }
        }
    
        // 显示卡片及其祖先包装器
        function ShowCardTree(Card) {
            ClearHideStyles(Card);
            let Ancestor = Card.parentElement;
            while (Ancestor && Ancestor !== document.body) {
                const Cls = (Ancestor.className || '').toLowerCase();
                let IsWrapper = false;
                for (let W = 0; W < WRAPPER_CLASSES.length; W++) {
                    if (Cls.indexOf(WRAPPER_CLASSES[W]) !== -1) {
                        IsWrapper = true;
                        break;
                    }
                }
                if (IsWrapper) {
                    ClearHideStyles(Ancestor);
                }
                Ancestor = Ancestor.parentElement;
            }
        }
    
        // ======================== 核心过滤逻辑 ========================
        function LimitVideos() {
            if (!IsActive) {
                RestoreAllVideos();
                return;
            }
    
            try {
                const Selector = DetectSelector();
                if (!Selector) {
                    Log(T('LogNoCards'));
                    return;
                }
    
                // 获取所有卡片
                let Cards = document.querySelectorAll(Selector);
                if (Cards.length === 0) {
                    // 扩展回退：同时查找 /video/, /bangumi/ 和 live.bilibili.com 链接
                    const LinkSelectors = [
                        'a[href*="/video/"]',
                        'a[href*="/bangumi/"]',
                        'a[href*="live.bilibili.com"]'
                    ];
                    const ParentCards = new Set();
                    for (const LinkSel of LinkSelectors) {
                        const Links = document.querySelectorAll(LinkSel);
                        for (const Link of Links) {
                            let Parent = Link.parentElement;
                            let Depth = 0;
                            while (Parent && Depth < 5) {
                                if (Parent.className && (Parent.className.includes('card') || Parent.className.includes('item') || Parent.className.includes('feed') || Parent.className.includes('floor'))) {
                                    ParentCards.add(Parent);
                                    break;
                                }
                                Parent = Parent.parentElement;
                                Depth++;
                            }
                        }
                    }
                    Cards = Array.from(ParentCards);
                    if (Cards.length === 0) {
                        Log(T('LogStillNoCards'));
                        return;
                    }
                }
    
                let VideoCards = Array.from(Cards);
    
                // 去重：移除嵌套包装器，只保留最内层卡片（bili-video-card > 其他包装器）
                // 避免同一个卡片被多次计数
                const NestedRemoval = new Set();
                for (let I = 0; I < VideoCards.length; I++) {
                    for (let J = 0; J < VideoCards.length; J++) {
                        if (I !== J && VideoCards[I].contains(VideoCards[J])) {
                            // VideoCards[I] 是 VideoCards[J] 的祖先 → 移除祖先
                            NestedRemoval.add(I);
                            break;
                        }
                    }
                }
                if (NestedRemoval.size > 0) {
                    VideoCards = VideoCards.filter((_, Idx) => !NestedRemoval.has(Idx));
                }
    
                // 辅助函数：检查卡片链接是否指向特定域名/路径
                function CardLinksTo(Card, Pattern) {
                    const Links = Card.querySelectorAll('a[href]');
                    for (const Link of Links) {
                        if (Link.href.indexOf(Pattern) !== -1) return true;
                    }
                    return false;
                }
    
                // 过滤非视频内容 —— 收集被排除的卡片，稍后统一隐藏
                const ExcludedCards = [];
                VideoCards = VideoCards.filter(Card => {
                    const Text = (Card.textContent || '').toLowerCase();
                    const Cls = (Card.className || '').toLowerCase();
                    // 检查 floor-title 标签（Bilibili新版卡片分类标签）
                    const FloorTitle = Card.querySelector('.floor-title');
                    const FloorTitleText = FloorTitle ? (FloorTitle.textContent || '').toLowerCase() : '';
    
                    let ShouldExclude = false;
    
                    if (Config.ExcludeLive && (
                        Cls.includes('live') ||
                        Text.includes('直播') || Text.includes('正在直播') || Text.includes('直播中') ||
                        FloorTitleText.includes('直播') || FloorTitleText.includes('赛事') ||
                        CardLinksTo(Card, 'live.bilibili.com')
                    )) {
                        ShouldExclude = true;
                    }
                    if (!ShouldExclude && Config.ExcludeAd && (Cls.includes('ad') || Cls.includes('advert') || Text.includes('广告') || Text.includes('sponsor'))) {
                        ShouldExclude = true;
                    }
                    if (!ShouldExclude && Config.ExcludeBangumi && (
                        Cls.includes('bangumi') ||
                        Text.includes('番剧') || Text.includes('追番') ||
                        Text.includes('国创') ||
                        FloorTitleText.includes('番剧') || FloorTitleText.includes('国创') ||
                        CardLinksTo(Card, '/bangumi/')
                    )) {
                        ShouldExclude = true;
                    }
                    if (!ShouldExclude && Config.ExcludePaid && (Text.includes('付费') || Text.includes('课程') || Text.includes('￥') || Text.includes('¥'))) {
                        ShouldExclude = true;
                    }
    
                    if (ShouldExclude) {
                        ExcludedCards.push(Card);
                        return false;
                    }
                    return true;
                });
    
                // 处理特殊保留（UP主ID）
                if (Config.KeepSpecialUPIDs && Config.KeepSpecialUPIDs.length > 0) {
                    const KeepSet = new Set(Config.KeepSpecialUPIDs.map(Id => String(Id)));
                    const Kept = [];
                    const Rest = [];
                    for (const Card of VideoCards) {
                        const UpLink = Card.querySelector('a[href*="/space/"]');
                        let Upid = null;
                        if (UpLink) {
                            const Match = UpLink.href.match(/\/space\/(\d+)/);
                            if (Match) Upid = Match[1];
                        }
                        if (Upid && KeepSet.has(Upid)) {
                            Kept.push(Card);
                        } else {
                            Rest.push(Card);
                        }
                    }
                    VideoCards = Kept.concat(Rest);
                }
    
                // 保留推广位
                let PromotedCards = [];
                if (Config.KeepPromoted) {
                    PromotedCards = VideoCards.filter(Card => {
                        const Text = (Card.textContent || '').toLowerCase();
                        return Text.includes('推广') || Text.includes('广告') || Text.includes('sponsor');
                    });
                    VideoCards = VideoCards.filter(Card => !PromotedCards.includes(Card));
                }
    
                // 处理置顶/推荐卡片
                const TopSelectors = ['.bili-feed__banner', '.bili-feed__top', '.top-banner', '.recommend-banner'];
                let TopCards = [];
                for (const Sel of TopSelectors) {
                    const Tops = document.querySelectorAll(Sel);
                    for (const Top of Tops) {
                        const InnerCards = Top.querySelectorAll(Selector);
                        for (const Card of InnerCards) {
                            if (VideoCards.includes(Card)) {
                                TopCards.push(Card);
                                const Idx = VideoCards.indexOf(Card);
                                if (Idx !== -1) VideoCards.splice(Idx, 1);
                            }
                        }
                    }
                }
    
                // 限制数量
                const Max = Math.max(1, Number(Config.MaxVideos) || 10);
                const ToShow = VideoCards.slice(0, Max);
                const ToHide = VideoCards.slice(Max);
    
                // 显示前max个
                ToShow.forEach(Card => { ShowCardTree(Card); });
    
                // 隐藏超出限制的卡片 以及 被过滤规则排除的卡片
                const AllToHide = ToHide.concat(ExcludedCards);
                AllToHide.forEach(Card => { HideCardTree(Card); });
    
                // 确保推广位和置顶卡片可见
                [...PromotedCards, ...TopCards].forEach(Card => { ShowCardTree(Card); });
    
                const Total = VideoCards.length + ExcludedCards.length + PromotedCards.length + TopCards.length;
                const Shown = ToShow.length + PromotedCards.length + TopCards.length;
                Log(T('LogProcessed', Total, Shown, ToHide.length + ExcludedCards.length));
    
            } catch (E) {
                ErrorLog(T('LogErrorLimit'), E);
            }
        }
    
        function RestoreAllVideos() {
            const Selector = DetectSelector();
            if (!Selector) return;
            const Cards = document.querySelectorAll(Selector);
            for (const Card of Cards) {
                ShowCardTree(Card);
            }
        }
    
        // ======================== CSS 样式（仅过滤类和动态配置面板） ========================
        function InjectStyles() {
            GM_addStyle(`
                .BiliLimitedHide {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    flex: 0 0 0 !important;
                    position: absolute !important;
                    pointer-events: none !important;
                }
            `);
        }
    
        // ======================== 配置面板（非侵入式：按需创建/销毁） ========================
        function InjectPanelStyles() {
            if (document.getElementById('BiliCompactPanelStyles')) return;
            const StyleEl = document.createElement('style');
            StyleEl.id = 'BiliCompactPanelStyles';
            StyleEl.textContent = `
                .BiliCompactOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.4);
                    z-index: 2147483646;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-size: 14px;
                }
                .BiliCompactPanel {
                    /* 变量与容器基础（背景/圆角/阴影/边框）由共享 PANEL_THEME_CSS 提供 */
                    font-size: 14px; /* 保持原面板字号，覆盖共享默认 13px */
                    padding: 24px 30px;
                    min-width: 340px;
                    max-width: 420px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    position: relative;
                    max-height: 85vh;
                    overflow-y: auto;
                }
                .BiliCompactPanel h3 {
                    margin: 0 0 4px 0;
                    font-weight: 500;
                    color: var(--text-heading);
                    font-size: 16px;
                }
                .BiliCompactPanel label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                    color: var(--text-secondary);
                    gap: 8px;
                }
                .BiliCompactPanel input[type="number"],
                .BiliCompactPanel input[type="text"] {
                    background: var(--input-bg);
                    border: 1px solid var(--border-light);
                    color: var(--text);
                    padding: 4px 10px;
                    border-radius: 6px;
                    width: 80px;
                    font-size: 14px;
                    font-family: inherit;
                }
                .BiliCompactPanel input[type="text"] {
                    width: 140px;
                }
                .BiliCompactPanel select {
                    background: var(--input-bg);
                    border: 1px solid var(--border-light);
                    color: var(--text);
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    cursor: pointer;
                }
                .BiliCompactPanel input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                }
                .BiliCompactPanel .BtnRow {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 6px;
                    flex-wrap: wrap;
                }
                .BiliCompactPanel button.bc-btn {
                    font-size: 14px;
                    padding: 6px 18px;
                }
                .BiliCompactPanel .StatusRow {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 14px;
                    color: var(--text-secondary);
                }
                .BiliCompactPanel .StatusBadge {
                    background: var(--accent);
                    color: #fff;
                    border-radius: 12px;
                    padding: 2px 12px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .BiliCompactPanel .StatusBadge.Off {
                    background: var(--badge-off);
                }
            `;
            document.head.appendChild(StyleEl);
        }
    
        let PanelDestroyFn = null;

        // 替换规则 ↔ 文本（每行 find=>replace）；按 scope 分流
        function purifierRulesToText(Rules, Scope) {
            return (Rules || []).filter(function(R) {
                return R && R.scopes && R.scopes.indexOf(Scope) !== -1;
            }).map(function(R) {
                return R.find + '=>' + (R.replace || '');
            }).join('\n');
        }
        function purifierTextToRules(Text, Scope) {
            const Out = [];
            String(Text || '').split('\n').forEach(function(Line) {
                const M = Line.match(/^(.+?)=>(.*)$/);
                if (!M) return; // 无 => 分隔的非法行跳过
                const Find = M[1].trim();
                if (!Find) return;
                Out.push({ find: Find, replace: M[2], scopes: [Scope] });
            });
            return Out;
        }

        function OpenConfigPanel() {
            const OldConfig = Object.assign({}, Config); // 面板打开时的快照（评论规则变更检测用）

            if (PanelDestroyFn) {
                PanelDestroyFn();
                PanelDestroyFn = null;
            }
    
            InjectPanelStyles();

            // 外壳交给共享工厂：主题按 Config.ColorMode（auto 跟随系统，打开时计算一次）
            // 必须传 className: 'BiliCompactPanel' —— InjectPanelStyles 的布局 CSS 全部以此类为前缀，
            // 缺类会导致 label 挤行、面板宽度失控（max-width 失效）、BtnRow/StatusBadge 无样式
            const PanelHandle = createBcPanel({ overlay: true, theme: 'config', colorMode: Config.ColorMode, className: 'BiliCompactPanel' });
            const Overlay = PanelHandle.overlay;
            const Panel = PanelHandle.el;
    
            // 语言选项
            const LangOptions = [
                { Value: 'auto',  Label: T('PanelLanguageAuto') },
                { Value: 'zh_CN', Label: '简体中文' },
                { Value: 'zh_TW', Label: '繁體中文' },
                { Value: 'en_US', Label: 'English' },
                { Value: 'ja_JP', Label: '日本語' },
            ];
            const LangSelectHTML = LangOptions.map(Opt =>
                `<option value="${Opt.Value}" ${Config.Language === Opt.Value ? 'selected' : ''}>${Opt.Label}</option>`
            ).join('');
    
            Panel.innerHTML = `
                <h3>${T('PanelTitle')}</h3>
                <div class="StatusRow">
                    <span>${T('PanelStatusLabel')}</span>
                    <span class="StatusBadge ${IsActive ? '' : 'Off'}" id="CfgStatusBadge">${IsActive ? T('PanelStatusActive') : T('PanelStatusPaused')}</span>
                </div>
                <label>${T('PanelMaxVideos')} <input type="number" id="CfgMax" value="${Config.MaxVideos}" min="1" max="100"></label>
                <label>${T('PanelExcludeLive')} <input type="checkbox" id="CfgExcludeLive" ${Config.ExcludeLive ? 'checked' : ''}></label>
                <label>${T('PanelExcludeAd')} <input type="checkbox" id="CfgExcludeAd" ${Config.ExcludeAd ? 'checked' : ''}></label>
                <label>${T('PanelExcludeBangumi')} <input type="checkbox" id="CfgExcludeBangumi" ${Config.ExcludeBangumi ? 'checked' : ''}></label>
                <label>${T('PanelExcludePaid')} <input type="checkbox" id="CfgExcludePaid" ${Config.ExcludePaid ? 'checked' : ''}></label>
                <label>${T('PanelKeepPromoted')} <input type="checkbox" id="CfgKeepPromoted" ${Config.KeepPromoted ? 'checked' : ''}></label>
                <label>${T('PanelDebug')} <input type="checkbox" id="CfgDebug" ${Config.Debug ? 'checked' : ''}></label>
                <label>${T('PanelEnableCommentPurifier')} <input type="checkbox" id="CfgEnablePurifier" ${Config.EnableCommentPurifier ? 'checked' : ''}></label>
                <label>${T('PanelLanguage')} <select id="CfgLanguage">${LangSelectHTML}</select></label>
                <label>${T('PanelColorMode')} <select id="CfgColorMode">
                    <option value="auto" ${(Config.ColorMode || 'auto') === 'auto' ? 'selected' : ''}>${T('PanelColorAuto')}</option>
                    <option value="dark" ${Config.ColorMode === 'dark' ? 'selected' : ''}>${T('PanelColorDark')}</option>
                    <option value="light" ${Config.ColorMode === 'light' ? 'selected' : ''}>${T('PanelColorLight')}</option>
                </select></label>
                <label>${T('PanelKeepUpids')} <input type="text" id="CfgKeepUids" value="${(Config.KeepSpecialUPIDs || []).join(',')}"></label>
                <hr style="margin:8px 0;border:none;border-top:1px solid var(--hr, #333)">
                <div class="bc-collapse-header" id="CfgCollapsePurifier">
                    <span class="bc-collapse-arrow" id="CfgCollapsePurifierArrow"> > </span>
                    <span>${T('PanelCommentSection')}</span>
                </div>
                <div class="bc-collapse-content collapsed" id="CfgCollapsePurifierContent">
                    <label>${T('CommentFuzzyLabel')}</label>
                    <textarea id="CfgCommentKeywords" rows="3" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${(Config.CommentKeywords || []).join('\n')}</textarea>
                    <label>${T('CommentRegexLabel')}</label>
                    <textarea id="CfgCommentRegex" rows="3" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${(Config.CommentRegex || []).join('\n')}</textarea>
                    <label>${T('RegexPresetSection')}</label>
                    <div class="bc-collapse-header" id="CfgPresetHeader_spam">
                        <span class="bc-collapse-arrow" id="CfgPresetArrow_spam"> > </span>
                        <label style="flex:1;cursor:pointer"><input type="checkbox" id="CfgRegexPreset_spam" ${(Config.PresetSpam || {}).enabled ? 'checked' : ''}>${T('RegexPresetSpam')}</label>
                    </div>
                    <div class="bc-collapse-content collapsed" id="CfgPresetContent_spam">
                        <textarea id="CfgRegexPresetRule_spam" rows="2" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${(Config.PresetSpam || {}).rule || ''}</textarea>
                        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="bc-btn" id="CfgPresetReset_spam">${T('RegexPresetReset')}</button></div>
                    </div>
                    <div class="bc-collapse-header" id="CfgPresetHeader_meme">
                        <span class="bc-collapse-arrow" id="CfgPresetArrow_meme"> > </span>
                        <label style="flex:1;cursor:pointer"><input type="checkbox" id="CfgRegexPreset_meme" ${(Config.PresetMeme || {}).enabled ? 'checked' : ''}>${T('RegexPresetMeme')}</label>
                    </div>
                    <div class="bc-collapse-content collapsed" id="CfgPresetContent_meme">
                        <textarea id="CfgRegexPresetRule_meme" rows="3" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${(Config.PresetMeme || {}).rule || ''}</textarea>
                        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="bc-btn" id="CfgPresetReset_meme">${T('RegexPresetReset')}</button></div>
                    </div>
                    <div class="bc-collapse-header" id="CfgPresetHeader_punch">
                        <span class="bc-collapse-arrow" id="CfgPresetArrow_punch"> > </span>
                        <label style="flex:1;cursor:pointer"><input type="checkbox" id="CfgRegexPreset_punch" ${(Config.PresetPunch || {}).enabled ? 'checked' : ''}>${T('RegexPresetPunch')}</label>
                    </div>
                    <div class="bc-collapse-content collapsed" id="CfgPresetContent_punch">
                        <textarea id="CfgRegexPresetRule_punch" rows="3" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${(Config.PresetPunch || {}).rule || ''}</textarea>
                        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="bc-btn" id="CfgPresetReset_punch">${T('RegexPresetReset')}</button></div>
                    </div>
                    <div class="bc-hint">${T('RegexPresetEditHint')}</div>
                    <label>${T('CommentReplaceLabel')}</label>
                    <textarea id="CfgCommentReplace" rows="2" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${purifierRulesToText(Config.SubstituteWords, 'content')}</textarea>
                    <label>${T('EmoticonReplaceLabel')}</label>
                    <textarea id="CfgEmoticonReplace" rows="2" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${purifierRulesToText(Config.SubstituteWords, 'emoticon')}</textarea>
                    <label>${T('RegexReplaceLabel')}</label>
                    <textarea id="CfgRegexReplace" rows="2" style="width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--border-light);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${purifierRulesToText(Config.RegexReplaceWords, 'regex')}</textarea>
                    <div class="bc-hint">${T('RegexReplaceHint')}</div>
                    <label>${T('EnableReplacement')} <input type="checkbox" id="CfgEnableReplacement" ${Config.EnableReplacement ? 'checked' : ''}></label>
                    <label>${T('ClearEmoticons')} <input type="checkbox" id="CfgClearEmoticons" ${Config.ClearCommentEmoticons ? 'checked' : ''}></label>
                    <label>${T('ReplaceSearchTerms')} <input type="checkbox" id="CfgReplaceSearchTerms" ${Config.ReplaceCommentSearchTerms ? 'checked' : ''}></label>
                    <div class="bc-hint">${T('PurifierSectionHint')}</div>
                    <div class="bc-hint" style="padding:6px 8px;border:1px dashed var(--border-light);border-radius:6px">${T('PurifierTutorial')}</div>
                </div>
                <hr style="margin:8px 0;border:none;border-top:1px solid var(--hr, #333)">
                <div class="bc-collapse-header" id="CfgCollapseRm">
                    <span class="bc-collapse-arrow" id="CfgCollapseRmArrow"> > </span>
                    <span>${T('PanelRemovalSection')}</span>
                </div>
                <div class="bc-collapse-content collapsed" id="CfgCollapseRmContent">
                ${ELEMENT_REMOVAL_PRESETS.map(function(P) {
                    return '<label><span style="flex:1">' + T(RmNameKey(P.id)) + '</span> <input type="checkbox" id="CfgRm_' + P.id + '" ' + ((Config.RemovedElements || {})[P.id] ? 'checked' : '') + '></label>';
                }).join('')}
                </div>
                <div class="BtnRow">
                    <button class="bc-btn" id="CfgToggle">${IsActive ? T('PanelBtnPause') : T('PanelBtnResume')}</button>
                    <button class="bc-btn" id="CfgReset">${T('PanelBtnReset')}</button>
                    <button class="bc-btn bc-btn-accent" id="CfgSave">${T('PanelBtnSave')}</button>
                </div>
            `;

            // 面板与遮罩已由工厂挂载（Overlay 内含 Panel，已 append 到 body）

            // —— 事件绑定 ——
    
            document.getElementById('CfgSave').addEventListener('click', function() {
                const Max = parseInt(document.getElementById('CfgMax').value) || 10;
                const NewLang = document.getElementById('CfgLanguage').value;
                const LangChanged = NewLang !== Config.Language;
    
                const NewConfig = {
                    MaxVideos: Max,
                    ExcludeLive: document.getElementById('CfgExcludeLive').checked,
                    ExcludeAd: document.getElementById('CfgExcludeAd').checked,
                    ExcludeBangumi: document.getElementById('CfgExcludeBangumi').checked,
                    ExcludePaid: document.getElementById('CfgExcludePaid').checked,
                    KeepPromoted: document.getElementById('CfgKeepPromoted').checked,
                    Language: NewLang,
                    ColorMode: document.getElementById('CfgColorMode').value,
                    KeepSpecialUPIDs: document.getElementById('CfgKeepUids').value.split(',').map(S => S.trim()).filter(Boolean).map(Number),
                    Debug: document.getElementById('CfgDebug').checked,
                    EnableCommentPurifier: document.getElementById('CfgEnablePurifier').checked,
                    RemovedElements: (function() {
                        var obj = {};
                        for (var I = 0; I < ELEMENT_REMOVAL_PRESETS.length; I++) {
                            var cb = document.getElementById('CfgRm_' + ELEMENT_REMOVAL_PRESETS[I].id);
                            if (cb) obj[ELEMENT_REMOVAL_PRESETS[I].id] = cb.checked;
                        }
                        return obj;
                    })(),
                    EnableReplacement: document.getElementById('CfgEnableReplacement').checked,
                    ClearCommentEmoticons: document.getElementById('CfgClearEmoticons').checked,
                    ReplaceCommentSearchTerms: document.getElementById('CfgReplaceSearchTerms').checked,
                    CommentKeywords: document.getElementById('CfgCommentKeywords').value.split('\n').map(S => S.trim()).filter(Boolean),
                    CommentRegex: document.getElementById('CfgCommentRegex').value.split('\n').map(S => S.trim()).filter(Boolean),
                    SubstituteWords: purifierTextToRules(document.getElementById('CfgCommentReplace').value, 'content')
                        .concat(purifierTextToRules(document.getElementById('CfgEmoticonReplace').value, 'emoticon')),
                    RegexReplaceWords: purifierTextToRules(document.getElementById('CfgRegexReplace').value, 'regex'),
                    PresetSpam: { enabled: document.getElementById('CfgRegexPreset_spam').checked, rule: document.getElementById('CfgRegexPresetRule_spam').value.trim() },
                    PresetMeme: { enabled: document.getElementById('CfgRegexPreset_meme').checked, rule: document.getElementById('CfgRegexPresetRule_meme').value.trim() },
                    PresetPunch: { enabled: document.getElementById('CfgRegexPreset_punch').checked, rule: document.getElementById('CfgRegexPresetRule_punch').value.trim() }
                };
                Object.assign(Config, NewConfig);
                SaveConfig(Config);

                // 评论规则变更 → 重扫全部评论（恢复不再命中的、隐藏新命中的、应用新替换）
                const CommentKeys = ['CommentKeywords', 'CommentRegex', 'SubstituteWords',
                    'RegexReplaceWords', 'PresetSpam', 'PresetMeme', 'PresetPunch',
                    'EnableReplacement', 'ClearCommentEmoticons', 'ReplaceCommentSearchTerms'];
                const RulesChanged = CommentKeys.some(function(K) {
                    return JSON.stringify(OldConfig[K]) !== JSON.stringify(Config[K]);
                });
                if (RulesChanged) purifierRescanAll();

                // 语言变更时立即生效
                if (LangChanged) {
                    CurrentLang = ResolveLanguage();
                }
    
                DestroyPanel();
                LimitVideos();
                applyElementRemoval();
    
                // 评论净化器开关变更后立即启停
                if (NewConfig.EnableCommentPurifier) {
                    startCommentPurifier();
                } else {
                    stopCommentPurifier();
                }
    
                // 语言变更后重新打开面板（让用户看到新语言）
                if (LangChanged) {
                    setTimeout(() => OpenConfigPanel(), 100);
                }
            });
    
            document.getElementById('CfgReset').addEventListener('click', function() {
                Object.assign(Config, DEFAULTS);
                SaveConfig(Config);
                CurrentLang = ResolveLanguage();
                // 刷新面板输入
                document.getElementById('CfgMax').value = Config.MaxVideos;
                document.getElementById('CfgExcludeLive').checked = Config.ExcludeLive;
                document.getElementById('CfgExcludeAd').checked = Config.ExcludeAd;
                document.getElementById('CfgExcludeBangumi').checked = Config.ExcludeBangumi;
                document.getElementById('CfgExcludePaid').checked = Config.ExcludePaid;
                document.getElementById('CfgKeepPromoted').checked = Config.KeepPromoted;
                document.getElementById('CfgDebug').checked = Config.Debug;
                document.getElementById("CfgEnablePurifier").checked = false;
                document.getElementById('CfgEnableReplacement').checked = false;
                document.getElementById('CfgClearEmoticons').checked = false;
                document.getElementById('CfgReplaceSearchTerms').checked = false;
                document.getElementById('CfgCommentKeywords').value = '';
                document.getElementById('CfgCommentRegex').value = '';
                document.getElementById('CfgCommentReplace').value = '';
                document.getElementById('CfgEmoticonReplace').value = '';
                document.getElementById('CfgRegexReplace').value = '';
                document.getElementById('CfgRegexPreset_spam').checked = false;
                document.getElementById('CfgRegexPreset_meme').checked = false;
                document.getElementById('CfgRegexPreset_punch').checked = false;
                document.getElementById('CfgRegexPresetRule_spam').value = DEFAULTS.PresetSpam.rule;
                document.getElementById('CfgRegexPresetRule_meme').value = DEFAULTS.PresetMeme.rule;
                document.getElementById('CfgRegexPresetRule_punch').value = DEFAULTS.PresetPunch.rule;
                document.getElementById('CfgColorMode').value = Config.ColorMode || 'auto';
                document.getElementById('CfgKeepUids').value = '';
                for (var I = 0; I < ELEMENT_REMOVAL_PRESETS.length; I++) {
                    var cb = document.getElementById('CfgRm_' + ELEMENT_REMOVAL_PRESETS[I].id);
                    if (cb) cb.checked = false;
                }
                stopCommentPurifier();
                // 重置后重新应用颜色模式主题
                const resetPanel = document.querySelector('.BiliCompactPanel');
                if (resetPanel) {
                    const resetMode = (Config.ColorMode || 'auto') === 'auto'
                        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                        : Config.ColorMode;
                    resetPanel.classList.toggle('light-mode', resetMode === 'light');
                }
                LimitVideos();
                applyElementRemoval();
            });
    
            document.getElementById('CfgToggle').addEventListener('click', function() {
                IsActive = !IsActive;
                if (IsActive) {
                    LimitVideos();
                } else {
                    RestoreAllVideos();
                }
                const Badge = document.getElementById('CfgStatusBadge');
                if (Badge) {
                    Badge.textContent = IsActive ? T('PanelStatusActive') : T('PanelStatusPaused');
                    Badge.className = 'StatusBadge' + (IsActive ? '' : ' Off');
                }
                this.textContent = IsActive ? T('PanelBtnPause') : T('PanelBtnResume');
            });
    
            // 评论屏蔽折叠切换
            document.getElementById('CfgCollapsePurifier').addEventListener('click', function() {
                const content = document.getElementById('CfgCollapsePurifierContent');
                const arrow = document.getElementById('CfgCollapsePurifierArrow');
                const isCollapsed = content.classList.contains('collapsed');
                if (isCollapsed) {
                    content.classList.remove('collapsed');
                    arrow.classList.add('open');
                } else {
                    content.classList.add('collapsed');
                    arrow.classList.remove('open');
                }
            });

            // 预设方案：折叠切换（点击勾选框/标签不触发折叠）+ 恢复默认
            ['spam', 'meme', 'punch'].forEach(function(Id) {
                document.getElementById('CfgPresetHeader_' + Id).addEventListener('click', function(E) {
                    if (E.target.closest('label, input')) return; // 勾选操作不展开/收起
                    const content = document.getElementById('CfgPresetContent_' + Id);
                    const arrow = document.getElementById('CfgPresetArrow_' + Id);
                    const isCollapsed = content.classList.contains('collapsed');
                    if (isCollapsed) {
                        content.classList.remove('collapsed');
                        arrow.classList.add('open');
                    } else {
                        content.classList.add('collapsed');
                        arrow.classList.remove('open');
                    }
                });
                document.getElementById('CfgPresetReset_' + Id).addEventListener('click', function() {
                    document.getElementById('CfgRegexPresetRule_' + Id).value = DEFAULTS[REGEX_PRESET_KEYS[Id]].rule;
                });
            });

            // 去除元素折叠切换
            document.getElementById('CfgCollapseRm').addEventListener('click', function() {
                const content = document.getElementById('CfgCollapseRmContent');
                const arrow = document.getElementById('CfgCollapseRmArrow');
                const isCollapsed = content.classList.contains('collapsed');
                if (isCollapsed) {
                    content.classList.remove('collapsed');
                    arrow.classList.add('open');
                } else {
                    content.classList.add('collapsed');
                    arrow.classList.remove('open');
                }
            });
    
            Overlay.addEventListener('click', function(E) {
                if (E.target === Overlay) {
                    DestroyPanel();
                }
            });
    
            function OnKeyDown(E) {
                if (E.key === 'Escape') {
                    DestroyPanel();
                }
            }
            document.addEventListener('keydown', OnKeyDown);
    
            function DestroyPanel() {
                document.removeEventListener('keydown', OnKeyDown);
                PanelHandle.destroy();
                PanelDestroyFn = null;
            }
    
            PanelDestroyFn = DestroyPanel;
        }
    
        function CloseConfigPanel() {
            if (PanelDestroyFn) {
                PanelDestroyFn();
                PanelDestroyFn = null;
            }
        }
    
    
        // ======================== 观察者 ========================
        function InitObserver() {
            if (Observer) {
                Observer.disconnect();
                Observer = null;
            }
    
            const Container = DetectContainer();
            if (!Container) return;
    
            Observer = new MutationObserver(function(Mutations) {
                let ShouldProcess = false;
                for (const Mutation of Mutations) {
                    if (Mutation.type === 'childList' && (Mutation.addedNodes.length > 0 || Mutation.removedNodes.length > 0)) {
                        for (const Node of Mutation.addedNodes) {
                            if (Node.nodeType === 1) {
                                const Sel = DetectSelector();
                                if (Sel && (Node.matches(Sel) || Node.querySelector(Sel))) {
                                    ShouldProcess = true;
                                    break;
                                }
                            }
                        }
                        if (!ShouldProcess) {
                            for (const Node of Mutation.removedNodes) {
                                if (Node.nodeType === 1) {
                                    const Sel = DetectSelector();
                                    if (Sel && (Node.matches(Sel) || Node.querySelector(Sel))) {
                                        ShouldProcess = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (ShouldProcess) break;
                }
    
                if (ShouldProcess) {
                    const Now = Date.now();
                    if (Now - LastRun < THROTTLE_INTERVAL) {
                        clearTimeout(DebounceTimer);
                        DebounceTimer = setTimeout(() => {
                            LastRun = Date.now();
                            LimitVideos();
                        }, 300);
                    } else {
                        LastRun = Now;
                        LimitVideos();
                    }
                }
            });
    
            Observer.observe(Container, {
                childList: true,
                subtree: true,
                attributes: false
            });
    
            Log(T('LogObserverStarted'), Container);
        }
    
        // ======================== 路由变化监听 ========================
        function WatchUrlChange() {
            let LastUrl = location.href;
            setInterval(() => {
                if (location.href !== LastUrl) {
                    LastUrl = location.href;
                    Log(T('LogUrlChanged'), LastUrl);
                    EffectiveSelector = null;
                    VideoListContainer = null;
                    setTimeout(() => {
                        DetectSelector();
                        DetectContainer();
                        LimitVideos();
                        applyElementRemoval();
                    }, 500);
                }
            }, 1000);
        }
    
        // ======================== 菜单命令（唯一入口，在语言解析后注册） ========================
        function RegisterMenu() {
            GM_registerMenuCommand(T('MenuSettings'), function() {
                OpenConfigPanel();
            });
            GM_registerMenuCommand(T('MenuRefresh'), function() {
                EffectiveSelector = null;
                VideoListContainer = null;
                LimitVideos();
            });
            GM_registerMenuCommand(T('MenuToggle'), function() {
                IsActive = !IsActive;
                if (IsActive) {
                    LimitVideos();
                } else {
                    RestoreAllVideos();
                }
                Log(T('LogStatus'), IsActive ? T('LogStatusOn') : T('LogStatusOff'));
            });
            GM_registerMenuCommand(T('MenuCommentPurifier'), function() {
                toggleCommentPurifier();
            });
            GM_registerMenuCommand(T('MenuQuickSet'), function() {
                const Num = prompt(T('PromptQuickSet'), Config.MaxVideos);
                if (Num !== null) {
                    const N = parseInt(Num);
                    if (N >= 1 && N <= 100) {
                        Config.MaxVideos = N;
                        SaveConfig({ MaxVideos: N });
                        if (!IsActive) {
                            IsActive = true;
                        }
                        LimitVideos();
                        Log(T('LogQuickSet'), N);
                    }
                }
            });
        }
    
        // ======================== 初始化 ========================
        function Init() {
            try {
                // 加载配置
                Config = GetConfig();
    
                // 解析语言（必须在任何 T() 调用之前）
                CurrentLang = ResolveLanguage();
    
                Log(T('LogConfigLoaded'), Config);
    
                // 注入样式（仅过滤类，不注入任何UI节点）
                InjectStyles();
    
                // 注册菜单（TM菜单是唯一入口，不在页面注入UI）
                RegisterMenu();
    
                // 启动评论净化器（如果启用）
                startCommentPurifier();
    
                // 启动观察
                InitObserver();
    
                // 路由监听
                WatchUrlChange();
    
                // 初次执行
                setTimeout(() => {
                    DetectSelector();
                    DetectContainer();
                    LimitVideos();
                    applyElementRemoval();
                }, 500);
    
                // 定时后备检查
                setInterval(() => {
                    if (IsActive) {
                        const Selector = DetectSelector();
                        if (Selector) {
                            const Cards = document.querySelectorAll(Selector);
                            let VisibleCount = 0;
                            for (const Card of Cards) {
                                if (!(Card.style.display === 'none' || Card.classList.contains('BiliLimitedHide'))) {
                                    VisibleCount++;
                                }
                            }
                            if (VisibleCount > Config.MaxVideos) {
                                Log(T('LogTimerRetry'));
                                LimitVideos();
                            }
                        }
                    }
                    // 定时重试元素去除（BilibiliSPA可能动态替换DOM）
                    applyElementRemoval();
                }, 5000);
    
                Log(T('LogInitDone'), Config);
    
            } catch (E) {
                ErrorLog(T('LogInitError'), E);
            }
        }
    
        // 页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', Init);
        } else {
            Init();
        }
    
    }
})();
