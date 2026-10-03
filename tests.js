(function (root) {
  'use strict';
  const E = root.SimdEngine || require('./engine.js');
  function runTests() {
    const results = [];
    const assert = (ok, message) => {if (!ok) throw new Error(message);};
    const equal = (actual, expected) => assert(actual.length === expected.length && actual.every((v,i) => Object.is(v, expected[i])), `Esperado [${expected}], obtenido [${actual}]`);
    function test(name, fn) {
      try {fn(); results.push({name, ok:true});}
      catch (e) {results.push({name, ok:false, detail:e.message});}
    }
    function fixture(name, type, A, B, expected) {
      test(name, () => {
        const s = E.run(type, A, B);
        equal(s.Cs, expected); equal(s.Cv, expected);
        const lanes = {float32:4,int16:8,uint8:16}[type];
        assert(s.scalarCount === A.length, 'Conteo escalar incorrecto');
        assert(s.vectorCount === Math.floor(A.length/lanes), 'Conteo vectorial incorrecto');
        assert(s.tailCount === A.length%lanes, 'Conteo de residuo incorrecto');
      });
    }
    for (const type of ['float32','int16','uint8']) {
      test(`${type}: todos los tamaños de 1 a 40`, () => {
        const lanes = {float32:4,int16:8,uint8:16}[type];
        for (let N=1;N<=40;N++) {
          const A=Array.from({length:N},(_,i)=>i), B=Array.from({length:N},(_,i)=>40-i);
          const s=E.run(type,A,B);
          equal(s.Cs,Array(N).fill(40)); equal(s.Cv,Array(N).fill(40));
          assert(s.tick===N && s.scalarCount===N, `Avance incorrecto para N=${N}`);
          assert(s.vectorCount===Math.floor(N/lanes) && s.tailCount===N%lanes, `Conteo incorrecto para N=${N}`);
          assert(E.done(s) && E.step(s)===null, `Final incorrecto para N=${N}`);
        }
      });
    }
    for (const type of ['float32','int16','uint8']) {
      const L = {float32:4,int16:8,uint8:16}[type];
      for (const N of [1,L-1,L,L+1,2*L,2*L+1,40]) {
        // Respuesta conocida por construcción: todos los resultados deben ser 5.
        fixture(`${type}: N=${N}, grupos y residuo`,type,Array(N).fill(2),Array(N).fill(3),Array(N).fill(5));
      }
      fixture(`${type}: correspondencia por índice`,type,[0,1,2],[4,2,0],[4,3,2]);
      fixture(`${type}: posiciones distintas entre carriles y residuo`,type,
        [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
        [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
        [0,2,2,4,4,6,6,8,8,10,10,12,12,14,14,16,16]);
    }
    for (const N of [16,17]) fixture(`float32: caso solicitado N=${N}`,'float32',Array(N).fill(1),Array(N).fill(1),Array(N).fill(2));
    fixture('uint8: desbordamiento modular','uint8',[255,0,250,128],[1,0,10,128],[0,0,4,0]);
    fixture('int16: negativos y límites','int16',[32767,-32768,-1,0],[1,-1,1,0],[-32768,32767,0,0]);
    fixture('float32: redondeo y negativos','float32',[16777216,0.1,-2.5,0],[1,0.2,1.25,0],[16777216,0.30000001192092896,-1.25,0]);
    fixture('float32: suma que desborda a infinito','float32',[3.4028234663852886e38],[3.4028234663852886e38],[Infinity]);
    test('Un paso procesa 1 escalar y 4 vectoriales', () => {
      const s = E.create('float32',Array(17).fill(2),Array(17).fill(3));
      const event = E.step(s);
      assert(s.tick===1 && s.sPos===1 && s.vPos===4, 'Avance incorrecto');
      equal(event.scalar.results,[5]); equal(event.vector.results,[5,5,5,5]);
      assert(s.Cs[1] === null && s.Cv[4] === null, 'Procesó elementos adicionales');
    });
    test('Al terminar, otro paso no cambia el estado', () => {
      const s=E.run('uint8',[1],[2]), before=JSON.stringify(s);
      assert(E.step(s)===null && JSON.stringify(s)===before,'Estado final modificado');
    });
    test('Parseo: comas, espacios, saltos y notación científica', () => equal(E.parse('1, 2\n3\t4e0','float32'),[1,2,3,4]));
    test('El motor copia sus entradas', () => {const A=[1],s=E.create('uint8',A,[2]); A[0]=9; assert(s.A[0]===1,'Entrada compartida');});
    for (const [type,text] of [['uint8',''],['uint8','-1'],['uint8','256'],['int16','32768'],['int16','-32769'],['int16','1.5'],['float32','Infinity'],['float32','NaN'],['float32','1e39'],['float32','2abc'],['float32','0x10'],['uint8',Array(41).fill(1).join(',')]]) {
      test(`Rechaza ${type}: ${text.slice(0,24) || '(vacío)'}`, () => {let rejected=false;try{E.parse(text,type);}catch{rejected=true;}assert(rejected,'Entrada aceptada indebidamente');});
    }
    test('Rechaza longitudes diferentes', () => {let rejected=false;try{E.create('uint8',[1],[1,2]);}catch{rejected=true;}assert(rejected,'Aceptó longitudes distintas');});
    return results;
  }
  root.SimdTests = {runTests};
  if (typeof module !== 'undefined') {
    module.exports = {runTests};
    if (require.main === module) {
      const r=runTests(); r.forEach(t=>console.log(`${t.ok?'OK':'FALLO'} ${t.name}${t.detail?': '+t.detail:''}`));
      console.log(`${r.filter(t=>t.ok).length}/${r.length} pruebas aprobadas`);
      process.exitCode=r.some(t=>!t.ok)?1:0;
    }
  }
})(globalThis);
