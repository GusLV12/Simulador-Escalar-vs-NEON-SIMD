/* Pruebas del controlador con un DOM mínimo y un reloj simulado.
 * No abren un navegador ni verifican renderizado o accesibilidad real.
 * Ejecutar: node simulador-mejorado/control-tests.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor() {
    this.children=[];this.attributes={};this.className='';this.value='';this.disabled=false;
    this.style={setProperty(){}};
    this.classList={
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
      remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');}
    };
  }
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.text='';this.children=[];this.append(...nodes);}
  replaceWith(node){const i=this.parent.children.indexOf(this);node.parent=this.parent;this.parent.children[i]=node;}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  scrollIntoView(options){this.scrollCalls=(this.scrollCalls||0)+1;this.scrollOptions=options;}
}
function harness() {
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'), elements=new Map();
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) {
    assert(!elements.has(match[1]),`ID duplicado: ${match[1]}`);elements.set(match[1],new Element());
  }
  const $=id=>{assert(elements.has(id),`No existe #${id} en HTML`);return elements.get(id);};
  $('tipo').value='float32';$('n').value='16';$('vel').value='800';$('example').value='full';
  const selectors=new Map([['.aluchip',new Element()],['.tracewrap',new Element()]]);
  const tasks=new Map();let next=0;
  const context=vm.createContext({console,
    document:{getElementById:$,createElement:()=>new Element(),createTextNode:text=>{const e=new Element();e.textContent=text;return e;},querySelector:s=>{assert(selectors.has(s));return selectors.get(s);}},
    setTimeout:fn=>{const id=++next;tasks.set(id,fn);return id;},clearTimeout:id=>tasks.delete(id)
  });
  for(const file of ['engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context,{filename:file});
  const click=id=>{if(!$(id).disabled)$(id).onclick();};
  const apply=(A,B)=>{$('inputA').value=A;$('inputB').value=B;click('apply');};
  const snapshot=()=>JSON.stringify(['eA','eB','eC','vC','eI','vI','trace'].map(id=>$(id).textContent));
  return {$,click,apply,snapshot,tasks,traceWrap:selectors.get('.tracewrap'),tick(){const entry=tasks.entries().next().value;if(entry){tasks.delete(entry[0]);entry[1]();}}};
}
const tests=[];
function test(name,fn){try{fn(harness());tests.push({name,ok:true});}catch(e){tests.push({name,ok:false,error:e.message});}}
test('Un clic avanza exactamente un paso',({$,click,tasks})=>{click('step');assert.equal($('eI').textContent,'1');assert.equal($('vD').textContent,'4');assert.equal($('trace').children.length,1);assert.equal(tasks.size,0);});
test('Reiniciar conserva A y B y limpia la ejecución',({$,click})=>{const A=$('inputA').value,B=$('inputB').value;click('step');click('reset');assert.equal($('inputA').value,A);assert.equal($('inputB').value,B);assert.equal($('eI').textContent,'0');assert.equal($('vI').textContent,'0');assert.equal($('trace').children.length,0);});
test('Pausar cancela el temporizador y no avanza',({$,click,tasks,tick,snapshot})=>{click('play');assert.equal(tasks.size,1);click('play');const before=snapshot();tick();assert.equal(tasks.size,0);assert.equal(snapshot(),before);assert.equal($('play').textContent,'Reproducir');});
test('Reiniciar durante reproducción cancela el temporizador',({$,click,tasks,tick})=>{click('play');click('reset');tick();assert.equal(tasks.size,0);assert.equal($('eI').textContent,'0');});
test('Un paso durante reproducción pausa y avanza solo una vez',({$,click,tasks,tick})=>{click('play');click('step');tick();assert.equal($('eI').textContent,'2');assert.equal(tasks.size,0);});
test('Datos manuales válidos ajustan N y reinician',({$,click,apply,tasks})=>{click('play');apply('1, 2\n3','4 5,6');assert.equal(Number($('n').value),3);assert.equal($('eA').children.length,3);assert.equal($('eI').textContent,'0');assert.equal(tasks.size,0);});
test('Errores en ambos campos conservan el experimento',({$,click,apply,snapshot})=>{click('step');const before=snapshot();apply('abc','1e39');assert.equal(snapshot(),before);assert($('errorA').textContent);assert($('errorB').textContent);assert.equal($('inputA').attributes['aria-invalid'],'true');});
test('Longitudes distintas no reemplazan resultados',({$,click,apply,snapshot})=>{click('step');const before=snapshot();apply('1 2','3');assert.equal(snapshot(),before);assert.match($('errorB').textContent,/misma longitud/);});
test('Generar datos detiene ejecución y limpia conteos',({$,click,tasks})=>{click('play');click('generate');assert.equal(tasks.size,0);assert.equal($('eI').textContent,'0');assert.equal($('inputA').value.split(',').length,16);});
test('Cambiar longitud o tipo cancela reproducción',({$,click,tasks})=>{click('play');$('n').value='17';$('n').oninput();assert.equal(tasks.size,0);assert.equal($('eA').children.length,17);click('play');$('tipo').value='uint8';$('tipo').onchange();assert.equal(tasks.size,0);assert.equal($('q0').children.length,16);});
test('Todos los ejemplos se cargan para cada tipo',({$,click})=>{for(const type of ['float32','int16','uint8']){ $('tipo').value=type;$('tipo').onchange();for(const example of ['full','tail','limits']){$('example').value=example;click('loadExample');assert.equal($('errorA').textContent,'');assert.equal($('errorB').textContent,'');assert.equal($('eI').textContent,'0');}}});
test('N=17 termina con 17 sumas escalares y 5 en ruta NEON',({$,apply,click,tick,tasks})=>{apply(Array(17).fill(2).join(','),Array(17).fill(3).join(','));click('play');for(let i=0;i<20;i++)tick();assert.equal(tasks.size,0);assert.equal($('eI').textContent,'17');assert.equal($('vI').textContent,'5');assert.equal($('trace').children.length,17);assert.match($('result').textContent,/4 vectoriales \+ 1 escalares/);assert($('step').disabled);assert($('play').disabled);});
test('Reproducir y Un paso llevan a la traza; pausar no desplaza',({click,traceWrap})=>{click('play');assert.equal(traceWrap.scrollCalls,1);click('play');assert.equal(traceWrap.scrollCalls,1);click('step');assert.equal(traceWrap.scrollCalls,2);assert.equal(traceWrap.scrollOptions.block,'center');});
test('Float32 conserva el signo de cero al aplicar y reiniciar',({$,apply,click})=>{apply('-0','-0');assert.equal($('inputA').value,'-0');click('step');assert.equal($('eRc').textContent,'-0');assert.match($('trace').textContent,/\[-0\]/);click('reset');assert.equal($('inputA').value,'-0');});
for(const t of tests)console.log(`${t.ok?'OK':'FALLO'} ${t.name}${t.error?': '+t.error:''}`);
console.log(`${tests.filter(t=>t.ok).length}/${tests.length} pruebas de controles aprobadas (DOM mínimo, sin navegador)`);
process.exitCode=tests.some(t=>!t.ok)?1:0;
