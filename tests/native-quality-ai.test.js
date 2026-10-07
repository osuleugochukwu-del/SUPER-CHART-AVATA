import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const native=
  fs.readFileSync(
    new URL(
      '../src/native-v27-renderer.js',
      import.meta.url
    ),
    'utf8'
  );

const quality=
  fs.readFileSync(
    new URL(
      '../src/chart-quality-ai.js',
      import.meta.url
    ),
    'utf8'
  );

const recovery=
  fs.readFileSync(
    new URL(
      '../src/master-recovery.js',
      import.meta.url
    ),
    'utf8'
  );

const server=
  fs.readFileSync(
    new URL(
      '../server/app.py',
      import.meta.url
    ),
    'utf8'
  );

test(
  'native v2.7 renderer is installed as the default active engine',
  ()=>{
    assert.match(
      recovery,
      /installNativeV27Engine\s*\(\s*app\s*\)/
    );

    assert.match(
      native,
      /Trade Avata Native v2\.7/
    );

    assert.match(
      native,
      /active\s*:\s*'native'/
    );

    assert.match(
      native,
      /ta-native-v27-layer/
    );

    assert.match(
      native,
      /upColor\s*:\s*[\r\n\s]*'rgba\(0,0,0,0\)'/
    );
  }
);

test(
  'native integration preserves a TradingView fallback and attribution only for fallback',
  ()=>{
    assert.match(
      native,
      /TradingView fallback/
    );

    assert.match(
      native,
      /attributionLogo\s*:\s*[\r\n\s]*!active/
    );

    assert.match(
      native,
      /setChartEngine/
    );
  }
);

test(
  'Chart Quality AI is owner-only and starts with automatic questions',
  ()=>{
    assert.match(
      recovery,
      /installChartQualityAI\s*\(\s*app\s*\)/
    );

    assert.match(
      quality,
      /u\.role==='owner'/
    );

    assert.doesNotMatch(
      quality,
      /u\.role==='admin'/
    );

    assert.match(
      quality,
      /What should I improve first\?/
    );

    assert.match(
      quality,
      /Are drawings moving perfectly with the chart\?/
    );

    assert.match(
      quality,
      /What should we test before the next deployment\?/
    );
  }
);

test(
  'quality monitor is lightweight and measures native paint, frame rate and errors',
  ()=>{
    for(
      const key of[
        'recordNativeRender',
        'fps_sample',
        'long_task',
        'oscillator_height_drift',
        'series_rebuild'
      ]
    ){
      assert.match(
        quality,
        new RegExp(key)
      );
    }

    assert.match(
      quality,
      /setTimeout\s*\(\s*sample\s*,\s*14000\s*\)/
    );
  }
);

test(
  'quality AI has an offline local analysis fallback and backend quality channel',
  ()=>{
    assert.match(
      quality,
      /localAnswer/
    );

    assert.match(
      quality,
      /requestAI\s*\(\s*\{\s*channel\s*:\s*'quality'/
    );

    assert.match(
      server,
      /\['indicator','market','quality'\]/
    );

    assert.match(
      server,
      /\{'indicator','market','quality'\}/
    );
  }
);

test(
  'native v2.7 paints price overlay indicators on the same canvas frame',
  ()=>{
    assert.match(
      native,
      /function\s+applyOverlayIndicatorVisibility/
    );

    assert.match(
      native,
      /drawOverlayIndicators/
    );

    assert.match(
      native,
      /this\.drawOverlayIndicators\s*\(\s*ctx\s*,\s*start\s*,\s*end\s*,\s*w\s*\)/
    );

    assert.match(
      native,
      /meta\.paneIndex\s*!==\s*0/
    );

    assert.match(
      native,
      /pane\.yForPrice\s*\?\.\s*\(\s*value\s*\)/
    );

    assert.match(
      native,
      /pane\.logicalToCoordinate\s*\?\.\s*\(\s*i\s*\)/
    );
  }
);

test(
  'old overlay indicator line is transparent while native renderer is active',
  ()=>{
    assert.match(
      native,
      /applyOverlayIndicatorVisibility\s*\(\s*this\.pane\s*,\s*active\s*\)/
    );

    assert.match(
      native,
      /native\s*&&\s*visible[\s\S]*?'rgba\(0,0,0,0\)'/
    );

    assert.match(
      native,
      /priceLineVisible\s*:\s*false/
    );

    assert.match(
      native,
      /lastValueVisible\s*:\s*false/
    );
  }
);

test(
  'native candle and indicator layer rerenders whenever chart overlays rerender',
  ()=>{
    assert.match(
      native,
      /const\s+renderOverlays\s*=\s*pane\.renderOverlays\.bind/
    );

    assert.match(
      native,
      /pane\.renderOverlays\s*=\s*function/
    );

    assert.match(
      native,
      /renderer\.render\s*\(\s*\)/
    );
  }
);

test(
  'native renderer detects Renko Pips and Renko Time',
  ()=>{
    assert.match(
      native,
      /function\s+isRenkoPane/
    );

    assert.match(
      native,
      /mode\s*===\s*'renko-pips'/
    );

    assert.match(
      native,
      /mode\s*===\s*'renko-time'/
    );

    assert.match(
      native,
      /renkoDirection/
    );
  }
);

test(
  'Renko uses a dedicated brick renderer instead of normal candle rendering',
  ()=>{
    assert.match(
      native,
      /drawRenkoBrick\s*\(/
    );

    assert.match(
      native,
      /drawCandle\s*\(/
    );

    assert.match(
      native,
      /if\s*\(\s*renko\s*\)[\s\S]*?drawRenkoBrick/
    );

    assert.match(
      native,
      /else[\s\S]*?drawCandle/
    );
  }
);

test(
  'Renko brick renderer uses full rectangular bodies without wick rendering',
  ()=>{
    const fn=
      native.match(
        /drawRenkoBrick\s*\([\s\S]*?\n\s*render\s*\(/
      )?.[0]||'';

    assert.ok(
      fn.length>0
    );

    assert.match(
      fn,
      /brickW/
    );

    assert.match(
      fn,
      /fillRect/
    );

    assert.match(
      fn,
      /strokeRect/
    );

    assert.doesNotMatch(
      fn,
      /wickVisible/
    );

    assert.doesNotMatch(
      fn,
      /moveTo\s*\(\s*sx/
    );
  }
);

test(
  'Renko brick width nearly fills its logical spacing',
  ()=>{
    assert.match(
      native,
      /spacing\s*\*\s*\.98/
    );

    assert.match(
      native,
      /Math\.max\s*\(\s*1\.25\s*,\s*base\s*\)/
    );
  }
);

test(
  'Renko quality telemetry reports the active construction',
  ()=>{
    assert.match(
      native,
      /construction\s*:/
    );

    assert.match(
      native,
      /pane\.period\?\.mode/
    );
  }
);
