package run.halo.codeenhance;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.PropertyPlaceholderHelper;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

import java.util.Properties;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class CodeEnhanceHeadProcessor implements TemplateHeadProcessor {

    static final PropertyPlaceholderHelper PROPERTY_PLACEHOLDER_HELPER =
        new PropertyPlaceholderHelper("${", "}");

    private final ReactiveSettingFetcher reactiveSettingFetcher;
    private final PluginContext pluginContext;

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
            IElementModelStructureHandler structureHandler) {
        
        if (notContentTemplate(context)) {
            return Mono.empty();
        }

        return reactiveSettingFetcher.fetch("basic", BasicConfig.class)
            .defaultIfEmpty(new BasicConfig())
            .doOnNext(config -> {
                if (!config.enableCodeHighlight && !config.enableCodeFold && !config.enableImgFold) {
                    log.debug("All features disabled, skip injection");
                    return;
                }
                
                final Properties properties = new Properties();
                properties.setProperty("name", pluginContext.getName());
                properties.setProperty("version", pluginContext.getVersion());
                properties.setProperty("enableCodeHighlight", String.valueOf(config.enableCodeHighlight));
                properties.setProperty("enableCodeFold", String.valueOf(config.enableCodeFold));
                properties.setProperty("enableImgFold", String.valueOf(config.enableImgFold));
                properties.setProperty("codeFoldLine", String.valueOf(config.codeFoldLine));
                properties.setProperty("imgFoldHeight", String.valueOf(config.imgFoldHeight));
                properties.setProperty("hljsTheme", config.hljsTheme);
                properties.setProperty("hljsDarkTheme", config.hljsDarkTheme);

                String script = PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders("""
                    <!-- PluginCodeEnhance start -->
                    <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/${hljsTheme}?v=${version}" id="ce-hljs-light"/>
                    <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/${hljsDarkTheme}?v=${version}" id="ce-hljs-dark" disabled="disabled"/>
                    <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/code-enhance.css?v=${version}"/>
                    <script src="/plugins/${name}/assets/static/js/code-enhance.js?v=${version}"></script>
                    <script>
                    window.CodeEnhanceConfig = {
                        pluginName: "${name}",
                        enableHighlight: ${enableCodeHighlight},
                        enableCodeFold: ${enableCodeFold},
                        enableImgFold: ${enableImgFold},
                        codeFoldLine: ${codeFoldLine},
                        imgFoldHeight: ${imgFoldHeight},
                        hljsTheme: "${hljsTheme}",
                        hljsDarkTheme: "${hljsDarkTheme}"
                    };
                    </script>
                    <!-- PluginCodeEnhance end -->
                    """, properties);

                model.add(context.getModelFactory().createText(script));
                log.debug("CodeEnhance script injected for template: {}",
                        context.getVariable("_templateId"));
            })
            .onErrorResume(e -> {
                log.error("CodeEnhanceHeadProcessor process failed: {}", e.getMessage());
                return Mono.empty();
            })
            .then();
    }

    private static final Set<String> CONTENT_TEMPLATES = Set.of("post", "page", "moments", "doc");

    private boolean notContentTemplate(ITemplateContext context) {
        var templateId = context.getVariable("_templateId");

        // 1. 快速路径：白名单匹配，避免昂贵的 getVariable 调用
        if (templateId != null && CONTENT_TEMPLATES.contains(templateId)) {
            log.debug("CodeEnhance matched content template: {}", templateId);
            return false;
        }

        // 2. 兜底：检测内容变量（支持 Moments/Docsme 等插件页面）
        if (context.getVariable("post") != null) {
            log.debug("CodeEnhance detected post variable");
            return false;
        }
        if (context.getVariable("singlePage") != null) {
            log.debug("CodeEnhance detected singlePage variable");
            return false;
        }
        if (context.getVariable("docInfo") != null) {
            log.debug("CodeEnhance detected docInfo variable (Docsme)");
            return false;
        }
        if (context.getVariable("moments") != null) {
            log.debug("CodeEnhance detected moments variable (Moments)");
            return false;
        }

        log.debug("CodeEnhance skipping non-content template: {}", templateId);
        return true;
    }

    @Data
    public static class BasicConfig {
        private boolean enableCodeHighlight = true;
        private boolean enableCodeFold = true;
        private boolean enableImgFold = true;
        private int codeFoldLine = 20;
        private int imgFoldHeight = 400;
        private String hljsTheme = "github.min.css";
        private String hljsDarkTheme = "github-dark.min.css";
    }
}