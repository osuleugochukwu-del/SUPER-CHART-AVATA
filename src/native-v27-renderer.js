/*
 * Trade Avata Native Chart Engine v2.7 — integrated renderer adapter.
 *
 * This is the production-safe bridge between the approved v2.7 native candle
 * renderer and the mature Supreme chart workspace.  Trade Avata draws the
 * visible candles on its own HiDPI canvas.  The existing Supreme/LWC chart is
 * kept as compatibility scaffolding for axes, time/price coordinates,
 * oscillator panes, crosshair, replay and the rest of the already working
 * platform while the native engine continues to mature.
 */

const NATIVE_BUILD='Trade Avata Native v2.7';
const SUPPORTED_TYPES=new Set(['Candles','Heikin-Ashi']);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>globalThis.performance?.now?.()??Date.now();

function isNativeActive(app,pane){
  const e=app.state.chartEngines||{};
  return e.nativeEnabled!==false&&e.active!=='tradingview'&&SUPPORTED_TYPES.has(pane.chartType);
}


function v27MinBarSpacing(pane){
  const width=Math.max(1,pane.chartHost?.clientWidth||pane.root?.clientWidth||800),count=Math.max(2,pane.currentDataLength?.()||pane.displayBars?.length||2),targetBars=Math.max(1,Math.floor((count-1)*.75));
  return Math.max(.008,Math.min(.44,width/targetBars)/.70);
}
function applyV27ScaleRules(pane){
  try{pane.chart?.timeScale?.().applyOptions?.({minBarSpacing:v27MinBarSpacing(pane)});}catch{}
}
function captureV27Window(pane){
  try{
    const ts=pane.chart?.timeScale?.(),range=ts?.getVisibleLogicalRange?.();if(!range)return null;
    const opts=ts.options?.()||{},spacing=Math.max(.01,Number(opts.barSpacing)||Number(pane.app.state.chartSettings?.barSpacing)||7),center=(range.from+range.to)/2;
    const centerTime=pane.projectedTimeForLogical?.(center),last=(pane.currentDataLength?.()||pane.displayBars?.length||1)-1,futurePx=Math.max(0,(range.to-last)*spacing);
    return{spacing,centerTime,futurePx,span:Math.max(2,range.to-range.from)};
  }catch{return null;}
}
function restoreV27Window(pane,snap){
  if(!snap)return;try{
    const ts=pane.chart?.timeScale?.();applyV27ScaleRules(pane);ts.applyOptions({barSpacing:snap.spacing});
    const width=Math.max(1,pane.chartHost?.clientWidth||800),visible=Math.max(8,width/Math.max(.01,snap.spacing));let center=pane.logicalForTime?.(snap.centerTime);
    if(!Number.isFinite(center))center=(pane.currentDataLength?.()||pane.displayBars?.length||1)-1-visible/2;
    let from=center-visible/2,to=center+visible/2;
    if(snap.futurePx>0){const last=(pane.currentDataLength?.()||pane.displayBars?.length||1)-1;to=last+snap.futurePx/Math.max(.01,snap.spacing);from=to-visible;}
    ts.setVisibleLogicalRange({from,to});pane.renderOverlays?.();
  }catch{}
}

function mainPaneHeight(pane){
  try{return Math.max(1,pane.chart?.panes?.()?.[0]?.getHeight?.()||pane.chartHost?.clientHeight||pane.root.clientHeight||1);}catch{return Math.max(1,pane.chartHost?.clientHeight||pane.root.clientHeight||1);}
}

function crisp(v,dpr,width=1){
  const px=Math.max(1,Math.round(width*dpr)),off=px%2?.5:0;
  return (Math.round(v*dpr-off)+off)/dpr;
}

function barSpacing(pane,idx){
  const x=pane.logicalToCoordinate?.(idx),prev=pane.logicalToCoordinate?.(idx-1),next=pane.logicalToCoordinate?.(idx+1);
  if(Number.isFinite(x)&&Number.isFinite(prev))return Math.max(.35,Math.abs(x-prev));
  if(Number.isFinite(x)&&Number.isFinite(next))return Math.max(.35,Math.abs(next-x));
  return Math.max(.35,Number(pane.app.state.chartSettings?.barSpacing)||7);
}

function styleForPane(pane){
  const s=pane.app.state,c=s.candleStyle||{};
  return {
    upBody:c.upBody||s.upColor||'#089981',downBody:c.downBody||s.downColor||'#f23645',
    upBorder:c.upBorder||c.upBody||s.upColor||'#089981',downBorder:c.downBorder||c.downBody||s.downColor||'#f23645',
    upWick:c.upWick||s.wickUp||c.upBody||s.upColor||'#089981',downWick:c.downWick||s.wickDown||c.downBody||s.downColor||'#f23645',
    borderVisible:c.borderVisible!==false,wickVisible:c.wickVisible!==false
  };
}

function applySeriesVisibility(pane,native){
  if(!pane.series?.applyOptions)return;
  const s=pane.app.state,c=s.candleStyle||{};
  try{
    if(pane.chartType==='Candles'||pane.chartType==='Heikin-Ashi'){
      if(native){
        pane.series.applyOptions({
          upColor:'rgba(0,0,0,0)',downColor:'rgba(0,0,0,0)',
          borderVisible:true,borderUpColor:'rgba(0,0,0,0)',borderDownColor:'rgba(0,0,0,0)',
          wickVisible:true,wickUpColor:'rgba(0,0,0,0)',wickDownColor:'rgba(0,0,0,0)',
          lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false
        });
      }else{
        pane.series.applyOptions({
          upColor:c.upBody||s.upColor,downColor:c.downBody||s.downColor,
          borderVisible:c.borderVisible!==false,borderUpColor:c.upBorder||c.upBody||s.upColor,borderDownColor:c.downBorder||c.downBody||s.downColor,
          wickVisible:c.wickVisible!==false,wickUpColor:c.upWick||s.wickUp,wickDownColor:c.downWick||s.wickDown,
          lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false
        });
      }
    }
  }catch{}
}

export class NativeV27PaneRenderer{
  constructor(pane){
    this.pane=pane;this.app=pane.app;this.canvas=document.createElement('canvas');
    this.canvas.className='ta-native-v27-layer';this.canvas.setAttribute('aria-hidden','true');
    this.ctx=this.canvas.getContext('2d',{alpha:true});this.dpr=Math.max(1,window.devicePixelRatio||1);this.lastRenderMs=0;this.frameCount=0;
    pane.root.append(this.canvas);this.sync();
  }
  destroy(){this.canvas?.remove();}
  active(){return isNativeActive(this.app,this.pane);}
  sync(){
    const active=this.active();this.canvas.hidden=!active;this.pane.root.classList.toggle('ta-native-engine-active',active);
    applySeriesVisibility(this.pane,active);
    if(active)applyV27ScaleRules(this.pane);
    try{this.pane.chart?.applyOptions?.({layout:{attributionLogo:!active}});}catch{}
    if(active)this.render();else this.clear();
  }
  clear(){const c=this.canvas;if(!c)return;this.ctx?.clearRect(0,0,c.width,c.height);}
  resize(){
    const w=Math.max(1,this.pane.chartHost?.clientWidth||this.pane.root.clientWidth||1),h=mainPaneHeight(this.pane),dpr=Math.max(1,window.devicePixelRatio||1);
    this.dpr=dpr;const W=Math.max(1,Math.round(w*dpr)),H=Math.max(1,Math.round(h*dpr));
    if(this.canvas.width!==W)this.canvas.width=W;if(this.canvas.height!==H)this.canvas.height=H;
    this.canvas.style.width=`${w}px`;this.canvas.style.height=`${h}px`;this.canvas.style.top='0px';this.canvas.style.left='0px';
    this.ctx.setTransform(dpr,0,0,dpr,0,0);return{w,h,dpr};
  }
  render(){
    if(!this.active())return;const t0=now(),pane=this.pane,{w,h,dpr}=this.resize(),ctx=this.ctx;
    ctx.clearRect(0,0,w,h);const bars=pane.displayBars||[],n=pane.currentDataLength?.()||bars.length;if(!n)return;
    let vr;try{vr=pane.chart?.timeScale?.().getVisibleLogicalRange?.();}catch{}
    const start=clamp(Math.floor(vr?.from??Math.max(0,n-220))-3,0,Math.max(0,n-1)),end=clamp(Math.ceil(vr?.to??n-1)+3,start,Math.max(0,n-1));
    const st=styleForPane(pane);
    for(let i=start;i<=end;i++){
      const b=bars[i];if(!b)continue;const x=pane.logicalToCoordinate?.(i);if(!Number.isFinite(x)||x<-20||x>w+20)continue;
      const yo=pane.yForPrice?.(b.open),yc=pane.yForPrice?.(b.close),yh=pane.yForPrice?.(b.high),yl=pane.yForPrice?.(b.low);if(![yo,yc,yh,yl].every(Number.isFinite))continue;
      const up=b.close>=b.open,spacing=barSpacing(pane,i),bodyW=spacing>=1.15?clamp(spacing*.70,1.1,24):1;
      const wickColor=up?st.upWick:st.downWick,borderColor=up?st.upBorder:st.downBorder,fillColor=up?st.upBody:st.downBody;
      const sx=crisp(x,dpr,1),top=Math.min(yo,yc),bottom=Math.max(yo,yc),rawH=Math.max(0,bottom-top),drawH=Math.max(1/dpr,rawH);
      if(st.wickVisible){ctx.beginPath();ctx.strokeStyle=wickColor;ctx.lineWidth=Math.max(1/dpr,1/dpr);ctx.moveTo(sx,crisp(yh,dpr,1));ctx.lineTo(sx,crisp(yl,dpr,1));ctx.stroke();}
      const left=Math.round((x-bodyW/2)*dpr)/dpr,right=Math.round((x+bodyW/2)*dpr)/dpr,bw=Math.max(1/dpr,right-left),bt=Math.round(top*dpr)/dpr;
      ctx.fillStyle=fillColor;ctx.fillRect(left,bt,bw,drawH);
      if(st.borderVisible&&bodyW>=2){ctx.strokeStyle=borderColor;ctx.lineWidth=Math.max(1/dpr,1/dpr);ctx.strokeRect(crisp(left,dpr,1),crisp(bt,dpr,1),Math.max(1/dpr,bw),Math.max(1/dpr,drawH));}
    }
    this.lastRenderMs=Math.max(0,now()-t0);this.frameCount++;
    globalThis.__tradeAvataChartQuality?.recordNativeRender?.(this.lastRenderMs,{paneId:pane.id,bars:end-start+1});
  }
}

function bindPane(app,pane){
  if(!pane||pane.__nativeV27Bound)return;pane.__nativeV27Bound=true;
  const renderer=new NativeV27PaneRenderer(pane);pane.nativeV27Renderer=renderer;
  const renderOverlays=pane.renderOverlays.bind(pane);pane.renderOverlays=function(...args){const r=renderOverlays(...args);renderer.render();return r;};
  const rebuild=pane.rebuildSeries.bind(pane);pane.rebuildSeries=function(...args){const r=rebuild(...args);renderer.sync();return r;};
  const resize=pane.resize.bind(pane);pane.resize=function(...args){const r=resize(...args);renderer.render();return r;};
  const screenshot=pane.screenshot.bind(pane);pane.screenshot=function(opts={}){
    const base=screenshot(opts);if(!base||!renderer.active()||!renderer.canvas)return base;
    try{
      const out=document.createElement('canvas');out.width=base.width;out.height=base.height;const ctx=out.getContext('2d');ctx.drawImage(base,0,0);
      const scale=out.width/Math.max(1,pane.root.clientWidth);const nh=renderer.canvas.clientHeight*scale;
      ctx.drawImage(renderer.canvas,0,0,renderer.canvas.width,renderer.canvas.height,0,0,out.width,nh);
      if(opts.drawings!==false&&pane.overlayCanvas)ctx.drawImage(pane.overlayCanvas,0,0,pane.overlayCanvas.width,pane.overlayCanvas.height,0,0,out.width,out.height);
      return out;
    }catch{return base;}
  };
  const destroy=pane.destroy.bind(pane);pane.destroy=function(...args){renderer.destroy();return destroy(...args);};
  renderer.sync();
}

function engineControl(app){
  const wrap=document.createElement('div');wrap.className='ta-engine-control';
  const label=document.createElement('div');label.innerHTML='<strong>Chart engine</strong><small>Trade Avata Native v2.7 is the default renderer. TradingView/Supreme remains the fallback.</small>';
  const select=document.createElement('select');select.className='select';
  const options=[['native','Trade Avata Native v2.7'],['tradingview','TradingView fallback']];
  for(const [value,text] of options){if(value==='tradingview'&&app.state.chartEngines?.tradingViewEnabled===false)continue;const o=document.createElement('option');o.value=value;o.textContent=text;o.selected=(app.state.chartEngines?.active||'native')===value;select.append(o);}
  select.addEventListener('change',()=>app.setChartEngine(select.value));wrap.append(label,select);return wrap;
}

export function installNativeV27Engine(app){
  app.state.chartEngines={nativeEnabled:true,tradingViewEnabled:true,active:'native',...(app.state.chartEngines||{})};
  if(app.state.chartEngines.nativeEnabled!==false&&!['native','tradingview'].includes(app.state.chartEngines.active))app.state.chartEngines.active='native';
  app.setChartEngine=function(engine){
    if(engine==='tradingview'&&this.state.chartEngines.tradingViewEnabled===false)return;
    this.state.chartEngines.active=engine==='tradingview'?'tradingview':'native';this.save?.();
    for(const p of this.panes){p.nativeV27Renderer?.sync();p.renderOverlays?.();}
    this.renderTopbar?.();this.renderRightPanel?.();
    globalThis.__tradeAvataChartQuality?.record?.('engine_switch',{engine:this.state.chartEngines.active});
  };
  const setPeriod=app.setPeriod.bind(app);app.setPeriod=function(period){
    const native=this.state.chartEngines?.active!=='tradingview',snap=native?captureV27Window(this.activePane()):null;const r=setPeriod(period);
    if(native)requestAnimationFrame(()=>restoreV27Window(this.activePane(),snap));return r;
  };
  app.activeChartEngine=()=>app.state.chartEngines?.active||'native';
  const bindAll=()=>app.panes.forEach(p=>bindPane(app,p));bindAll();
  const applyLayout=app.applyLayout.bind(app);app.applyLayout=function(...args){const r=applyLayout(...args);setTimeout(bindAll,0);return r;};
  const fill=app.fillSettings.bind(app);app.fillSettings=function(tab,nav,body){fill(tab,nav,body);if(tab==='symbol'){const ctl=engineControl(this);body.prepend(ctl);}};
  const ops=app.renderOps.bind(app);app.renderOps=function(body){ops(body);const card=document.createElement('div');card.className='side-card ta-native-engine-card';card.innerHTML=`<h4>${NATIVE_BUILD}</h4><p>ACTIVE: <strong>${this.state.chartEngines.active==='native'?'Trade Avata Native':'TradingView fallback'}</strong></p><p>The native v2.7 HiDPI candle renderer is integrated into the Supreme workspace without removing working indicators, drawings, replay or oscillator panes.</p>`;card.append(engineControl(this));body.append(card);};
  app.state.chartEngines.active=app.state.chartEngines.active||'native';app.save?.();
  globalThis.__tradeAvataNativeV27={build:NATIVE_BUILD,bindAll,app};
  return{bindAll};
}
