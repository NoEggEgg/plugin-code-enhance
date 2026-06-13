/**
 * PluginCodeEnhance - 代码高亮、行号、标题栏、代码折叠、长图折叠
 * 零 jQuery 依赖，纯原生 JavaScript
 */
(function () {
    'use strict';

    // 全局变量声明区域
    var PLUGIN_NAME = 'CodeEnhance';
    var INIT_FLAG = 'ce-initialized';
    var _themeObserver = null;  // 保存 MutationObserver 引用以便清理
    var _codeObserver = null;   // 代码块 IntersectionObserver
    var _imgObserver = null;    // 图片 IntersectionObserver

    // 语言名称映射
    var LANG_MAP = {
        js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
        py: 'Python', python: 'Python', java: 'Java', go: 'Go', golang: 'Go',
        rust: 'Rust', c: 'C', cpp: 'C++', cs: 'C#', csharp: 'C#',
        rb: 'Ruby', ruby: 'Ruby', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin',
        scala: 'Scala', r: 'R', sql: 'SQL', sh: 'Shell', bash: 'Bash', shell: 'Shell',
        powershell: 'PowerShell', html: 'HTML', xml: 'XML', svg: 'SVG',
        css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
        json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
        markdown: 'Markdown', md: 'Markdown', dockerfile: 'Dockerfile',
        makefile: 'Makefile', lua: 'Lua', perl: 'Perl', dart: 'Dart',
        groovy: 'Groovy', vue: 'Vue', jsx: 'JSX', tsx: 'TSX',
        diff: 'Diff', plaintext: 'Text', text: 'Text'
    };

    var Config = {
        pluginName: 'CodeEnhance',
        enableHighlight: false,
        enableCodeFold: false,
        enableImgFold: false,
        codeFoldLine: 20,
        imgFoldHeight: 400,
        hljsTheme: '',
        hljsDarkTheme: ''
    };

    // 内容区域选择器常量（统一管理，便于扩展）
    var CONTENT_SELECTORS = [
        '.article-content',
        '.post-content',
        'article',
        '.moment-content',     // Moments 页面
        '.moments-wrapper',    // Moments 页面
        '.dm-content__body',   // Docsme 页面
        '.prose-content'       // Docsme 页面
    ];
    var CONTENT_SELECTOR_STR = CONTENT_SELECTORS.join(', ');
    var IMG_SELECTORS_STR = CONTENT_SELECTORS.map(function(s) { return s + ' img'; }).join(', ');

    // 主题配色映射：标题栏背景、文字色、代码区背景、边框色
    var THEME_COLORS = {
        // 亮色主题
        'github.min.css':          { bg: '#e8ecf1', color: '#24292e', codeBg: '#fff',       border: '#d1d5da' },
        'atom-one-light.min.css':  { bg: '#f0f0f0', color: '#383a42', codeBg: '#fafafa',   border: '#e5e5e5' },
        'solarized-light.min.css': { bg: '#fdf6e3', color: '#586e75', codeBg: '#fdf6e3',   border: '#eee8d5' },
        'vs.min.css':              { bg: '#f3f3f3', color: '#373737', codeBg: '#ffffff',   border: '#e6e6e6' },
        'tomorrow.min.css':        { bg: '#ffffff', color: '#4d4d4c', codeBg: '#ffffff',   border: '#e0e0e0' },
        'ascetic.min.css':         { bg: '#f7f7f7', color: '#444444', codeBg: '#ffffff',   border: '#d0d0d0' },
        'foundation.min.css':      { bg: '#f5f5f5', color: '#444444', codeBg: '#fefefe',   border: '#e0e0e0' },
        // 暗色主题
        'github-dark.min.css':     { bg: '#161b22', color: '#c9d1d9', codeBg: '#0d1117',   border: '#30363d' },
        'atom-one-dark.min.css':   { bg: '#2c313a', color: '#abb2bf', codeBg: '#282c34',   border: '#3e4451' },
        'vs2015.min.css':          { bg: '#1e1e1e', color: '#dcdcdc', codeBg: '#1e1e1e',   border: '#3e3e3e' },
        'monokai.min.css':         { bg: '#272822', color: '#f8f8f2', codeBg: '#272822',   border: '#49483e' },
        'solarized-dark.min.css':  { bg: '#002b36', color: '#839496', codeBg: '#002b36',   border: '#586e75' },
        'obsidian.min.css':        { bg: '#282828', color: '#e6e6e6', codeBg: '#282828',   border: '#3f3f3f' },
        'dracula.min.css':         { bg: '#282a36', color: '#f8f8f2', codeBg: '#282a36',   border: '#44475a' }
    };

    function loadConfig() {
        if (typeof window.CodeEnhanceConfig === 'undefined') {
            console.warn('[' + PLUGIN_NAME + '] Config not found');
            return false;
        }
        Config.pluginName = window.CodeEnhanceConfig.pluginName || 'CodeEnhance';
        Config.enableHighlight = window.CodeEnhanceConfig.enableHighlight === true;
        Config.enableCodeFold = window.CodeEnhanceConfig.enableCodeFold === true;
        Config.enableImgFold = window.CodeEnhanceConfig.enableImgFold === true;
        Config.codeFoldLine = parseInt(window.CodeEnhanceConfig.codeFoldLine, 10) || 20;
        Config.imgFoldHeight = parseInt(window.CodeEnhanceConfig.imgFoldHeight, 10) || 400;
        Config.hljsTheme = window.CodeEnhanceConfig.hljsTheme || '';
        Config.hljsDarkTheme = window.CodeEnhanceConfig.hljsDarkTheme || '';
        return true;
    }

    // 检测当前是否为暗色模式
    function isDarkMode() {
        var html = document.documentElement;
        return html.getAttribute('data-theme') === 'dark' ||
               html.classList.contains('dark') ||
               window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // 获取当前主题对应的配色
    function getCurrentThemeColors() {
        var isDark = isDarkMode();
        var theme = isDark ? Config.hljsDarkTheme : Config.hljsTheme;
        var colors = THEME_COLORS[theme];
        if (!colors) {
            // 回退：暗色用 github-dark，亮色用 github
            colors = isDark
                ? THEME_COLORS['github-dark.min.css']
                : THEME_COLORS['github.min.css'];
        }
        return colors;
    }

    // 将主题配色注入 CSS 变量，并切换 hljs 主题样式表
    function applyThemeColors() {
        var isDark = isDarkMode();
        var colors = getCurrentThemeColors();
        if (!colors) return;
        var root = document.documentElement;
        root.style.setProperty('--ce-header-bg', colors.bg);
        root.style.setProperty('--ce-header-color', colors.color);
        root.style.setProperty('--ce-code-bg', colors.codeBg);
        root.style.setProperty('--ce-border-color', colors.border);

        // 按钮和行号配色
        root.style.setProperty('--ce-btn-bg', isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.55)');
        root.style.setProperty('--ce-btn-hover-bg', isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.75)');
        root.style.setProperty('--ce-btn-color', isDark ? '#c9d1d9' : '#fff');
        root.style.setProperty('--ce-line-num-color', isDark ? '#484f58' : '#adb5bd');

        // 切换 hljs 主题样式表
        var lightLink = document.getElementById('ce-hljs-light');
        var darkLink = document.getElementById('ce-hljs-dark');
        if (lightLink) lightLink.disabled = isDark;
        if (darkLink) darkLink.disabled = !isDark;
    }

    // 从 code 元素的 class 中提取语言名
    function getLanguage(codeEl) {
        var classes = codeEl.className || '';
        var match = classes.match(/(?:language-|hljs\s+)(\w+)/);
        if (match) {
            var lang = match[1].toLowerCase();
            return LANG_MAP[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
        }
        // 尝试从 data 属性获取
        var detectedLang = codeEl.getAttribute('data-detected-lang') || codeEl.getAttribute('data-language');
        if (detectedLang) {
            detectedLang = detectedLang.toLowerCase();
            return LANG_MAP[detectedLang] || detectedLang.charAt(0).toUpperCase() + detectedLang.slice(1);
        }
        return '';
    }

    var Highlight = {
        _hljsLoaded: false,
        _loading: false,
        
        init: function () {
            if (!Config.enableHighlight) return;
            if (Highlight.isShikiActive()) return;
            
            var codeBlocks = document.querySelectorAll('pre > code');
            if (codeBlocks.length === 0) return;
            
            // 如果 hljs 已加载，直接高亮
            if (typeof hljs !== 'undefined') {
                Highlight._hljsLoaded = true;
                Highlight.doHighlight();
                return;
            }
            
            // 如果正在加载中，等待加载完成
            if (Highlight._loading) return;
            
            // 动态加载 highlight.js
            Highlight._loading = true;
            var script = document.createElement('script');
            script.src = '/plugins/' + Config.pluginName + '/assets/static/js/highlight.min.js';
            script.onload = function() {
                Highlight._loading = false;
                Highlight._hljsLoaded = true;
                Highlight.doHighlight();
            };
            script.onerror = function() {
                Highlight._loading = false;
                console.warn('[' + PLUGIN_NAME + '] Failed to load highlight.js, code highlighting disabled');
            };
            document.head.appendChild(script);
        },
        
        doHighlight: function () {
            document.querySelectorAll('code[data-highlighted="yes"]').forEach(function (el) {
                el.removeAttribute('data-highlighted');
            });
            try { 
                document.querySelectorAll('pre > code:not(.hljs)').forEach(function (codeEl) {
                    // 使用已有的 getLanguage 函数获取语言
                    var lang = codeEl.getAttribute('data-language') || 
                              codeEl.className.match(/(?:language-|hljs\s+)(\w+)/)?.[1];
                    
                    // 获取纯文本内容（textContent 自动转义 HTML）
                    var text = codeEl.textContent || codeEl.innerText;
                    
                    // 使用 textContent 设置回元素，确保内容被正确转义
                    codeEl.textContent = text;
                    
                    // 使用 highlight.js 的 API 进行高亮
                    var result;
                    if (lang && hljs.getLanguage(lang)) {
                        result = hljs.highlight(text, { language: lang, ignoreIllegals: true });
                    } else {
                        result = hljs.highlightAuto(text);
                    }
                    
                    // 将高亮结果设置回元素
                    codeEl.innerHTML = result.value;
                    codeEl.classList.add('hljs');
                    
                    // 添加标记表示已处理
                    codeEl.setAttribute('data-highlighted', 'yes');
                });
            } catch (e) { 
                console.warn('[' + PLUGIN_NAME + '] Highlight failed:', e);
            }
        },
        
        isShikiActive: function () {
            if (document.querySelector('pre.shiki, code.shiki, pre[data-shiki]')) {
                return true;
            }
            // 检查是否有 pre > code 已标记为 shiki 处理过（避免误判）
            var codeBlocks = document.querySelectorAll('pre > code');
            for (var i = 0; i < codeBlocks.length; i++) {
                var className = codeBlocks[i].className || '';
                if (className.indexOf('shiki') !== -1) return true;
            }
            return false;
        }
    };

    // 行号 + 标题栏
    var CodeDecor = {
        init: function () {
            document.querySelectorAll('pre > code').forEach(function (codeEl) {
                if (codeEl.classList.contains('ce-decorated')) return;
                CodeDecor.processCode(codeEl);
            });
        },

        processCode: function (codeEl) {
            codeEl.classList.add('ce-decorated');
            var pre = codeEl.parentElement;
            var lang = getLanguage(codeEl);

            // 确保 figure 包裹
            var figure = pre.parentElement;
            if (!figure || figure.tagName !== 'FIGURE') {
                var newFigure = document.createElement('figure');
                newFigure.className = 'ce-fold-wrap';
                pre.parentNode.insertBefore(newFigure, pre);
                newFigure.appendChild(pre);
                figure = newFigure;
            }

            // 添加标题栏
            if (!figure.querySelector('.ce-header')) {
                var header = document.createElement('div');
                header.className = 'ce-header';
                
                // 创建标题栏结构（安全方式，避免 XSS）
                var dots = document.createElement('span');
                dots.className = 'ce-header-dots';
                dots.innerHTML = 
                    '<span class="ce-header-dot ce-header-dot--red"></span>' +
                    '<span class="ce-header-dot ce-header-dot--yellow"></span>' +
                    '<span class="ce-header-dot ce-header-dot--green"></span>';
                
                var langSpan = document.createElement('span');
                langSpan.className = 'ce-header-lang';
                langSpan.textContent = lang || 'Code';  // 使用 textContent 避免 XSS
                
                var actions = document.createElement('div');
                actions.className = 'ce-header-actions';
                actions.innerHTML = 
                    '<button class="ce-header-fold" title="收起代码">' +
                        '<span class="ce-header-fold-icon ce-header-fold-icon--unfold">&#x25BC;</span>' +
                        '<span class="ce-header-fold-icon ce-header-fold-icon--fold">&#x25C0;</span>' +
                    '</button>' +
                    '<button class="ce-header-copy" title="复制代码">复制</button>';
                
                header.appendChild(dots);
                header.appendChild(langSpan);
                header.appendChild(actions);
                figure.insertBefore(header, pre);

                // 复制按钮事件（支持触摸）
                var copyBtn = header.querySelector('.ce-header-copy');
                var handleCopy = function (e) {
                    e.stopPropagation();
                    CodeDecor.copyCode(codeEl, copyBtn);
                };
                copyBtn.addEventListener('click', handleCopy);
                copyBtn.addEventListener('touchstart', handleCopy, { passive: true });

                // 标题栏折叠按钮事件（支持触摸）
                var foldBtn = header.querySelector('.ce-header-fold');
                var handleFold = function (e) {
                    e.stopPropagation();
                    CodeDecor.toggleFold(figure);
                };
                foldBtn.addEventListener('click', handleFold);
                foldBtn.addEventListener('touchstart', handleFold, { passive: true });

                // 完全折叠后点击标题栏任意位置可展开（支持触摸）
                var handleHeaderClick = function (e) {
                    if (figure.classList.contains('ce-fully-folded')) {
                        CodeDecor.toggleFold(figure);
                    }
                };
                header.addEventListener('click', handleHeaderClick);
                header.addEventListener('touchstart', handleHeaderClick, { passive: true });
            }

            // 添加行号
            CodeDecor.addLineNumbers(codeEl);

            // 自动折叠（合并原 CodeFold.init 遍历）
            if (Config.enableCodeFold && Config.codeFoldLine > 0) {
                CodeFold.processBlock(pre);
            }
        },

        addLineNumbers: function (codeEl) {
            if (codeEl.querySelector('.ce-code-grid')) return;

            var html = codeEl.innerHTML;
            var lines = CodeDecor.splitLines(html);
            if (lines.length === 0) return;

            // 使用 Grid 布局，每行 2 个节点（行号 + 代码），比 table 少 33% DOM 节点
            var parts = ['<div class="ce-code-grid">'];
            for (var i = 0; i < lines.length; i++) {
                parts.push(
                    '<span class="ce-line-num">' + (i + 1) + '</span>' +
                    '<span class="ce-line-code">' + (lines[i] || ' ') + '</span>'
                );
            }
            parts.push('</div>');
            codeEl.innerHTML = parts.join('');
        },

        // 按换行符分割 HTML，保持标签完整性
        splitLines: function (html) {
            var lines = html.split('\n');
            var result = [];
            var openTags = [];

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                // 收集当前行的开标签和闭标签
                var tagRe = /<(\/?)(\w+)[^>]*>/g;
                var m;
                while ((m = tagRe.exec(line)) !== null) {
                    if (m[1] === '/') {
                        // 闭标签：弹出匹配的开标签
                        if (openTags.length > 0) openTags.pop();
                    } else if (line.charAt(m.index + m[0].length - 1) !== '/') {
                        // 开标签（非自闭合）：压栈
                        openTags.push(m[2]);
                    }
                }

                // 行首补上上一行未闭合的标签
                var prefix = '';
                for (var j = 0; j < openTags.length; j++) {
                    prefix += '<' + openTags[j] + '>';
                }

                result.push(prefix + line);
            }

            // 移除末尾空行
            if (result.length > 0 && result[result.length - 1].trim() === '') {
                result.pop();
            }
            return result;
        },

        copyCode: function (codeEl, btn) {
            // 优先提取纯代码内容（排除行号）
            var codeCells = codeEl.querySelectorAll('.ce-line-code');
            var text;
            if (codeCells.length > 0) {
                text = Array.prototype.map.call(codeCells, function (cell) {
                    return cell.textContent;
                }).join('\n');
            } else {
                text = codeEl.textContent || codeEl.innerText;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    CodeDecor.showCopied(btn);
                });
            } else {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    CodeDecor.showCopied(btn);
                } catch (e) { /* 忽略 */ }
                document.body.removeChild(textarea);
            }
        },

        showCopied: function (btn) {
            var orig = btn.textContent;
            btn.textContent = '已复制';
            btn.classList.add('ce-header-copy--copied');
            setTimeout(function () {
                btn.textContent = orig;
                btn.classList.remove('ce-header-copy--copied');
            }, 2000);
        },

        toggleFold: function (figure) {
            var pre = figure.querySelector('pre');
            var foldBtn = figure.querySelector('.ce-header-fold');
            var expandBtn = figure.querySelector('.ce-expand-btn');
            var collapseBtn = figure.querySelector('.ce-collapse-btn');
            if (!pre) return;

            if (figure.classList.contains('ce-fully-folded')) {
                // 当前完全折叠，展开恢复之前状态
                figure.classList.remove('ce-fully-folded');
                foldBtn.classList.remove('ce-header-fold--folded');
                foldBtn.title = '收起代码';
                // 恢复 pre 的原始折叠状态
                if (pre._cePrevFoldState === 'fold') {
                    pre.classList.remove('ce-code-unfold');
                    pre.classList.add('ce-code-fold');
                    if (expandBtn) expandBtn.style.display = '';
                } else if (pre._cePrevFoldState === 'unfold') {
                    pre.classList.remove('ce-code-fold');
                    pre.classList.add('ce-code-unfold');
                    if (collapseBtn) collapseBtn.style.display = '';
                }
            } else {
                // 记住当前折叠状态
                pre._cePrevFoldState = pre.classList.contains('ce-code-unfold') ? 'unfold'
                    : pre.classList.contains('ce-code-fold') ? 'fold' : 'none';
                // 完全折叠
                figure.classList.add('ce-fully-folded');
                foldBtn.classList.add('ce-header-fold--folded');
                foldBtn.title = '展开代码';
                if (expandBtn) expandBtn.style.display = 'none';
                if (collapseBtn) collapseBtn.style.display = 'none';
            }
        }
    };

    var CodeFold = {
        processBlock: function (pre) {
            if (!pre || pre.classList.contains('ce-code-processed')) return;
            var codeEl = pre.querySelector('code');
            if (!codeEl) return;
            if (CodeFold.countLines(codeEl) <= Config.codeFoldLine) return;

            pre.classList.add('ce-code-processed');
            var figure = pre.parentElement;
            if (!figure || !figure.classList.contains('ce-fold-wrap')) return;

            pre.classList.add('ce-code-fold');
            var lineHeight = parseFloat(getComputedStyle(codeEl).lineHeight) || 22;
            pre.style.setProperty('--ce-fold-height', (Config.codeFoldLine * lineHeight) + 'px');

            // 展开按钮
            var expandBtn = document.createElement('button');
            expandBtn.className = 'ce-expand-btn';
            expandBtn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开代码';
            expandBtn.addEventListener('click', function () {
                CodeFold.expand(pre, expandBtn, collapseBtn);
            });
            figure.appendChild(expandBtn);

            // 收起按钮
            var collapseBtn = document.createElement('button');
            collapseBtn.className = 'ce-collapse-btn';
            collapseBtn.innerHTML = '<span class="ce-expand-icon">&#x25B2;</span> 收起代码';
            collapseBtn.style.display = 'none';
            collapseBtn.addEventListener('click', function () {
                CodeFold.collapse(pre, expandBtn, collapseBtn);
            });
            figure.appendChild(collapseBtn);
        },

        countLines: function (codeEl) {
            // 行号已添加时，直接数行数（Grid 布局使用 .ce-line-num）
            var lineNums = codeEl.querySelectorAll('.ce-line-num');
            if (lineNums.length > 0) return lineNums.length;
            // 未添加行号时，按换行符分割
            var lines = codeEl.textContent.split('\n');
            if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                return lines.length - 1;
            }
            return lines.length;
        },

        expand: function (pre, expandBtn, collapseBtn) {
            pre.classList.remove('ce-code-fold');
            pre.classList.add('ce-code-unfold');
            expandBtn.style.display = 'none';
            collapseBtn.style.display = '';
        },

        collapse: function (pre, expandBtn, collapseBtn) {
            pre.classList.remove('ce-code-unfold');
            pre.classList.add('ce-code-fold');
            expandBtn.style.display = '';
            collapseBtn.style.display = 'none';

            var rect = pre.getBoundingClientRect();
            if (rect.top < 0) {
                window.scrollBy(0, rect.top - 20);
            }
        }
    };

    var ImgFold = {
        processImg: function (img) {
            if (img.closest('.ce-img-wrap')) return;
            if (img.src && img.src.endsWith('.svg')) return;
            if (img.width < 100 || img.height < 50) return;

            if (img.complete && img.naturalHeight > 0) {
                ImgFold.tryFold(img);
            } else {
                img.addEventListener('load', function () { 
                    try {
                        ImgFold.tryFold(img);
                    } catch (e) {
                        console.warn('[' + PLUGIN_NAME + '] Failed to fold image:', e);
                    }
                });
            }
        },

        tryFold: function (img) {
            if (!img.naturalHeight || img.naturalHeight < Config.imgFoldHeight) return;
            if (img.naturalWidth < 100) return;

            var wrapper = document.createElement('div');
            wrapper.className = 'ce-img-wrap ce-img-folded';
            wrapper.style.setProperty('--ce-img-fold-height', Config.imgFoldHeight + 'px');

            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);

            var expandBtn = document.createElement('button');
            expandBtn.className = 'ce-img-expand-btn';
            expandBtn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开图片';
            expandBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                ImgFold.toggle(wrapper, expandBtn);
            });
            wrapper.appendChild(expandBtn);
        },

        toggle: function (wrapper, btn) {
            if (wrapper.classList.contains('ce-img-unfolded')) {
                wrapper.classList.remove('ce-img-unfolded');
                wrapper.classList.add('ce-img-folded');
                btn.innerHTML = '<span class="ce-expand-icon">&#x25BC;</span> 展开图片';
            } else {
                wrapper.classList.remove('ce-img-folded');
                wrapper.classList.add('ce-img-unfolded');
                btn.innerHTML = '<span class="ce-expand-icon">&#x25B2;</span> 收起图片';
            }
        }
    };

    function init() {
        var contentArea = document.querySelector(CONTENT_SELECTOR_STR);
        if (!contentArea) return;
        if (contentArea.getAttribute(INIT_FLAG) === 'true') return;
        contentArea.setAttribute(INIT_FLAG, 'true');

        if (!loadConfig()) return;
        applyThemeColors();
        Highlight.init();
        
        // 使用 IntersectionObserver 延迟处理代码块
        initCodeObserver();
        
        // 使用 IntersectionObserver 延迟处理图片
        initImgObserver();
    }

    // 初始化代码块延迟处理
    function initCodeObserver() {
        // 清理旧的 observer
        if (_codeObserver) {
            _codeObserver.disconnect();
            _codeObserver = null;
        }

        var codeBlocks = document.querySelectorAll('pre > code');
        if (codeBlocks.length === 0) return;

        _codeObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var codeEl = entry.target;
                    try {
                        CodeDecor.processCode(codeEl);
                    } catch (e) {
                        console.warn('[' + PLUGIN_NAME + '] Failed to process code block:', e);
                    }
                    _codeObserver.unobserve(codeEl);
                }
            });
        }, { 
            rootMargin: '200px',  // 提前 200px 处理
            threshold: 0.01 
        });

        codeBlocks.forEach(function(codeEl) {
            if (!codeEl.classList.contains('ce-decorated')) {
                _codeObserver.observe(codeEl);
            }
        });
    }

    // 初始化图片延迟处理
    function initImgObserver() {
        // 清理旧的 observer
        if (_imgObserver) {
            _imgObserver.disconnect();
            _imgObserver = null;
        }

        if (!Config.enableImgFold || Config.imgFoldHeight <= 0) return;

        var imgs = document.querySelectorAll(IMG_SELECTORS_STR);
        if (imgs.length === 0) return;

        _imgObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var img = entry.target;
                    try {
                        ImgFold.processImg(img);
                    } catch (e) {
                        console.warn('[' + PLUGIN_NAME + '] Failed to process image:', e);
                    }
                    _imgObserver.unobserve(img);
                }
            });
        }, { 
            rootMargin: '200px',
            threshold: 0.01 
        });

        imgs.forEach(function(img) {
            if (!img.closest('.ce-img-wrap')) {
                _imgObserver.observe(img);
            }
        });
    }

    // 监听暗色模式切换，重新应用配色（带防抖）
    var _themeTimer = null;
    function watchThemeChange() {
        // 清理旧的 observer
        if (_themeObserver) {
            _themeObserver.disconnect();
            _themeObserver = null;
        }

        var debouncedApply = function () {
            if (_themeTimer) clearTimeout(_themeTimer);
            _themeTimer = setTimeout(applyThemeColors, 100);
        };

        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', debouncedApply);

        // 监听 Halo 主题切换（data-theme 属性变化）
        _themeObserver = new MutationObserver(debouncedApply);
        _themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'class']
        });
    }

    function cleanup() {
        // 清理主题 MutationObserver
        if (_themeObserver) {
            _themeObserver.disconnect();
            _themeObserver = null;
        }
        // 清理代码块 IntersectionObserver
        if (_codeObserver) {
            _codeObserver.disconnect();
            _codeObserver = null;
        }
        // 清理图片 IntersectionObserver
        if (_imgObserver) {
            _imgObserver.disconnect();
            _imgObserver = null;
        }
        // 清理超时定时器
        if (_themeTimer) {
            clearTimeout(_themeTimer);
            _themeTimer = null;
        }
        // 清理初始化标记
        document.querySelectorAll('[' + INIT_FLAG + ']').forEach(function (el) {
            el.removeAttribute(INIT_FLAG);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); watchThemeChange(); });
    } else {
        init();
        watchThemeChange();
    }

    document.addEventListener('pjax:complete', function () { cleanup(); init(); });
})();