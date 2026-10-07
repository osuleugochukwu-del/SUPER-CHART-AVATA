import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const native=fs.readFileSync(new URL('../src/native-v27-renderer.js',import.meta.url),'utf8');
const quality=fs.readFileSync(new URL('../src/chart-quality-ai.js',import.meta.url),'utf8');
const recovery=fs.readFileSync(new URL('../src/master-recovery.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server/app.py',import.meta.url),'utf8');

test('native v2.7 renderer is installed as the default active engine',()=>{
  assert.match(recovery,/installNativeV27Engine\(app\)/);
  assert.match(native,/Trade Avata Native v2\.7/);
  assert.match(native,/active:'native'/);
  assert.match(native,/ta-native-v27-layer/);
  assert.match(native,/upColor:'rgba\(0,0,0,0\)'/);
});

test('native integration preserves a TradingView fallback and attribution only for fallback',()=>{
  assert.match(native,/TradingView fallback/);
  assert.match(native,/attributionLogo:!active/);
  assert.match(native,/setChartEngine/);
});

test('Chart Quality AI is owner-only and starts with automatic questions',()=>{
  assert.match(recovery,/installChartQualityAI\(app\)/);
  assert.match(quality,/u\.role==='owner'/);
  assert.doesNotMatch(quality,/u\.role==='admin'/);
  assert.match(quality,/What should I improve first\?/);
  assert.match(quality,/Are drawings moving perfectly with the chart\?/);
  assert.match(quality,/What should we test before the next deployment\?/);
});

test('quality monitor is lightweight and measures native paint, frame rate and errors',()=>{
  for(const key of ['recordNativeRender','fps_sample','long_task','oscillator_height_drift','series_rebuild'])assert.match(quality,new RegExp(key));
  assert.match(quality,/setTimeout\(sample,14000\)/);
});

test('quality AI has an offline local analysis fallback and backend quality channel',()=>{
  assert.match(quality,/localAnswer/);
  assert.match(quality,/requestAI\(\{channel:'quality'/);
  assert.match(server,/\['indicator','market','quality'\]/);
  assert.match(server,/\{'indicator','market','quality'\}/);
});
