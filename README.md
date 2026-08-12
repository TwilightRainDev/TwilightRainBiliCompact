# BiliCompact [中文](#中文) | [English](#english)
BiliCompact – A Tampermonkey script that severely trims the Bilibili web feed.
---
## 中文

###  项目简介

**BiliCompact** —— 一款针对 B 站（Bilibili）网页端的 **Tampermonkey 用户脚本**，让你对首页、分区、动态、搜索等页面上的视频流拥有精确的控制力。
你是否厌倦了 B 站首页和各类页面铺天盖地的视频流？BiliCompact 让你精确控制显示的视频数量，并智能过滤直播、广告、番剧、付费内容等冗余信息。
###  功能特性

- **数量限制**：设置最大显示视频数量（1~100 个），告别信息过载。
- **智能过滤**：
  - 排除直播
  - 排除广告 / 推广（可选择保留推广位但不计入总数）
  - 排除番剧（Bangumi）
  - 排除付费课程
- **白名单机制**：保留指定 UP 主（通过 UID）的视频，不受数量限制。
- **一键切换**：悬浮按钮可随时开启 / 关闭精简模式，恢复原始视图。
- **实时计数器**：展示当前显示 / 总视频数，以及隐藏数量。
- **配置持久化**：所有设置自动保存在浏览器中，跨页面生效。
- **悬浮配置面板**：可视化调整所有选项，无需手动编辑脚本。
- **广泛兼容**：适用于 B 站首页、分区（动画、音乐、游戏、科技等）、动态、搜索、番剧、国创等绝大多数页面。
- **轻量高效**：使用 MutationObserver 监听动态加载，节流防抖，性能优化。
- **评论屏蔽**：配置面板可设模糊词/正则屏蔽规则，命中即隐藏整条评论；支持表情替换、搜索跳转词转普通文本、关键词替换，规则变更即时生效。
- **收藏夹重命名**：在收藏夹页（space.bilibili.com/*/favlist）为视频设置本地自定义名，按 BV 号全局生效；纯显示层替换，零网络请求，无风控面。
- **重命名面板**：浮动面板列出已渲染视频，随滚动同步，支持搜索、折叠、逐条改名/恢复原名。
- **重命名设置**：弱标记字符（默认 `*` 前缀）、总开关、清空全部映射。
- **多语言界面**：自动适配简体中文、繁体中文、英语、日语；信息流精简的配置面板内可手动切换。

###  安装方法

1. 确保浏览器已安装 **Tampermonkey** 或 **Violentmonkey** 等用户脚本管理器。
2. 点击以下链接安装脚本：
   - 点击main.user.js，在右侧点击raw即可。
3. 刷新 B 站页面，即可在左下角看到控制按钮。

> 一个脚本覆盖信息流精简与收藏夹重命名两类功能，无需分别安装。

> 建议配合 **Adblock** 等插件使用，效果更佳。

###  使用指南

- **切换精简状态**：点击页面右下角的 `精简已开启` 按钮，一键开启 / 关闭精简。
- **调整数量**：通过配置面板输入最大显示数量。
- **打开配置面板**：点击 Tampermonkey 菜单中的 `B站精简设置`，或通过脚本菜单项进入可视化配置。
- **收藏夹重命名**：打开 B 站任意收藏夹页，GM 菜单出现「打开重命名面板」与「设置」；面板内可直接改名，按 BV 号全局生效。

###  评论屏蔽使用教程

在配置面板展开「评论屏蔽」区块（需先开启「启用评论净化」）：

- **评论屏蔽词**（每行一条）：评论内容含任一词即隐藏整条评论，大小写不敏感。示例：

  ```
  广告
  低价出售
  ```

- **评论屏蔽正则**（每行一条）：按正则部分匹配隐藏，匹配前自动去除评论中的空白。示例：

  ```
  \d{8,}            屏蔽超长数字（如 UID 串）
  (加|v)\s*[xX]     微信号广告
  ```

  单条正则写错会被自动跳过并在控制台提示，不影响其余规则。

- **评论内容替换**（每行一条 `关键词=>替换词`）：评论中的关键词全文替换为替换词。
- **表情替换**（每行一条 `图片alt=>文本`）：指定表情替换为文本，替换文本留空表示删除该表情。
- **开关**：启用内容替换 / 清除评论全部表情 / 搜索跳转词转普通文本（评论内蓝色搜索链接变为普通文本）。

保存后规则立即对已加载评论生效，无需刷新页面。

###  配置选项（面板可调）

| 选项 | 说明 |
|------|------|
| 最大显示数量 | 限制页面最多显示的视频个数（默认 10） |
| 排除直播 | 隐藏正在直播的卡片 |
| 排除广告 | 隐藏含有广告 / 推广标记的卡片 |
| 排除番剧 | 隐藏番剧相关卡片（如“追番”等） |
| 排除付费课程 | 隐藏付费 / 课程类视频 |
| 保留推广位 | 保留推广卡片，但不计入总数（仍会显示） |
| 保留 UP 主 ID | 输入数字 UID（逗号分隔），这些 UP 主的视频将始终显示 |
| 显示计数器 | 在左上角显示视频统计信息 |
| 显示切换按钮 | 在右下角显示开启 / 关闭按钮 |

所有更改**自动保存**，无需重启脚本。


###  注意事项

- 本脚本仅作用于 **B 站网页端**，不影响移动端或 APP。
- 由于 B 站页面结构可能更新，若失效请提 Issue，我会尽快适配。
- 脚本会尝试自动探测页面上的视频卡片，如遇未覆盖页面，欢迎反馈。
- 已测试环境：Chrome + Tampermonkey，Firefox + Violentmonkey 基本兼容。

###  开发者相关

- **技术栈**：原生 JavaScript + GM_* API
- **代码风格**：ES5 兼容（保证广泛兼容性）
- **调试模式**：在配置面板中开启 `debug` 选项（需要手动在脚本中修改 `config.debug = true` 或通过 GM 存储设置），可在控制台查看详细日志。
- **模块结构**：单脚本双模块，按域名路由（space.bilibili.com → 收藏夹重命名，其余 B 站页面 → 信息流精简），模块间存储键隔离（favrename_* 前缀）。

###  贡献与反馈

欢迎提交 Issue、Pull Request 或任何建议！

- **Issue 模板**：请描述使用的浏览器、脚本管理器版本、B 站页面 URL 以及重现步骤。
- **PR 指引**：请确保代码风格一致，并测试在多种页面下的兼容性。

###  开源协议

本项目采用 [MIT License](LICENSE) 授权，你可以自由使用、修改、分发。
PS：本人很喜欢英文大驼峰式命名风格。
---

## English

###  Introduction

**BiliCompact** is a **Tampermonkey userscript** that gives you precise control over the video feed on Bilibili (B站) web pages – homepage, channels, search, dynamic, and more.
Tired of endless video streams? BiliCompact lets you set a maximum number of visible videos and automatically filters out live streams, ads, bangumi, paid courses, and other clutter.

###  Features

- **Limit video count**: Set a max number (1–100) to avoid information overload.
- **Smart filters**:
  - Exclude live streams
  - Exclude ads / promotions (optionally keep promoted items without counting them)
  - Exclude bangumi (anime series)
  - Exclude paid courses
- **Whitelist**: Keep videos from specific UP IDs – they are always shown regardless of the limit.
- **One‑click toggle**: Floating button to enable/disable the limiter instantly.
- **Live counter**: Shows current displayed / total videos and hidden count.
- **Persistent settings**: All preferences are saved in browser storage and persist across pages.
- **Visual config panel**: Tweak every option through a GUI – no need to edit the script manually.
- **Broad compatibility**: Works on homepage, channels (animation, music, game, tech, etc.), dynamic, search, anime, and most other Bilibili pages.
- **Lightweight & efficient**: Uses MutationObserver with throttling and debouncing for performance.
- **Comment blocking**: Configure fuzzy/regex block rules in the panel — matching comments are hidden entirely; emoticon replacement, search-term plain-text conversion, and keyword replacement are supported, applied immediately on save.
- **Multilingual UI**: Auto-adapts to Simplified Chinese, Traditional Chinese, English, and Japanese; manually switchable inside the config panel.

###  Installation

1. Make sure you have **Tampermonkey** or **Violentmonkey** installed in your browser.
2. Click the installation link:
   - To use this script, click on main.user.js, then click the ‘Raw’ button located on the right side, and everything will work fine.
3. Refresh any Bilibili page – you should see the control button in the bottom‑right corner.

> For the best experience, consider using an ad blocker alongside this script.

###  Usage

- **Toggle limiting**: Click the `精简已开启` (or `Enabled`) button at the bottom‑right.
- **Open config panel**: Click `B站精简设置` in the Tampermonkey menu, or use the script’s menu entry.

###  Comment Blocking Tutorial

Open the "Comment Blocking" section in the config panel (enable "Comment Purifier" first):

- **Block keywords** (one per line): a comment is hidden entirely when it contains any keyword; case-insensitive. Example:

  ```
  广告
  低价出售
  ```

- **Block regexes** (one per line): partial regex match; whitespace is stripped from the comment before matching. Example:

  ```
  \d{8,}            hides comments with long digit runs (e.g. UID spam)
  (加|v)\s*[xX]     hides WeChat ad comments
  ```

  A broken regex is skipped with a console warning and never breaks the other rules.

- **Text replace** (one `keyword=>replacement` per line): replaces every occurrence of the keyword in comment text.
- **Emoticon replace** (one `alt=>text` per line): replaces a matching emoticon image with text; leave the replacement empty to delete the image.
- **Switches**: enable content replacement / clear all emoticons / convert search-term links to plain text.

Rules apply to already-loaded comments right after saving - no page refresh needed.

###  Configuration (via GUI)

| Option | Description |
|--------|-------------|
| Max visible videos | Maximum number of videos to keep (default 10) |
| Exclude live | Hide live‑streaming cards |
| Exclude ads | Hide cards with ad / promotion labels |
| Exclude bangumi | Hide cards related to anime series |
| Exclude paid content | Hide paid courses / lessons |
| Keep promoted | Show promoted cards but they don’t count toward the limit |
| Whitelist UP IDs | Comma‑separated UIDs whose videos always show |
| Show counter | Display stats in the top‑left corner |
| Show toggle button | Display the enable/disable button in the bottom‑right |

All changes are **saved automatically** – no restart needed.

###  Notes

- This script affects only the **web version** of Bilibili, not mobile or app.
- Bilibili may update its page structure – if the script stops working, please open an issue.
- The script auto‑detects video cards; if a page isn't covered, feel free to report it.
- Tested on Chrome + Tampermonkey; Firefox + Violentmonkey also works.

###  For Developers

- **Tech stack**: Vanilla JS + GM_* API.
- **Code style**: ES5 compatible for maximum cross‑browser support.
- **Debug mode**: Enable `debug` in the script’s `config` object (or via GM storage) to see detailed logs in the console.

###  Contributing

Issues, suggestions, and pull requests are welcome!

- **Issue template**: Please include your browser version, script manager version, Bilibili page URL, and steps to reproduce.
- **PR guidelines**: Keep code style consistent and test on multiple pages.

###  License

This project is licensed under the [MIT License](LICENSE) – feel free to use, modify, and distribute.

---

**Enjoy a cleaner Bilibili feed!** 

### 对开发者本人

本项目不采用emoji。
