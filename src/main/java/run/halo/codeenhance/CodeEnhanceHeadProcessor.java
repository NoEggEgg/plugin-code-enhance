package run.halo.codeenhance;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.util.PropertyPlaceholderHelper;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

import java.util.Properties;
import jakarta.validation.constraints.Min;

@Component
@Order(-100)
@RequiredArgsConstructor
@Slf4j
public class CodeEnhanceHeadProcessor implements TemplateHeadProcessor {

    static final PropertyPlaceholderHelper PHP = new PropertyPlaceholderHelper("${", "}");
    private static final String BASE = """
        <link rel="stylesheet" href="/plugins/${name}/assets/styles/code-enhance.css?v=${version}"/>
        <script defer src="/plugins/${name}/assets/js/code-enhance.js?v=${version}"></script>""";

    private static final String CONFIG = """
        <script>
        window.CodeEnhanceConfig = {
            enableCodeFold: ${enableCodeFold},
            enableImgFold: ${enableImgFold},
            codeFoldLine: ${codeFoldLine},
            imgFoldHeight: ${imgFoldHeight},
            rememberFoldState: ${rememberFoldState}
        };
        </script>""";

    private final ReactiveSettingFetcher fetcher;
    private final PluginContext ctx;

    @Override
    @SuppressWarnings("null")
    public Mono<Void> process(ITemplateContext c, IModel m, IElementModelStructureHandler h) {
        return fetcher.fetch("basic", BasicConfig.class)
            .defaultIfEmpty(new BasicConfig())
            .filter(BasicConfig::hasAny)
            .doOnNext(cfg -> {
                sanitizeConfig(cfg);
                inject(c, m, cfg);
            })
            .onErrorResume(e -> {
                log.error("CodeEnhance inject failed, fallback to defaults", e);
                injectFallback(c, m);
                return Mono.empty();
            })
            .then();
    }

    private void sanitizeConfig(BasicConfig cfg) {
        if (cfg.codeFoldLine < 1) cfg.codeFoldLine = 20;
        if (cfg.imgFoldHeight < 1) cfg.imgFoldHeight = 400;
    }

    private void inject(ITemplateContext c, IModel m, BasicConfig cfg) {
        Properties p = new Properties();
        p.setProperty("name", ctx.getName());
        p.setProperty("version", ctx.getVersion());
        p.setProperty("enableCodeFold", String.valueOf(cfg.enableCodeFold));
        p.setProperty("enableImgFold", String.valueOf(cfg.enableImgFold));
        p.setProperty("codeFoldLine", String.valueOf(cfg.codeFoldLine));
        p.setProperty("imgFoldHeight", String.valueOf(cfg.imgFoldHeight));
        p.setProperty("rememberFoldState", String.valueOf(cfg.rememberFoldState));

        StringBuilder b = new StringBuilder("\n<!-- PluginCodeEnhance start -->\n");
        b.append(PHP.replacePlaceholders(CONFIG, p));
        b.append(PHP.replacePlaceholders(BASE, p));
        b.append("<!-- PluginCodeEnhance end -->\n");
        m.add(c.getModelFactory().createText(b.toString()));
    }

    private void injectFallback(ITemplateContext c, IModel m) {
        Properties p = new Properties();
        p.setProperty("name", ctx.getName());
        p.setProperty("version", ctx.getVersion());
        p.setProperty("enableCodeFold", "true");
        p.setProperty("enableImgFold", "true");
        p.setProperty("codeFoldLine", "20");
        p.setProperty("imgFoldHeight", "400");
        p.setProperty("rememberFoldState", "true");
        StringBuilder b = new StringBuilder("\n<!-- PluginCodeEnhance start (fallback) -->\n");
        b.append(PHP.replacePlaceholders(CONFIG, p));
        b.append(PHP.replacePlaceholders(BASE, p));
        b.append("<!-- PluginCodeEnhance end -->\n");
        m.add(c.getModelFactory().createText(b.toString()));
    }

    @Data
    public static class BasicConfig {
        private boolean enableCodeFold = true;
        private boolean enableImgFold = true;
        @Min(1)
        private int codeFoldLine = 20;
        @Min(1)
        private int imgFoldHeight = 400;
        private boolean rememberFoldState = true;

        public boolean hasAny() { return enableCodeFold || enableImgFold; }
    }
}
