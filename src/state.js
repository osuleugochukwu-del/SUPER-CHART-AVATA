import { DEFAULT_FAVORITES, DEFAULT_PERIOD_FAVORITES } from './data.js';

const KEY='tradeAvataChartV8State';
const LEGACY_KEYS=['tradeAvataChartV7State','tradeAvataChartV6State'];

export const defaultState={
  symbol:'XAUUSD', timeframe:'15s', chartType:'Candles',
  period:{mode:'time',value:'15s'},
  favoriteTimeframes:[...DEFAULT_FAVORITES],
  favoritePeriods:structuredClone(DEFAULT_PERIOD_FAVORITES),
  periodSettings:{tickCount:50,renkoPips:5,renkoTime:'1m',rangePips:5},
  layout:'1', layoutSync:{symbol:false,timeframe:false,crosshair:true,time:true,drawings:false},
  activePane:0,

  // Platform theme and chart appearance are intentionally independent.
  platformTheme:'dark',theme:'dark',
  gridH:false,gridV:false,majorRoundGrid:false,
  background:'#111820',textColor:'#9db4cc',gridColor:'rgba(76,103,130,.18)',
  upColor:'#00c7b1',downColor:'#ff4d57',wickUp:'#00b6a4',wickDown:'#f25c65',
  candleStyle:{
    upBody:'#00c7b1',downBody:'#ff4d57',
    upBorder:'#00b9a5',downBorder:'#f34450',
    upWick:'#00aa99',downWick:'#ef5861',
    borderVisible:true,wickVisible:true,colorByPreviousClose:false
  },
  crosshairColor:'#7f93a8',
  priceScaleMode:'normal',
  showBidLine:false,showAskLine:false,showLastPriceLine:true,showCountdown:true,
  showSessionSeparators:false,showEconomicEvents:true,showLatestNews:false,showDataWindow:false,
  timezone:'UTC+1 Lagos',

  indicatorPalette:['#178eff','#f3a000','#a76dff','#22c55e','#ff6b6b','#eab308','#00c7b1','#ef4444','#38bdf8','#fb7185','#84cc16','#c084fc'],
  indicators:[
    {id:'ema20',kind:'ema',name:'EMA 20',length:20,color:'#178eff',visible:true,lineWidth:1.5,source:'close',pane:'price'},
    {id:'ema50',kind:'ema',name:'EMA 50',length:50,color:'#f3a000',visible:true,lineWidth:1.5,source:'close',pane:'price'}
  ],
  indicatorFavorites:['ema','sma','rsi','macd','stochastic','bollinger','atr'],
  indicatorTemplates:[],
  indicatorProfiles:{},

  showOHLC:true,showSymbolOverlay:true,showIndicatorOverlay:true,showLatency:true,
  quickTrade:true,tradeSizeMode:'risk',riskPercent:1,fixedLots:0.10,fixedCashRisk:100,
  accountSize:10000,leverage:100,

  rightSidebarOpen:false,rightPanel:'watchlist',watchlist:['XAUUSD','NAS100','EURUSD','GBPUSD','BTCUSD','US30'],
  bottomOpen:false,bottomTab:'positions',bottomHeight:280,bottomLastHeight:420,

  drawings:[],selectedDrawingId:null,selectedDrawingIds:[],
  activeTool:'cursor',keepDrawing:false,magnet:false,magnetMode:'off',
  drawingFavorites:['crosshair','trend','horizontal','fibonacci','rectangle','long','short','measure'],
  drawingTemplates:[],drawingClipboard:null,
  undoStack:[],redoStack:[],

  alerts:[],notifications:[],
  alertPreferences:{sound:true,browser:true,email:false,telegram:false,push:false,webhook:false},
  connection:{tradeAvataUser:null,broker:null,status:'demo',account:null,feed:'DEMO'},

  chartSettings:{
    rightOffset:16,barSpacing:7,topMargin:.08,bottomMargin:.08,autoScale:true,shiftPercent:22,
    homeBarsDesktop:180,homeBarsMobile:90,lockVisibleTimeRangeOnResize:false
  },

  brand:{logoDataUrl:null,darkLogoDataUrl:null,lightLogoDataUrl:null},
  advertising:{enabled:true,houseAds:true,dismissedSession:false},
  ownerMode:true,
  aiAccess:{
    chatEntitled:false,
    voiceInput:true,
    readAloud:true,
    autoReadReplies:false
  },
  aiConversations:{indicator:[],market:[]},
  marketIntelligence:{
    activeTab:'overview',
    symbol:'XAUUSD',
    timeframe:'15m',
    autoRefresh:true,
    refreshSeconds:60,
    lastUpdated:null
  },

  replay:{
    active:false,selecting:false,index:0,playing:false,speed:1,mode:'online',follow:true,
    interval:'auto',sessionName:'',lastSession:null,offlinePackages:[]
  },

  onboardingDismissed:true,
  paneConfigs:[{symbol:'XAUUSD',timeframe:'15s',chartType:'Candles',period:{mode:'time',value:'15s'},detached:false}],
  chartTemplates:[],activeChartTemplateId:null,
  workspaces:[],activeWorkspaceId:null,
  detachedPanes:{},
  share:{referralId:null,lastInboundRef:null,events:[]},
  ui:{lockedCursorTime:null,oscillatorVisibilitySnapshot:[]}
};

const CHART_TEMPLATE_FIELDS=[
  'gridH','gridV','majorRoundGrid','background','textColor','gridColor','candleStyle',
  'upColor','downColor','wickUp','wickDown','crosshairColor','priceScaleMode',
  'showBidLine','showAskLine','showLastPriceLine','showCountdown','showSessionSeparators','showEconomicEvents','showLatestNews','timezone',
  'indicatorPalette','indicators','showOHLC','showSymbolOverlay','showIndicatorOverlay','showLatency',
  'quickTrade','tradeSizeMode','riskPercent','fixedLots','fixedCashRisk','chartSettings',
  'drawingFavorites','magnetMode','periodSettings'
];

export function captureChartTemplate(state,{name='Template',chartType='Candles',period=null,includePeriod=false}={}){
  const config={chartType};
  if(includePeriod&&period)config.period=cloneSerializable(period);
  for(const key of CHART_TEMPLATE_FIELDS)config[key]=cloneSerializable(state[key]);
  return {
    id:`tpl-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    name:String(name||'Template').trim()||'Template',
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    includePeriod:!!includePeriod,config
  };
}

export function applyChartTemplateToState(state,template){
  if(!template?.config)return state;
  for(const key of CHART_TEMPLATE_FIELDS){
    if(Object.prototype.hasOwnProperty.call(template.config,key))state[key]=cloneSerializable(template.config[key]);
  }
  state.activeChartTemplateId=template.id||null;
  return state;
}

export function captureWorkspace(state,{name='Workspace'}={}){
  return {
    id:`ws-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    name:String(name||'Workspace').trim()||'Workspace',
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    config:{
      layout:state.layout,
      layoutSync:cloneSerializable(state.layoutSync),
      paneConfigs:cloneSerializable(state.paneConfigs),
      bottomOpen:state.bottomOpen,bottomTab:state.bottomTab,bottomHeight:state.bottomHeight,
      rightSidebarOpen:state.rightSidebarOpen,rightPanel:state.rightPanel,
      drawings:cloneSerializable(state.drawings),
      indicators:cloneSerializable(state.indicators),
      activeChartTemplateId:state.activeChartTemplateId
    }
  };
}

export function applyWorkspaceToState(state,workspace){
  const c=workspace?.config;if(!c)return state;
  for(const key of ['layout','layoutSync','paneConfigs','bottomOpen','bottomTab','bottomHeight','rightSidebarOpen','rightPanel','drawings','indicators','activeChartTemplateId']){
    if(Object.prototype.hasOwnProperty.call(c,key))state[key]=cloneSerializable(c[key]);
  }
  state.activeWorkspaceId=workspace.id||null;
  return state;
}

export function loadState(){
  try{
    let raw=localStorage.getItem(KEY);
    if(!raw){for(const k of LEGACY_KEYS){raw=localStorage.getItem(k);if(raw)break;}}
    const saved=raw?JSON.parse(raw):null;
    const merged=saved?deepMerge(structuredClone(defaultState),saved):structuredClone(defaultState);
    return migrateState(merged,saved||{});
  }catch{return structuredClone(defaultState);}
}

export function saveState(state){
  const safe={...state,undoStack:[],redoStack:[],drawingClipboard:null};
  try{localStorage.setItem(KEY,JSON.stringify(safe));}catch{}
}

function migrateState(state,saved){
  if(!state.platformTheme)state.platformTheme=saved.theme||'dark';
  // Preserve the old top favorites, but move them into the richer period model.
  if(!Array.isArray(saved.favoritePeriods)&&Array.isArray(saved.favoriteTimeframes)){
    const migrated=saved.favoriteTimeframes.map(value=>({mode:'time',value}));
    const extras=[{mode:'renko-pips',value:5},{mode:'renko-time',value:'1m'},{mode:'range-pips',value:5}];
    state.favoritePeriods=[...migrated,...extras.filter(x=>!migrated.some(y=>y.mode===x.mode&&String(y.value)===String(x.value)))];
  }
  if(!state.period?.mode){state.period={mode:'time',value:saved.timeframe||'15s'};}
  state.paneConfigs=(state.paneConfigs||[]).map(c=>({
    ...c,
    timeframe:c.timeframe||c.period?.value||'15s',
    period:c.period?.mode?c.period:{mode:'time',value:c.timeframe||'15s'},
    detached:!!c.detached
  }));
  // Migrate the old single body/wick colors into the three-layer candle model.
  const cs=state.candleStyle||{};
  cs.upBody=cs.upBody||state.upColor||'#00c7b1';
  cs.downBody=cs.downBody||state.downColor||'#ff4d57';
  cs.upBorder=cs.upBorder||cs.upBody;cs.downBorder=cs.downBorder||cs.downBody;
  cs.upWick=cs.upWick||state.wickUp||cs.upBody;cs.downWick=cs.downWick||state.wickDown||cs.downBody;
  if(cs.borderVisible==null)cs.borderVisible=true;if(cs.wickVisible==null)cs.wickVisible=true;
  state.candleStyle=cs;
  state.magnetMode=state.magnetMode||(state.magnet?'strong':'off');
  state.magnet=state.magnetMode!=='off';
  state.selectedDrawingIds=Array.isArray(state.selectedDrawingIds)?state.selectedDrawingIds:[];
  if(state.selectedDrawingId&&!state.selectedDrawingIds.includes(state.selectedDrawingId))state.selectedDrawingIds=[state.selectedDrawingId];
  return state;
}

function deepMerge(a,b){
  for(const [k,v] of Object.entries(b||{})){
    if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))deepMerge(a[k],v);
    else a[k]=v;
  }
  return a;
}

export function cloneSerializable(v){return JSON.parse(JSON.stringify(v));}
