!function () {
  "use strict";

  // ==================== 常量与配置 ====================

  var INIT_ATTR = "ce-initialized";
  var themeObserver = null;
  var codeObserver = null;
  var imgObserver = null;
  var pendingInit = false;

  // 语言标识映射
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

  // 运行时配置（由后端注入覆盖）
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

  // 内容容器选择器
  var CONTENT_SELECTORS = [
    ".article-content", ".post-content", "article",
    ".moment-content", ".moments-wrapper",
    ".dm-content__body", ".prose-content"
  ];
  var contentSelector = CONTENT_SELECTORS.join(", ");
  var imgSelector = CONTENT_SELECTORS.map(function (s) { return s + " img"; }).join(", ");

  // 主题颜色映射
  var THEME_MAP = {
    "github.min.css": { bg: "#e8ecf1", color: "#24292e", codeBg: "#fff", border: "#d1d5da" },
    "atom-one-light.min.css": { bg: "#f0f0f0", color: "#383a42", codeBg: "#fafafa", border: "#e5e5e5" },
    "solarized-light.min.css": { bg: "#fdf6e3", color: "#586e75", codeBg: "#fdf6e3", border: "#eee8d5" },
    "vs.min.css": { bg: "#f3f3f3", color: "#373737", codeBg: "#ffffff", border: "#e6e6e6" },
    "tomorrow.min.css": { bg: "#ffffff", color: "#4d4d4c", codeBg: "#ffffff", border: "#e0e0e0" },
    "ascetic.min.css": { bg: "#f7f7f7", color: "#444444", codeBg: "#ffffff", border: "#d0d0d0" },
    "foundation.min.css": { bg: "#f5f5f5", color: "#444444", codeBg: "#fefefe", border: "#e0e0e0" },
    "github-dark.min.css": { bg: "#161b22", color: "#c9d1d9", codeBg: "#0d1117", border: "#30363d" },
    "atom-one-dark.min.css": { bg: "#2c313a", color: "#abb2bf", codeBg: "#282c34", border: "#3e4451" },
    "vs2015.min.css": { bg: "#1e1e1e", color: "#dcdcdc", codeBg: "#1e1e1e", border: "#3e3e3e" },
    "monokai.min.css": { bg: "#272822", color: "#f8f8f2", codeBg: "#272822", border: "#49483e" },
    "solarized-dark.min.css": { bg: "#002b36", color: "#839496", codeBg: "#002b36", border: "#586e75" },
    "obsidian.min.css": { bg: "#282828", color: "#e6e6e6", codeBg: "#282828", border: "#3f3f3f" },
    "dracula.min.css": { bg: "#282a36", color: "#f8f8f2", codeBg: "#282a36", border: "#44475a" }
  };

  // ==================== 工具函数 ====================

  function isDarkMode() {
    var el = document.documentElement;
    return el.getAttribute("data-theme") === "dark"
      || el.classList.contains("dark")
      || window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // 应用主题颜色变量
  function applyThemeColors() {
    if (!config.enableHighlight) return;

    var dark = isDarkMode();
    var colors = (function () {
      var themeName = dark ? config.hljsDarkTheme : config.hljsTheme;
      var colors = THEME_MAP[themeName];
      if (!colors) {
        colors = dark ? THEME_MAP["github-dark.min.css"] : THEME_MAP["github.min.css"];
      }
      return colors;
    })();

    if (!colors) return;

    var root = document.documentElement;
    root.style.setProperty("--ce-header-bg", colors.bg);
    root.style.setProperty("--ce-header-color", colors.color);
    root.style.setProperty("--ce-code-bg", colors.codeBg);
    root.style.setProperty("--ce-border-color", colors.border);
    root.style.setProperty("--ce-btn-bg", dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.55)");
    root.style.setProperty("--ce-btn-hover-bg", dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.75)");
    root.style.setProperty("--ce-btn-color", dark ? "#c9d1d9" : "#fff");
    root.style.setProperty("--ce-line-num-color", dark ? "#484f58" : "#adb5bd");

    // 切换亮/暗主题 CSS
    var lightEl = document.getElementById("ce-hljs-light");
    var darkEl = document.getElementById("ce-hljs-dark");
    if (lightEl) lightEl.disabled = dark;
    if (darkEl) darkEl.disabled = !dark;
  }

  // HTML 转义
  function escapeHtml(str) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return str.replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  // ==================== 代码高亮模块 ====================

  var highlight = {
    _hljsLoaded: false,
    _loading: false,

    init: function () {
      if (!config.enableHighlight) return false;
      if (highlight.isShikiActive()) return false;
      if (document.querySelectorAll("pre > code").length === 0) return false;

      // hljs 已加载，直接高亮
      if (typeof hljs !== "undefined") {
        highlight._hljsLoaded = true;
        highlight.doHighlight();
        return false;
      }

      // 正在加载中
      if (highlight._loading) return true;

      // 动态加载 hljs
      highlight._loading = true;
      var script = document.createElement("script");
      script.src = "/plugins/" + config.pluginName + "/assets/static/js/highlight.min.js";
      script.onload = function () {
        highlight._loading = false;
        highlight._hljsLoaded = true;
        highlight.doHighlight();
        if (pendingInit) {
          observeCodeBlocks();
          observeImages();
          pendingInit = false;
        }
      };
      script.onerror = function () {
        highlight._loading = false;
        pendingInit = false;
        console.warn("[CodeEnhance] Failed to load highlight.min.js");
      };
      document.head.appendChild(script);
      return true;
    },

    // 合并为一次遍历：先清除旧标记，再执行高亮
    doHighlight: function () {
      document.querySelectorAll("pre > code").forEach(function (codeEl) {
        try {
          // 清除旧的高亮标记
          if (codeEl.getAttribute("data-highlighted") === "yes") {
            codeEl.removeAttribute("data-highlighted");
          }

          // 跳过已高亮的代码块
          if (codeEl.classList.contains("hljs")) return;

          var text = codeEl.textContent || codeEl.innerText;
          codeEl.textContent = text;

          var lang = codeEl.getAttribute("data-language")
            || codeEl.className.match(/(?:language-|hljs\s+)(\w+)/)?.[1];
          var result = lang && hljs.getLanguage(lang)
            ? hljs.highlight(text, { language: lang, ignoreIllegals: true })
            : hljs.highlightAuto(text);

          codeEl.innerHTML = result.value;
          codeEl.classList.add("hljs");
          codeEl.setAttribute("data-highlighted", "yes");
        } catch (err) {
          console.warn("[CodeEnhance] highlight error:", err);
        }
      });
    },

    isShikiActive: function () {
      if (document.querySelector("pre.shiki, code.shiki, pre[data-shiki]")) return true;
      var codes = document.querySelectorAll("pre > code");
      for (var i = 0; i < codes.length; i++) {
        if ((codes[i].className || "").indexOf("shiki") !== -1) return true;
      }
      return false;
    }
  };

  // ==================== 代码装饰模块 ====================

  var decorator = {

    init: function () {
      document.querySelectorAll("pre > code").forEach(function (codeEl) {
        if (!codeEl.classList.contains("ce-decorated")) {
          decorator.processCode(codeEl);
        }
      });
    },

    processCode: function (codeEl) {
      codeEl.classList.add("ce-decorated");

      var preEl = codeEl.parentElement;
      var langName = decorator.getLangName(codeEl);
      var wrapper = preEl.parentElement;

      // 确保 figure.ce-fold-wrap 包裹
      if (!wrapper || wrapper.tagName !== "FIGURE") {
        var figure = document.createElement("figure");
        figure.className = "ce-fold-wrap";
        preEl.parentNode.insertBefore(figure, preEl);
        figure.appendChild(preEl);
        wrapper = figure;
      }

      // 添加标题栏
      if (!wrapper.querySelector(".ce-header")) {
        var header = document.createElement("div");
        header.className = "ce-header";

        // 窗口按钮
        var dots = document.createElement("span");
        dots.className = "ce-header-dots";
        dots.innerHTML = '<span class="ce-header-dot ce-header-dot--red"></span>'
          + '<span class="ce-header-dot ce-header-dot--yellow"></span>'
          + '<span class="ce-header-dot ce-header-dot--green"></span>';

        // 语言标签
        var langSpan = document.createElement("span");
        langSpan.className = "ce-header-lang";
        langSpan.textContent = langName || "Code";

        // 操作按钮
        var actions = document.createElement("div");
        actions.className = "ce-header-actions";
        actions.innerHTML = '<button class="ce-header-fold" title="收起代码">'
          + '<span class="ce-header-fold-icon ce-header-fold-icon--unfold">&#x25BC;</span>'
          + '<span class="ce-header-fold-icon ce-header-fold-icon--fold">&#x25C0;</span>'
          + '</button><button class="ce-header-copy" title="复制代码">复制</button>';

        header.appendChild(dots);
        header.appendChild(langSpan);
        header.appendChild(actions);
        wrapper.insertBefore(header, preEl);

        // 绑定复制事件
        var copyBtn = header.querySelector(".ce-header-copy");
        var copyHandler = function (e) {
          e.stopPropagation();
          decorator.copyCode(codeEl, copyBtn);
        };
        copyBtn.addEventListener("click", copyHandler);
        copyBtn.addEventListener("touchstart", copyHandler, { passive: true });

        // 绑定折叠事件
        var foldBtn = header.querySelector(".ce-header-fold");
        var foldHandler = function (e) {
          e.stopPropagation();
          decorator.toggleFold(wrapper);
        };
        foldBtn.addEventListener("click", foldHandler);
        foldBtn.addEventListener("touchstart", foldHandler, { passive: true });

        // 标题栏点击展开
        var headerClickHandler = function (e) {
          if (wrapper.classList.contains("ce-fully-folded")) {
            decorator.toggleFold(wrapper);
          }
        };
        header.addEventListener("click", headerClickHandler);
        header.addEventListener("touchstart", headerClickHandler, { passive: true });
      }

      // 添加行号
      decorator.addLineNumbers(codeEl);

      // 代码折叠处理
      if (config.enableCodeFold && config.codeFoldLine > 0) {
        codeFold.processBlock(preEl);
      }
    },

    getLangName: function (codeEl) {
      var match = (codeEl.className || "").match(/(?:language-|hljs\s+)(\w+)/);
      if (match) {
        var key = match[1].toLowerCase();
        return LANG_MAP[key] || key.charAt(0).toUpperCase() + key.slice(1);
      }
      var detected = codeEl.getAttribute("data-detected-lang") || codeEl.getAttribute("data-language");
      if (detected) {
        detected = detected.toLowerCase();
        return LANG_MAP[detected] || detected.charAt(0).toUpperCase() + detected.slice(1);
      }
      return "";
    },

    addLineNumbers: function (codeEl) {
      if (codeEl.querySelector(".ce-code-grid")) return;

      var isHighlighted = codeEl.classList.contains("hljs");
      var lines;

      if (isHighlighted) {
        lines = decorator.splitHtmlLines(codeEl.innerHTML);
      } else {
        lines = (codeEl.textContent || codeEl.innerText).split("\n");
        if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
      }

      if (lines.length === 0) return;

      var html = ['<div class="ce-code-grid">'];
      for (var i = 0; i < lines.length; i++) {
        var lineContent = isHighlighted ? (lines[i] || " ") : escapeHtml(lines[i] || " ");
        html.push('<span class="ce-line-num">' + (i + 1) + '</span>'
          + '<span class="ce-line-code">' + lineContent + '</span>');
      }
      html.push("</div>");
      codeEl.innerHTML = html.join("");
    },

    // 拆分 HTML 行（保留标签状态）
    splitHtmlLines: function (html) {
      var rawLines = html.split("\n");
      var result = [];
      var openTags = [];

      for (var i = 0; i < rawLines.length; i++) {
        var line = rawLines[i];
        var re = /<(\/?)(\w+)[^>]*>/g;
        var m;
        while ((m = re.exec(line)) !== null) {
          if (m[1] === "/") {
            if (openTags.length > 0) openTags.pop();
          } else if (line.charAt(m.index + m[0].length - 1) !== "/") {
            openTags.push(m[2]);
          }
        }
        var closingTags = "";
        for (var j = 0; j < openTags.length; j++) {
          closingTags += "<" + openTags[j] + ">";
        }
        result.push(closingTags + line);
      }

      if (result.length > 0 && result[result.length - 1].trim() === "") result.pop();
      return result;
    },

    copyCode: function (codeEl, btn) {
      var lineCodes = codeEl.querySelectorAll(".ce-line-code");
      var text = lineCodes.length > 0
        ? Array.prototype.map.call(lineCodes, function (el) { return el.textContent; }).join("\n")
        : codeEl.textContent || codeEl.innerText;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          decorator.showCopied(btn);
        });
      } else {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          decorator.showCopied(btn);
        } catch (err) {
          console.warn("[CodeEnhance] copy failed:", err);
        }
        document.body.removeChild(textarea);
      }
    },

    showCopied: function (btn) {
      var original = btn.textContent;
      btn.textContent = "已复制";
      btn.classList.add("ce-header-copy--copied");
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove("ce-header-copy--copied");
      }, 2000);
    },

    toggleFold: function (wrapper) {
      var pre = wrapper.querySelector("pre");
      var foldBtn = wrapper.querySelector(".ce-header-fold");
      var expandBtn = wrapper.querySelector(".ce-expand-btn");
      var collapseBtn = wrapper.querySelector(".ce-collapse-btn");

      if (!pre) return;

      if (wrapper.classList.contains("ce-fully-folded")) {
        // 展开
        wrapper.classList.remove("ce-fully-folded");
        foldBtn.classList.remove("ce-header-fold--folded");
        foldBtn.title = "收起代码";

        if (expandBtn) expandBtn.style.display = "";
        if (collapseBtn) collapseBtn.style.display = "";

        if (pre._cePrevFoldState === "fold") {
          pre.classList.remove("ce-code-unfold");
          pre.classList.add("ce-code-fold");
        } else if (pre._cePrevFoldState === "unfold") {
          pre.classList.remove("ce-code-fold");
          pre.classList.add("ce-code-unfold");
        }
      } else {
        // 折叠
        pre._cePrevFoldState = pre.classList.contains("ce-code-unfold") ? "unfold"
          : pre.classList.contains("ce-code-fold") ? "fold" : "none";

        wrapper.classList.add("ce-fully-folded");
        foldBtn.classList.add("ce-header-fold--folded");
        foldBtn.title = "展开代码";

        if (expandBtn) expandBtn.style.display = "none";
        if (collapseBtn) collapseBtn.style.display = "none";
      }
    }
  };

  // ==================== 代码折叠模块 ====================

  var codeFold = {
    processBlock: function (preEl) {
      if (!preEl || preEl.classList.contains("ce-code-processed")) return;

      var codeEl = preEl.querySelector("code");
      if (!codeEl || codeFold.countLines(codeEl) <= config.codeFoldLine) return;

      preEl.classList.add("ce-code-processed");
      var wrapper = preEl.parentElement;
      if (!wrapper || !wrapper.classList.contains("ce-fold-wrap")) return;

      preEl.classList.add("ce-code-fold");

      var lineHeight = parseFloat(getComputedStyle(codeEl).lineHeight) || 22;
      preEl.style.setProperty("--ce-fold-height", config.codeFoldLine * lineHeight + "px");

      // 展开按钮
      var expandBtn = document.createElement("button");
      expandBtn.className = "ce-expand-btn";
      expandBtn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开代码';
      expandBtn.addEventListener("click", function () {
        codeFold.expand(preEl, expandBtn, collapseBtn);
      });
      wrapper.appendChild(expandBtn);

      // 收起按钮
      var collapseBtn = document.createElement("button");
      collapseBtn.className = "ce-collapse-btn";
      collapseBtn.innerHTML = '<span class="ce-expand-icon">&#x25B2;</span> 收起代码';
      collapseBtn.style.display = "none";
      collapseBtn.addEventListener("click", function () {
        codeFold.collapse(preEl, expandBtn, collapseBtn);
      });
      wrapper.appendChild(collapseBtn);
    },

    countLines: function (codeEl) {
      var lineNums = codeEl.querySelectorAll(".ce-line-num");
      if (lineNums.length > 0) return lineNums.length;
      var lines = codeEl.textContent.split("\n");
      return lines.length > 0 && lines[lines.length - 1].trim() === "" ? lines.length - 1 : lines.length;
    },

    expand: function (preEl, expandBtn, collapseBtn) {
      preEl.classList.remove("ce-code-fold");
      preEl.classList.add("ce-code-unfold");
      expandBtn.style.display = "none";
      collapseBtn.style.display = "";
    },

    collapse: function (preEl, expandBtn, collapseBtn) {
      preEl.classList.remove("ce-code-unfold");
      preEl.classList.add("ce-code-fold");
      expandBtn.style.display = "";
      collapseBtn.style.display = "none";

      // 确保折叠后代码块可见
      var rect = preEl.getBoundingClientRect();
      if (rect.top < 0) {
        window.scrollBy(0, rect.top - 20);
      }
    }
  };

  // ==================== 图片折叠模块 ====================

  var imgFold = {
    processImg: function (img) {
      if (img.closest(".ce-img-wrap")) return;
      if (img.src && img.src.endsWith(".svg")) return;
      if (img.width < 100 || img.height < 50) return;

      if (img.complete && img.naturalHeight > 0) {
        imgFold.tryFold(img);
      } else {
        img.addEventListener("load", function () {
          try {
            imgFold.tryFold(img);
          } catch (err) {
            console.warn("[CodeEnhance] img fold error:", err);
          }
        });
      }
    },

    tryFold: function (img) {
      if (!img.naturalHeight || img.naturalHeight < config.imgFoldHeight) return;
      if (img.naturalWidth < 100) return;

      var wrap = document.createElement("div");
      wrap.className = "ce-img-wrap ce-img-folded";
      wrap.style.setProperty("--ce-img-fold-height", config.imgFoldHeight + "px");

      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);

      var btn = document.createElement("button");
      btn.className = "ce-img-expand-btn";
      btn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开图片';
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        imgFold.toggle(wrap, btn);
      });
      wrap.appendChild(btn);
    },

    toggle: function (wrap, btn) {
      if (wrap.classList.contains("ce-img-unfolded")) {
        wrap.classList.remove("ce-img-unfolded");
        wrap.classList.add("ce-img-folded");
        btn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开图片';
      } else {
        wrap.classList.remove("ce-img-folded");
        wrap.classList.add("ce-img-unfolded");
        btn.innerHTML = '<span class="ce-expand-icon">&#x25B2;</span> 收起图片';
      }
    }
  };

  // ==================== IntersectionObserver ====================

  function observeCodeBlocks() {
    if (codeObserver) {
      codeObserver.disconnect();
      codeObserver = null;
    }

    var codes = document.querySelectorAll("pre > code");
    if (codes.length === 0) return;

    codeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          try {
            decorator.processCode(target);
          } catch (err) {
            console.warn("[CodeEnhance] processCode error:", err);
          }
          codeObserver.unobserve(target);
        }
      });
    }, { rootMargin: "200px", threshold: 0.01 });

    codes.forEach(function (codeEl) {
      if (!codeEl.classList.contains("ce-decorated")) {
        codeObserver.observe(codeEl);
      }
    });
  }

  function observeImages() {
    if (imgObserver) {
      imgObserver.disconnect();
      imgObserver = null;
    }

    if (!config.enableImgFold || config.imgFoldHeight <= 0) return;

    var imgs = document.querySelectorAll(imgSelector);
    if (imgs.length === 0) return;

    imgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          try {
            imgFold.processImg(target);
          } catch (err) {
            console.warn("[CodeEnhance] processImg error:", err);
          }
          imgObserver.unobserve(target);
        }
      });
    }, { rootMargin: "200px", threshold: 0.01 });

    imgs.forEach(function (img) {
      if (!img.closest(".ce-img-wrap")) {
        imgObserver.observe(img);
      }
    });
  }

  // ==================== 主题监听 ====================

  var themeDebounce = null;

  function watchThemeChanges() {
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }

    var handleThemeChange = function () {
      if (themeDebounce) clearTimeout(themeDebounce);
      themeDebounce = setTimeout(applyThemeColors, 100);
    };

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", handleThemeChange);

    themeObserver = new MutationObserver(handleThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"]
    });
  }

  // ==================== 初始化入口 ====================

  function init() {
    var container = document.querySelector(contentSelector);
    if (!container || container.getAttribute(INIT_ATTR) === "true") return;

    container.setAttribute(INIT_ATTR, "true");

    // 读取后端注入的配置
    if (typeof window.CodeEnhanceConfig !== "undefined") {
      config.pluginName = window.CodeEnhanceConfig.pluginName || "CodeEnhance";
      config.enableHighlight = window.CodeEnhanceConfig.enableHighlight === true;
      config.enableCodeFold = window.CodeEnhanceConfig.enableCodeFold === true;
      config.enableImgFold = window.CodeEnhanceConfig.enableImgFold === true;
      config.codeFoldLine = parseInt(window.CodeEnhanceConfig.codeFoldLine, 10) || 20;
      config.imgFoldHeight = parseInt(window.CodeEnhanceConfig.imgFoldHeight, 10) || 400;
      config.hljsTheme = window.CodeEnhanceConfig.hljsTheme || "";
      config.hljsDarkTheme = window.CodeEnhanceConfig.hljsDarkTheme || "";
    }

    // 应用主题颜色
    applyThemeColors();

    // 初始化高亮（可能异步加载 hljs）
    if (highlight.init()) {
      pendingInit = true;
    } else {
      observeCodeBlocks();
      observeImages();
    }
  }

  // ==================== 启动 ====================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      watchThemeChanges();
    });
  } else {
    init();
    watchThemeChanges();
  }

  // Pjax 页面切换支持
  document.addEventListener("pjax:complete", function () {
    // 清理所有 Observer
    if (themeObserver) { themeObserver.disconnect(); themeObserver = null; }
    if (codeObserver) { codeObserver.disconnect(); codeObserver = null; }
    if (imgObserver) { imgObserver.disconnect(); imgObserver = null; }
    if (themeDebounce) { clearTimeout(themeDebounce); themeDebounce = null; }

    // 清除初始化标记
    document.querySelectorAll("[" + INIT_ATTR + "]").forEach(function (el) {
      el.removeAttribute(INIT_ATTR);
    });

    init();
  });

}();
