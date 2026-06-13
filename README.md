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
- **移动端适配**：按钮尺寸优化，支持触摸事件
- **性能优化**：使用 IntersectionObserver 延迟初始化，提升首屏加载速度

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

# 构建产物位于 build/libs/plugin-code-enhance-1.0.0.jar
```

## ⚙️ 配置选项

插件安装后，可在 Halo 管理后台进行配置：

| 配置项                  | 说明                 | 默认值                  |
| :---------------------- | :------------------- | :---------------------- |
| `enableCodeHighlight` | 是否启用代码高亮     | `true`                |
| `hljsTheme`           | 亮色主题             | `github.min.css`      |
| `hljsDarkTheme`       | 暗色主题             | `github-dark.min.css` |
| `enableCodeFold`      | 是否启用代码折叠     | `true`                |
| `codeFoldLine`        | 代码折叠阈值（行数） | `20`                  |
| `enableImgFold`       | 是否启用长图折叠     | `true`                |
| `imgFoldHeight`       | 图片折叠阈值（像素） | `400`                 |

## 🎨 支持的主题

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

> **适用范围**：当前仅支持文章（post）和页面（page）模板，Moments / Docsme 等插件页面暂不支持。

> V1.1.0 版本扩展模板匹配范围，支持 Moments 和 Docsme 插件页面

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

- **Halo**：2.20.x
- **Highlight.js**：11.11.1
- **Java**：17
- **Gradle**：8.5

## 📁 项目结构

```
plugin-code-enhance/
├── src/main/java/run/halo/codeenhance/
│   ├── CodeEnhancePlugin.java        # 插件主类
│   └── CodeEnhanceHeadProcessor.java # 扩展点实现（PropertyPlaceholderHelper）
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
├── .gitignore                        # Git 忽略规则
├── build.gradle                      # Gradle 配置
└── README.md                         # 项目说明
```

## 🔧 核心实现

### 后端实现

插件使用 `PropertyPlaceholderHelper` 实现高效的静态资源注入，避免模板引擎开销：

```java
static final PropertyPlaceholderHelper PROPERTY_PLACEHOLDER_HELPER =
    new PropertyPlaceholderHelper("${", "}");

// 动态注入脚本和样式
properties.setProperty("name", pluginContext.getName());
properties.setProperty("version", pluginContext.getVersion());
String script = PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders(template, properties);
```

### 前端实现

前端采用模块化设计，包含以下核心模块：

- **Config**：配置加载和管理
- **Highlight**：代码高亮处理（自动检测 Shiki，避免冲突）
- **CodeDecor**：代码装饰（行号、标题栏、复制按钮）
- **CodeFold**：代码折叠逻辑
- **ImgFold**：长图折叠逻辑

## 版本更新

### 


### v1.1.0

* 动态加载 highlight.min.js，仅在检测到代码* 块时引入资源
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
