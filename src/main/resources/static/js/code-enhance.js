!function () {
  "use strict";

  var INIT_ATTR = "ce-initialized";
  var themeObserver = null;
  var codeObserver = null;
  var imgObserver = null;

  // 语言名称映射表：将代码语言标识转换为友好显示名称
  var LANG_MAP = {
    js: "JavaScript", javascript: "JavaScript",
    ts: "TypeScript", typescript: "TypeScript",
    py: "Python", python: "Python",
    java: "Java", go: "Go", golang: "Go",
    rust: "Rust", c: "C", cpp: "C++",
    cs: "C#", csharp: "C#",
    rb: "Ruby", ruby: "Ruby",
    php: "PHP", swift: "Swift",
    kotlin: "Kotlin", scala: "Scala",
    r: "R", sql: "SQL",
    sh: "Shell", bash: "Bash", shell: "Shell",
    powershell: "PowerShell",
    html: "HTML", xml: "XML", svg: "SVG",
    css: "CSS", scss: "SCSS", sass: "Sass", less: "Less",
    json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
    markdown: "Markdown", md: "Markdown",
    dockerfile: "Dockerfile", makefile: "Makefile",
    lua: "Lua", perl: "Perl", dart: "Dart",
    groovy: "Groovy", vue: "Vue",
    jsx: "JSX", tsx: "TSX", diff: "Diff",
    plaintext: "Text", text: "Text"
  };

  // 全局配置对象：从后端注入的 window.CodeEnhanceConfig 中读取
  var config = {
    pluginName: "CodeEnhance",
    enableHighlight: false,
    enableCodeFold: false,
    enableImgFold: false,
    codeFoldLine: 20,
    imgFoldHeight: 400,
    hljsTheme: "",
    hljsDarkTheme: ""
  };

  // 内容区域选择器：用于定位文章内容和图片
  var CONTENT_SELECTORS = [
    ".article-content", ".post-content", "article",
    ".moment-content", ".moments-wrapper",
    ".dm-content__body", ".prose-content"
  ];
  var contentSelector = CONTENT_SELECTORS.join(", ");
  var imgSelector = CONTENT_SELECTORS.map(function (s) { return s + " img"; }).join(", ");

  /**
   * 检测当前是否为深色模式
   * @returns {boolean} 是否为深色模式
   */
  function isDarkMode() {
    var el = document.documentElement;
    return el.getAttribute("data-theme") === "dark"
      || el.classList.contains("dark")
      || window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  /**
   * 根据系统主题切换 hljs 主题样式表
   * 通过 disabled 属性控制亮/暗主题的启用状态
   */
  function applyThemeColors() {
    if (!config.enableHighlight) return;
    
    var systemDark = isDarkMode();
    var lightEl = document.getElementById("ce-hljs-light");
    var darkEl = document.getElementById("ce-hljs-dark");
    
    if (lightEl) lightEl.disabled = systemDark;
    if (darkEl) darkEl.disabled = !systemDark;
  }

  /**
   * HTML 转义：防止 XSS 攻击
   * @param {string} str - 待转义的字符串
   * @returns {string} 转义后的字符串
   */
  function escapeHtml(str) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return str.replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  /**
   * 检测页面是否已启用 Shiki 高亮插件
   * @returns {boolean} 是否存在 Shiki
   */
  function hasShiki() {
    return typeof shiki !== "undefined"
      || document.querySelector('.shiki') !== null
      || document.querySelector('[class*="shiki-"]') !== null
      || document.querySelector('pre.astro-code') !== null;
  }

  /**
   * 代码高亮模块：使用 hljs 对代码块进行语法高亮
   */
  var highlight = {
    /**
     * 对单个代码块执行语法高亮
     * @param {HTMLElement} codeEl - 代码块元素
     */
    highlightBlock: function (codeEl) {
      if (!config.enableHighlight) return;
      // 检测到 Shiki 时跳过高亮，避免双重处理导致样式冲突
      if (hasShiki()) return;
      if (typeof hljs !== "undefined") {
        hljs.highlightElement(codeEl);
      }
    }
  };

  /**
   * 代码装饰模块：添加标题栏、行号、折叠按钮等装饰元素
   */
  var decorator = {
    /**
     * 处理单个代码块：添加装饰元素
     * @param {HTMLElement} codeEl - 代码块元素
     */
    processCode: function (codeEl) {
      codeEl.classList.add("ce-decorated");
      var preEl = codeEl.parentElement;
      var wrapper = decorator.ensureWrapper(preEl);
      if (!wrapper.querySelector(".ce-header")) {
        decorator.addHeader(wrapper, codeEl, decorator.getLangName(codeEl));
      }
      decorator.addLineNumbers(codeEl);
      if (config.enableCodeFold && config.codeFoldLine > 0) {
        codeFold.processBlock(preEl);
      }
    },

    /**
     * 确保代码块被包裹在 figure.ce-fold-wrap 容器中
     * @param {HTMLElement} preEl - pre 元素
     * @returns {HTMLElement} wrapper 容器元素
     */
    ensureWrapper: function (preEl) {
      var wrapper = preEl.parentElement;
      if (wrapper && wrapper.tagName === "FIGURE") return wrapper;
      var figure = document.createElement("figure");
      figure.className = "ce-fold-wrap";
      preEl.parentNode.insertBefore(figure, preEl);
      figure.appendChild(preEl);
      return figure;
    },

    /**
     * 添加标题栏：包含语言名称、复制按钮、折叠按钮
     * @param {HTMLElement} wrapper - 容器元素
     * @param {HTMLElement} codeEl - 代码块元素
     * @param {string} langName - 语言名称
     */
    addHeader: function (wrapper, codeEl, langName) {
      var header = document.createElement("div");
      header.className = "ce-header";
      header.innerHTML = '<span class="ce-header-dots">' +
        '<span class="ce-header-dot ce-header-dot--red"></span>' +
        '<span class="ce-header-dot ce-header-dot--yellow"></span>' +
        '<span class="ce-header-dot ce-header-dot--green"></span>' +
        '</span>' +
        '<span class="ce-header-lang">' + escapeHtml(langName) + '</span>' +
        '<div class="ce-header-actions">' +
        '<button class="ce-header-fold" title="折叠代码">' +
        '<span class="ce-header-fold-icon ce-header-fold-icon--unfold">▼</span>' +
        '<span class="ce-header-fold-icon ce-header-fold-icon--fold">▲</span>' +
        '</button>' +
        '<button class="ce-header-copy" title="复制代码">复制</button>' +
        '</div>';

      var pre = wrapper.querySelector("pre");
      wrapper.insertBefore(header, pre);

      var copyBtn = header.querySelector(".ce-header-copy");
      var foldBtn = header.querySelector(".ce-header-fold");

      // 复制按钮点击事件
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(codeEl.textContent).then(function () {
          copyBtn.textContent = "已复制";
          copyBtn.classList.add("ce-header-copy--copied");
          setTimeout(function () {
            copyBtn.textContent = "复制";
            copyBtn.classList.remove("ce-header-copy--copied");
          }, 2000);
        }).catch(function (err) {
          console.warn("复制失败:", err);
        });
      });

      // 折叠按钮点击事件
      foldBtn.addEventListener("click", function () {
        decorator.toggleFullFold(wrapper);
      });

      // 标题栏点击事件（点击空白区域触发折叠）
      header.addEventListener("click", function (e) {
        if (e.target === header || e.target.classList.contains("ce-header")) {
          decorator.toggleFullFold(wrapper);
        }
      });
    },

    /**
     * 切换完全折叠状态：隐藏整个代码块
     * @param {HTMLElement} wrapper - 容器元素
     */
    toggleFullFold: function (wrapper) {
      var isFolded = wrapper.classList.contains("ce-fully-folded");
      wrapper.classList.toggle("ce-fully-folded");
      
      var expandBtn = wrapper.querySelector(".ce-expand-btn");
      var collapseBtn = wrapper.querySelector(".ce-collapse-btn");
      
      if (isFolded) {
        if (expandBtn) expandBtn.style.display = "none";
        if (collapseBtn) collapseBtn.style.display = "flex";
      } else {
        if (expandBtn) expandBtn.style.display = "none";
        if (collapseBtn) collapseBtn.style.display = "none";
      }
    },

    /**
     * 获取代码块的语言名称
     * @param {HTMLElement} codeEl - 代码块元素
     * @returns {string} 语言名称
     */
    getLangName: function (codeEl) {
      var classList = codeEl.classList;
      for (var i = 0; i < classList.length; i++) {
        var cls = classList[i];
        if (cls.startsWith("language-")) {
          var lang = cls.replace("language-", "").toLowerCase();
          return LANG_MAP[lang] || lang;
        }
      }
      return "Code";
    },

    /**
     * 添加行号：保留 hljs 语法高亮结构
     * @param {HTMLElement} codeEl - 代码块元素
     */
    addLineNumbers: function (codeEl) {
      if (codeEl.classList.contains("ce-line-numbers")) return;
      codeEl.classList.add("ce-line-numbers");

      // 获取 hljs 高亮后的 HTML 内容
      var html = codeEl.innerHTML;
      var lines = decorator.splitHtmlLines(html);
      var lastLineEmpty = lines[lines.length - 1] === "";
      if (lastLineEmpty) lines.pop();

      var grid = document.createElement("div");
      grid.className = "ce-code-grid";

      for (var i = 0; i < lines.length; i++) {
        var numSpan = document.createElement("span");
        numSpan.className = "ce-line-num";
        numSpan.textContent = i + 1;

        var codeSpan = document.createElement("span");
        codeSpan.className = "ce-line-code";
        codeSpan.innerHTML = lines[i];  // 使用 innerHTML 保留 hljs 结构

        grid.appendChild(numSpan);
        grid.appendChild(codeSpan);
      }

      codeEl.innerHTML = "";
      codeEl.appendChild(grid);
    },

    /**
     * 将 HTML 内容按行分割，保留标签结构
     * @param {string} html - HTML 内容
     * @returns {Array<string>} 分割后的行数组
     */
    splitHtmlLines: function (html) {
      var lines = [];
      var currentLine = "";
      var tagStack = [];
      var i = 0;

      while (i < html.length) {
        if (html[i] === "<") {
          // 处理标签
          var tagEnd = html.indexOf(">", i);
          if (tagEnd === -1) {
            currentLine += html[i];
            i++;
            continue;
          }

          var tag = html.substring(i, tagEnd + 1);
          currentLine += tag;

          // 判断是否为自闭合标签
          if (tag.match(/^<[^>]+\/>/)) {
            // 自闭合标签，不入栈
          } else if (tag.match(/^<\/[^>]+>/)) {
            // 结束标签，出栈
            if (tagStack.length > 0) {
              tagStack.pop();
            }
          } else if (tag.match(/^<[^>]+>/)) {
            // 开始标签，入栈
            tagStack.push(tag);
          }

          i = tagEnd + 1;
        } else if (html[i] === "\n") {
          // 换行符：结束当前行，关闭所有未闭合的标签
          var closeTags = "";
          for (var j = tagStack.length - 1; j >= 0; j--) {
            var tagName = tagStack[j].match(/^<([^\s>]+)/);
            if (tagName) {
              closeTags += "</" + tagName[1] + ">";
            }
          }
          lines.push(currentLine + closeTags);

          // 新行开始，重新打开所有标签
          currentLine = "";
          for (var k = 0; k < tagStack.length; k++) {
            currentLine += tagStack[k];
          }

          i++;
        } else {
          currentLine += html[i];
          i++;
        }
      }

      // 处理最后一行
      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }
  };

  /**
   * 代码折叠模块：根据行数阈值自动折叠代码块
   */
  var codeFold = {
    /**
     * 处理单个代码块：判断是否需要折叠
     * @param {HTMLElement} preEl - pre 元素
     */
    processBlock: function (preEl) {
      var codeEl = preEl.querySelector("code");
      if (!codeEl || preEl.classList.contains("ce-code-fold")) return;

      var lines = codeEl.textContent.split("\n");
      var lastLineEmpty = lines[lines.length - 1] === "";
      var lineCount = lastLineEmpty ? lines.length - 1 : lines.length;

      if (lineCount <= config.codeFoldLine) return;

      preEl.classList.add("ce-code-fold");
      codeFold.addButtons(preEl);
    },

    /**
     * 添加展开/折叠按钮
     * @param {HTMLElement} preEl - pre 元素
     */
    addButtons: function (preEl) {
      if (preEl.querySelector(".ce-expand-btn")) return;

      var expandBtn = document.createElement("button");
      expandBtn.className = "ce-expand-btn";
      expandBtn.innerHTML = '<span class="ce-expand-icon">▲</span>展开代码';

      var collapseBtn = document.createElement("button");
      collapseBtn.className = "ce-collapse-btn";
      collapseBtn.innerHTML = '<span class="ce-expand-icon">▼</span>折叠代码';

      expandBtn.style.display = "flex";
      collapseBtn.style.display = "none";

      expandBtn.addEventListener("click", function () {
        codeFold.toggleFold(preEl, true);
      });

      collapseBtn.addEventListener("click", function () {
        codeFold.toggleFold(preEl, false);
      });

      var wrapper = preEl.parentElement;
      wrapper.appendChild(expandBtn);
      wrapper.appendChild(collapseBtn);
    },

    /**
     * 切换折叠状态
     * @param {HTMLElement} preEl - pre 元素
     * @param {boolean} expand - 是否展开
     */
    toggleFold: function (preEl, expand) {
      var wrapper = preEl.parentElement;
      var expandBtn = wrapper.querySelector(".ce-expand-btn");
      var collapseBtn = wrapper.querySelector(".ce-collapse-btn");
      
      if (expand) {
        preEl.classList.remove("ce-code-fold");
        preEl.classList.add("ce-code-unfold");
        expandBtn.style.display = "none";
        collapseBtn.style.display = "flex";
      } else {
        preEl.classList.remove("ce-code-unfold");
        preEl.classList.add("ce-code-fold");
        expandBtn.style.display = "flex";
        collapseBtn.style.display = "none";
      }

      if (wrapper.classList.contains("ce-fully-folded")) {
        wrapper.classList.remove("ce-fully-folded");
      }
    }
  };

  /**
   * 图片折叠模块：根据高度阈值自动折叠长图
   */
  var imgFold = {
    /**
     * 处理单个图片：判断是否需要折叠
     * @param {HTMLElement} imgEl - 图片元素
     */
    processImage: function (imgEl) {
      if (imgEl.classList.contains("ce-img-processed")) return;
      imgEl.classList.add("ce-img-processed");

      var parent = imgEl.parentElement;
      var wrapper = document.createElement("span");
      wrapper.className = "ce-img-wrap ce-img-folded";
      
      parent.insertBefore(wrapper, imgEl);
      wrapper.appendChild(imgEl);

      var expandBtn = document.createElement("button");
      expandBtn.className = "ce-img-expand-btn";
      expandBtn.innerHTML = '<span class="ce-expand-icon">▲</span>展开图片';
      wrapper.appendChild(expandBtn);

      expandBtn.addEventListener("click", function () {
        imgFold.toggleFold(wrapper);
      });
    },

    /**
     * 切换折叠状态
     * @param {HTMLElement} wrapper - 容器元素
     */
    toggleFold: function (wrapper) {
      var isFolded = wrapper.classList.contains("ce-img-folded");
      var btn = wrapper.querySelector(".ce-img-expand-btn");

      if (isFolded) {
        wrapper.classList.remove("ce-img-folded");
        wrapper.classList.add("ce-img-unfolded");
        btn.innerHTML = '<span class="ce-expand-icon">▼</span>折叠图片';
      } else {
        wrapper.classList.remove("ce-img-unfolded");
        wrapper.classList.add("ce-img-folded");
        btn.innerHTML = '<span class="ce-expand-icon">▲</span>展开图片';
      }
    }
  };

  /**
   * 创建懒加载观察器：仅在元素进入视口时处理
   * @param {string} selector - CSS 选择器
   * @param {Function} callback - 处理回调
   * @param {boolean} enabled - 是否启用
   * @returns {IntersectionObserver|null} 观察器实例
   */
  function createLazyObserver(selector, callback, enabled) {
    if (!enabled) return null;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          observer.unobserve(el);
          callback(el);
        }
      });
    }, { rootMargin: "200px" });

    document.querySelectorAll(selector).forEach(function (el) {
      observer.observe(el);
    });

    return observer;
  }

  /**
   * 观察代码块：统一处理高亮、装饰、折叠
   */
  function observeCodeBlocks() {
    if (codeObserver) { codeObserver.disconnect(); codeObserver = null; }
    var needObserveCode = config.enableHighlight || config.enableCodeFold;
    codeObserver = createLazyObserver("pre > code:not(.ce-decorated)", function (codeEl) {
      if (config.enableHighlight) {
        highlight.highlightBlock(codeEl);
      }
      if (config.enableHighlight || config.enableCodeFold) {
        decorator.processCode(codeEl);
      }
    }, needObserveCode);
  }

  /**
   * 观察图片：处理图片折叠
   */
  function observeImages() {
    if (imgObserver) { imgObserver.disconnect(); imgObserver = null; }
    imgObserver = createLazyObserver(imgSelector + ":not(.ce-img-processed)", imgFold.processImage, config.enableImgFold);
  }

  /**
   * 观察主题变化：监听系统主题和页面主题切换
   */
  function observeThemeChange() {
    if (themeObserver) { themeObserver.disconnect(); }
    
    themeObserver = new MutationObserver(function () {
      applyThemeColors();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });

    // 监听系统主题变化
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
      applyThemeColors();
    });
  }

  /**
   * 初始化插件：统一入口，避免重复初始化
   */
  function init() {
    if (document.documentElement.hasAttribute(INIT_ATTR)) return;
    document.documentElement.setAttribute(INIT_ATTR, "true");

    // 根据配置添加类名，控制 CSS 样式
    if (config.enableHighlight) {
      document.documentElement.classList.add("ce-highlight-enabled");
      document.documentElement.classList.remove("ce-highlight-disabled");
    } else {
      document.documentElement.classList.add("ce-highlight-disabled");
      document.documentElement.classList.remove("ce-highlight-enabled");
    }

    applyThemeColors();
    observeThemeChange();

    // 统一初始化：合并所有模块的 init() 调用
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        observeCodeBlocks();
        observeImages();
      });
    } else {
      observeCodeBlocks();
      observeImages();
    }
  }

  // Pjax 页面切换后重新观察
  document.addEventListener("pjax:complete", function () {
    observeCodeBlocks();
    observeImages();
  });

  // 模块导出：支持 AMD 和 CommonJS
  if (typeof define === "function" && define.amd) {
    define(function () { return { init: init, config: config }; });
  } else if (typeof module !== "undefined" && module.exports) {
    module.exports = { init: init, config: config };
  } else {
    init();
  }

}();