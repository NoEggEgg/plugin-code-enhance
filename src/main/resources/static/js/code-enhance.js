!function () {
  "use strict";

  // ====== 配置 ======
  var config = {
    enableCodeFold: true,
    enableImgFold: true,
    codeFoldLine: 20,
    imgFoldHeight: 400
  };

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

  function scan(sel, cb) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.target.isConnected) {
          io.unobserve(e.target);
          cb(e.target);
        }
      });
    }, { rootMargin: '200px' });
    _observers.push(io);
    document.querySelectorAll(sel).forEach(function (el) { io.observe(el); });
  }

  function disconnectObservers() {
    _observers.forEach(function (io) { io.disconnect(); });
    _observers = [];
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
  }

  function toggleFold(w) {
    var s = w.getAttribute('data-ce-state');
    var next = s === 'collapsed' ? 'expanded' : 'collapsed';
    w.setAttribute('data-ce-state', next);
    var fb = w.querySelector('.ce-fold-btn');
    if (fb) {
      fb.setAttribute('aria-expanded', next === 'expanded' ? 'true' : 'false');
      // 同步更新 aria-label，与按钮实际显示文字一致
      fb.setAttribute('aria-label', next === 'expanded' ? I18N.foldCollapse : I18N.foldExpand);
    }
  }

  function processCode(codeEl) {
    if (codeEl.classList.contains('ce-decorated')) return;
    codeEl.classList.add('ce-decorated');

    var preEl = codeEl.parentElement;
    if (!preEl) return;

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
    preEl.style.setProperty('--ce-fold-h',
      Math.min(config.codeFoldLine * lineHeight(codeEl), window.innerHeight * 0.5) + 'px');

    if (!wrapper.querySelector('.ce-fold-btn')) {
      var btn = createBtn('fold', function () { toggleFold(wrapper); });
      btn.setAttribute('aria-label', I18N.foldExpand);
      wrapper.appendChild(btn);
    }
    wrapper.setAttribute('data-ce-state', 'collapsed');
  }

  // ====== 长图折叠 ======

  // 常见文章内容容器选择器，覆盖主流 Halo 主题
  var IMG_SEL = [
    '.article-content img',
    '.post-content img',
    'article img',
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
      img.removeAttribute(attrs[i]);
    }
  }

  function processImage(img) {
    if (img.classList.contains('ce-img-done')) return;

    // 处理懒加载图片：先尝试触发真实资源加载
    wakeLazyImage(img);

    if (!img.complete || img.naturalHeight === 0) {
      img.addEventListener('load', function () { processImage(img); }, { once: true });
      img.addEventListener('error', function () { img.classList.add('ce-img-done'); }, { once: true });
      return;
    }

    img.classList.add('ce-img-done');

    if (img.naturalWidth < 100 || img.naturalHeight < config.imgFoldHeight) return;

    // 跳过 SVG 图片（矢量图不适合折叠）
    if (img.src && (/\.svg(\?.*)?$/i.test(img.src) || /^data:image\/svg/i.test(img.src))) return;

    var w = document.createElement('div');
    w.className = 'ce-img-wrap';
    w.setAttribute('data-ce-img', 'folded');
    w.style.setProperty('--ce-img-h', config.imgFoldHeight + 'px');

    var p = img.parentElement;
    p.insertBefore(w, img);
    w.appendChild(img);

    var btn = createBtn('img', function (e) {
      var folded = w.getAttribute('data-ce-img') === 'folded';
      var next = folded ? 'unfolded' : 'folded';
      w.setAttribute('data-ce-img', next);
      e.currentTarget.setAttribute('aria-expanded', folded ? 'true' : 'false');
      e.currentTarget.setAttribute('aria-label', folded ? I18N.imgCollapse : I18N.imgExpand);
    });
    btn.setAttribute('aria-label', I18N.imgExpand);
    w.appendChild(btn);
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
    } catch (e) { console.warn('[CodeEnhance] init:', e); }
  }

  // 兼容 pjax 页面切换（Halo 默认主题使用 pjax）
  document.addEventListener('pjax:complete', function () {
    // pjax 切换时释放旧 observer，避免重复注册占内存
    disconnectObservers();
    document.documentElement.removeAttribute('data-ce-init');
    init();
  });

  init();
}();
