import {
  generateBars, buildPeriodBars, buildDisplayBars, heikinAshi,
  SYMBOLS, formatPrice, niceStep, timeframeSeconds, periodLabel
} from './data.js';
import { DrawingLayer } from './drawings.js';
import { computeIndicator, valuesToData } from './indicators.js';
import { el, clamp, toast } from './utils.js';

export class ChartPane{
  constructor(app,id,config={}){
    this.app=app;this.id=id;
    this.symbol=config.symbol||'XAUUSD';
    this.timeframe=config.timeframe||config.period?.value||'15s';
    this.period=config.period?.mode?structuredClone(config.period):{mode:'time',value:this.timeframe};
    this.chartType=config.chartType||'Candles';
    this.detached=!!config.detached;

    this.rawBars=[];this.periodBars=[];this.displayBars=[];this.barIndex=new Map();
    this.series=null;this.indicatorSeries=[];this.oscillatorPanes=[];this.chart=null;this.drawingLayer=null;
    this.manualMode=false;this.manualRange=null;this.scaleGesture=null;this.verticalPan=null;
    this.replayIndex=null;this.replaySelecting=false;this.replaySelectorLogical=null;this.replayFollow=true;
    this.lastCrosshair=null;this.mounted=false;this.suppressRangeEvent=false;

    this.root=this.buildDom();
    this.chartHost=this.root.querySelector('.lwc-host');
    this.overlayCanvas=this.root.querySelector('.drawing-canvas');
    this.roundGridCanvas=this.root.querySelector('.round-grid-canvas');
  }

  mount(){
    if(this.mounted)return;this.mounted=true;
    this.createChart();
    this.drawingLayer=new DrawingLayer(this,this.overlayCanvas,()=>this.app.state,e=>this.app.handleDrawingChange(e,this));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.root);
    this.loadData({home:true});
    this.updateCursorMode();
    this.countdownTimer=setInterval(()=>this.updateCountdown(),1000);this.updateCountdown();
  }

  buildDom(){
    const root=el('section',{class:'chart-pane',tabindex:'0','data-pane':this.id});
    root.innerHTML=`
      <div class="pane-overlay-head">
        <button class="pane-symbol-overlay" title="Open chart settings"><span class="diamond">◆</span><strong></strong><span class="market-dot"></span></button>
        <div class="pane-ohlc"></div>
        <div class="indicator-legend"></div>
      </div>
      <div class="pane-latency"><span>SYNC</span><b>18 ms</b><small>age 2 ms</small></div>
      <div class="bar-countdown"></div>
      <div class="lwc-host"></div>
      <canvas class="round-grid-canvas"></canvas>
      <canvas class="drawing-canvas"></canvas>
      <div class="data-window-card"></div>
      <div class="replay-selector-line"><span>SELECT REPLAY START</span></div>
      <div class="replay-toolbar"></div>
      <div class="chart-nav"><button data-nav="live">● LIVE</button><button data-nav="auto">AUTO</button><button data-nav="free">FREE</button><button data-nav="shift">SHIFT ${this.app.state.chartSettings.shiftPercent??22}%</button><button data-nav="reset">RESET</button></div>
      <div class="chart-mode-chip">AUTO</div>
    `;
    root.addEventListener('pointerdown',()=>this.app.setActivePaneById(this.id));
    root.addEventListener('contextmenu',e=>{
      if(!this.chart)return;e.preventDefault();
      const r=this.chartHost.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      const logical=this.logicalAtCoordinate(x),price=this.priceAtCoordinate(y),time=this.projectedTimeForLogical(logical);
      this.app.openChartContextMenu?.(e,this,{x,y,logical,price,time});
    });
    root.querySelector('.pane-symbol-overlay').addEventListener('dblclick',e=>{e.stopPropagation();this.app.openSettings('symbol');});
    root.querySelector('.pane-symbol-overlay').addEventListener('click',e=>{e.stopPropagation();this.app.openSettings('symbol');});
    root.querySelector('[data-nav="live"]').addEventListener('click',()=>this.goLive());
    root.querySelector('[data-nav="auto"]').addEventListener('click',()=>this.setAutoMode(false));
    root.querySelector('[data-nav="free"]').addEventListener('click',()=>this.enterFreeMode());
    root.querySelector('[data-nav="shift"]').addEventListener('click',e=>this.cycleShift(e.currentTarget));
    root.querySelector('[data-nav="reset"]').addEventListener('click',()=>this.resetView());
    return root;
  }

  createChart(){
    if(!window.LightweightCharts)throw new Error('Lightweight Charts failed to load. Check internet connection.');
    const L=window.LightweightCharts,s=this.app.state,cs=s.chartSettings;
    this.chart=L.createChart(this.chartHost,{
      autoSize:true,
      layout:{
        background:{type:'solid',color:s.background},textColor:s.textColor,
        fontSize:window.innerWidth<=780?9:11,fontFamily:'Inter,system-ui,sans-serif',attributionLogo:false,
        panes:{separatorColor:'#1b3348',separatorHoverColor:'#2b5574',enableResize:true}
      },
      grid:{vertLines:{visible:s.gridV,color:s.gridColor},horzLines:{visible:s.gridH,color:s.gridColor}},
      rightPriceScale:{
        visible:true,borderVisible:false,autoScale:true,mode:this.priceScaleModeValue(),
        scaleMargins:{top:cs.topMargin,bottom:cs.bottomMargin},minimumWidth:window.innerWidth<=780?42:46,
        tickMarkDensity:2.5
      },
      leftPriceScale:{visible:false},
      timeScale:{
        visible:true,borderVisible:false,timeVisible:true,secondsVisible:true,
        rightOffset:cs.rightOffset,barSpacing:cs.barSpacing,minBarSpacing:.45,
        fixLeftEdge:false,fixRightEdge:false,lockVisibleTimeRangeOnResize:false,
        shiftVisibleRangeOnNewBar:true
      },
      crosshair:{
        mode:L.CrosshairMode?.Normal??0,
        vertLine:{visible:true,color:s.crosshairColor,width:1,style:L.LineStyle?.Dashed??2,labelBackgroundColor:'#173042'},
        horzLine:{visible:true,color:s.crosshairColor,width:1,style:L.LineStyle?.Dashed??2,labelBackgroundColor:'#173042'}
      },
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:true},
      handleScale:{axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true},mouseWheel:true,pinch:true},
      kineticScroll:{mouse:true,touch:true},
      hoveredSeriesOnTop:true
    });
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range=>{
      this.renderOverlays();
      if(!this.suppressRangeEvent)this.app.onPaneRangeChanged?.(this,range);
    });
    this.chart.subscribeCrosshairMove(param=>{
      this.lastCrosshair=param;this.updateCrosshairReadout(param);this.updateDataWindow(param);this.app.onCrosshair?.(this,param);
    });
    this.installGestureBridge();
    this.installReplaySelectorBridge();
  }

  priceScaleModeValue(){
    const L=window.LightweightCharts,m=this.app.state.priceScaleMode||'normal';
    const map={normal:L.PriceScaleMode?.Normal??0,log:L.PriceScaleMode?.Logarithmic??1,percent:L.PriceScaleMode?.Percentage??2,indexed:L.PriceScaleMode?.IndexedTo100??3};
    return map[m]??map.normal;
  }

  installGestureBridge(){
    const host=this.chartHost;
    host.addEventListener('pointerdown',e=>{
      if(this.replaySelecting)return;
      if(!['cursor','crosshair'].includes(this.app.state.activeTool))return;
      const r=host.getBoundingClientRect(),x=e.clientX-r.left;
      if(x>r.width-72){this.scaleGesture={x:e.clientX,y:e.clientY,moved:false};return;}
      if(this.manualMode)this.verticalPan={x:e.clientX,y:e.clientY,started:false,range:this.manualRange?{...this.manualRange}:this.rangeFromCoordinates()};
    },true);
    host.addEventListener('pointermove',e=>{
      if(this.scaleGesture){if(Math.hypot(e.clientX-this.scaleGesture.x,e.clientY-this.scaleGesture.y)>4)this.scaleGesture.moved=true;return;}
      if(!this.verticalPan||!this.manualMode)return;
      const dx=e.clientX-this.verticalPan.x,dy=e.clientY-this.verticalPan.y;
      if(!this.verticalPan.started){if(Math.abs(dy)<6||Math.abs(dy)<Math.abs(dx)*1.15)return;this.verticalPan.started=true;this.manualRange=this.verticalPan.range||this.rangeFromCoordinates();}
      if(!this.manualRange)return;
      e.preventDefault();e.stopPropagation();
      const span=this.verticalPan.range.max-this.verticalPan.range.min,h=Math.max(1,host.clientHeight),shift=(dy/h)*span;
      this.manualRange={min:this.verticalPan.range.min+shift,max:this.verticalPan.range.max+shift};this.applyManualProvider();this.renderOverlays();
    },true);
    const end=()=>{
      if(this.scaleGesture){
        if(this.scaleGesture.moved){this.manualMode=true;this.manualRange=this.rangeFromCoordinates();this.applyManualProvider();this.updateModeChip();}
        this.scaleGesture=null;
      }
      this.verticalPan=null;
      setTimeout(()=>this.captureOscillatorPaneHeights(),0);
    };
    host.addEventListener('pointerup',end,true);host.addEventListener('pointercancel',end,true);
    host.addEventListener('dblclick',e=>{
      const r=host.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      if(x>r.width-72){this.setAutoMode(false);return;}
      if(this.app.state.selectedDrawingId||!['cursor','crosshair'].includes(this.app.state.activeTool))return;
      // Empty-chart double-click intentionally does nothing. Oscillator visibility is controlled from its Eye button.
    });
  }

  isPlainMainChartPoint(x,y){
    try{
      const panes=this.chart?.panes?.()||[],mainHeight=panes[0]?.getHeight?.()??this.chartHost.clientHeight;
      if(y<0||y>mainHeight)return false;
      const logical=this.logicalAtCoordinate(x),idx=Math.round(logical);
      if(!Number.isFinite(idx)||idx<0||idx>=this.displayBars.length)return true;
      const bar=this.displayBars[idx],cx=this.logicalToCoordinate(idx);if(cx==null)return true;
      const half=Math.max(4,Math.min(14,(this.app.state.chartSettings?.barSpacing||7)*.6));
      if(Math.abs(x-cx)>half)return true;
      if(this.chartType==='Line'||this.chartType==='Area'){const py=this.yForPrice(bar.close);return py==null||Math.abs(y-py)>7;}
      const hi=this.yForPrice(bar.high??bar.close),lo=this.yForPrice(bar.low??bar.close);if(hi==null||lo==null)return true;
      const top=Math.min(hi,lo)-5,bottom=Math.max(hi,lo)+5;return y<top||y>bottom;
    }catch{return true;}
  }

  captureOscillatorPaneHeights(){
    if(!this.oscillatorPanes?.length)return;
    try{
      const panes=this.chart?.panes?.()||[];let changed=false;
      for(const meta of this.oscillatorPanes){const pane=panes[meta.paneIndex],h=pane?.getHeight?.();if(!Number.isFinite(h)||h<28)continue;const next=Math.round(h);if(meta.cfg.paneHeight!==next){meta.cfg.paneHeight=next;changed=true;}}
      if(changed)this.app.save?.();
    }catch{}
  }

  applyOscillatorPaneHeights(){
    if(!this.oscillatorPanes?.length)return;
    try{
      const panes=this.chart?.panes?.()||[],hostH=Math.max(240,this.chartHost.clientHeight||600),count=this.oscillatorPanes.length;
      const fallback=Math.max(56,Math.min(130,Math.floor((hostH*.42)/Math.max(1,count))));
      for(const meta of this.oscillatorPanes){const pane=panes[meta.paneIndex];if(!pane?.setHeight)continue;const wanted=Math.max(36,Math.min(Math.round(hostH*.42),Number(meta.cfg.paneHeight)||fallback));pane.setHeight(wanted);}
    }catch{}
  }

  installReplaySelectorBridge(){
    const host=this.chartHost,line=this.root.querySelector('.replay-selector-line');
    host.addEventListener('pointermove',e=>{
      if(!this.replaySelecting)return;
      const r=host.getBoundingClientRect(),x=clamp(e.clientX-r.left,0,r.width),logical=this.logicalAtCoordinate(x);
      this.replaySelectorLogical=logical;line.style.left=`${Math.round(x)}px`;
    },true);
    host.addEventListener('pointerdown',e=>{
      if(!this.replaySelecting)return;
      e.preventDefault();e.stopPropagation();
      const r=host.getBoundingClientRect(),logical=this.logicalAtCoordinate(e.clientX-r.left);
      const idx=clamp(Math.round(logical),20,Math.max(20,this.displayBars.length-2));
      this.exitReplaySelection();this.app.onReplayStartSelected?.(this,idx);
    },true);
  }

  enterReplaySelection(){
    this.replaySelecting=true;this.replaySelectorLogical=null;this.root.classList.add('replay-selecting');
    this.root.querySelector('.replay-selector-line').style.display='block';
  }
  exitReplaySelection(){this.replaySelecting=false;this.root.classList.remove('replay-selecting');this.root.querySelector('.replay-selector-line').style.display='none';}

  renderReplayToolbar(content){const box=this.root.querySelector('.replay-toolbar');box.replaceChildren(...(Array.isArray(content)?content:[content]).filter(Boolean));box.classList.toggle('show',box.childNodes.length>0);}
  clearReplayToolbar(){const box=this.root.querySelector('.replay-toolbar');box.innerHTML='';box.classList.remove('show');}

  enterFreeMode(){this.manualMode=true;this.manualRange=this.rangeFromCoordinates();this.applyManualProvider();this.updateModeChip();toast('Free vertical chart movement enabled');}
  cycleShift(button){
    const opts=[0,10,22,35],cur=this.app.state.chartSettings.shiftPercent??22;let i=opts.findIndex(v=>v===cur);i=(i+1)%opts.length;const next=opts[i];this.app.state.chartSettings.shiftPercent=next;
    const visibleBars=Math.max(10,this.chartHost.clientWidth/Math.max(.5,this.app.state.chartSettings.barSpacing||7)),rightOffset=Math.round(visibleBars*next/100);
    try{this.chart.timeScale().applyOptions({rightOffset});}catch{}
    if(button)button.textContent=`SHIFT ${next}%`;this.app.save();
  }

  rangeFromCoordinates(){
    if(!this.series)return null;const h=Math.max(20,this.chartHost.clientHeight-24),a=this.series.coordinateToPrice(4),b=this.series.coordinateToPrice(h-4);if(a==null||b==null)return null;return{min:Math.min(a,b),max:Math.max(a,b)};
  }
  applyManualProvider(){
    if(!this.manualRange)return;const provider=()=>({priceRange:{minValue:this.manualRange.min,maxValue:this.manualRange.max}});
    try{this.series?.applyOptions({autoscaleInfoProvider:provider});this.indicatorSeries.filter(x=>x.paneIndex===0).forEach(x=>x.series.applyOptions({autoscaleInfoProvider:provider}));}catch{}
  }
  clearManualProvider(){try{this.series?.applyOptions({autoscaleInfoProvider:null});this.indicatorSeries.forEach(x=>x.series.applyOptions({autoscaleInfoProvider:null}));}catch{}}
  setAutoMode(home=false){this.manualMode=false;this.manualRange=null;this.clearManualProvider();try{this.chart.priceScale('right').applyOptions({autoScale:true,mode:this.priceScaleModeValue()});}catch{};if(home)this.homeView();this.updateModeChip();}
  updateModeChip(){const n=this.root.querySelector('.chart-mode-chip');if(!n)return;n.textContent=this.manualMode?'MANUAL':'AUTO';n.classList.toggle('manual',this.manualMode);}

  currentDataLength(){return this.replayIndex==null?this.displayBars.length:Math.min(this.displayBars.length,this.replayIndex+1);}
  homeView(){
    const len=this.currentDataLength();if(!len)return;
    const cs=this.app.state.chartSettings,bars=window.innerWidth<=780?(cs.homeBarsMobile||90):(cs.homeBarsDesktop||180),offset=Number(cs.rightOffset??16);
    const to=(len-1)+offset,from=Math.max(-offset,to-bars);
    this.suppressRangeEvent=true;
    try{this.chart.timeScale().applyOptions({rightOffset:offset,barSpacing:cs.barSpacing||7});this.chart.timeScale().setVisibleLogicalRange({from,to});}catch{}
    requestAnimationFrame(()=>{this.suppressRangeEvent=false;this.renderOverlays();});
  }
  viewAllData(){this.suppressRangeEvent=true;try{this.chart.timeScale().fitContent();}catch{}requestAnimationFrame(()=>{this.suppressRangeEvent=false;this.renderOverlays();});}
  resetView(){this.setAutoMode(false);this.homeView();toast('Chart home view restored');}
  goLive(){
    if(this.replayIndex!=null){this.replayFollow=true;this.anchorReplayViewport();return;}
    try{this.chart.timeScale().scrollToRealTime();this.chart.timeScale().applyOptions({rightOffset:this.app.state.chartSettings.rightOffset});}catch{}
  }

  setConfig(cfg,{home=true}={}){
    if(cfg.symbol)this.symbol=cfg.symbol;
    if(cfg.period?.mode){this.period=structuredClone(cfg.period);if(this.period.mode==='time')this.timeframe=this.period.value;}
    if(cfg.timeframe&&!cfg.period){this.timeframe=cfg.timeframe;this.period={mode:'time',value:cfg.timeframe};}
    if(cfg.chartType)this.chartType=cfg.chartType;
    this.replayIndex=null;this.loadData({home});
  }

  loadData({home=true}={}){
    const baseTf=this.period.mode==='time'?this.period.value:'1s';
    const count=this.period.mode==='time'?1800:6000;
    this.rawBars=generateBars(this.symbol,baseTf,count);
    this.periodBars=buildPeriodBars(this.rawBars,this.symbol,this.period,this.app.state.periodSettings);
    const cfg=SYMBOLS[this.symbol],last=this.periodBars.at(-1)?.close||cfg.base;
    this.displayBars=this.chartType==='Heikin-Ashi'?heikinAshi(this.periodBars):buildDisplayBars(this.periodBars,this.chartType,{renkoSize:last*.0005,rangeSize:last*.0008});
    this.barIndex=new Map(this.displayBars.map((b,i)=>[Number(b.time),i]));
    this.rebuildSeries();this.setAutoMode(false);this.refreshHeader();this.renderOverlays();
    if(home)requestAnimationFrame(()=>this.homeView());
  }

  rebuildSeries(){
    const L=window.LightweightCharts,s=this.app.state,cfg=SYMBOLS[this.symbol],visibleRange=this.chart?.timeScale().getVisibleLogicalRange?.();
    if(this.series){try{this.chart.removeSeries(this.series);}catch{}this.series=null;}
    this.indicatorSeries.forEach(x=>{try{this.chart.removeSeries(x.series);}catch{}});this.indicatorSeries=[];
    const priceFormat={type:'price',precision:cfg.precision,minMove:cfg.minMove};
    const candle=s.candleStyle||{};
    if(this.chartType==='Line'){
      this.series=this.chart.addSeries(L.LineSeries,{color:candle.upBody||s.upColor,lineWidth:2,priceFormat,lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false},0);
    }else if(this.chartType==='Area'){
      this.series=this.chart.addSeries(L.AreaSeries,{lineColor:candle.upBody||s.upColor,topColor:'rgba(0,199,177,.28)',bottomColor:'rgba(0,199,177,.02)',lineWidth:2,priceFormat,lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false},0);
    }else if(this.chartType==='Bars'&&L.BarSeries){
      this.series=this.chart.addSeries(L.BarSeries,{upColor:candle.upBody||s.upColor,downColor:candle.downBody||s.downColor,thinBars:false,priceFormat,lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false},0);
    }else{
      this.series=this.chart.addSeries(L.CandlestickSeries,{
        upColor:candle.upBody||s.upColor,downColor:candle.downBody||s.downColor,
        borderVisible:candle.borderVisible!==false,borderUpColor:candle.upBorder||candle.upBody||s.upColor,borderDownColor:candle.downBorder||candle.downBody||s.downColor,
        wickVisible:candle.wickVisible!==false,wickUpColor:candle.upWick||s.wickUp,wickDownColor:candle.downWick||s.wickDown,
        priceFormat,lastValueVisible:true,priceLineVisible:s.showLastPriceLine!==false
      },0);
    }
    this.applyMainSeriesData();
    this.renderMarketPriceLines();

    this.oscillatorPanes=[];let nextOscillatorPane=1;
    for(const ind of s.indicators.filter(i=>i.visible!==false)){
      const computed=computeIndicator(ind,this.displayBars);const isOscillator=computed.pane==='oscillator';const paneIndex=isOscillator?nextOscillatorPane++:0;
      if(isOscillator)this.oscillatorPanes.push({id:ind.id,cfg:ind,paneIndex});
      for(const part of computed.series){
        let series;
        if(part.type==='histogram'&&L.HistogramSeries){
          series=this.chart.addSeries(L.HistogramSeries,{color:part.color||ind.color,priceLineVisible:false,lastValueVisible:false,priceScaleId:paneIndex===0?'right':''},paneIndex);
        }else{
          series=this.chart.addSeries(L.LineSeries,{color:part.color||ind.color,lineWidth:ind.lineWidth||1.5,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceScaleId:paneIndex===0?'right':''},paneIndex);
        }
        const data=valuesToData(this.displayBars,part.values,this.replayIndex);series.setData(data);
        this.indicatorSeries.push({cfg:ind,part,series,values:part.values,paneIndex});
      }
    }
    if(this.oscillatorPanes.length)requestAnimationFrame(()=>this.applyOscillatorPaneHeights());
    this.chart.applyOptions({
      layout:{background:{type:'solid',color:s.background},textColor:s.textColor},
      grid:{vertLines:{visible:s.gridV,color:s.gridColor},horzLines:{visible:s.gridH,color:s.gridColor}},
      rightPriceScale:{scaleMargins:{top:s.chartSettings.topMargin,bottom:s.chartSettings.bottomMargin},mode:this.priceScaleModeValue()}
    });
    if(visibleRange&&!this.replayIndex){try{this.chart.timeScale().setVisibleLogicalRange(visibleRange);}catch{}}
  }

  mainSeriesData(maxIndex=this.replayIndex){
    const end=maxIndex==null?this.displayBars.length:Math.min(this.displayBars.length,maxIndex+1),bars=this.displayBars.slice(0,end);
    if(this.chartType==='Line'||this.chartType==='Area')return bars.map(b=>({time:b.time,value:b.close}));
    return bars;
  }
  applyMainSeriesData(){try{this.series?.setData(this.mainSeriesData());}catch(e){console.error('Trade Avata main series data error',e);}}

  setReplayIndex(index,{anchor=true}={}){
    this.replayIndex=clamp(Math.round(index),20,Math.max(20,this.displayBars.length-1));
    this.applyMainSeriesData();
    for(const x of this.indicatorSeries)x.series.setData(valuesToData(this.displayBars,x.values,this.replayIndex));
    this.refreshHeader();this.renderOverlays();if(anchor)this.anchorReplayViewport();
  }
  clearReplay(){this.replayIndex=null;this.applyMainSeriesData();for(const x of this.indicatorSeries)x.series.setData(valuesToData(this.displayBars,x.values,null));this.refreshHeader();this.homeView();}
  anchorReplayViewport(){
    if(this.replayIndex==null)return;const cs=this.app.state.chartSettings,visible=window.innerWidth<=780?(cs.homeBarsMobile||90):(cs.homeBarsDesktop||180);
    const future=Math.round(visible*.34),to=this.replayIndex+future,from=to-visible;
    this.suppressRangeEvent=true;try{this.chart.timeScale().setVisibleLogicalRange({from,to});}catch{}requestAnimationFrame(()=>{this.suppressRangeEvent=false;});
  }

  renderMarketPriceLines(){
    if(!this.series?.createPriceLine)return;const s=this.app.state,last=this.displayBars[this.currentDataLength()-1]?.close;if(!Number.isFinite(last))return;
    const cfg=SYMBOLS[this.symbol]||SYMBOLS.XAUUSD,spread=Math.max(cfg.minMove*2,last*.00002);
    try{
      if(s.showBidLine)this.series.createPriceLine({price:last-spread/2,color:'#f59e0b',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Bid'});
      if(s.showAskLine)this.series.createPriceLine({price:last+spread/2,color:'#22c55e',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Ask'});
    }catch{}
  }
  updateCountdown(){
    const box=this.root.querySelector('.bar-countdown');if(!box)return;const s=this.app.state;
    if(!s.showCountdown||this.period.mode!=='time'){box.style.display='none';return;}
    const sec=Math.max(1,timeframeSeconds(this.period.value)),now=Math.floor(Date.now()/1000),left=sec-(now%sec);const h=Math.floor(left/3600),m=Math.floor((left%3600)/60),ss=left%60;
    box.textContent=h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;box.style.display='block';
  }

  refreshAppearance({preserveView=true}={}){
    const range=preserveView?this.chart?.timeScale().getVisibleLogicalRange?.():null;this.rebuildSeries();
    if(range){try{this.chart.timeScale().setVisibleLogicalRange(range);}catch{}}else this.homeView();
    this.refreshHeader();this.renderOverlays();this.updateCursorMode();
  }

  refreshHeader(){
    const s=this.app.state,index=this.replayIndex==null?this.displayBars.length-1:this.replayIndex,last=this.displayBars[index];
    const overlay=this.root.querySelector('.pane-symbol-overlay strong');overlay.textContent=`${this.symbol} · ${periodLabel(this.period)}${this.chartType==='Candles'?'':` · ${this.chartType}`}`;
    this.root.querySelector('.pane-ohlc').textContent=last&&s.showOHLC?`O ${formatPrice(this.symbol,last.open)}  H ${formatPrice(this.symbol,last.high)}  L ${formatPrice(this.symbol,last.low)}  C ${formatPrice(this.symbol,last.close)}`:'';
    this.root.querySelector('.pane-overlay-head').style.display=s.showSymbolOverlay||s.showOHLC||s.showIndicatorOverlay?'flex':'none';
    this.root.querySelector('.pane-latency').style.display=s.showLatency?'flex':'none';
    const legend=this.root.querySelector('.indicator-legend');legend.innerHTML='';
    if(s.showIndicatorOverlay){
      for(const ind of s.indicators){
        const hidden=ind.visible===false,seriesMeta=this.indicatorSeries.find(x=>x.cfg.id===ind.id),val=seriesMeta?.values?.[index];
        const item=el('div',{class:`legend-item ${hidden?'hidden':''}`,'data-indicator':ind.id,title:hidden?`Show ${ind.name}`:`${ind.name} · eye hides indicator · double-click name for settings`});
        const eye=el('button',{class:'legend-eye','aria-label':hidden?`Show ${ind.name}`:`Hide ${ind.name}`,title:hidden?`Show ${ind.name}`:`Hide ${ind.name}`});
        eye.innerHTML=hidden?' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9.5 5.2 9.5 5.2a15.7 15.7 0 01-3.1 3.7M6.2 6.2C3.9 7.7 2.5 9.2 2.5 9.2S6.5 14.4 12 14.4c1.1 0 2.1-.2 3-.5"/></svg>':' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></svg>';
        eye.addEventListener('click',e=>{e.stopPropagation();this.app.toggleIndicatorVisibility?.(ind.id);});
        const label=el('button',{class:'legend-label',title:`Double-click to edit ${ind.name}`},el('i',{style:`background:${ind.color}`}),el('strong',{style:`color:${hidden?'#8194a5':ind.color}`},`${ind.name}${!hidden&&val!=null?` ${Number(val).toFixed(2)}`:''}`));
        label.addEventListener('click',e=>e.stopPropagation());label.addEventListener('dblclick',e=>{e.stopPropagation();this.app.openIndicatorSettings(ind.id);});
        item.append(eye,label);legend.append(item);
      }
    }
  }

  updateCrosshairReadout(param){
    if(!param?.time||!param.seriesData)return;const d=param.seriesData.get(this.series);if(!d)return;
    const ohlc=this.root.querySelector('.pane-ohlc');if('open'in d)ohlc.textContent=`O ${formatPrice(this.symbol,d.open)}  H ${formatPrice(this.symbol,d.high)}  L ${formatPrice(this.symbol,d.low)}  C ${formatPrice(this.symbol,d.close)}`;else if('value'in d)ohlc.textContent=`C ${formatPrice(this.symbol,d.value)}`;
  }

  updateDataWindow(param){
    const box=this.root.querySelector('.data-window-card');if(!this.app.state.showDataWindow||!param?.time||!param.seriesData){box.classList.remove('show');return;}
    const d=param.seriesData.get(this.series);if(!d){box.classList.remove('show');return;}const logical=this.chart.timeScale().coordinateToLogical(param.point?.x??0),idx=clamp(Math.round(logical??0),0,this.displayBars.length-1),bar=this.displayBars[idx];if(!bar)return;
    const rows=[`<b>${this.symbol} · ${periodLabel(this.period)}</b>`,`Time ${new Date(Number(bar.time)*1000).toLocaleString()}`,`O ${formatPrice(this.symbol,bar.open)} · H ${formatPrice(this.symbol,bar.high)}`,`L ${formatPrice(this.symbol,bar.low)} · C ${formatPrice(this.symbol,bar.close)}`,`Vol ${Math.round(bar.volume||0).toLocaleString()}`];
    const seen=new Set();for(const x of this.indicatorSeries){if(seen.has(x.cfg.id))continue;seen.add(x.cfg.id);const v=x.values[idx];if(v!=null)rows.push(`${x.cfg.name}: ${Number(v).toFixed(3)}`);}box.innerHTML=rows.map((x,i)=>i?`<span>${x}</span>`:x).join('');box.classList.add('show');
  }

  updateCursorMode(){
    if(!this.chart)return;const L=window.LightweightCharts,cross=this.app.state.activeTool==='crosshair';
    try{this.chart.applyOptions({crosshair:{mode:cross?(L.CrosshairMode?.MagnetOHLC??1):(L.CrosshairMode?.Normal??0),vertLine:{visible:cross,color:this.app.state.crosshairColor},horzLine:{visible:cross,color:this.app.state.crosshairColor}}});}catch{}
    if(this.drawingLayer)this.drawingLayer.syncPointerMode();
  }

  resize(){
    if(!this.chart)return;const r=this.root.getBoundingClientRect();if(r.width<10||r.height<10)return;
    this.drawingLayer?.resize();this.resizeRoundGrid();this.renderOverlays();
  }
  resizeRoundGrid(){const c=this.roundGridCanvas,r=c.getBoundingClientRect(),dpr=Math.max(1,devicePixelRatio||1);c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);}
  renderRoundGrid(){
    const c=this.roundGridCanvas,ctx=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight;ctx.clearRect(0,0,w,h);if(!this.app.state.majorRoundGrid||!this.series)return;
    const range=this.visiblePriceRange();if(!range)return;const step=niceStep(range.max-range.min,7),start=Math.ceil(range.min/step)*step;ctx.strokeStyle='rgba(126,157,185,.13)';ctx.lineWidth=1;
    for(let p=start;p<=range.max+step*.001;p+=step){const y=this.yForPrice(p);if(y==null||y<0||y>h)continue;ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(w-55,Math.round(y)+.5);ctx.stroke();}
  }
  visiblePriceRange(){
    const vr=this.chart.timeScale().getVisibleLogicalRange?.();let start=0,end=this.currentDataLength();if(vr&&this.displayBars.length){start=clamp(Math.floor(vr.from),0,this.displayBars.length-1);end=clamp(Math.ceil(vr.to)+1,start+1,this.currentDataLength());}const arr=this.displayBars.slice(start,end);if(!arr.length)return null;const lows=arr.map(b=>b.low??b.value),highs=arr.map(b=>b.high??b.value);return{min:Math.min(...lows),max:Math.max(...highs)};
  }
  renderSignals(){
    const sell=this.root.querySelector('.signal-sell'),buy=this.root.querySelector('.signal-buy'),n=this.currentDataLength();if(n<100){sell.style.display='none';buy.style.display='none';return;}const a=this.displayBars[n-95],b=this.displayBars[n-70];positionBadge(sell,this.xForTime(a.time),this.yForPrice(a.high),-36);positionBadge(buy,this.xForTime(b.time),this.yForPrice(b.low),14);
  }
  renderOverlays(){this.drawingLayer?.render();this.renderRoundGrid();}

  // ===== Logical/future-space helpers =====
  logicalAtCoordinate(x){return this.chart?.timeScale().coordinateToLogical(x)??0;}
  logicalToCoordinate(logical){return this.chart?.timeScale().logicalToCoordinate?.(logical)??null;}
  timeAtCoordinate(x){return this.projectedTimeForLogical(this.logicalAtCoordinate(x));}
  projectedTimeForLogical(logical){
    if(!this.displayBars.length)return null;const i=Math.round(logical);if(i>=0&&i<this.displayBars.length)return Number(this.displayBars[i].time);
    const last=this.displayBars.at(-1),first=this.displayBars[0],step=this.projectedBarSeconds();
    if(i>=this.displayBars.length)return Number(last.time)+(i-(this.displayBars.length-1))*step;
    return Number(first.time)+i*step;
  }
  projectedBarSeconds(){if(this.period.mode==='time')return Math.max(1,timeframeSeconds(this.period.value));if(this.period.mode==='renko-time')return Math.max(1,timeframeSeconds(this.period.value));return 1;}
  priceAtCoordinate(y){return this.series?.coordinateToPrice(y)??null;}
  xForTime(time){return this.chart?.timeScale().timeToCoordinate(time)??null;}
  xForPoint(point){if(Number.isFinite(point?.logical)){const x=this.logicalToCoordinate(point.logical);if(x!=null)return x;}return point?.time!=null?this.xForTime(point.time):null;}
  yForPrice(price){return this.series?.priceToCoordinate(price)??null;}
  pointAtCoordinate(x,y){const logical=this.logicalAtCoordinate(x),price=this.priceAtCoordinate(y);if(logical==null||price==null)return null;return{x,y,logical,time:this.projectedTimeForLogical(logical),price};}
  nearestBar(time){if(!this.displayBars.length)return null;let idx=this.barIndex.get(Number(time));if(idx==null){idx=this.displayBars.findIndex(b=>Number(b.time)>=Number(time));if(idx<0)idx=this.displayBars.length-1;}return this.displayBars[idx];}
  nearestBarByLogical(logical){if(!this.displayBars.length)return null;return this.displayBars[clamp(Math.round(logical),0,this.displayBars.length-1)];}
  shiftPoint(point,deltaLogical){const logical=Number.isFinite(point.logical)?point.logical:this.logicalForTime(point.time);const next=logical+deltaLogical;return{...point,logical:next,time:this.projectedTimeForLogical(next)};}
  logicalForTime(time){const idx=this.barIndex.get(Number(time));if(idx!=null)return idx;const i=this.displayBars.findIndex(b=>Number(b.time)>=Number(time));return i>=0?i:this.displayBars.length-1;}
  shiftTime(time,deltaLogical){return this.projectedTimeForLogical(this.logicalForTime(time)+deltaLogical);}

  screenshot({metadata=true,drawings=true}={}){
    try{
      const base=this.chart.takeScreenshot();if(!metadata&&!drawings)return base;
      const out=document.createElement('canvas');out.width=base.width;out.height=base.height;const ctx=out.getContext('2d');ctx.drawImage(base,0,0);
      if(drawings&&this.overlayCanvas){ctx.drawImage(this.overlayCanvas,0,0,this.overlayCanvas.width,this.overlayCanvas.height,0,0,out.width,out.height);}
      if(metadata){
        const ratio=out.width/Math.max(1,this.chartHost.clientWidth),pad=10*ratio;ctx.save();ctx.fillStyle='rgba(5,12,20,.82)';ctx.fillRect(0,0,out.width,34*ratio);ctx.fillStyle='#e7f0f8';ctx.font=`${12*ratio}px Inter,system-ui,sans-serif`;const cfg=`${this.symbol} · ${periodLabel(this.period)} · ${this.chartType}`;ctx.fillText(cfg,pad,21*ratio);const inds=this.app.state.indicators.filter(i=>i.visible!==false).map(i=>i.name).slice(0,4).join(' · ');if(inds){ctx.fillStyle='#9db4cc';ctx.font=`${9*ratio}px Inter,system-ui,sans-serif`;ctx.fillText(inds,Math.min(out.width*.45,pad+ctx.measureText(cfg).width+16*ratio),21*ratio);}ctx.fillStyle='rgba(5,12,20,.78)';ctx.fillRect(0,out.height-26*ratio,out.width,26*ratio);ctx.fillStyle='#9db4cc';ctx.font=`${9*ratio}px Inter,system-ui,sans-serif`;ctx.fillText(`Trade Avata · Trade Simple · ${this.symbol} · ${new Date().toLocaleString()} · ${Intl.DateTimeFormat().resolvedOptions().timeZone||'Local'}`,pad,out.height-9*ratio);ctx.restore();
      }
      return out;
    }catch{return null;}
  }

  destroy(){this.resizeObserver?.disconnect();clearInterval(this.countdownTimer);this.drawingLayer?.destroy?.();try{this.chart?.remove();}catch{}this.chart=null;}
}

function positionBadge(node,x,y,offset){if(x==null||y==null){node.style.display='none';return;}node.style.display='block';node.style.transform=`translate(${Math.round(x-28)}px,${Math.round(y+offset)}px)`;}
