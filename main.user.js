// ==UserScript==
// @name         Simplified Bilibili Web Homepage~ BiliCompact
// @name:zh-CN   网页端Bilibili主页精简~ BiliCompact
// @name:ja      Web版Bilibiliのhomepageの簡素化
// @namespace    http://tampermonkey.net/
// @version      2.7.0
// @license MIT
// @name:   Are you tired of the overwhelming number of videos on Bilibili's web interface? Want a more streamlined interface? This plugin helps you display only a specified number of videos, with support for multiple pages, black/whitelists, and persistent configuration. Its non‑intrusive design injects no UI elements into Bilibili pages. Supports Simplified Chinese, Traditional Chinese, and English. Also includes local renaming of videos in the favorites page (merged from BiliFavRename), with pure display‑layer replacement and zero network requests.
// @name:zh-CN   你是否厌倦了网页端极多视频？想要更简要的界面？这个插件将帮助你只显示指定数量的视频，支持多种页面、黑/白名单、配置持久化。非侵入式设计，不在页面注入任何UI元素。支持简中，繁中，英语。另含收藏夹页视频本地重命名，纯显示层替换，零网络请求。
// @description:ja     ビリビリ の ウェブ 版では、動画が多すぎてうんざりしていませんか？もっと シンプル で見やすい インターフェース が欲しいと思いませんか？この プラグイン は、表示する動画数を指定した件数に制限するお手伝いをします。複数 ページ への対応や、 ホワイトリスト ／ ブラックリスト の設定、そして設定内容の保存も可能です。また、 ビリビリ の ページ に一切の ユーザー インターフェース 要素を追加しない、非侵襲的な設計を採用しています。対応言語は、簡体中文、繁体中文、英語です。さらに、お気に入り ページ の動画を ローカル で リネーム する機能も搭載しています。表示 レイヤー のみを置き換える純粋な処理のため、 ネットワークリクエスト は一切発生しません。
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
// ==/UserScript==

(function() {
    'use strict';

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
            Log('Observer 已启动，挂载点:', Root);
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
        GM_addStyle(`
            #favrename-panel {
                position: fixed; right: 24px; top: 80px; width: 340px;
                background: #ffffff; color: #18191c;
                border: 1px solid #e3e5e7; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                z-index: 99999; font-size: 13px; line-height: 1.6;
            }
            #favrename-panel.favrename-collapsed .favrename-panel-body { display: none; }
            #favrename-panel .favrename-panel-head {
                display: flex; align-items: center; gap: 8px; padding: 10px 12px;
                border-bottom: 1px solid #e3e5e7;
            }
            #favrename-panel .favrename-panel-title { font-weight: bold; white-space: nowrap; }
            #favrename-panel input.favrename-search {
                flex: 1; min-width: 0; padding: 4px 8px;
                border: 1px solid #ccd0d6; border-radius: 4px; font-size: 12px;
            }
            #favrename-panel .favrename-panel-body { max-height: 60vh; overflow-y: auto; }
            #favrename-panel .favrename-entry {
                display: flex; align-items: center; gap: 8px; padding: 8px 12px;
                border-bottom: 1px solid #f1f2f3;
            }
            #favrename-panel .favrename-title {
                flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            #favrename-panel .favrename-custom { color: #00aeec; }
            #favrename-panel .favrename-orig { color: #9499a0; margin-left: 6px; }
            #favrename-panel button.favrename-btn {
                border: 1px solid #ccd0d6; background: #ffffff; border-radius: 4px;
                padding: 2px 8px; cursor: pointer; font-size: 12px; white-space: nowrap;
            }
            #favrename-panel button.favrename-btn:hover { background: #f1f2f3; }
            #favrename-panel input.favrename-input {
                flex: 1; min-width: 0; padding: 3px 6px;
                border: 1px solid #00aeec; border-radius: 4px; font-size: 12px;
            }
            #favrename-panel .favrename-empty { padding: 16px 12px; color: #9499a0; text-align: center; }
        `);
    
        let PanelEl = null;
    
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
                Btn.className = 'favrename-btn';
                Btn.textContent = '改名';
                Btn.addEventListener('click', function() { openEditRow(Entry, Item); });
                Entry.appendChild(Title);
                Entry.appendChild(Btn);
                Body.appendChild(Entry);
            });
            if (!Count) {
                const Empty = document.createElement('div');
                Empty.className = 'favrename-empty';
                Empty.textContent = '当前页面没有已加载的视频，滚动页面加载后自动同步';
                Body.appendChild(Empty);
            }
        }
    
        function openEditRow(Entry, Item) {
            Entry.innerHTML = '';
            const Input = document.createElement('input');
            Input.className = 'favrename-input';
            // 已改名预填当前自定义名，未改名预填原标题，便于直接裁剪
            Input.value = getRenames()[Item.bvid] || Item.origTitle;
            const Ok = document.createElement('button');
            Ok.className = 'favrename-btn';
            Ok.textContent = '确定';
            const Cancel = document.createElement('button');
            Cancel.className = 'favrename-btn';
            Cancel.textContent = '取消';
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
            refreshCardList();
            PanelEl = document.createElement('div');
            PanelEl.id = 'favrename-panel';
            const Head = document.createElement('div');
            Head.className = 'favrename-panel-head';
            const Title = document.createElement('span');
            Title.className = 'favrename-panel-title';
            Title.textContent = 'BiliFavRename';
            const Search = document.createElement('input');
            Search.className = 'favrename-search';
            Search.placeholder = '搜索视频标题';
            Search.addEventListener('input', function() { renderList(Search.value); });
            const Collapse = document.createElement('button');
            Collapse.className = 'favrename-btn';
            Collapse.textContent = '折叠';
            Collapse.addEventListener('click', function() {
                const Collapsed = PanelEl.classList.toggle('favrename-collapsed');
                Collapse.textContent = Collapsed ? '展开' : '折叠';
            });
            const Close = document.createElement('button');
            Close.className = 'favrename-btn';
            Close.textContent = '关闭';
            Close.addEventListener('click', function() {
                PanelEl.remove();
                PanelEl = null;
            });
            Head.appendChild(Title);
            Head.appendChild(Search);
            Head.appendChild(Collapse);
            Head.appendChild(Close);
            const Body = document.createElement('div');
            Body.className = 'favrename-panel-body';
            PanelEl.appendChild(Head);
            PanelEl.appendChild(Body);
            document.body.appendChild(PanelEl);
            renderList('');
        }
    
        // ======================== 设置面板 ========================
        GM_addStyle(`
            #favrename-settings {
                position: fixed; right: 24px; top: 80px; width: 300px;
                background: #ffffff; color: #18191c;
                border: 1px solid #e3e5e7; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                z-index: 99999; font-size: 13px; line-height: 1.8;
            }
            #favrename-settings .favrename-settings-head {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 12px; border-bottom: 1px solid #e3e5e7; font-weight: bold;
            }
            #favrename-settings .favrename-settings-row {
                display: flex; align-items: center; gap: 8px; padding: 8px 12px;
                border-bottom: 1px solid #f1f2f3;
            }
            #favrename-settings .favrename-settings-row label { flex: 1; }
            #favrename-settings input.favrename-marker {
                width: 48px; padding: 3px 6px;
                border: 1px solid #ccd0d6; border-radius: 4px; font-size: 12px; text-align: center;
            }
            #favrename-settings .favrename-danger {
                color: #f25d8e; border-color: #f25d8e; background: #ffffff;
            }
            #favrename-settings .favrename-danger:hover { background: #fff1f5; }
        `);
    
        let SettingsEl = null;
    
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
            if (!confirm('确定清空全部重命名映射？此操作不可撤销。')) return;
            GM_setValue(KEY_RENAMES, {});
            document.querySelectorAll(SEL_ITEM).forEach(function(Item) { revertTitle(Item); });
            CARD_LIST = [];
            Log('已清空全部重命名映射');
        }
    
        function OpenSettings() {
            if (SettingsEl) { SettingsEl.remove(); SettingsEl = null; }
            const S = getSettings();
            SettingsEl = document.createElement('div');
            SettingsEl.id = 'favrename-settings';
            const Head = document.createElement('div');
            Head.className = 'favrename-settings-head';
            const HeadTitle = document.createElement('span');
            HeadTitle.textContent = 'BiliFavRename 设置';
            const Close = document.createElement('button');
            Close.className = 'favrename-btn';
            Close.textContent = '关闭';
            Close.addEventListener('click', function() {
                SettingsEl.remove();
                SettingsEl = null;
            });
            Head.appendChild(HeadTitle);
            Head.appendChild(Close);
            SettingsEl.appendChild(Head);
    
            // 弱标记字符
            const RowMarker = document.createElement('div');
            RowMarker.className = 'favrename-settings-row';
            const LabelMarker = document.createElement('label');
            LabelMarker.textContent = '弱标记字符（留空为不标记）';
            const MarkerInput = document.createElement('input');
            MarkerInput.className = 'favrename-marker';
            MarkerInput.value = S.marker;
            MarkerInput.maxLength = 4;
            MarkerInput.addEventListener('change', function() {
                setMarker(MarkerInput.value);
                if (PanelEl) renderList(getFilterValue());
            });
            RowMarker.appendChild(LabelMarker);
            RowMarker.appendChild(MarkerInput);
            SettingsEl.appendChild(RowMarker);
    
            // 总开关
            const RowToggle = document.createElement('div');
            RowToggle.className = 'favrename-settings-row';
            const LabelToggle = document.createElement('label');
            LabelToggle.textContent = '启用重命名';
            const Toggle = document.createElement('input');
            Toggle.type = 'checkbox';
            Toggle.checked = !!S.enabled;
            Toggle.addEventListener('change', function() {
                setEnabled(Toggle.checked);
                if (PanelEl) renderList(getFilterValue());
            });
            RowToggle.appendChild(LabelToggle);
            RowToggle.appendChild(Toggle);
            SettingsEl.appendChild(RowToggle);
    
            // 清空全部映射
            const RowClear = document.createElement('div');
            RowClear.className = 'favrename-settings-row';
            const ClearBtn = document.createElement('button');
            ClearBtn.className = 'favrename-btn favrename-danger';
            ClearBtn.textContent = '清空全部映射';
            ClearBtn.addEventListener('click', function() {
                clearAllRenames();
                if (PanelEl) renderList(getFilterValue());
            });
            RowClear.appendChild(ClearBtn);
            SettingsEl.appendChild(RowClear);
    
            document.body.appendChild(SettingsEl);
        }
    
        // ======================== 菜单注册与初始化 ========================
        function RegisterMenu() {
            GM_registerMenuCommand('打开重命名面板', OpenPanel);
            GM_registerMenuCommand('设置', OpenSettings);
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
        RegisterMenu();
        WatchUrlChange();
        if (isFavlistPage()) {
            ApplyAll();
            Log('BiliFavRename 已初始化（收藏夹页）');
        } else {
            Log('BiliFavRename 已初始化（空间页，进入收藏夹后启动）');
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
    
                // Prompt
                PromptQuickSet: 'Enter max videos to show (1-100):',
            }
        };
    
        // 当前生效的语言
        let CurrentLang = 'zh_CN';
    
        function ResolveLanguage() {
            if (Config.Language && Config.Language !== 'auto') {
                return Config.Language;
            }
            const Nav = (navigator.language || '').toLowerCase();
            if (/^zh-(tw|hk|mo)$/i.test(Nav) || /^zh-(hant)$/i.test(Nav)) return 'zh_TW';
            if (/^zh/i.test(Nav)) return 'zh_CN';
            if (/^en/i.test(Nav)) return 'en_US';
            return 'zh_CN'; // fallback
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
        const DEFAULTS = {
            MaxVideos: 10,                 // 最大显示数量
            ExcludeLive: true,             // 排除直播
            ExcludeAd: true,              // 排除广告
            ExcludeBangumi: true,         // 排除番剧
            ExcludePaid: true,            // 排除付费课程
            KeepSpecialUPIDs: [],         // 保留的UP主ID列表（数字）
            KeepPromoted: false,          // 保留推广位（不计入数量）
            Language: 'auto',             // 界面语言: auto | zh_CN | zh_TW | en_US
            Debug: false,                 // 调试模式
            EnableCommentPurifier: false, // 评论净化器 (删除@提及，隐藏短评论)
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
    
            // 删除所有 @提及标签
            const mentions = contents.querySelectorAll('a[data-type="mention"]');
            for (const m of mentions) {
                m.remove();
            }
    
            // 计算剩余有效字符
            const remaining = contents.textContent.replace(/\s+/g, '').trim();
    
            // 不足5字 -> 隐藏整条评论
            if (remaining.length < 5) {
                renderer.style.display = 'none';
                try {
                    const threadRenderer = renderer.getRootNode().host;
                    if (threadRenderer) threadRenderer.style.display = 'none';
                } catch (_) {}
            }
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
            Log('评论净化器已启动' + (hasBlocker ? '（检测到 BilibiliBlocker，兼容模式）' : ''));
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
            Log('评论净化器已停止');
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
                    /* Dark theme (default) variables */
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
                    --collapse-hover: #333;
    
                    background: var(--bg);
                    color: var(--text);
                    padding: 24px 30px;
                    border-radius: 16px;
                    box-shadow: 0 8px 40px rgba(0,0,0,0.6);
                    min-width: 340px;
                    max-width: 420px;
                    border: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    position: relative;
                    max-height: 85vh;
                    overflow-y: auto;
                }
                .BiliCompactPanel.light-mode {
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
                    --collapse-hover: #eee;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
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
                    accent-color: var(--accent);
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
                .BiliCompactPanel .BtnRow {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 6px;
                    flex-wrap: wrap;
                }
                .BiliCompactPanel button {
                    background: var(--accent);
                    border: none;
                    color: #fff;
                    padding: 6px 18px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: inherit;
                    transition: background 0.2s;
                }
                .BiliCompactPanel button.Secondary {
                    background: var(--btn-secondary-bg);
                    color: var(--btn-secondary-text);
                }
                .BiliCompactPanel button:hover {
                    background: var(--accent-hover);
                }
                .BiliCompactPanel button.Secondary:hover {
                    background: var(--btn-secondary-hover);
                }
                .BiliCompactPanel .Hint {
                    font-size: 12px;
                    color: #888;
                    margin-top: -4px;
                    line-height: 1.4;
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
                /* Collapsible section */
                .BiliCompactPanel .CollapseHeader {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    padding: 6px 8px;
                    border-radius: 6px;
                    user-select: none;
                    font-size: 13px;
                    color: var(--accent);
                    font-weight: 500;
                    transition: background 0.15s;
                }
                .BiliCompactPanel .CollapseHeader:hover {
                    background: var(--collapse-hover);
                }
                .BiliCompactPanel .CollapseArrow {
                    transition: transform 0.2s;
                    font-size: 12px;
                    line-height: 1;
                }
                .BiliCompactPanel .CollapseArrow.open {
                    transform: rotate(90deg);
                }
                .BiliCompactPanel .CollapseContent {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .BiliCompactPanel .CollapseContent.collapsed {
                    display: none;
                }
            `;
            document.head.appendChild(StyleEl);
        }
    
        let PanelDestroyFn = null;
    
        function OpenConfigPanel() {
            if (PanelDestroyFn) {
                PanelDestroyFn();
                PanelDestroyFn = null;
            }
    
            InjectPanelStyles();
    
            const Overlay = document.createElement('div');
            Overlay.className = 'BiliCompactOverlay';
    
            const Panel = document.createElement('div');
            Panel.className = 'BiliCompactPanel';
    
            // 应用颜色模式
            const effectiveColorMode = (Config.ColorMode || 'auto') === 'auto'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : Config.ColorMode;
            if (effectiveColorMode === 'light') {
                Panel.classList.add('light-mode');
            }
    
            // 语言选项
            const LangOptions = [
                { Value: 'auto',  Label: T('PanelLanguageAuto') },
                { Value: 'zh_CN', Label: '简体中文' },
                { Value: 'zh_TW', Label: '繁體中文' },
                { Value: 'en_US', Label: 'English' },
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
                <div class="CollapseHeader" id="CfgCollapseRm">
                    <span class="CollapseArrow" id="CfgCollapseRmArrow">▸</span>
                    <span>${'去除元素'}</span>
                </div>
                <div class="CollapseContent collapsed" id="CfgCollapseRmContent">
                ${ELEMENT_REMOVAL_PRESETS.map(function(P) {
                    return '<label><span style="flex:1">' + P.name + '</span> <input type="checkbox" id="CfgRm_' + P.id + '" ' + ((Config.RemovedElements || {})[P.id] ? 'checked' : '') + '></label>';
                }).join('')}
                </div>
                <div class="BtnRow">
                    <button class="Secondary" id="CfgToggle">${IsActive ? T('PanelBtnPause') : T('PanelBtnResume')}</button>
                    <button class="Secondary" id="CfgReset">${T('PanelBtnReset')}</button>
                    <button id="CfgSave">${T('PanelBtnSave')}</button>
                </div>
            `;
    
            Overlay.appendChild(Panel);
            document.body.appendChild(Overlay);
    
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
                    })()
                };
                Object.assign(Config, NewConfig);
                SaveConfig(Config);
    
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
                if (Overlay.parentNode) {
                    Overlay.parentNode.removeChild(Overlay);
                }
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
