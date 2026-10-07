import fs from 'node:fs';
import path from 'node:path';

const required=[
  'index.html',
  'assets/styles.css',
  'src/app.js',
  'src/chart-pane.js',
  'src/data.js',
  'src/drawings.js',
  'src/state.js',
  'src/utils.js',

  'src/indicators.js',
  'src/analytics.js',
  'src/workspace-sync.js',
  'src/share.js',
  'src/market-intelligence.js',
  'src/ai-client.js',
  'src/indicator-security.js',
  'src/alert-client.js',
  'src/replay-client.js',

  'src/master-recovery.js',
  'src/native-v27-renderer.js',
  'src/chart-quality-ai.js',

  'public/brand/trade-avata-logo.svg',

  '.github/workflows/deploy.yml',

  'README.md',
  'CHANGELOG-v8.md',

  'assets/master-recovery.css',

  'engines/trade-avata-native-chart-v2.7.html',

  'docs/MASTER-UPGRADE-SPEC.md',
  'docs/PLATFORM-INFRASTRUCTURE.md',
  'docs/SECURITY-INDICATORS.md',
  'docs/RENKO-NOTES.md',
  'docs/ADS-AI-ALERTS.md',
  'docs/UPGRADE-CHECKLIST.md',
  'docs/SHARING.md'
];

for(const f of required){
  if(!fs.existsSync(f)){
    throw new Error(
      `Missing ${f}`
    );
  }
}

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  );

JSON.parse(
  fs.readFileSync(
    'manifest.webmanifest',
    'utf8'
  )
);

if(
  pkg.version!=='9.2.0'
){
  throw new Error(
    `Package version is ${pkg.version}; expected 9.2.0`
  );
}

const html=
  fs.readFileSync(
    'index.html',
    'utf8'
  );

if(
  !html.includes(
    'lightweight-charts@5.0.8'
  )
){
  throw new Error(
    'Lightweight Charts renderer not wired'
  );
}

if(
  !html.includes(
    'Content-Security-Policy'
  )
){
  throw new Error(
    'CSP baseline missing'
  );
}

const app=
  fs.readFileSync(
    'src/app.js',
    'utf8'
  );

const recovery=
  fs.readFileSync(
    'src/master-recovery.js',
    'utf8'
  );

/*
 * Master Recovery v9.2 checks.
 */

for(const key of[
  'Mouse / Pointer',
  'openIndicatorSettings',
  'master-ind-actions',
  'OSC_GUIDES',
  'riskReward=1',
  'ta-return-live',
  'master-replay-grab',
  'master-replay-buy',
  'master-replay-sell',
  'openPrivateIndicatorVault',
  'tradingViewEnabled',

  'setConstruction',
  'installAtomicConstructionSwitch',
  'construction_switch',
  'Heikin-Ashi',
  'renko-time',
  'renko-pips'
]){
  if(
    !recovery.includes(key)
  ){
    throw new Error(
      `Master recovery missing ${key}`
    );
  }
}

const recoveryCss=
  fs.readFileSync(
    'assets/master-recovery.css',
    'utf8'
  );

for(const key of[
  '.ta-master-nav',
  '.ta-return-live',
  '.ta-drawing-active .drawing-canvas',
  '.master-theme-grid'
]){
  if(
    !recoveryCss.includes(key)
  ){
    throw new Error(
      `Master recovery CSS missing ${key}`
    );
  }
}

if(
  !html.includes(
    'master-recovery.css'
  )||
  !html.includes(
    'master-recovery.js'
  )
){
  throw new Error(
    'Master recovery not wired into index.html'
  );
}

for(const key of[
  'openLayoutMenu',
  'openLogin',
  'openSettings',
  'openIndicatorBrowser',
  'openAlertModal',
  'installBottomResize',
  'openDrawingSettings',

  'openBrandManager',
  'startReplaySelection',
  'renderReplayControls',
  'openSnapshotMenu',
  'openChartContextMenu',
  'openWorkspaceManager',
  'detachActiveChart',

  'openTemplateMenu',
  'openTemplateManager',
  'applyChartTemplate',

  'renderAnalytics',
  'applyPlatformTheme',

  'openShareCenter',
  'shareSelectedDrawing',
  'copyShareLink',
  'applyIncomingShare',

  'renderToolsPanel',

  'openOrderTicket',
  'openPositionModify',
  'requestClosePosition',
  'cancelOrder',
  'sendBrokerCommand',

  'toggleIndicatorVisibility',
  'toggleOscillatorIndicators',

  'renderMarketCenter',
  'renderAIInsights',
  'canUseAIChat',
  'renderAIChatComposer',
  'startAIInputVoice',
  'submitAIChat',
  'speakAI',

  'startMarketIntelligenceTimer'
]){
  if(
    !app.includes(key)
  ){
    throw new Error(
      `Missing ${key}`
    );
  }
}

if(
  app.includes(
    "toast('Modify position panel opened')"
  )||
  app.includes(
    'Favorite drawing tools can be pinned here in a later workspace preset'
  )||
  app.includes(
    'order confirmation opened'
  )
){
  throw new Error(
    'Known frontend placeholder action remains'
  );
}

const pane=
  fs.readFileSync(
    'src/chart-pane.js',
    'utf8'
  );

for(const key of[
  'mount()',
  'ResizeObserver',
  'manualMode',
  'setAutoMode',
  'enterFreeMode',
  'handleScale',
  'homeView',
  'viewAllData',
  'setReplayIndex',

  'pointAtCoordinate',
  'projectedTimeForLogical',
  'updateDataWindow',
  'renderMarketPriceLines',
  'updateCountdown',

  'isPlainMainChartPoint',

  'captureOscillatorPaneHeights',
  'applyOscillatorPaneHeights',

  'legend-eye'
]){
  if(
    !pane.includes(key)
  ){
    throw new Error(
      `Missing chart engine requirement ${key}`
    );
  }
}

const data=
  fs.readFileSync(
    'src/data.js',
    'utf8'
  );

for(const key of[
  'RENKO_PIP_PERIODS',
  'RENKO_TIME_PERIODS',
  'RANGE_PIP_PERIODS',
  'TICK_PERIODS',
  'buildPeriodBars',
  'renkoTimeBars'
]){
  if(
    !data.includes(key)
  ){
    throw new Error(
      `Missing period engine ${key}`
    );
  }
}

const drawings=
  fs.readFileSync(
    'src/drawings.js',
    'utf8'
  );

for(const key of[
  'crossline',
  'brush',
  'highlighter',
  'drawPosition',
  'floating',
  'logical',
  'magnetMode'
]){
  if(
    !drawings.includes(key)
  ){
    throw new Error(
      `Missing drawing requirement ${key}`
    );
  }
}

const indicators=
  fs.readFileSync(
    'src/indicators.js',
    'utf8'
  );

for(const key of[
  'BUILTIN_INDICATORS',
  'macd',
  'stochastic',
  'bollinger',
  'rsi',
  'atr',
  'valuesToData'
]){
  if(
    !indicators
      .toLowerCase()
      .includes(
        key.toLowerCase()
      )
  ){
    throw new Error(
      `Indicator library missing ${key}`
    );
  }
}

const analytics=
  fs.readFileSync(
    'src/analytics.js',
    'utf8'
  );

for(const key of[
  'summarizeTrades',
  'profitabilityBySymbol',
  'behaviorInsights'
]){
  if(
    !analytics.includes(key)
  ){
    throw new Error(
      `Analytics missing ${key}`
    );
  }
}

const market=
  fs.readFileSync(
    'src/market-intelligence.js',
    'utf8'
  );

for(const key of[
  'analyzeMarketBars',
  'buildHeatmap',
  'buildScreener',
  'marketSentiment',
  'buildAIContext'
]){
  if(
    !market.includes(key)
  ){
    throw new Error(
      `Market Intelligence missing ${key}`
    );
  }
}

const aiClient=
  fs.readFileSync(
    'src/ai-client.js',
    'utf8'
  );

for(const key of[
  'startSpeechRecognition',
  'speakText',
  'requestAI',
  '/api/ai/'
]){
  if(
    !aiClient.includes(key)
  ){
    throw new Error(
      `AI client missing ${key}`
    );
  }
}

const share=
  fs.readFileSync(
    'src/share.js',
    'utf8'
  );

for(const key of[
  'createSharePayload',
  'buildStatelessShareUrl',
  'createSocialCardCanvas',
  'normalizeShareStatus',
  'buildShareSummary'
]){
  if(
    !share.includes(key)
  ){
    throw new Error(
      `Sharing engine missing ${key}`
    );
  }
}

if(
  /firebase|storageBucket|uploadBytes|putObject/i
    .test(share)
){
  throw new Error(
    'Share engine must not upload/store generated chart images'
  );
}

const security=
  fs.readFileSync(
    'src/indicator-security.js',
    'utf8'
  );

if(
  !security.includes(
    'Arbitrary JavaScript is not accepted'
  )
){
  throw new Error(
    'Indicator security gate missing'
  );
}

/*
 * Scan all source JavaScript
 * for unsafe eval().
 */

const srcText=
  fs.readdirSync('src')
    .filter(
      f=>f.endsWith('.js')
    )
    .map(
      f=>
        fs.readFileSync(
          path.join(
            'src',
            f
          ),
          'utf8'
        )
    )
    .join('\n');

if(
  /\beval\s*\(/
    .test(srcText)
){
  throw new Error(
    'Unsafe eval() found in src'
  );
}

/*
 * Verify relative JavaScript imports.
 */

for(
  const file of
  fs.readdirSync('src')
    .filter(
      f=>f.endsWith('.js')
    )
){
  const text=
    fs.readFileSync(
      path.join(
        'src',
        file
      ),
      'utf8'
    );

  for(
    const m of
    text.matchAll(
      /from\s+['"](\.\.?\/[^'"]+)['"]/g
    )
  ){
    const target=
      path.resolve(
        'src',
        path.dirname(file),
        m[1]
      );

    if(
      !fs.existsSync(target)
    ){
      throw new Error(
        `Broken import in ${file}: ${m[1]}`
      );
    }
  }
}

/*
 * GitHub deployment workflow.
 */

const workflow=
  fs.readFileSync(
    '.github/workflows/deploy.yml',
    'utf8'
  );

for(const marker of[
  'jobs:',
  'actions/checkout@v7',
  'actions/setup-node@v7',
  'actions/configure-pages@v6',
  'actions/upload-pages-artifact@v5',
  'actions/deploy-pages@v5',
  'actions: read',
  'pages: write',
  'id-token: write'
]){
  if(
    !workflow.includes(marker)
  ){
    throw new Error(
      `GitHub workflow missing ${marker}`
    );
  }
}

/*
 * Native v2.7 renderer.
 *
 * IMPORTANT:
 * These checks deliberately allow
 * normal whitespace and multiline
 * formatting. We verify behavior
 * markers rather than exact formatting.
 */

const native=
  fs.readFileSync(
    'src/native-v27-renderer.js',
    'utf8'
  );

for(const key of[
  'Trade Avata Native v2.7',
  'ta-native-v27-layer',
  'setChartEngine',
  'applyOverlayIndicatorVisibility',
  'drawOverlayIndicators',
  'canvasLineDash',
  'drawCandle',
  'drawRenkoBrick',
  'isRenkoPane',
  'renkoDirection'
]){
  if(
    !native.includes(key)
  ){
    throw new Error(
      `Native v2.7 integration missing ${key}`
    );
  }
}

/*
 * Native engine must hide the
 * compatibility candle series.
 */

if(
  !/upColor\s*:\s*[\r\n\s]*'rgba\(0,0,0,0\)'/
    .test(native)
){
  throw new Error(
    'Native v2.7 integration missing transparent compatibility candle body'
  );
}

/*
 * TradingView attribution must only
 * be visible when Native is not active.
 */

if(
  !/attributionLogo\s*:\s*[\r\n\s]*!active/
    .test(native)
){
  throw new Error(
    'Native v2.7 integration missing TradingView fallback attribution rule'
  );
}

/*
 * Price-overlay indicators must use
 * Native chart coordinates.
 */

if(
  !/pane\.yForPrice\s*\?\.\s*\(\s*value\s*\)/
    .test(native)
){
  throw new Error(
    'Native indicator renderer missing price coordinate mapping'
  );
}

if(
  !/pane\.logicalToCoordinate\s*\?\.\s*\(\s*i\s*\)/
    .test(native)
){
  throw new Error(
    'Native indicator renderer missing time coordinate mapping'
  );
}

/*
 * Dedicated Renko renderer.
 *
 * Renko Pips and Renko Time must
 * never be drawn through the ordinary
 * candle drawing routine.
 */

if(
  !/mode\s*===\s*'renko-pips'/
    .test(native)
){
  throw new Error(
    'Native renderer missing Renko Pips detection'
  );
}

if(
  !/mode\s*===\s*'renko-time'/
    .test(native)
){
  throw new Error(
    'Native renderer missing Renko Time detection'
  );
}

if(
  !/if\s*\(\s*renko\s*\)[\s\S]*?drawRenkoBrick/
    .test(native)
){
  throw new Error(
    'Native renderer is not routing Renko to the dedicated brick renderer'
  );
}

const renkoFn=
  native.match(
    /drawRenkoBrick\s*\([\s\S]*?\n\s*render\s*\(/
  )?.[0]||'';

if(
  !renkoFn
){
  throw new Error(
    'Native Renko brick renderer body not found'
  );
}

if(
  !renkoFn.includes(
    'fillRect'
  )
){
  throw new Error(
    'Native Renko renderer is not drawing solid brick bodies'
  );
}

if(
  !renkoFn.includes(
    'strokeRect'
  )
){
  throw new Error(
    'Native Renko renderer is missing brick borders'
  );
}

if(
  renkoFn.includes(
    'wickVisible'
  )
){
  throw new Error(
    'Native Renko renderer must not use candle wick rendering'
  );
}

if(
  !/spacing\s*\*\s*\.98/
    .test(native)
){
  throw new Error(
    'Native Renko brick width does not fill logical spacing'
  );
}

/*
 * Quality AI.
 */

const quality=
  fs.readFileSync(
    'src/chart-quality-ai.js',
    'utf8'
  );

for(const key of[
  'ChartQualityMonitor',
  'recordNativeRender',
  'What should I improve first?',
  "channel:'quality'"
]){
  if(
    !quality.includes(key)
  ){
    throw new Error(
      `Chart Quality AI missing ${key}`
    );
  }
}

console.log(
  'Trade Avata Master Recovery v9.2.0 — Native v2.7 indicator sync + dedicated Renko brick renderer + atomic Heiken Ashi/Renko construction verification passed.'
);
