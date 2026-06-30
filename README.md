# PluginCodeEnhance

Halo 博客平台的代码折叠增强插件，专注提供**代码块折叠**和**长图折叠**功能，轻量高效，无外部依赖。

我的博客：[代码折叠增强插件 — PluginCodeEnhance](https://wuqishi.com/archives/halo-plugin-code-enhance-intro)

---

## ✨ 功能特性

- **代码折叠**：自动检测长代码块，超过指定行数自动折叠，支持展开/收起
- **长图折叠**：自动折叠超过指定高度的图片，优化文章排版
- **懒加载兼容**：支持 `data-src`、`data-original`、`data-lazy` 等懒加载属性
- **展开态 sticky 按钮**：长代码时展开按钮固定在视口底部，方便操作
- **横向滚动**：超长代码行自动横向滚动，不撑破布局
- **暗色模式**：通过 CSS 变量自动适配 Halo 暗色主题
- **无障碍支持**：完整的 ARIA 属性支持（`aria-label`、`aria-expanded`、`:focus-visible`）
- **移动端适配**：按钮尺寸优化，触摸友好
- **性能优化**：使用 `IntersectionObserver` 延迟初始化，文件大小仅 8KB（减少 97%）
- **pjax 兼容**：自动监听 `pjax:complete` 事件，支持 Halo 默认主题的 pjax 路由切换

---

## 📦 安装方法

### 方法一：手动安装

1. 下载最新版本的插件 JAR 文件（`plugin-codeenhance-2.0.1.jar`）
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
./gradlew build -x test

# 构建产物位于 build/libs/plugin-codeenhance-2.0.1.jar
```

---

## ⚙️ 配置选项

插件安装后，可在 Halo 管理后台进行配置：

| 配置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `enableCodeFold` | 是否启用代码折叠 | `true` |
| `codeFoldLine` | 代码折叠阈值（行数） | `20` |
| `enableImgFold` | 是否启用长图折叠 | `true` |
| `imgFoldHeight` | 图片折叠阈值（像素） | `400` |

> **说明**：自 v2.0.0 起，所有功能默认启用。代码折叠和长图折叠独立控制，互不影响。

---

## 🚀 使用说明

插件安装启用后，会自动对文章和页面中的代码块和图片进行处理：

> **适用范围**：支持文章（post）、页面（page），以及 Moments、Docsme 插件页面。

### 代码折叠

当代码块行数超过 `codeFoldLine`（默认 20 行）时，自动折叠：

- **折叠态**：显示前 N 行代码（可预览），底部显示「展开代码 ▼」按钮
- **展开态**：显示完整代码，底部显示「折叠代码 ▲」按钮（sticky 固定在视口底部）
- **横向滚动**：超长代码行自动横向滚动

### 长图折叠

当图片高度超过 `imgFoldHeight`（默认 400px）时，自动折叠：

- **折叠态**：显示图片顶部 400px，底部显示「展开图片 ▼」按钮
- **展开态**：显示完整图片，底部显示「折叠图片 ▲」按钮（sticky 固定在视口底部）
- **SVG 图片**：自动跳过（矢量图不适合折叠）

---

## 🛠️ 技术栈

- **Halo**：>=2.20.0
- **Java**：21
- **Gradle**：8.5
- **前端**：原生 JavaScript（无框架）+ CSS 变量

---

## 📁 项目结构

```
plugin-code-enhance/
├── src/main/java/run/halo/codeenhance/
│   ├── CodeEnhancePlugin.java        # 插件主类
│   └── CodeEnhanceHeadProcessor.java # 扩展点实现（资源注入）
├── src/main/resources/
│   ├── extensions/
│   │   └── settings.yaml             # 设置表单定义
│   ├── static/
│   │   ├── js/
│   │   │   └── code-enhance.js       # 前端核心逻辑（~270 行）
│   │   └── styles/
│   │       └── code-enhance.css      # 插件样式（~220 行）
│   └── plugin.yaml                   # 插件元数据
├── .gitignore                        # Git 忽略规则
├── build.gradle                      # Gradle 配置
└── README.md                         # 项目说明
```

---

## 🔧 核心实现

### 后端实现

插件使用 Halo 2.x 的扩展点机制，通过 `TemplateHeadProcessor` 向页面注入前端资源：

```java
@Component
@Order(-100)
public class CodeEnhanceHeadProcessor implements TemplateHeadProcessor {
    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
                              IElementModelStructureHandler handler) {
        // 从配置读取启用的功能
        // 只有折叠或长图折叠启用时才注入资源
        return fetcher.fetch("basic", BasicConfig.class)
            .defaultIfEmpty(new BasicConfig())
            .filter(BasicConfig::hasAny)
            .doOnNext(cfg -> inject(context, model, cfg))
            .then();
    }
}
```

### 前端实现

前端采用简洁的单文件设计，核心逻辑约 270 行：

- **配置读取**：从 `window.CodeEnhanceConfig` 读取用户配置
- **懒加载观察**：使用 `IntersectionObserver` 延迟处理，提升性能
- **代码折叠**：计算行数，超过阈值时创建包装容器并添加按钮
- **长图折叠**：监听 `load` 事件，获取图片真实尺寸后判断是否需要折叠
- **懒加载兼容**：检测 `data-src` 等属性，触发真实资源加载

**关键优化**：

- 无外部依赖（不依赖 hljs、jQuery 等），文件大小仅 8KB
- 使用 CSS 变量管理配色，自动适配暗色主题
- 使用 `position: sticky` 实现展开态按钮固定
- 完整 ARIA 支持，提升无障碍体验

---

## 版本更新

### v2.0.1 (2026-06-30)

**🐛 修复：插件 CSS 不再覆盖主题代码块样式**

- **修复 CSS 冲突**：移除了 `.ce-pre` 中多余的重置样式（`background: transparent`、`padding: 0`、`border: 0` 等），主题的代码块背景色、内边距、滚动条等样式完整保留
- **修复静态资源 404**：重新创建被误删的 `reverseProxy.yaml`，修正资源路径去掉多余 `/static/` 层级，CSS/JS 文件恢复正常加载
- **移除无用数据**：前端配置不再注入未使用的 `pluginName` 字段
- **内存整洁**：pjax 切换时正确释放旧 IntersectionObserver 实例
- **文档修正**：README 后端代码示例对齐实际实现

### v2.0.0 (2026-06-29)

**🎉 重大精简：移除所有非核心功能，专注折叠体验**

- **移除代码高亮**：不再依赖 Highlight.js，文件大小减少 97%
- **移除行号显示**：简化代码块结构
- **移除复制按钮**：如需复制功能，可使用浏览器自带复制或主题自带功能
- **移除语言名称显示**：简化界面
- **移除标题栏**：不再显示 macOS 风格红绿灯按钮
- **新增懒加载图片兼容**：支持 `data-src`、`data-original`、`data-lazy` 等常见懒加载属性
- **新增展开态 sticky 按钮**：长代码时展开按钮固定在视口底部
- **新增横向滚动支持**：超长代码行自动横向滚动
- **新增无障碍支持**：`aria-label`、`aria-expanded`、`:focus-visible`
- **性能优化**：JS 从 ~600 行重构为 ~270 行（-55%），CSS 从 ~800 行重构为 ~220 行（-72%）
- **浏览器兼容性提升**：Chrome 57+、Firefox 52+、Safari 10.1+
- **默认启用功能**：代码折叠和长图折叠默认开启（之前默认关闭）

**升级说明**：

- 从 v1.x 升级到 v2.0.0 会自动丢失高亮、行号、复制按钮等功能
- 如果依赖这些功能，**请勿升级**
- 如果只需要折叠功能，v2.0.0 性能更优，体验更好

---

### v1.1.6

- **代码审查修复**：基于全面代码审查，修复以下问题
- **语法高亮保留**：新增 `splitHtmlLines()` 方法，行号显示时完整保留 hljs 语法高亮结构
- **Shiki 冲突检测**：恢复 Shiki 高亮插件检测逻辑，避免双重样式冲突
- **初始化合并**：统一观察者调用，提升性能
- **未使用变量清理**：删除 `pendingInit` 未使用变量
- **CSS :has() 兼容**：使用 `@supports` 特性查询
- **JSDoc 完善**：为所有关键函数添加完整的 JSDoc 注释

### v1.1.5

- **开关独立**：所有功能开关默认关闭，避免与主题自带高亮产生冲突
- **主题兼容**：通过 CSS 变量统一管理配色
- **移动端修复**：移除 `touchstart` 绑定，避免点击双触发
- **代码重构**：`applyThemeColors` 改为数据驱动
- **观察者优化**：仅在启用对应功能时观察代码块/图片
- **配置增强**：亮色/暗色主题选择器均提供完整 14 种主题选项

### v1.1.4

- **资源统一**：统一 CSS 文件名为 `code-enhance.css`
- **开关独立修复**：修复未开启代码高亮只开启其他选项时，前台仍加载代码高亮资源的问题

### v1.1.3

- **配置项重命名**：`enableCodeHighlight` 重命名为 `enableHighlight`
- **代码重构**：重构头部处理器，抽取 `injectResources`、`buildProperties` 等方法
- **Logo 本地化**：插件 Logo 路径从外链改为本地静态资源

### v1.1.2

- 更新静态资源引用为压缩版本

### v1.1.1

- 强化 XSS 防护：使用 `textContent` 提取代码
- 修复异步竞态：`Highlight.init()` 异步加载时延迟启动 `IntersectionObserver`
- 测试增强：新增 5 个测试用例

### v1.1.0

- 动态加载 highlight.min.js，仅在检测到代码块时引入资源
- 扩展模板匹配范围，支持 Moments 和 Docsme 插件页面
- 重构高亮逻辑，使用 hljs API 处理文本以防止 XSS
- 调整折叠按钮样式为 sticky 定位

### v1.0.0

- 初始版本发布，支持代码高亮、折叠、长图折叠等功能

---

## 📄 许可证

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 链接

- **博客**：[https://wuqishi.com](https://wuqishi.com)
- **源码仓库**：[https://github.com/NoEggEgg/plugin-code-enhance](https://github.com/NoEggEgg/plugin-code-enhance)
