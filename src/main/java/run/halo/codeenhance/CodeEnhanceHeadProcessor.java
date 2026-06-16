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

/**
 * 代码增强插件的页面头部处理器
 * 负责根据配置条件化注入代码高亮、代码折叠和图片折叠功能所需的资源
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CodeEnhanceHeadProcessor implements TemplateHeadProcessor {

    static final PropertyPlaceholderHelper PROPERTY_PLACEHOLDER_HELPER =
        new PropertyPlaceholderHelper("${", "}");

    private static final Set<String> CONTENT_TEMPLATES = Set.of("post", "page", "moments", "doc");
    
    private static final String HLJS_CSS_TEMPLATE = """
        <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/${hljsTheme}?v=${version}" id="ce-hljs-light"/>
        <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/${hljsDarkTheme}?v=${version}" id="ce-hljs-dark" disabled="disabled"/>
        """;
    
    private static final String BASE_RESOURCES_TEMPLATE = """
        <link rel="stylesheet" href="/plugins/${name}/assets/static/styles/code-enhance.min.css?v=${version}"/>
        <script src="/plugins/${name}/assets/static/js/code-enhance.js?v=${version}"></script>
        """;
    
    private static final String CONFIG_WITH_THEME_TEMPLATE = """
        <script>
        window.CodeEnhanceConfig = {
            pluginName: "${name}",
            enableHighlight: ${enableHighlight},
            enableCodeFold: ${enableCodeFold},
            enableImgFold: ${enableImgFold},
            codeFoldLine: ${codeFoldLine},
            imgFoldHeight: ${imgFoldHeight},
            hljsTheme: "${hljsTheme}",
            hljsDarkTheme: "${hljsDarkTheme}"
        };
        </script>
        """;
    
    private static final String CONFIG_WITHOUT_THEME_TEMPLATE = """
        <script>
        window.CodeEnhanceConfig = {
            pluginName: "${name}",
            enableHighlight: ${enableHighlight},
            enableCodeFold: ${enableCodeFold},
            enableImgFold: ${enableImgFold},
            codeFoldLine: ${codeFoldLine},
            imgFoldHeight: ${imgFoldHeight}
        };
        </script>
        """;

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
                if (!config.hasAnyFeatureEnabled()) {
                    log.debug("All features disabled, skip injection");
                    return;
                }
                
                injectResources(context, model, config);
            })
            .onErrorResume(e -> {
                log.error("CodeEnhanceHeadProcessor process failed", e);
                return Mono.empty();
            })
            .then();
    }

    private void injectResources(ITemplateContext context, IModel model, BasicConfig config) {
        Properties properties = buildProperties(config);
        
        StringBuilder builder = new StringBuilder();
        builder.append("\n<!-- PluginCodeEnhance start -->\n");
        
        if (config.enableHighlight) {
            appendHljsResources(builder, properties);
        }
        appendConfig(builder, properties, config.enableHighlight);
        appendBaseResources(builder, properties);
        
        builder.append("<!-- PluginCodeEnhance end -->\n");
        model.add(context.getModelFactory().createText(builder.toString()));
        
        log.debug("CodeEnhance script injected: highlight={}, codeFold={}, imgFold={}",
                config.enableHighlight, config.enableCodeFold, config.enableImgFold);
    }

    private Properties buildProperties(BasicConfig config) {
        Properties properties = new Properties();
        properties.setProperty("name", pluginContext.getName());
        properties.setProperty("version", pluginContext.getVersion());
        properties.setProperty("enableHighlight", String.valueOf(config.enableHighlight));
        properties.setProperty("enableCodeFold", String.valueOf(config.enableCodeFold));
        properties.setProperty("enableImgFold", String.valueOf(config.enableImgFold));
        properties.setProperty("codeFoldLine", String.valueOf(config.codeFoldLine));
        properties.setProperty("imgFoldHeight", String.valueOf(config.imgFoldHeight));
        properties.setProperty("hljsTheme", config.hljsTheme);
        properties.setProperty("hljsDarkTheme", config.hljsDarkTheme);
        return properties;
    }

    private void appendHljsResources(StringBuilder builder, Properties properties) {
        builder.append(PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders(HLJS_CSS_TEMPLATE, properties));
    }

    private void appendConfig(StringBuilder builder, Properties properties, boolean withTheme) {
        String template = withTheme ? CONFIG_WITH_THEME_TEMPLATE : CONFIG_WITHOUT_THEME_TEMPLATE;
        builder.append(PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders(template, properties));
    }

    private void appendBaseResources(StringBuilder builder, Properties properties) {
        builder.append(PROPERTY_PLACEHOLDER_HELPER.replacePlaceholders(BASE_RESOURCES_TEMPLATE, properties));
    }

    private boolean notContentTemplate(ITemplateContext context) {
        var templateId = context.getVariable("_templateId");
        if (templateId != null && CONTENT_TEMPLATES.contains(templateId)) {
            log.debug("CodeEnhance matched content template: {}", templateId);
            return false;
        }
        return !hasContentVariable(context);
    }

    private boolean hasContentVariable(ITemplateContext context) {
        return context.getVariable("post") != null 
            || context.getVariable("singlePage") != null 
            || context.getVariable("docInfo") != null 
            || context.getVariable("moments") != null;
    }

    @Data
    public static class BasicConfig {
        private boolean enableHighlight = true;
        private boolean enableCodeFold = true;
        private boolean enableImgFold = true;
        private int codeFoldLine = 20;
        private int imgFoldHeight = 400;
        private String hljsTheme = "github.min.css";
        private String hljsDarkTheme = "github-dark.min.css";

        public boolean hasAnyFeatureEnabled() {
            return enableHighlight || enableCodeFold || enableImgFold;
        }
    }
}
