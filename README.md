# PluginCodeEnhance

Halo 博客平台的代码增强插件，提供代码高亮、代码折叠、长图折叠、行号显示和标题栏等功能。

我的博客：[代码增强插件 — PluginCodeEnhance发布](https://wuqishi.com/archives/halo-plugin-code-enhance-intro)

## ✨ 功能特性

- **代码高亮**：基于 Highlight.js 11.11.1，支持 14 种高亮主题（7 个亮色 + 7 个暗色）
- **代码折叠**：自动检测长代码块，超过指定行数自动折叠，支持展开/收起
- **长图折叠**：自动折叠超过指定高度的图片，优化文章排版
- **行号显示**：为代码块添加行号，方便代码引用
- **标题栏**：代码块顶部显示语言标识、复制按钮和折叠按钮
- **暗色模式**：支持 Halo 暗色主题切换，配色自动匹配
- **移动端适配**：按钮尺寸优化，浮动定位，避免双触发
- **性能优化**：使用 IntersectionObserver 延迟初始化，提升首屏加载速度
- **开关独立**：各功能开关相互独立，未启用的功能不会加载任何资源
- **主题兼容**：通过 CSS 变量统一管理配色，避免主题背景冲突导致文字不可读

## 📦 安装方法

### 方法一：手动安装

1. 下载最新版本的插件 JAR 文件
2. 登录 Halo 管理后台
3. 进入「插件管理」→「安装插件」
4. 选择下载的 JAR 文件上传安装
5. 安装完成后启用插件

### 方法二：构建安装

```bash
# 克隆仓库
git clone https://github.com/NoEggEgg/plugin-code-enhance.git
cd plugin-code-enhance

# 构建插件
gradle build -x test

# 构建产物位于 build/libs/plugin-code-enhance-1.1.6.jar
```

## ⚙️ 配置选项

插件安装后，可在 Halo 管理后台进行配置：

| 配置项              | 说明                                      | 默认值                  |
| :------------------ | :---------------------------------------- | :---------------------- |
| `enableHighlight` | 是否启用代码高亮（启用 Shiki 时自动跳过） | `false`               |
| `hljsTheme`       | 亮色模式高亮主题（可选 14 种）            | `github.min.css`      |
| `hljsDarkTheme`   | 暗色模式高亮主题（可选 14 种）            | `github-dark.min.css` |
| `enableCodeFold`  | 是否启用代码折叠                          | `false`               |
| `codeFoldLine`    | 代码折叠阈值（行数，0 表示不折叠）        | `20`                  |
| `enableImgFold`   | 是否启用长图折叠                          | `false`               |
| `imgFoldHeight`   | 图片折叠阈值（像素，0 表示不折叠）        | `400`                 |

> **默认值说明**：自 v1.1.5 起，所有功能开关默认关闭，避免与主题自带高亮产生冲突。用户按需开启即可。

## 🎨 支持的主题

亮色与暗色模式下均可在 14 种主题中自由选择（支持反向配色）：

### 亮色主题

- GitHub Light
- Atom One Light
- Solarized Light
- VS Light
- Tomorrow
- Ascetic
- Foundation

### 暗色主题

- GitHub Dark
- Atom One Dark
- VS 2015 Dark
- Monokai
- Solarized Dark
- Obsidian
- Dracula

## 🚀 使用说明

插件安装启用后，会自动对文章和页面中的代码块和图片进行处理：

> **适用范围**：支持文章（post）、页面（page），以及 Moments、Docsme 插件页面。

```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

代码块会自动显示：

- 顶部标题栏（显示语言名称 "Java"）
- 复制按钮（一键复制代码）
- 折叠按钮（收起/展开代码块）
- 行号显示
- 语法高亮

## 🛠️ 技术栈

- **Halo**：>=2.20.0
- **Highlight.js**：11.11.1
- **Java**：17
- **Gradle**：8.5

## 📁 项目结构

```
plugin-code-enhance/
├── src/main/java/run/halo/codeenhance/
│   ├── CodeEnhancePlugin.java        # 插件主类
│   └── CodeEnhanceHeadProcessor.java # 扩展点实现（条件资源注入）
├── src/main/resources/
│   ├── extensions/
│   │   ├── extension-head.yaml       # 扩展点定义
│   │   ├── settings.yaml             # 设置表单定义
│   │   └── reverseProxy.yaml         # 静态资源代理配置
│   ├── static/
│   │   ├── js/
│   │   │   ├── code-enhance.js       # 前端核心逻辑
│   │   │   └── highlight.min.js      # Highlight.js 库
│   │   └── styles/
│   │       ├── code-enhance.css      # 插件样式
│   │       └── *.min.css             # 高亮主题样式（14个）
│   └── plugin.yaml                   # 插件元数据
├── src/test/java/                    # 单元测试
├── .gitignore                        # Git 忽略规则
├── build.gradle                      # Gradle 配置
└── README.md                         # 项目说明
```

## 🔧 核心实现

### 后端实现

插件使用 `PropertyPlaceholderHelper` 实现高效的静态资源注入，并根据配置开关条件性注入资源，避免加载未启用的功能模块：

```java
static final PropertyPlaceholderHelper PROPERTY_PLACEHOLDER_HELPER =
    new PropertyPlaceholderHelper("${", "}");

// 仅在对应开关启用时注入资源
if (config.enableHighlight) {
    appendTemplate(properties, HLJS_CSS_TEMPLATE, sb);
}
if (config.enableHighlight || config.enableCodeFold) {
    appendTemplate(properties, BASE_RESOURCES_TEMPLATE, sb);
}
// CONFIG_TEMPLATE 统一注入，buildThemePart() 在未启用高亮时返回空串
```

### 前端实现

前端采用模块化设计，包含以下核心模块：

- **Config**：配置加载和管理
- **Highlight**：代码高亮处理（自动检测 Shiki，避免冲突）
- **CodeDecor**：代码装饰（行号、标题栏、复制按钮）
- **CodeFold**：代码折叠逻辑
- **ImgFold**：长图折叠逻辑

**关键优化**：

- `applyThemeColors` 采用数据驱动设计（`BASE_COLORS` 对象），消除重复代码
- `processCode` 拆分为 `ensureWrapper` 与 `addHeader` 子方法，单一职责
- `observeCodeBlocks` 仅在启用高亮或代码折叠时观察代码块，避免误装饰
- 移除所有 `touchstart` 绑定，避免移动端点击双触发
- `toggleFold` 严格依据 `_cePrevFoldState` 控制底部按钮显隐，避免同时出现
- 通过 CSS 变量 `--ce-code-bg` 同步 `pre` 背景，避免主题背景冲突

## 版本更新

### v1.1.6

- **代码审查修复**：基于全面代码审查，修复以下问题
- **语法高亮保留**：新增 `splitHtmlLines()` 方法，行号显示时完整保留 hljs 语法高亮结构，修复行号导致高亮失效的问题
- **Shiki 冲突检测**：恢复 Shiki 高亮插件检测逻辑，当检测到 Shiki 存在时自动跳过高亮处理，避免双重样式冲突
- **初始化合并**：统一 `observeCodeBlocks()` 和 `observeImages()` 调用，移除重复的模块 `init()` 调用，提升性能
- **未使用变量清理**：删除 `pendingInit` 未使用变量
- **CSS :has() 兼容**：使用 `@supports` 特性查询，并为不支持 :has() 的浏览器提供 CSS fallback
- **JSDoc 完善**：为所有关键函数添加完整的 JSDoc 注释，提升代码可维护性
- **错误日志**：添加复制按钮失败的错误日志输出

### v1.1.5

- **开关独立**：所有功能开关默认关闭，未启用的功能不再加载任何资源
- **主题兼容**：通过 CSS 变量统一管理配色，修复部分主题下代码文字不可读的问题
- **移动端修复**：移除 `touchstart` 绑定，避免点击双触发；底部折叠按钮严格依据状态显隐
- **代码重构**：`applyThemeColors` 改为数据驱动（`BASE_COLORS`），`processCode` 拆分为 `ensureWrapper`/`addHeader` 子方法
- **观察者优化**：`observeCodeBlocks` 仅在启用高亮或代码折叠时观察代码块，避免仅启用长图折叠时误装饰代码
- **配置增强**：亮色/暗色主题选择器均提供完整 14 种主题选项，支持反向配色
- **日志清理**：移除所有 `console.log` 调试日志，保留 `console.warn` 错误日志

### v1.1.4

- **资源统一**：统一 CSS 文件名为 `code-enhance.css`（不存在 `.min.css` 版本）
- **开关独立修复**：修复未开启代码高亮只开启其他选项时，前台仍加载代码高亮资源的问题
- **条件注入优化**：根据各功能开关条件性注入资源，避免加载未启用的功能模块

### v1.1.3

- **配置项重命名**：`enableCodeHighlight` 重命名为 `enableHighlight`，语义更简洁
- **代码重构**：重构头部处理器，抽取 `injectResources`、`buildProperties`、`appendHljsResources`、`appendConfig`、`appendBaseResources` 等方法，优化模板资源注入逻辑
- **功能检查简化**：新增 `hasAnyFeatureEnabled()` 方法，简化全功能禁用时的跳过判断
- **模板匹配优化**：抽取 `hasContentVariable()` 方法，简化内容模板判断逻辑
- **Logo 本地化**：插件 Logo 路径从外链改为本地静态资源 `static/images/dan.svg`
- **类注释完善**：补充 `CodeEnhanceHeadProcessor` 类注释文档
- **错误日志增强**：`onErrorResume` 改为记录完整异常堆栈

### v1.1.2

- 更新静态资源引用为压缩版本 (code-enhance.min.css/js)
- 删除未压缩的源文件 (code-enhance.css/js)

### v1.1.1

- 强化 XSS 防护：hljs 高亮流程使用 `textContent` 提取代码，未高亮场景下行号使用 `escapeHtml()` 转义
- 修复异步竞态：`Highlight.init()` 异步加载时延迟启动 `IntersectionObserver`，避免 `doHighlight` 清空已装饰的行号
- 代码审查优化：`notContentTemplate` 检查顺序调优，删除冗余方法，预计算选择器字符串
- 测试增强：新增 5 个测试用例，覆盖默认值、插件变量兜底路径、注入内容断言

### v1.1.0

- 动态加载 highlight.min.js，仅在检测到代码块时引入资源
- 扩展模板匹配范围，支持 Moments 和 Docsme 插件页面
- 重构高亮逻辑，使用 hljs API 处理文本以防止 XSS
- 移除静态脚本标签，改为前端按需加载
- 优化触摸事件监听，添加 passive: true 提升滚动性能
- 改进代码块标题栏 DOM 构建，确保语言文本安全插入
- 调整折叠按钮样式为 sticky 定位

### v1.0.0

- 初始版本发布，支持代码高亮、折叠、长图折叠等功能

## 📄 许可证

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🔗 链接

- **博客**：[https://wuqishi.com](https://wuqishi.com)
- **源码仓库**：[https://github.com/NoEggEgg/plugin-code-enhance](https://github.com/NoEggEgg/plugin-code-enhance)
