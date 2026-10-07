import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const pane=fs.readFileSync(new URL('../src/chart-pane.js',import.meta.url),'utf8');
const recovery=fs.readFileSync(new URL('../src/master-recovery.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('master recovery is wired without changing the approved shell entry points',()=>{
  assert.match(html,/assets\/master-recovery\.css/);
  assert.match(html,/src\/master-recovery\.js/);
  assert.match(html,/id="topbar"/);
  assert.match(html,/id="leftbar"/);
  assert.match(html,/id="right-rail"/);
  assert.match(html,/id="bottom-panel"/);
});

test('hardcoded signal badges and redundant chart style selector are removed',()=>{
  assert.doesNotMatch(pane,/signal-badge signal-(?:buy|sell)/);
  assert.doesNotMatch(app,/class:'toolbar-select chart-type-select'/);
});

test('AI conversation is not automatically granted to admin role',()=>{
  const fn=app.match(/canUseAIChat\(\)\{[\s\S]*?\n  \}/)?.[0]||'';
  assert.ok(fn.length>0);
  assert.doesNotMatch(fn,/u\.role==='admin'/);
  assert.match(fn,/u\.role==='owner'/);
  assert.match(fn,/permissions/);
});

test('pointer, mobile drawing and chart controls are present',()=>{
  for(const key of ['Mouse / Pointer','ta-drawing-active','ta-return-live','ta-master-nav','master-replay-grab'])assert.match(recovery,new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('indicator attached list and Eye Edit Remove controls are present',()=>{
  for(const key of ['On this chart','master-ind-actions','toggleIndicatorVisibility','openIndicatorSettings','Remove'])assert.match(recovery,new RegExp(key));
});

test('risk reward, oscillator guides, replay trading, themes and vault are present',()=>{
  for(const key of ['riskReward=1','OSC_GUIDES','master-replay-buy','master-replay-sell','master-theme-grid','openPrivateIndicatorVault','Build & Validate'])assert.match(recovery,new RegExp(key.replace(/[&]/g,'&')));
});
