/* Presentación y controles. Los cálculos y los pasos pertenecen a engine.js. */
(function () {
  'use strict';
  const E = SimdEngine, $ = id => document.getElementById(id);
  let state, timer = null;
  const fmt = value => value === null ? '·' : String(value);
  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null; $('play').textContent = 'Reproducir';
  }
  function clearErrors() {
    for (const p of ['A','B']) { $('error'+p).textContent=''; $('input'+p).removeAttribute('aria-invalid'); }
  }
  function error(p, message) {
    $('error'+p).textContent=message; $('input'+p).setAttribute('aria-invalid','true');
  }
  function cell(value, i) {
    const el=document.createElement('div'); el.className='cell';
    const index=document.createElement('small'); index.textContent=i;
    el.append(index, document.createTextNode(fmt(value))); el.title=`[${i}] ${fmt(value)}`;
    return el;
  }
  function install(next, message) {
    stop(); state=next; clearErrors();
    $('tipo').value=state.type; $('n').value=state.N; $('nVal').textContent=state.N;
    $('inputA').value=state.A.map(fmt).join(', '); $('inputB').value=state.B.map(fmt).join(', ');
    $('inputStatus').textContent=message;
    $('info').textContent=`Registro Q = 128 bits = ${state.L} carriles × ${E.TYPES[state.type]} bits · N = ${state.N} → ${state.groups} grupos SIMD + ${state.tail} elementos de residuo. Instrucciones de suma previstas: escalar ${state.N}; ruta NEON ${state.groups+state.tail}.`;
    for (const p of ['e','v']) {
      for (const name of ['A','B','C']) {
        const values=name==='C'?Array(state.N).fill(null):state[name];
        $(p+name).replaceChildren(...values.map(cell));
      }
      $(p+'I').textContent='0'; $(p+'D').textContent='0'; $(p+'S').textContent='listo';
      $(p+'G').replaceChildren();
    }
    for (const name of ['q0','q1','q2']) {
      const q=$(name); q.style.gridTemplateColumns=`repeat(${state.L},minmax(0,1fr))`;
      q.replaceChildren(...Array.from({length:state.L},()=>{const el=document.createElement('div');el.className='lane';el.textContent='–';return el;}));
    }
    for (const id of ['eRa','eRb','eRc']) {$(id).textContent='–'; $(id).classList.remove('on');}
    document.querySelector('.aluchip').textContent=state.type==='float32'?'VFP':'ALU';
    $('eIns').textContent=''; $('vIns').textContent=''; $('vIns').className='instr';
    $('qbits').textContent=`${state.L} carriles × ${E.TYPES[state.type]} bits = 128 bits`;
    $('vUname').textContent='Unidad vectorial'; $('trace').replaceChildren();
    $('result').className='result'; $('result').replaceChildren();
    $('step').disabled=false; $('play').disabled=false;
  }
  function generate() {
    stop();
    const type=$('tipo').value, N=Number($('n').value);
    const random=()=>type==='float32'?Math.fround(Math.round(Math.random()*200)/10):type==='uint8'?Math.floor(Math.random()*256):Math.floor(Math.random()*65536)-32768;
    install(E.create(type,Array.from({length:N},random),Array.from({length:N},random)),'Nuevos datos generados.');
  }
  function mark(p, event) {
    for (const name of ['A','B','C']) for (const c of $(p+name).children) c.classList.remove('sel','tail');
    if (!event) return;
    event.indices.forEach((i,j)=>{
      const result=cell(event.results[j],i); result.classList.add('done');
      $(p+'C').children[i].replaceWith(result);
      for (const name of ['A','B','C']) {
        const c=$(p+name).children[i];c.classList.add('sel');if(event.tail)c.classList.add('tail');
      }
    });
    const column=document.createElement('div');column.className='col';
    for(let j=0;j<state.L;j++) {
      const el=document.createElement('i');el.style.setProperty('--h',`${Math.max(4,Math.floor(120/state.L))}px`);
      if(j<event.indices.length)el.className=event.tail?'f t':'f';column.append(el);
    }
    $(p+'G').append(column);
  }
  function mnemonic(vector) {
    if(vector)return `vadd.${state.type==='float32'?'f32':state.type==='int16'?'i16':'i8'} q2, q0, q1`;
    return state.type==='float32'?'vadd.f32 s2, s0, s1':'add r2, r0, r1';
  }
  function describe(event) {
    if(!event)return '—';
    return `${event.tail?'Residuo escalar: ':''}c[${event.indices.join(', ')}] = [${event.results.map(fmt).join(', ')}]`;
  }
  function advance() {
    const events=E.step(state);if(!events)return;
    mark('e',events.scalar);mark('v',events.vector);
    if(events.scalar) {
      const i=events.scalar.indices[0];
      for(const [id,value] of [['eRa',state.A[i]],['eRb',state.B[i]],['eRc',state.Cs[i]]]) {$(id).textContent=fmt(value);$(id).classList.add('on');}
      $('eIns').textContent=`${mnemonic(false)} ; c[${i}]`;
    }
    if(events.vector) {
      const event=events.vector;
      for(const [id,source] of [['q0',state.A],['q1',state.B],['q2',state.Cv]]) {
        [...$(id).children].forEach((el,j)=>{
          el.className='lane';el.textContent='–';el.title='';
          if(j<event.indices.length) {el.classList.add('on');if(event.tail)el.classList.add('tail');el.textContent=fmt(source[event.indices[j]]);el.title=el.textContent;}
        });
      }
      $('vUname').textContent=event.tail?'Residuo: suma escalar (no es una instrucción NEON)':`Unidad vectorial: ${state.L} datos por suma`;
      $('vIns').textContent=`${mnemonic(!event.tail)} ; ${describe(event)}`;
      $('vIns').className=event.tail?'instr tail':'instr';
    } else {
      $('vIns').textContent='En espera: ruta NEON terminada.';
      for(const id of ['q0','q1','q2'])for(const el of $(id).children)el.classList.remove('on');
    }
    $('eI').textContent=state.scalarCount;$('vI').textContent=state.vectorCount+state.tailCount;
    $('eD').textContent=state.sPos;$('vD').textContent=state.vPos;
    $('eS').textContent=state.sPos===state.N?'terminado':'ejecutando';
    $('vS').textContent=state.vPos===state.N?'terminado':'ejecutando';
    const row=document.createElement('tr');
    for(const text of [state.tick,describe(events.scalar),describe(events.vector)]) {const td=document.createElement('td');td.textContent=text;row.append(td);}
    $('trace').append(row);
    const wrap=document.querySelector('.tracewrap');wrap.scrollTop=wrap.scrollHeight;
    if(E.done(state))finish();
  }
  function finish() {
    stop();$('step').disabled=true;$('play').disabled=true;
    const same=state.Cs.every((value,i)=>Object.is(value,state.Cv[i]));
    const total=state.vectorCount+state.tailCount;
    const lines=[
      `Comprobación de coincidencia: ${same?'los '+state.N+' resultados coinciden':'hay diferencias'}. Esta comparación no sustituye las pruebas con respuestas conocidas.`,
      `Instrucciones de suma: escalar ${state.scalarCount}; ruta NEON ${total} (${state.vectorCount} vectoriales + ${state.tailCount} escalares de residuo).`,
      `Relación de instrucciones de suma: ${(state.scalarCount/total).toFixed(2)}×. No es una medida de tiempo ni de aceleración real.`
    ];
    $('result').replaceChildren(...lines.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
    $('result').className='result show';
  }
  function play() {
    if(timer!==null){stop();return;}
    if(E.done(state))return;
    $('play').textContent='Pausar';
    function loop() {timer=null;advance();if(!E.done(state))timer=setTimeout(loop,Number($('vel').value));}
    loop();
  }
  $('play').onclick=play;
  $('step').onclick=()=>{stop();advance();};
  $('reset').onclick=()=>install(E.create(state.type,state.A,state.B),'Ejecución reiniciada: A y B se conservaron.');
  $('generate').onclick=generate;
  $('tipo').onchange=generate;
  $('n').oninput=generate;
  $('apply').onclick=()=>{
    clearErrors();const type=$('tipo').value;let A,B;
    try{A=E.parse($('inputA').value,type);}catch(e){error('A',e.message);}
    try{B=E.parse($('inputB').value,type);}catch(e){error('B',e.message);}
    if(!A||!B)return;
    if(A.length!==B.length){error('B','A y B deben tener la misma longitud.');return;}
    install(E.create(type,A,B),'Datos aplicados. La ejecución comienza desde cero.');
  };
  $('loadExample').onclick=()=>{const type=$('tipo').value,data=E.example(type,$('example').value);install(E.create(type,data.A,data.B),'Ejemplo cargado.');};
  $('runTests').onclick=()=>{
    const results=SimdTests.runTests();
    $('testSummary').textContent=`${results.filter(t=>t.ok).length}/${results.length} pruebas aprobadas. Cada caso de cálculo compara ambas rutas con una respuesta conocida.`;
    $('testResults').replaceChildren(...results.map(t=>{const li=document.createElement('li');li.textContent=`${t.ok?'✓':'✗'} ${t.name}${t.detail?' — '+t.detail:''}`;li.className=t.ok?'pass':'fail';return li;}));
  };
  generate();
})();
