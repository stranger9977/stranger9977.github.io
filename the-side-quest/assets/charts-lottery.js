(function () {
  var FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  var SPORT = { NFL: '#0072B2', MLB: '#D55E00', NHL: '#009E73', NBA: '#CC79A7' };
  var ERA = ['#b8c4e8', '#7f93d6', '#4f68c0', '#2c3f9e'];

  // The charts blend into the page in BOTH themes: backgrounds are transparent
  // and the ink/grid/line/accent colours track the site's light or dark tokens.
  // Every per-chart call below is authored in the LIGHT palette; the render step
  // swaps those exact colours for their dark equivalents when the page is dark,
  // and re-renders live when the OS theme flips.
  var LIGHT = { INK:'#16150f', MUTED:'#6f6c60', GRID:'#e7e4d7', LINE:'#c9c6b8', ACCENT:'#3f3ab5', PAGE:'#fbfaf5', HOVER:'#ffffff', REF:'#7a776a' };
  var DARK  = { INK:'#ecebe3', MUTED:'#a3a094', GRID:'#2f2e2a', LINE:'#3a3933', ACCENT:'#a8a3ff', PAGE:'#131311', HOVER:'#232320', REF:'#c8c5b9' };

  // Light -> dark colour swaps, applied only in dark mode. Keys are the exact
  // literals used in the per-chart specs below. Sport + era palettes are
  // colourblind-safe and read on either background, so they are left untouched.
  var SWAP = {
    '#16150f': DARK.INK,   '#6f6c60': DARK.MUTED, '#e7e4d7': DARK.GRID,
    '#c9c6b8': DARK.LINE,  '#3f3ab5': DARK.ACCENT,
    'white':   DARK.PAGE,  // open/hollow marker fills (plot-07)
    '#d8d5c8': '#3d3c36',  // faint background scatter (plot-26)
    '#b0ada0': '#7c7a70',  // de-emphasised lines (plot-14)
    '#8a8779': '#a3a094',  // de-emphasised end-labels (plot-14)
    '#7a776a': DARK.REF    // reference lines and callout labels
  };

  function isObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(base, over) {
    var out = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
    for (k in over) {
      if (!over.hasOwnProperty(k)) continue;
      if (isObj(out[k]) && isObj(over[k])) out[k] = deepMerge(out[k], over[k]);
      else out[k] = over[k]; // arrays and scalars replace
    }
    return out;
  }

  // Deep-clone a spec, swapping light colours for dark ones when dark === true.
  function themed(v, dark) {
    if (!dark) return v;
    if (Array.isArray(v)) return v.map(function (x) { return themed(x, dark); });
    if (isObj(v)) { var o = {}, k; for (k in v) if (v.hasOwnProperty(k)) o[k] = themed(v[k], dark); return o; }
    if (typeof v === 'string' && SWAP.hasOwnProperty(v)) return SWAP[v];
    return v;
  }

  function axisBase(T) {
    return {
      gridcolor: T.GRID, zeroline: false, linecolor: T.LINE,
      ticks: 'outside', tickcolor: T.LINE, automargin: true,
      titlefont: { size: 11.5, color: T.MUTED }, tickfont: { color: T.MUTED }
    };
  }

  function baseLayout(T) {
    return {
      font: { family: FONT, size: 12.5, color: T.INK },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      height: 380, margin: { l: 52, r: 18, t: 14, b: 40 },
      hovermode: 'closest',
      hoverlabel: { bgcolor: T.HOVER, bordercolor: T.LINE, font: { family: FONT, color: T.INK } },
      colorway: [T.ACCENT, SPORT.NFL, SPORT.MLB, SPORT.NHL, SPORT.NBA],
      legend: { orientation: 'h', y: 1.12, x: 0, font: { size: 11 } },
      xaxis: axisBase(T), yaxis: axisBase(T)
    };
  }

  var CONFIG = { responsive: true, displayModeBar: false };
  var REG = {};

  function isDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function render(divId) {
    var e = REG[divId];
    if (!e || typeof Plotly === 'undefined') return;
    var dark = isDark(), T = dark ? DARK : LIGHT;
    var layout = deepMerge(baseLayout(T), themed(e.layout, dark));
    var traces = themed(e.traces, dark);
    if (e.init) return Plotly.react(divId, traces, layout, CONFIG);
    e.init = true;
    return Plotly.newPlot(divId, traces, layout, CONFIG);
  }

  function plot(divId, traces, layoutOverrides) {
    REG[divId] = { traces: traces, layout: layoutOverrides || {}, init: false };
    return render(divId);
  }

  // Live-swap the palette when the OS theme changes.
  if (window.matchMedia) {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { Object.keys(REG).forEach(function (id) { render(id); }); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* no-op */ }
  }

  window.LOL = { plot: plot, deepMerge: deepMerge, SPORT: SPORT, ACCENT: LIGHT.ACCENT, ERA: ERA, INK: LIGHT.INK, MUTED: LIGHT.MUTED, GRID: LIGHT.GRID, REF: LIGHT.REF };
})();
/* plot-01 */
LOL.plot('plot-01', [{ type:'scatter', mode:'lines+markers+text', x:['Q1','Q2','Q3','Q4'], y:[31.5,29,20,14], line:{color:LOL.ACCENT, width:2.5}, marker:{color:LOL.ACCENT, size:8}, text:[31.5,29,20,14].map(v=>v+'%'), textposition:'top center', textfont:{color:LOL.INK, size:11}, cliponaxis:false, hovertemplate:'%{x}: %{y}%<extra></extra>' }], { showlegend:false, margin:{l:52,r:24,t:20,b:40}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8' }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', range:[0,36], title:{text:'% of players', font:{size:11.5,color:LOL.MUTED}} } });
/* plot-02 */
var panels=[{sport:'NFL',color:LOL.SPORT.NFL,y:[26,23,25,26]},{sport:'MLB',color:LOL.SPORT.MLB,y:[24,23,27,26]},{sport:'NHL',color:LOL.SPORT.NHL,y:[32,28,22,19]},{sport:'NBA',color:LOL.SPORT.NBA,y:[25,23,26,25]}]; var base=[24,25.5,26,25]; var q=['Q1','Q2','Q3','Q4'], traces=[], anns=[], lay={ grid:{rows:1, columns:4, pattern:'independent', xgap:0.08}, showlegend:false, height:380, margin:{l:52,r:18,t:40,b:40} }; panels.forEach((p,i)=>{ var n=i===0?'':(i+1), ax='x'+n, ay='y'+n; traces.push({ type:'scatter', mode:'lines', x:q, y:base, xaxis:ax, yaxis:ay, line:{color:LOL.REF, dash:'dash', width:1.7}, hoverinfo:'skip' }); traces.push({ type:'bar', x:q, y:p.y, xaxis:ax, yaxis:ay, marker:{color:p.color}, text:p.y.map(v=>v+'%'), textposition:'outside', textfont:{color:p.color, size:10.5}, cliponaxis:false, hovertemplate:p.sport+' %{x}: %{y}%<extra></extra>' }); lay['xaxis'+n]={ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', tickfont:{color:LOL.REF} }; lay['yaxis'+n]={ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[0,36], showticklabels:i===0, tickfont:{color:LOL.REF}, title:i===0?{text:'Share of players (%)', font:{size:11.5,color:LOL.MUTED}}:undefined }; anns.push({ text:p.sport, xref:ax+' domain', yref:ay+' domain', x:0.5, y:1.1, xanchor:'center', showarrow:false, font:{size:13, color:LOL.INK} }); }); lay.annotations=anns; LOL.plot('plot-02', traces, lay);
/* plot-03 */
var quarters=['Q1','Q2','Q3','Q4']; var series=[{name:'Soccer 1985-1999',color:LOL.SPORT.NFL,y:[1.06,0.97,1.02,0.94]},{name:'Soccer 2003-2009',color:'#5aa0d8',y:[1.51,1.10,0.73,0.67]},{name:'Swimming',color:'#E69F00',y:[1.11,1.04,0.93,0.92]}]; var traces=series.map(s=>({ type:'bar', name:s.name, x:quarters, y:s.y, marker:{color:s.color}, text:s.y.map(v=>v.toFixed(2)), textposition:'outside', textfont:{size:10}, cliponaxis:false, hovertemplate:s.name+' %{x}: %{y}<extra></extra>' })); LOL.plot('plot-03', traces, { barmode:'group', bargap:0.28, bargroupgap:0.08, margin:{l:52,r:18,t:14,b:40}, shapes:[{type:'line', x0:-0.5,x1:3.5, y0:1,y1:1, line:{color:LOL.REF, width:1.7, dash:'dash'}}], xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8' }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[0,1.9], title:{text:'Representation ratio', font:{size:11.5,color:LOL.MUTED}} } });
/* plot-06 */
LOL.plot('plot-06', [{ type:'scatter', mode:'lines+markers', x:['Kindergarten','Grade 4','Grade 8','College entry'], y:[10,8,4.5,1.3], line:{color:LOL.ACCENT, width:2.5}, marker:{color:LOL.ACCENT, size:10}, hovertemplate:'%{x}: +%{y} pts<extra></extra>' }], { showlegend:false, margin:{l:52,r:24,t:14,b:40}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8' }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[0,12], title:{text:'Oldest kids\' advantage', font:{size:11.5,color:LOL.MUTED}} } });
/* plot-07 */
(function(){var age=[24,25,26,27,28,29,30,31,32,33,34,35];var y=[-9.3,-10.0,-9.6,-6.4,-4.4,-2.4,-1.3,-0.8,-0.3,0.6,0.4,0.6];var upper=[-6.3,-7.0,-6.7,-3.7,-2.2,-0.5,0.4,0.8,1.3,2.4,2.1,2.2];var lower=[-12.2,-13.0,-12.5,-9.0,-6.6,-4.3,-3.0,-2.4,-1.9,-1.2,-1.3,-1.0];var solid=[true,true,true,true,true,true,false,false,false,true,false,false];var traces=[{type:'scatter',mode:'lines',x:age,y:lower,line:{width:0},showlegend:false,hoverinfo:'skip'},{type:'scatter',mode:'lines',x:age,y:upper,fill:'tonexty',fillcolor:'rgba(0,114,178,0.15)',line:{width:0},showlegend:false,hoverinfo:'skip'},{type:'scatter',mode:'lines+markers',x:age,y:y,line:{color:LOL.SPORT.NFL,width:2.5},marker:{color:age.map(function(a,i){return solid[i]?LOL.SPORT.NFL:'white'}),size:8,line:{color:LOL.SPORT.NFL,width:2}},showlegend:false,hovertemplate:'Age %{x}: %{y:.1f}%<extra></extra>'}];LOL.plot('plot-07',traces,{margin:{l:56,r:132,t:14,b:40},shapes:[{type:'line',x0:24,x1:35,y0:0,y1:0,line:{color:LOL.REF,width:1.7,dash:'dash'}}],annotations:[{x:35,y:0,xanchor:'left',xshift:8,text:'no earnings difference',showarrow:false,font:{color:LOL.REF,size:10.5}}],xaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',dtick:1,range:[23.5,35.5],title:{text:'Age when earnings are measured',font:{size:11.5,color:LOL.MUTED}}},yaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',ticksuffix:'%',title:{text:'% earnings effect',font:{size:11.5,color:LOL.MUTED}}}});})();
/* plot-09 */
(function(){var rows=[['South',60],['Midwest',39],['West',34],['Northeast',23]];rows.reverse();LOL.plot('plot-09',[{type:'bar',orientation:'h',y:rows.map(function(r){return r[0]}),x:rows.map(function(r){return r[1]}),marker:{color:LOL.SPORT.NFL},text:rows.map(function(r){return r[1]}),textposition:'outside',textfont:{color:LOL.INK,size:12.5},cliponaxis:false,hovertemplate:'%{y}: %{x}<extra></extra>'}],{margin:{l:96,r:60,t:30,b:44},xaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',automargin:true,title:{text:'NFL players per million residents',font:{size:11.5,color:LOL.MUTED}}},yaxis:{automargin:true,ticks:'',showgrid:false,linecolor:'#c9c6b8'},shapes:[{type:'line',x0:43,x1:43,xref:'x',y0:0,y1:1,yref:'paper',line:{color:LOL.REF,width:1.7,dash:'dash'}}],annotations:[{x:43,yref:'paper',y:1,yanchor:'bottom',yshift:4,text:'US average 43',showarrow:false,font:{color:LOL.REF,size:11}}]});})();
/* plot-10 */
(function(){var rows=[['Louisiana',134.8],['Mississippi',114.5],['Alabama',88.8],['Georgia',86.4],['Florida',66.9],['South Carolina',62.4],['Hawaii',60.2],['Ohio',56.5],['Texas',51.7],['Iowa',48.7],['Nebraska',47.4],['Maryland',46.9],['New York',17.0],['Massachusetts',13.6],['New Mexico',12.7],['Alaska',10.8],['Rhode Island',5.4],['New Hampshire',4.3],['Maine',3.6],['Vermont',3.1]];rows.reverse();LOL.plot('plot-10',[{type:'bar',orientation:'h',y:rows.map(function(r){return r[0]}),x:rows.map(function(r){return r[1]}),marker:{color:LOL.SPORT.NFL},text:rows.map(function(r){return r[1]}),textposition:'outside',textfont:{color:LOL.INK,size:11.5},cliponaxis:false,hovertemplate:'%{y}: %{x}<extra></extra>'}],{height:560,margin:{l:110,r:60,t:30,b:44},xaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',automargin:true,title:{text:'NFL players per million residents',font:{size:11.5,color:LOL.MUTED}}},yaxis:{automargin:true,ticks:'',showgrid:false,linecolor:'#c9c6b8',tickfont:{size:10.5}},shapes:[{type:'line',x0:43.1,x1:43.1,xref:'x',y0:0,y1:1,yref:'paper',line:{color:LOL.REF,width:1.7,dash:'dash'}}],annotations:[{x:43.1,yref:'paper',y:1,yanchor:'bottom',yshift:4,text:'US average 43.1',showarrow:false,font:{color:LOL.REF,size:11}}]});})();
/* plot-11 */
(function(){var panels=[{sport:'MLB',color:LOL.SPORT.MLB,rows:[['Pennsylvania',112],['Missouri',101],['Massachusetts',95],['Ohio',90],['Illinois',87],['Kansas',76],['Mississippi',75],['Rhode Island',72]]},{sport:'NBA',color:LOL.SPORT.NBA,rows:[['Mississippi',34],['Louisiana',29],['Kentucky',28],['Indiana',27],['Illinois',25],['New York',23],['Arkansas',20],['Alabama',20]]},{sport:'NHL',color:LOL.SPORT.NHL,rows:[['Minnesota',55],['Massachusetts',33],['North Dakota',26],['Michigan',22],['Rhode Island',21],['Alaska',20],['New Hampshire',13],['Connecticut',10]]}];var traces=[],anns=[],lay={grid:{rows:1,columns:3,pattern:'independent',xgap:0.32},showlegend:false,height:450,margin:{l:52,r:14,t:36,b:40}};panels.forEach(function(p,i){var n=i===0?'':(i+1);var ax='x'+n,ay='y'+n;var rows=p.rows.slice().reverse();traces.push({type:'bar',orientation:'h',xaxis:ax,yaxis:ay,y:rows.map(function(r){return r[0]}),x:rows.map(function(r){return r[1]}),marker:{color:p.color},text:rows.map(function(r){return r[1]}),textposition:'inside',insidetextanchor:'end',constraintext:'none',textfont:{color:'#ffffff',size:10.5},cliponaxis:false,hovertemplate:'%{y}: %{x}<extra></extra>'});lay['xaxis'+n]={gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',automargin:true,rangemode:'tozero'};lay['yaxis'+n]={automargin:true,ticks:'',showgrid:false,linecolor:'#c9c6b8',tickfont:{size:10}};anns.push({text:p.sport,xref:ax+' domain',yref:ay+' domain',x:0.5,y:1.08,xanchor:'center',showarrow:false,font:{size:13,color:LOL.INK}});});lay.annotations=anns;LOL.plot('plot-11',traces,lay);})();
/* plot-12 */
LOL.plot('plot-12', [
  {type:'scatter', mode:'lines+markers+text', x:['1990s','2000s','2010s','2020s'], y:[52,51,55,57], xaxis:'x', yaxis:'y', line:{color:LOL.SPORT.NFL, width:2.5}, marker:{color:LOL.SPORT.NFL, size:7}, text:['52%','51%','55%','57%'], textposition:'top center', textfont:{color:LOL.INK, size:11}, hovertemplate:'%{x}: %{y}%<extra></extra>'},
  {type:'scatter', mode:'lines+markers+text', x:['1990s','2000s','2010s','2020s'], y:[58,59,63,68], xaxis:'x2', yaxis:'y2', line:{color:LOL.SPORT.NFL, width:2.5}, marker:{color:LOL.SPORT.NFL, size:7}, text:['$58k','$59k','$63k','$68k'], textposition:'top center', textfont:{color:LOL.INK, size:11}, hovertemplate:'%{x}: $%{y}k<extra></extra>'}
], {
  showlegend:false, height:380,
  grid:{rows:1, columns:2, pattern:'independent', xgap:0.12},
  xaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8'},
  xaxis2:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8'},
  yaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', title:{text:'% of NFL from the South', font:{size:11.5,color:LOL.MUTED}}},
  yaxis2:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'k', title:{text:'Median hometown income $k', font:{size:11.5,color:LOL.MUTED}}},
  annotations:[
    {text:'Share of players', xref:'x domain', yref:'y domain', x:0.5, y:1.12, xanchor:'center', showarrow:false, font:{size:12.5,color:LOL.INK}},
    {text:'Hometown income', xref:'x2 domain', yref:'y2 domain', x:0.5, y:1.12, xanchor:'center', showarrow:false, font:{size:12.5,color:LOL.INK}}
  ]
});
/* plot-13 */
var eras=['1990s','2000s','2010s','2020s'], quarters=['Q1 (poorest)','Q2','Q3','Q4 (richest)']; var valsByEra=[[43,28.5,19,10],[39,28.5,19.5,12.5],[36,25.5,19.7,19],[32.5,22.5,19.8,25]]; var traces=eras.map((e,i)=>({type:'bar',name:e,x:quarters,y:valsByEra[i],marker:{color:LOL.ERA[i]},text:valsByEra[i].map(v=>v+'%'),textposition:'outside',textfont:{size:10.5},cliponaxis:false})); LOL.plot('plot-13', traces, {barmode:'group',bargap:0.28,bargroupgap:0.08,margin:{l:52,r:18,t:14,b:40},yaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',ticksuffix:'%',range:[0,48],title:{text:'Share of players',font:{size:11.5,color:LOL.MUTED}}},shapes:[{type:'line',x0:0,x1:1,xref:'paper',y0:25,y1:25,line:{color:LOL.REF,width:1.7,dash:'dash'}}]});
/* plot-14 */
var eras=['1990s','2000s','2010s','2020s'];
var series=[
  {name:'K/P', color:LOL.SPORT.NFL, width:2.5, y:[21,22,27,43]},
  {name:'QB', color:'#b0ada0', width:1.5, y:[15,14,29,38]},
  {name:'OL', color:'#b0ada0', width:1.5, y:[10,11,19,31]},
  {name:'RB/WR/TE', color:'#b0ada0', width:1.5, y:[9,10,17,25]},
  {name:'DB', color:'#b0ada0', width:1.5, y:[10,13,16,22]},
  {name:'DL/LB', color:'#b0ada0', width:1.5, y:[5,10,15,20]}
];
var traces=series.map(function(s){return {type:'scatter', mode:'lines+markers', name:s.name, x:eras, y:s.y, line:{color:s.color,width:s.width}, marker:{color:s.color,size:6}, hovertemplate:s.name+' %{x}: %{y}%<extra></extra>'};});
LOL.plot('plot-14', traces, {
  showlegend:false,
  margin:{l:56,r:78,t:14,b:40},
  xaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8'},
  yaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', title:{text:'Share from richest-quartile hometowns', font:{size:11.5,color:LOL.MUTED}}},
  shapes:[{type:'line', x0:eras[0], x1:eras[3], y0:25, y1:25, line:{color:LOL.REF,width:1.7,dash:'dash'}}],
  annotations:series.map(function(s){return {x:eras[3], y:s.y[3], xanchor:'left', xshift:8, text:s.name+' '+s.y[3]+'%', showarrow:false, font:{color:s.name==='K/P'?LOL.SPORT.NFL:'#8a8779', size:11}};})
});
/* plot-15 */
var deciles=[1,2,3,4,5,6,7,8,9,10];
var eras=[
  {name:'1990s', color:LOL.ERA[0], y:[11.0,11.5,9.7,8.5,9.0,8.9,9.5,10.6,9.3,13.6]},
  {name:'2000s', color:LOL.ERA[1], y:[9.3,9.9,9.8,9.9,10.6,9.0,10.5,10.3,11.6,11.6]},
  {name:'2010s', color:LOL.ERA[2], y:[9.3,9.2,9.9,10.1,10.4,10.2,10.2,9.9,10.9,9.8]},
  {name:'2020s', color:LOL.ERA[3], y:[10.7,10.1,11.5,11.4,10.7,12.2,9.7,9.5,8.2,7.5]}
];
var traces=eras.map(function(e){return {type:'scatter', mode:'lines+markers', name:e.name, x:deciles, y:e.y, line:{color:e.color,width:2}, marker:{color:e.color,size:6}, hovertemplate:e.name+' decile %{x}: %{y}%<extra></extra>'};});
LOL.plot('plot-15', traces, {
  margin:{l:52,r:70,t:20,b:44},
  xaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', dtick:1, title:{text:'Birthplace density decile (1=rural, 10=urban)', font:{size:11.5,color:LOL.MUTED}}},
  yaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', title:{text:'Share of players', font:{size:11.5,color:LOL.MUTED}}},
  shapes:[{type:'line', x0:1, x1:10, y0:10, y1:10, line:{color:LOL.REF,width:1.7,dash:'dash'}}],
  annotations:eras.map(function(e){return {x:10, y:e.y[9], xanchor:'left', xshift:8, text:e.name, showarrow:false, font:{color:e.color, size:11}};})
});
/* plot-16 */
var eras=['1990s','2000s','2010s','2020s'], quarters=['Q1 (poorest)','Q2','Q3','Q4 (richest)']; var valsByEra=[[44,29.5,19.5,6.5],[37,32,22.5,8],[38.5,24,21.5,16],[33.5,26,25,15]]; var traces=eras.map((e,i)=>({type:'bar',name:e,x:quarters,y:valsByEra[i],marker:{color:LOL.ERA[i]},text:valsByEra[i].map(v=>v+'%'),textposition:'outside',textfont:{size:10.5},cliponaxis:false})); LOL.plot('plot-16', traces, {barmode:'group',bargap:0.28,bargroupgap:0.08,margin:{l:52,r:18,t:14,b:40},yaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',ticksuffix:'%',range:[0,48],title:{text:'Share of players',font:{size:11.5,color:LOL.MUTED}}},shapes:[{type:'line',x0:0,x1:1,xref:'paper',y0:25,y1:25,line:{color:LOL.REF,width:1.7,dash:'dash'}}]});
/* plot-17 */
var eras=['1990s','2000s','2010s','2020s'], quarters=['Q1 (poorest)','Q2','Q3','Q4 (richest)']; var valsByEra=[[34,30,22,14],[30.5,30,23.5,16],[28,25,21,25.5],[24,22.5,23.5,29.5]]; var traces=eras.map((e,i)=>({type:'bar',name:e,x:quarters,y:valsByEra[i],marker:{color:LOL.ERA[i]},text:valsByEra[i].map(v=>v+'%'),textposition:'outside',textfont:{size:10.5},cliponaxis:false})); LOL.plot('plot-17', traces, {barmode:'group',bargap:0.28,bargroupgap:0.08,margin:{l:52,r:18,t:14,b:40},yaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',ticksuffix:'%',range:[0,38],title:{text:'Share of players',font:{size:11.5,color:LOL.MUTED}}},shapes:[{type:'line',x0:0,x1:1,xref:'paper',y0:25,y1:25,line:{color:LOL.REF,width:1.7,dash:'dash'}}]});
/* plot-18 */
var eras=['1990s','2000s','2010s','2020s'], quarters=['Q1 (poorest)','Q2','Q3','Q4 (richest)']; var valsByEra=[[30.5,16,25.5,27.5],[25.5,14.5,22.5,37],[17,21,26,35.5],[11,18,23,47]]; var traces=eras.map((e,i)=>({type:'bar',name:e,x:quarters,y:valsByEra[i],marker:{color:LOL.ERA[i]},text:valsByEra[i].map(v=>v+'%'),textposition:'outside',textfont:{size:10.5},cliponaxis:false})); LOL.plot('plot-18', traces, {barmode:'group',bargap:0.28,bargroupgap:0.08,margin:{l:52,r:18,t:14,b:40},yaxis:{gridcolor:LOL.GRID,zeroline:false,linecolor:'#c9c6b8',ticks:'outside',tickcolor:'#c9c6b8',ticksuffix:'%',range:[0,52],title:{text:'Share of players',font:{size:11.5,color:LOL.MUTED}}},shapes:[{type:'line',x0:0,x1:1,xref:'paper',y0:25,y1:25,line:{color:LOL.REF,width:1.7,dash:'dash'}}]});
/* plot-19 */
var eras=['1990s','2000s','2010s','2020s'];
var series=[
  {name:'NHL', color:LOL.SPORT.NHL, y:[27,37,36,48]},
  {name:'MLB', color:LOL.SPORT.MLB, y:[15,16,26,30]},
  {name:'NFL', color:LOL.SPORT.NFL, y:[10,13,19,25]},
  {name:'NBA', color:LOL.SPORT.NBA, y:[6,8,15,15]}
];
var traces=series.map(function(s){return {type:'scatter', mode:'lines+markers', name:s.name, x:eras, y:s.y, line:{color:s.color,width:2.5}, marker:{color:s.color,size:7}, hovertemplate:s.name+' %{x}: %{y}%<extra></extra>'};});
LOL.plot('plot-19', traces, {
  showlegend:false,
  margin:{l:52,r:64,t:14,b:40},
  xaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8'},
  yaxis:{gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', title:{text:'Share from richest quarter', font:{size:11.5,color:LOL.MUTED}}},
  shapes:[{type:'line', x0:eras[0], x1:eras[3], y0:25, y1:25, line:{color:LOL.REF,width:1.7,dash:'dash'}}],
  annotations:series.map(function(s){return {x:eras[3], y:s.y[3], xanchor:'left', xshift:8, text:s.name+' '+s.y[3]+'%', showarrow:false, font:{color:s.color, size:11.5}};}).concat([{x:eras[0], y:25, xanchor:'right', xshift:-8, text:'proportional share, 25%', showarrow:false, font:{color:LOL.REF, size:10.5}}])
});
/* plot-21 */
LOL.plot('plot-21', [{ type:'scatter', mode:'lines+markers+text', x:['Under $20k','$20-40k','$40-60k','$60-80k','$80-100k','$100-120k','$120-140k','$140-160k','$160-200k','Over $200k'], y:[1326,1402,1461,1497,1535,1569,1581,1604,1625,1714], line:{color:LOL.ACCENT, width:2.5}, marker:{color:LOL.ACCENT, size:7}, text:[1326,1402,1461,1497,1535,1569,1581,1604,1625,1714], textposition:'top center', textfont:{color:LOL.INK, size:10.5}, cliponaxis:false, hovertemplate:'%{x}: %{y}<extra></extra>' }], { margin:{l:56,r:20,t:26,b:56}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', tickfont:{size:10, color:LOL.MUTED}, title:{text:'Family income', font:{size:11.5, color:LOL.MUTED}} }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[1280,1760], title:{text:'Average SAT', font:{size:11.5, color:LOL.MUTED}} } });
/* plot-22 */
LOL.plot('plot-22', [{ type:'scatter', mode:'lines+markers', x:[1955,1972,1976,2001], y:[0.9,0.9,0.9,1.25], line:{color:LOL.ACCENT, width:2.5}, marker:{color:LOL.ACCENT, size:7}, hovertemplate:'%{x}: %{y} SD<extra></extra>' }], { margin:{l:56,r:20,t:26,b:40}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[1950,2005] }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', range:[0.6,1.4], title:{text:'Gap (SD)', font:{size:11.5, color:LOL.MUTED}} }, annotations:[ {x:1962, y:0.9, yanchor:'bottom', yshift:8, text:'about 0.9 SD', showarrow:false, font:{color:LOL.INK, size:11}}, {x:2001, y:1.25, yanchor:'bottom', yshift:8, text:'about 1.25 SD', showarrow:false, font:{color:LOL.INK, size:11}} ] });
/* plot-23 */
LOL.plot('plot-23', [{ type:'scatter', mode:'lines+markers+text', x:[1940,1950,1960,1970,1980,1984], y:[92,78,62,61,50,50], line:{color:LOL.SPORT.NFL, width:2.5}, marker:{color:LOL.SPORT.NFL, size:7}, text:['92%','78%','62%','61%','50%','50%'], textposition:'top center', textfont:{color:LOL.INK, size:10.5}, cliponaxis:false, hovertemplate:'%{x}: %{y}%<extra></extra>' }], { margin:{l:56,r:20,t:26,b:40}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', title:{text:'Child birth cohort', font:{size:11.5, color:LOL.MUTED}} }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', range:[40,100], title:{text:'Share who out-earn parents', font:{size:11.5, color:LOL.MUTED}} } });
/* plot-24 */
LOL.plot('plot-24', [{ type:'bar', x:['Poorest 20%','Lower-middle','Middle','Upper-middle','Richest 20%'], y:[7.5,12.3,18.3,25.4,36.5], marker:{color:LOL.ACCENT}, text:['7.5%','12.3%','18.3%','25.4%','36.5%'], textposition:'outside', textfont:{color:LOL.INK, size:12}, cliponaxis:false, hovertemplate:'%{x}: %{y}%<extra></extra>' }], { margin:{l:56,r:20,t:26,b:44}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', title:{text:"Parents' income fifth", font:{size:11.5, color:LOL.MUTED}} }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', range:[0,40], title:{text:'Chance of reaching the top fifth', font:{size:11.5, color:LOL.MUTED}} }, shapes:[{type:'line', x0:0,x1:1, xref:'paper', y0:20,y1:20, line:{color:LOL.REF, width:1.7, dash:'dash'}}], annotations:[{x:0.02, xref:'paper', y:20, yanchor:'bottom', text:'If family did not matter: 20%', showarrow:false, font:{color:LOL.REF, size:10.5}}] });
/* plot-26 */
LOL.plot('plot-26', (function(){ var filler=[[10800,17.5],[11400,16.2],[11700,16],[12900,14.8],[13100,18.5],[13400,23],[13800,19.4],[14200,20.7],[14700,16.8],[15200,15.3],[15400,17.1],[15700,17],[15900,15.7],[16100,22.3],[16400,26.5],[16700,21.7],[17300,15.6],[17600,19.4],[17900,17.9],[18200,13.9],[18700,12.9],[19100,18.6],[19600,14.6],[20300,23],[20800,13.3],[21100,17.6],[21600,22.8],[22000,18.3],[22300,14.8],[22700,16.7],[23200,18.3],[24200,20.3],[24600,18.1],[26200,21.1],[26700,18],[28700,17.9]]; var trend={type:'scatter', mode:'lines', x:[10000,32000], y:[19.3,17.3], line:{color:LOL.MUTED, width:1.5}, hoverinfo:'skip'}; var fill={type:'scatter', mode:'markers', x:filler.map(function(d){return d[0];}), y:filler.map(function(d){return d[1];}), marker:{color:'#d8d5c8', size:7}, hoverinfo:'skip', showlegend:false, name:''}; var labeled=[{name:'Mississippi', x:12324, y:24.4, color:LOL.SPORT.NFL}, {name:'Louisiana', x:15400, y:24.6, color:'#5aa0d8'}, {name:'Alabama', x:13700, y:17.4, color:'#5aa0d8'}, {name:'Oregon', x:18000, y:11.1, color:LOL.SPORT.MLB}, {name:'New York', x:31918, y:20.4, color:LOL.INK}]; var lab={type:'scatter', mode:'markers+text', x:labeled.map(function(d){return d.x;}), y:labeled.map(function(d){return d.y;}), marker:{color:labeled.map(function(d){return d.color;}), size:10}, text:labeled.map(function(d){return d.name;}), textposition:['middle right','middle right','middle right','middle right','middle left'], textfont:{size:11}, hovertemplate:'%{text}<extra></extra>'}; return [trend, fill, lab]; })(), { margin:{l:60,r:80,t:14,b:44}, showlegend:false, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', tickprefix:'$', title:{text:'Spending per pupil', font:{size:11.5, color:LOL.MUTED}} }, yaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', ticksuffix:'%', range:[9,28], title:{text:'Low-income reading proficiency', font:{size:11.5, color:LOL.MUTED}} } });
/* plot-27 */
LOL.plot('plot-27', [{ type:'bar', orientation:'h', y:['BDS 2007 — +2% earnings','Black, Devereux & Salvanes 2007 — +3 IQ pts','Kristensen & Bjerkedal 2007 — +2.3 IQ pts'], x:[2,3,2.3], marker:{color:'#b3263c'}, text:['+2% higher pay','+3 IQ points','+2.3 IQ points'], textposition:'outside', textfont:{color:LOL.INK, size:12}, cliponaxis:false, hovertemplate:'%{y}: %{x}<extra></extra>' }], { margin:{l:220,r:60,t:14,b:44}, xaxis:{ gridcolor:LOL.GRID, zeroline:false, linecolor:'#c9c6b8', ticks:'outside', tickcolor:'#c9c6b8', title:{text:'First-born advantage over second-born', font:{size:11.5, color:LOL.MUTED}} }, yaxis:{ automargin:true, ticks:'', showgrid:false, linecolor:'#c9c6b8', tickfont:{size:11} } });