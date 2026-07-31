!function () {
  "use strict";

  // ====== 配置 ======
  var config = {
    enableCodeFold: true,
    enableImgFold: true,
    codeFoldLine: 20,
    imgFoldHeight: 400
  };

  // ====== 命名常量 ======
  var SCAN_MARGIN = '200px';
  var MIN_IMG_WIDTH = 100;
  var VIEWPORT_RATIO = 0.5;
  var RECHECK_MAX_RETRIES = 5;
  var TRANSITION_TIMEOUT_MS = 2000;

  // ====== 国际化文本 ======
  var I18N = {
    foldExpand: "\u5C55\u5F00\u4EE3\u7801",
    foldCollapse: "\u6298\u53E0\u4EE3\u7801",
    imgExpand: "\u5C55\u5F00\u56FE\u7247",
    imgCollapse: "\u6298\u53E0\u56FE\u7247"
  };

  function clampInt(v, fb) {
    v = parseInt(v, 10);
    return isFinite(v) && v >= 0 ? v : fb;
  }

  function readConfig() {
    var cfg = window.CodeEnhanceConfig;
    if (!cfg) return;
    if (cfg.enableCodeFold === false) config.enableCodeFold = false;
    if (cfg.enableImgFold === false) config.enableImgFold = false;
    config.codeFoldLine = clampInt(cfg.codeFoldLine, 20);
    config.imgFoldHeight = clampInt(cfg.imgFoldHeight, 400);
  }

  // ====== 工具 ======
  function lineHeight(el) {
    var cs = getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight);
    return isNaN(lh)
      ? Math.max(16, parseFloat(cs.fontSize || '16')) * 1.2
      : Math.max(12, lh);
  }

  function preVerticalPadding(preEl) {
    var cs = getComputedStyle(preEl);
    return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  }

  function calcFoldHeight(codeEl, preEl) {
    return Math.min(config.codeFoldLine * lineHeight(codeEl) + preVerticalPadding(preEl),
      window.innerHeight * VIEWPORT_RATIO) + 'px';
  }

  /**
   * 创建操作按钮（折叠/展开）
   * @param {string} type - 'fold' 或 'img'
   * @param {Function} onClick - 点击事件回调
   * @returns {HTMLElement}
   */
  function createBtn(type, onClick) {
    var b = document.createElement('button');
    b.className = 'ce-' + type + '-btn';
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    // 按钮文字由 CSS 通过 data-ce-state / data-ce-img 属性控制，无需在 HTML 中硬编码
    b.innerHTML = '<span class="ce-' + type + '-btn-icon"></span>'
                + '<span class="ce-' + type + '-btn-text"></span>';
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }

  // 保存 IntersectionObserver 实例，pjax 切换时释放旧实例
  var _observers = [];
  // 图片 rAF 重试计数器，防止 naturalHeight=0 时无限循环
  var _retryCount = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  // 检测浏览器是否支持 interpolate-size（CSS 原生 from/to auto 动画）
  var _interpolateSize = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    && CSS.supports('interpolate-size', 'allow-keywords');
  // MutationObserver 兜底：捕获非 PJAX 动态加载的内容变更（防抖计时器）
  var _contentMo = null;
  var _moDebounce = null;
  // prefers-reduced-motion 是页面级固定设置，init 时缓存一次，供展开动画分支使用
  var _reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function scan(sel, cb) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.target.isConnected) {
          io.unobserve(e.target);
          cb(e.target);
        }
      });
    }, { rootMargin: SCAN_MARGIN });
    _observers.push(io);
    document.querySelectorAll(sel).forEach(function (el) { io.observe(el); });
  }

  function disconnectObservers() {
    _observers.forEach(function (io) { io.disconnect(); });
    _observers = [];
  }

  function disconnectAll() {
    disconnectObservers();
    stopContentWatcher();
  }

  function stopContentWatcher() {
    if (_moDebounce) { clearTimeout(_moDebounce); _moDebounce = null; }
    if (_contentMo) { _contentMo.disconnect(); _contentMo = null; }
  }

  /**
   * MutationObserver 兜底：当非 PJAX 方式（htmx / turbo / 手动 AJAX）加载新内容时，
   * 自动释放旧 Observer 并重新扫描。使用防抖避免短时间内重复初始化。
   */
  function startContentWatcher() {
    stopContentWatcher();
    var root = document.querySelector('main, article, .content, .article-content, .post-content')
      || document.body;
    _contentMo = new MutationObserver(function () {
      if (_moDebounce) clearTimeout(_moDebounce);
      _moDebounce = setTimeout(function () {
        disconnectObservers();
        document.documentElement.removeAttribute('data-ce-init');
        init();
      }, 300);
    });
    _contentMo.observe(root, { childList: true, subtree: true });
  }

  // ====== 代码折叠 ======

  /**
   * 为 pre 元素创建 ce-block 包装容器（仅在需要折叠时调用）
   * 若已被包装则直接返回已有容器
   */
  function ensureWrapper(preEl) {
    var p = preEl.parentElement;
    if (p && p.tagName === 'FIGURE' && p.classList.contains('ce-block')) {
      preEl.classList.add('ce-pre');
      return p;
    }
    var f = document.createElement('figure');
    f.className = 'ce-block ce-fold-wrap';
    preEl.classList.add('ce-pre');
    preEl.parentNode.insertBefore(f, preEl);
    f.appendChild(preEl);
    return f;
  }

  /**
   * 移除 ce-block 包装，将 pre 元素还原到原始位置
   * 同时清除 codeEl 的 ce-decorated 标记，允许重新评估
   */
  function removeWrapper(preEl) {
    var fig = preEl.parentElement;
    if (!fig || fig.tagName !== 'FIGURE' || !fig.classList.contains('ce-block')) return;
    // 清除 codeEl 的 ce-decorated 标记，允许重新评估（如阈值调小后重新折叠）
    var codeEl = preEl.querySelector('code');
    if (codeEl) codeEl.classList.remove('ce-decorated');
    fig.parentNode.insertBefore(preEl, fig);
    fig.remove();
    preEl.classList.remove('ce-pre');
    // 恢复 ensureSticky 修改过的祖先 overflow（clip 临时修复 → 还原主题原始值）
    restoreOrigOverflow(fig);
  }

  /**
   * 恢复 ensureSticky 为突破 sticky 阻断而临时修改的祖先 overflow。
   * 从被移除的容器向上找带 data-ce-orig-overflow 的祖先并还原。
   */
  function restoreOrigOverflow(el) {
    var p = el;
    while (p) {
      if (p.hasAttribute && p.hasAttribute('data-ce-orig-overflow')) {
        var v = (p.getAttribute('data-ce-orig-overflow') || '||').split('|');
        p.style.overflow = v[0] || '';
        p.style.overflowX = v[1] || '';
        p.style.overflowY = v[2] || '';
        p.removeAttribute('data-ce-orig-overflow');
      }
      p = p.parentElement;
    }
  }

  /**
   * 检测 sticky 是否会被自身或祖先的滚动容器阻断。
   * 从 el 自身开始遍历（而非 parentElement）：因为展开态按钮是 el 的直接子元素，
   * sticky 定位相对最近滚动祖先生效，el 自身若有 overflow:hidden（如旧浏览器
   * 不支持 overflow:clip 时的 fallback），同样会使按钮无法粘住视口。
   * overflow:clip 不算滚动容器（不阻断 sticky），仅 hidden/scroll/auto 阻断。
   *
   * 关键边界：遍历到 body/html 即停止（不检查它们）。body 和 html 都是页面
   * 最外层滚动容器，sticky 相对它们/视口仍然正常生效；而大量主题会给
   * body/html 设 overflow:hidden 或 overflow-x:hidden 来隐藏横向溢出/让
   * 文档可滚动，若把它们算作阻断会导致全站按钮误降级为 absolute
   * （实测 theme-kaze 的 <html> 有 overflow-y:auto，被误判后按钮
   *   sticky 劫持到文档底部而非视口）。
   * 阻断时给容器加 ce-no-sticky 类，CSS 降级为 absolute 锚定容器底部。
   */
  function stickyBlocked(el) {
    var p = el;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = getComputedStyle(p);
      if ((cs.overflow !== 'visible' && cs.overflow !== 'clip') ||
          (cs.overflowX !== 'visible' && cs.overflowX !== 'clip') ||
          (cs.overflowY !== 'visible' && cs.overflowY !== 'clip')) {
        return true;
      }
      p = p.parentElement;
    }
    return false;
  }

  /**
   * 尽量保证按钮走 sticky 路径：
   * 1. 无阻断 → 直接用 sticky
   * 2. 有阻断且浏览器支持 overflow:clip → 把阻断祖先的 overflow 改为 clip
   *    （clip 与 hidden 视觉等价：都裁剪溢出，但 clip 不创建滚动容器，
   *      因此不阻断 sticky）。修改前保存原值，移除 wrap 时恢复，
   *      避免影响主题布局。
   * 3. 无法修复（旧浏览器不支持 clip）→ 加 ce-no-sticky 降级为 absolute。
   * body/html 永不修改（它们的 overflow 是页面级，改了会破坏滚动）。
   */
  function ensureSticky(el) {
    if (!stickyBlocked(el)) return;
    // 旧浏览器不支持 overflow:clip 时无法修复
    if (!window.CSS || !CSS.supports || !CSS.supports('overflow', 'clip')) {
      el.classList.add('ce-no-sticky');
      return;
    }
    var p = el;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = getComputedStyle(p);
      var blocked = (cs.overflow !== 'visible' && cs.overflow !== 'clip') ||
        (cs.overflowX !== 'visible' && cs.overflowX !== 'clip') ||
        (cs.overflowY !== 'visible' && cs.overflowY !== 'clip');
      if (blocked) {
        // 保存原始 overflow，供 removeWrapper 恢复
        if (!p.hasAttribute('data-ce-orig-overflow')) {
          p.setAttribute('data-ce-orig-overflow',
            (p.style.overflow || '') + '|' + (p.style.overflowX || '') + '|' + (p.style.overflowY || ''));
        }
        p.style.overflow = 'clip';
        p.style.overflowX = 'clip';
        p.style.overflowY = 'clip';
      }
      p = p.parentElement;
    }
    // 修复后再次检测，仍阻断（例如祖先同时有 scroll 类）则降级
    if (stickyBlocked(el)) el.classList.add('ce-no-sticky');
  }

  function toggleFold(w) {
    var s = w.getAttribute('data-ce-state');
    var next = s === 'collapsed' ? 'expanded' : 'collapsed';
    w.setAttribute('data-ce-state', next);
    w.classList.toggle('ce-unfold', next === 'expanded');
    var fb = w.querySelector('.ce-fold-btn');
    if (fb) {
      fb.setAttribute('aria-expanded', next === 'expanded' ? 'true' : 'false');
      // 同步更新 aria-label，与按钮实际显示文字一致
      fb.setAttribute('aria-label', next === 'expanded' ? I18N.foldCollapse : I18N.foldExpand);
    }
  }

  /**
   * 给代码块容器（figure/ce-block）创建并追加折叠按钮（adorn 与 wrapper 共用）
   * @param {HTMLElement} container 折叠容器（fig 或 wrapper）
   */
  function appendFoldBtn(container) {
    if (container.querySelector('.ce-fold-btn')) return;
    var btn = createBtn('fold', function () { toggleFold(container); });
    btn.setAttribute('aria-label', I18N.foldExpand);
    container.appendChild(btn);
  }

  /**
   * 给主题已有的 figure 容器加上折叠功能（adorn 模式）
   * 不创建新包装，只在现有 figure 上加 data-* 属性和折叠按钮
   */
  function adornCodeBlock(fig, codeEl) {
    fig.classList.add('ce-adorn');
    var preEl = codeEl.parentElement;
    preEl.style.setProperty('--ce-fold-h', calcFoldHeight(codeEl, preEl));
    appendFoldBtn(fig);
    fig.setAttribute('data-ce-state', 'collapsed');
    // 保证按钮走 sticky 路径；overflow 阻断时优先用 clip 修复，无法修复才降级
    ensureSticky(fig);
  }

  function processCode(codeEl) {
    if (codeEl.classList.contains('ce-decorated')) return;
    codeEl.classList.add('ce-decorated');

    var preEl = codeEl.parentElement;
    if (!preEl) return;

    // 主题可能有多层包装（figure > div > pre），使用 closest 定位祖先 figure
    var fig = preEl.closest('figure');
    if (fig) {
      // 主题已自带折叠控件 → 跳过
      if (fig.classList.contains('fold') || fig.querySelector('.expand-done, .ce-fold-btn, [class*="fold-btn"]')) {
        return;
      }
      // 主题有包装无折叠 → 给现有 figure 补折叠
      var lc = codeEl.textContent.replace(/\n$/, '').split('\n').length;
      if (lc > config.codeFoldLine) {
        adornCodeBlock(fig, codeEl);
      }
      return;
    }

    var lc = codeEl.textContent.replace(/\n$/, '').split('\n').length;

    // 行数未超过阈值：不折叠，若之前被包装过则移除包装
    if (lc <= config.codeFoldLine) {
      if (preEl.parentElement && preEl.parentElement.classList.contains('ce-block')) {
        removeWrapper(preEl);
      }
      return;
    }

    // 行数超过阈值：需要折叠，创建包装容器
    var wrapper = ensureWrapper(preEl);
    preEl.style.setProperty('--ce-fold-h', calcFoldHeight(codeEl, preEl));

    appendFoldBtn(wrapper);
    wrapper.setAttribute('data-ce-state', 'collapsed');
    ensureSticky(wrapper);
  }

  // ====== 长图折叠 ======

  // 常见文章内容容器选择器，覆盖主流 Halo 主题
  var IMG_SEL = [
    '.article-content img',
    '.post-content img',
    'article img',
    '.main-content img',
    '.moment-content img',
    '.moments-wrapper img',
    '.dm-content__body img',
    '.prose-content img'
  ].map(function (s) { return s + ':not(.ce-img-done)'; }).join(', ');

  /**
   * 检测并触发懒加载图片的真实资源加载
   * 兼容 data-src / data-original / data-lazy / data-srcset 等常见懒加载属性
   */
  function wakeLazyImage(img) {
    var attrs = ['data-src', 'data-original', 'data-lazy', 'data-srcset'];
    for (var i = 0; i < attrs.length; i++) {
      var val = img.getAttribute(attrs[i]);
      if (!val) continue;
      if (attrs[i] === 'data-srcset') {
        img.srcset = val;
      } else {
        // 避免重复设置相同的 src（会触发重复加载）
        // 使用 URL 标准化比较，处理绝对路径 vs 相对路径的问题
        try {
          var currentSrc = img.src ? new URL(img.src, location.href).href : '';
          var newSrc = new URL(val, location.href).href;
          if (!currentSrc || currentSrc !== newSrc) {
            img.src = val;
          }
        } catch (e) {
          // URL 解析失败，回退到直接比较
          if (!img.src || img.src.indexOf(val) === -1) {
            img.src = val;
          }
        }
      }
      // 保留 data-src 等属性不删除，以便加载失败后主题可重试
    }
  }

  /**
   * 判断图片是否为 SVG（矢量图不适合折叠）
   * @param {HTMLImageElement} img 目标图片
   * @returns {boolean}
   */
  function isSvgImage(img) {
    return !!(img.src && (/\.svg(\?.*)?$/i.test(img.src) || /^data:image\/svg/i.test(img.src)));
  }

  /**
   * 将图片包裹进折叠容器并绑定展开/折叠按钮（recheckAndFold 与 processImage 共用）
   * @param {HTMLImageElement} img 目标图片
   * @param {number} fullH 图片完整渲染高度(px)，供展开动画平滑过渡
   * @returns {HTMLElement} 创建的 .ce-img-wrap 容器
   */
  function wrapAndFoldImage(img, fullH) {
    var w = document.createElement('div');
    w.className = 'ce-img-wrap';
    w.setAttribute('data-ce-img', 'folded');
    w.style.setProperty('--ce-img-h', config.imgFoldHeight + 'px');
    var p = img.parentElement;
    p.insertBefore(w, img);
    w.appendChild(img);
    ensureSticky(w);
    var btn = createBtn('img', function (e) {
      var folded = w.getAttribute('data-ce-img') === 'folded';
      if (folded) {
        w.setAttribute('data-ce-img', 'unfolded');
        // 支持 interpolate-size 时由 CSS 原生处理动画，无需缓存具体高度
        if (!_interpolateSize) w.style.maxHeight = fullH + 'px';
        // 展开过程中保持裁剪以实现平滑揭示；动画结束后再放开裁剪，
        // 兼容窗口缩放等导致图片实际高度变化的场景
        if (_reducedMotion) {
          w.style.overflow = '';
        } else {
          w.style.overflow = 'hidden';
          // 清除之前的 transitionend 监听器和超时，防止累积
          if (w._ceTe) { w.removeEventListener('transitionend', w._ceTe); clearTimeout(w._ceTo); }
          var te = function te(ev) {
            if (ev.propertyName !== 'max-height') return;
            w.style.overflow = '';
            w.removeEventListener('transitionend', te);
            delete w._ceTe; delete w._ceTo;
          };
          w._ceTe = te;
          w._ceTo = setTimeout(function() {
            w.style.overflow = '';
            w.removeEventListener('transitionend', te);
            delete w._ceTe; delete w._ceTo;
          }, TRANSITION_TIMEOUT_MS);
          w.addEventListener('transitionend', te);
        }
        e.currentTarget.setAttribute('aria-expanded', 'true');
        e.currentTarget.setAttribute('aria-label', I18N.imgCollapse);
      } else {
        w.setAttribute('data-ce-img', 'folded');
        // 清除行内 max-height，回退到 CSS 的固定阈值（同为具体数值，过渡生效）
        w.style.maxHeight = '';
        e.currentTarget.setAttribute('aria-expanded', 'false');
        e.currentTarget.setAttribute('aria-label', I18N.imgExpand);
      }
    });
    btn.setAttribute('aria-label', I18N.imgExpand);
    w.appendChild(btn);
    return w;
  }

  /**
   * layout 稳定后重检图片高度并折叠
   * 解决 imagesLoaded 后 getBoundingClientRect 可能不准确的问题
   */
  function recheckAndFold(img) {
    if (!img.isConnected) return;
    if (img.closest('.ce-img-wrap')) return;
    var rect = img.getBoundingClientRect();
    if (rect.width < MIN_IMG_WIDTH || rect.height < config.imgFoldHeight) return;
    // 跳过 SVG（矢量图不适合折叠）
    if (isSvgImage(img)) return;
    // 执行折叠（rect.height 为完整渲染高度）
    wrapAndFoldImage(img, rect.height);
  }

  function processImage(img) {
    if (img.classList.contains('ce-img-done')) return;

    // 处理懒加载图片：先尝试触发真实资源加载
    wakeLazyImage(img);

    if (!img.complete || img.naturalHeight === 0) {
      // 图片未加载完成：监听 load 事件
      if (!img.complete) {
        img.addEventListener('load', function () { processImage(img); }, { once: true });
        img.addEventListener('error', function () {
          // 加载失败：清空 src，让主题可通过 data-src 重试
          img.removeAttribute('src');
          img.classList.add('ce-img-done');
        }, { once: true });
        return;
      }
      // complete=true 但 naturalHeight=0：元数据正在解析中，下帧重试，最多 5 次后放弃
      if (img.naturalHeight === 0) {
        var rc = _retryCount ? (_retryCount.get(img) || 0) : 0;
        if (rc > RECHECK_MAX_RETRIES) {
          img.classList.add('ce-img-done');
          return;
        }
        if (_retryCount) _retryCount.set(img, rc + 1);
        requestAnimationFrame(function () { processImage(img); });
        return;
      }
    }

    img.classList.add('ce-img-done');

    // 以「页面渲染高度」而非原始像素高度判断是否折叠。
    // 否则被 CSS 缩放后实际显示不足阈值却仍被包裹，折叠态会与原图一致（缺陷1）
    var rect = img.getBoundingClientRect();
    if (rect.height < config.imgFoldHeight) {
      // 渲染高度不足可能是 layout 未稳定导致，用 naturalHeight 兜底
      if (img.naturalHeight >= config.imgFoldHeight && rect.width >= MIN_IMG_WIDTH) {
        // 下个 animation frame 重试，此时 layout 应该已稳定
        requestAnimationFrame(function () { recheckAndFold(img); });
      }
      return;
    }
    if (rect.width < MIN_IMG_WIDTH) return;

    // 跳过 SVG 图片（矢量图不适合折叠）
    if (isSvgImage(img)) return;

    // 缓存图片完整渲染高度，供展开时做平滑过渡（此时尚未裁剪，rect 为全高）
    wrapAndFoldImage(img, rect.height);
  }

  // ====== 扫描 + 初始化 ======

  function scanCodeBlocks() {
    scan('pre > code:not(.ce-decorated)', function (el) {
      try { processCode(el); } catch (e) { console.warn('[CodeEnhance] processCode:', e); }
    });
  }

  function scanImages() {
    scan(IMG_SEL, function (el) {
      try { processImage(el); } catch (e) { console.warn('[CodeEnhance] processImage:', e); }
    });
  }

  function init() {
    if (document.documentElement.hasAttribute('data-ce-init')) return;
    try {
      readConfig();
      if (config.enableCodeFold) scanCodeBlocks();
      if (config.enableImgFold) scanImages();
      document.documentElement.setAttribute('data-ce-init', 'true');
      // MutationObserver 兜底：捕获非 PJAX 动态内容变更
      startContentWatcher();
      // 延迟补扫：IO 首次扫描可能因图片未加载完而跳过，延迟重扫一次
      if (config.enableImgFold) setTimeout(scanRemainingImages, 500);
    } catch (e) { console.warn('[CodeEnhance] init:', e); }
  }

  /**
   * 全量补扫：处理初始扫描中漏掉的图片。
   * 部分主题（Dream2 Plus 等）通过 JS 动态加载图片，
   * init 时它们尚未加载完毕（naturalHeight=0），IO 回调无法折叠。
   * 页面完全加载后的补扫 + init 内的延迟补扫，覆盖所有场景。
   */
  function scanRemainingImages() {
    var imgs = document.querySelectorAll(IMG_SEL);
    imgs.forEach(function(img) {
      if (!img.isConnected) return;
      // 因初次扫描时图片尚未渲染（rect=0）被误标记为 done，
      // 现在已有实际尺寸则应清除标记重新处理
      if (img.classList.contains('ce-img-done')) {
        var r = img.getBoundingClientRect();
        if (r.width >= MIN_IMG_WIDTH && r.height >= config.imgFoldHeight) {
          img.classList.remove('ce-img-done');
        }
      }
      if (!img.classList.contains('ce-img-done')) {
        processImage(img);
      }
    });
  }

  // 兼容 pjax 页面切换（Halo 默认主题使用 pjax）
  // 使用命名函数 + 先解绑再绑，防止重复注册
  function onPjaxComplete() {
    disconnectAll();
    document.documentElement.removeAttribute('data-ce-init');
    init();
  }
  document.removeEventListener('pjax:complete', onPjaxComplete);
  document.addEventListener('pjax:complete', onPjaxComplete);

  init();
}();
