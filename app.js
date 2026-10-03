/* Presentación y controles. Los cálculos y los pasos pertenecen a engine.js. */
(function () {
  'use strict';
  const E = SimdEngine, $ = id => document.getElementById(id);
  let state, sequence, timer = null, playing=false, animating=false, generation=0;
  const reducedMotion=()=>typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = value => value === null ? '·' : Object.is(value,-0) ? '-0' : String(value);
  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null; playing=false; animating=false; generation++;
    $('execution').className='execution';
    if(state) syncControls();
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
    stop();sequence=E.timeline(next.type,next.A,next.B);state=E.copy(sequence.states[0]);
    clearErrors();
    $('tipo').value=state.type; $('n').value=state.N; $('nVal').textContent=state.N;
    $('inputA').value=state.A.map(fmt).join(', '); $('inputB').value=state.B.map(fmt).join(', ');
    $('inputStatus').textContent=message;
    $('timeline').max=state.N;
    resetVisual();syncControls();SimdComparison.update(state.type,state.N);
  }
  function resetVisual() {
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
      const q=$(name); q.style.gridTemplateColumns=`repeat(${state.L},minmax(32px,1fr))`;
      q.replaceChildren(...Array.from({length:state.L},()=>{const el=document.createElement('div');el.className='lane';el.textContent='–';return el;}));
    }
    for (const id of ['eRa','eRb','eRc']) {$(id).textContent='–'; $(id).classList.remove('on');}
    document.querySelector('.aluchip').textContent=state.type==='float32'?'VFP':'ALU';
    $('eIns').textContent=''; $('vIns').textContent=''; $('vIns').className='instr';
    $('qbits').textContent=`${state.L} carriles × ${E.TYPES[state.type]} bits = 128 bits · desliza el registro si no caben todos`;
    $('vUname').textContent='Unidad vectorial'; $('trace').replaceChildren();
    $('result').className='result'; $('result').replaceChildren();
    $('ePhase').textContent='Listo';$('vPhase').textContent='Listo';
    $('phaseStatus').textContent='Listo para comenzar.';
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
    if(E.done(state))return;
    const events=sequence.events[state.tick+1];state=E.copy(sequence.states[state.tick+1]);
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
          if(!event.tail&&j<event.indices.length) {el.classList.add('on');el.textContent=fmt(source[event.indices[j]]);el.title=`Carril ${j}: ${el.textContent}`;}
        });
      }
      $('vUname').textContent=event.tail?`Residuo escalar: ${fmt(state.A[event.indices[0]])} + ${fmt(state.B[event.indices[0]])} = ${fmt(event.results[0])} (sin registro Q)`:`Unidad vectorial: ${state.L} datos por suma`;
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
    const same=state.Cs.every((value,i)=>Object.is(value,state.Cv[i]));
    const total=state.vectorCount+state.tailCount;
    const lines=[
      `Comprobación de coincidencia: ${same?'los '+state.N+' resultados coinciden':'hay diferencias'}.`,
      `Instrucciones de suma: escalar ${state.scalarCount}; ruta NEON ${total} (${state.vectorCount} vectoriales + ${state.tailCount} escalares de residuo).`,
      `Relación de instrucciones de suma: ${(state.scalarCount/total).toFixed(2)}×. No es una medida de tiempo ni de aceleración real.`
    ];
    $('result').replaceChildren(...lines.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
    $('result').className='result show';
  }
  function syncControls(){
    for(const id of ['play','localPlay']){$(id).textContent=playing?'Pausar':'Reproducir';$(id).disabled=E.done(state)&&!playing;}
    for(const id of ['step','next'])$(id).disabled=E.done(state);
    $('previous').disabled=state.tick===0;
    $('timeline').value=state.tick;$('position').textContent=`Paso ${state.tick} de ${state.N}`;
    $('timeline').setAttribute('aria-valuetext',`Paso ${state.tick} de ${state.N}`);
    $('localSpeed').value=$('vel').value;
  }
  function seek(position){
    stop();const target=Math.max(0,Math.min(state.N,Math.trunc(Number(position)||0)));
    state=E.copy(sequence.states[0]);resetVisual();
    for(let i=0;i<target;i++)advance();
    const event=sequence.events[target];
    $('ePhase').textContent=target?'Paso completado':'Listo';
    $('vPhase').textContent=event?.vector?(event.vector.tail?'Residuo escalar completado':'Grupo SIMD completado'):target?'Ruta terminada':'Listo';
    $('phaseStatus').textContent=target===state.N?'Ejecución completada. Puedes retroceder o reiniciar.':`Paso ${target} de ${state.N}.`;
    syncControls();
  }
  function showExecution(){
    $('execution').scrollIntoView?.({behavior:reducedMotion()?'auto':'smooth',block:'start'});
  }
  function phase(name,events,duration){
    $('execution').className=`execution phase-${name}`;
    $('execution').style.setProperty('--phase-time',`${duration}ms`);
    const label={entry:'1/3 · Entrada a registros',sum:'2/3 · Suma',output:'3/3 · Salida hacia C'}[name];
    $('phaseStatus').textContent=`Paso ${state.tick+(name==='output'?0:1)} de ${state.N}: ${label}`;
    $('ePhase').textContent=events.scalar?label:'Ruta terminada';
    $('vPhase').textContent=events.vector?`${label}${events.vector.tail?' · residuo escalar':''}`:'Ruta terminada · en espera';
    // El residuo usa registros escalares: los carriles Q quedan vacíos.
    if(name==='entry'){
      for(const [p,event] of [['e',events.scalar],['v',events.vector]]){
        for(const name of ['A','B','C'])for(const el of $(p+name).children)el.classList.remove('sel','tail');
        if(event)for(const i of event.indices)for(const name of ['A','B']){
          const el=$(p+name).children[i];el.classList.add('sel');if(event.tail)el.classList.add('tail');
        }
      }
      if(events.scalar){const i=events.scalar.indices[0];$('eRa').textContent=fmt(state.A[i]);$('eRb').textContent=fmt(state.B[i]);$('eRc').textContent='…';$('eIns').textContent=`${mnemonic(false)} ; c[${i}]`;}
      const event=events.vector;
      for(const [id,source] of [['q0',state.A],['q1',state.B],['q2',null]]){
        [...$(id).children].forEach((el,j)=>{el.className='lane';el.textContent='–';el.title='';if(event&&!event.tail&&source&&j<event.indices.length){el.classList.add('on');el.textContent=fmt(source[event.indices[j]]);el.title=el.textContent;}});
      }
      $('vUname').textContent=!event?'En espera: ruta NEON terminada.':event.tail?`Residuo escalar: ${fmt(state.A[event.indices[0]])} + ${fmt(state.B[event.indices[0]])}`:`Entrada de ${state.L} carriles al registro Q`;
      $('vIns').textContent=event?`${mnemonic(!event.tail)} ; c[${event.indices.join(', ')}]`:'En espera: ruta NEON terminada.';
    }
  }
  function performStep(){
    if(E.done(state)){playing=false;syncControls();return;}
    const token=++generation,events=sequence.events[state.tick+1],duration=Number($('vel').value)/3;
    animating=true;syncControls();
    function schedule(fn,delay){timer=setTimeout(()=>{if(token!==generation)return;timer=null;fn();},delay);}
    function complete(){
      animating=false;$('execution').className='execution';
      $('ePhase').textContent='Paso completado';
      $('vPhase').textContent=events.vector?(events.vector.tail?'Residuo escalar completado':'Grupo SIMD completado'):'Ruta terminada · en espera';
      $('phaseStatus').textContent=E.done(state)?'Ejecución completada. Puedes retroceder o reiniciar.':`Paso ${state.tick} completado.`;
      if(E.done(state))playing=false;
      syncControls();if(playing)performStep();
    }
    if(reducedMotion()){
      advance();$('ePhase').textContent='Paso completado';$('vPhase').textContent=events.vector?.tail?'Residuo escalar completado':events.vector?'Grupo SIMD completado':'Ruta terminada';syncControls();
      if(playing)schedule(complete,duration*3);else complete();return;
    }
    phase('entry',events,duration);
    schedule(()=>{phase('sum',events,duration);schedule(()=>{advance();phase('output',events,duration);syncControls();schedule(complete,duration);},duration);},duration);
  }
  function play(scroll=true){
    if(playing){seek(state.tick);return;}
    if(E.done(state))return;
    if(animating)seek(state.tick);
    playing=true;if(scroll)showExecution();performStep();
  }
  function next(scroll=true){seek(state.tick);if(scroll)showExecution();performStep();}
  $('play').onclick=()=>play(true);$('localPlay').onclick=()=>play(false);
  $('step').onclick=()=>next(true);$('next').onclick=()=>next(false);
  $('previous').onclick=()=>seek(state.tick-1);
  $('timeline').oninput=()=>seek($('timeline').value);
  const reset=()=>install(E.create(state.type,state.A,state.B),'Ejecución reiniciada: A y B se conservaron.');
  $('localReset').onclick=reset;
  $('localSpeed').onchange=()=>{$('vel').value=$('localSpeed').value;};
  $('vel').onchange=()=>{$('localSpeed').value=$('vel').value;};
  $('reset').onclick=reset;
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
  SimdComparison.init();generate();
})();
