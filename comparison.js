/* Gráfica local: solo lee conteos; nunca cambia el experimento. */
(function(root){
  'use strict';
  const E=SimdEngine, $=id=>document.getElementById(id);
  const types=['float32','int16','uint8'], colors=['var(--vec)','var(--tail)','var(--ok)'];
  const x=n=>60+(n-1)*700/39, y=count=>300-count*6.5;
  let currentType='float32',currentN=16,selectedN=16;
  function inspect(n){
    selectedN=Math.max(1,Math.min(40,Math.round(n)));
    $('graphN').value=selectedN; $('graphValue').textContent=selectedN;
    const c=E.counts(currentType,selectedN);
    $('chartSummary').textContent=`Consulta N=${selectedN}: escalar ${selectedN}; ${types.map(t=>`NEON ${t}: ${E.counts(t,selectedN).total}`).join('; ')}. Tipo seleccionado ${currentType}: ${c.vector} grupos completos + ${c.tail} sumas de residuo; relación ${c.ratio.toFixed(2)}×.`;
    const marker=$('inspectMarker');marker.setAttribute('x1',x(selectedN));marker.setAttribute('x2',x(selectedN));
    $('inspectionPoint').setAttribute('cx',x(selectedN));$('inspectionPoint').setAttribute('cy',y(c.total));
    $('comparisonSvg').setAttribute('aria-label',`Instrucciones de suma según N. ${$('chartSummary').textContent}`);
  }
  function update(type,N){
    currentType=type;currentN=N;
    const c=E.counts(type,N);
    $('chartCurrent').textContent=`Experimento actual: ${type}, N=${N}. Escalar ${N}; ruta NEON ${c.total} (${c.vector} vectoriales + ${c.tail} escalares de residuo), relación ${c.ratio.toFixed(2)}×. Línea discontinua: N actual; punto sólido: consulta.`;
    $('currentMarker').setAttribute('x1',x(N));$('currentMarker').setAttribute('x2',x(N));
    for(const t of types)$('curve-'+t).setAttribute('class',t===type?'curve active-curve':'curve');
    $('inspectionPoint').setAttribute('fill',colors[types.indexOf(type)]);
    inspect(N);
  }
  function init(){
    const paths=types.map((t,i)=>`<path id="curve-${t}" class="curve" stroke="${colors[i]}" d="${Array.from({length:40},(_,j)=>`${j?'L':'M'}${x(j+1)},${y(E.counts(t,j+1).total)}`).join(' ')}"/>`).join('');
    const grid=[0,10,20,30,40].map(v=>`<line class="axis" x1="60" x2="760" y1="${y(v)}" y2="${y(v)}"/><text x="45" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('');
    const labels=[1,8,16,24,32,40].map(n=>`<text x="${x(n)}" y="322" text-anchor="middle">${n}</text>`).join('');
    $('chartHost').innerHTML=`<svg id="comparisonSvg" class="chart" viewBox="0 0 800 355" preserveAspectRatio="none" role="img" tabindex="0" aria-describedby="chartSummary chartCurrent"><title>Instrucciones de suma según longitud N</title>${grid}<text x="60" y="22">Eje Y: instrucciones de suma</text><text x="760" y="347" text-anchor="end">Eje X: N (elementos por arreglo)</text>${labels}<path class="curve" stroke="var(--esc)" d="M${x(1)},${y(1)} L${x(40)},${y(40)}"/>${paths}<line id="currentMarker" class="current-marker" y1="35" y2="300"/><line id="inspectMarker" class="inspect-marker" y1="35" y2="300"/><circle id="inspectionPoint" r="5" fill="var(--vec)"/></svg>`;
    const rows=[];
    for(let n=1;n<=40;n++){
      const row=document.createElement('tr');
      [n,n,...types.map(t=>E.counts(t,n).total)].forEach((value,i)=>{const el=document.createElement(i===0?'th':'td');if(i===0)el.setAttribute('scope','row');el.textContent=value;row.append(el);});rows.push(row);
    }
    $('chartTable').replaceChildren(...rows);
    $('graphN').oninput=()=>inspect(Number($('graphN').value));
    $('graphCurrent').onclick=()=>inspect(currentN);
    const svg=$('comparisonSvg');
    function point(event){const r=svg.getBoundingClientRect();if(r.width)inspect(1+(((event.clientX-r.left)/r.width)*800-60)*39/700);}
    svg.onpointerdown=point;
    svg.onpointermove=event=>{if(event.pointerType==='mouse'||event.buttons)point(event);};
    svg.onkeydown=event=>{
      const delta={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1}[event.key];
      if(delta){event.preventDefault();inspect(selectedN+delta);}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();inspect(event.key==='Home'?1:40);}
    };
    update(currentType,currentN);
  }
  root.SimdComparison={init,update};
})(globalThis);
