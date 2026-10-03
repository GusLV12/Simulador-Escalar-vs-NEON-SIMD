(function (root) {
  'use strict';
  const TYPES = Object.freeze({float32:32, int16:16, uint8:8});
  const MAX_N = 40;
  function validate(values, type) {
    if (!Object.hasOwn(TYPES, type)) throw new Error('Tipo de dato desconocido.');
    if (!Array.isArray(values) || !values.length || values.length > MAX_N)
      throw new Error('Introduce entre 1 y 40 números.');
    return values.map((v, i) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Elemento ${i + 1}: debe ser un número finito.`);
      if (type === 'float32') {
        const f = Math.fround(v);
        if (!Number.isFinite(f)) throw new Error(`Elemento ${i + 1}: excede el rango finito float32.`);
        return f;
      }
      const min = type === 'uint8' ? 0 : -32768, max = type === 'uint8' ? 255 : 32767;
      if (!Number.isInteger(v) || v < min || v > max) throw new Error(`Elemento ${i + 1}: usa un entero entre ${min} y ${max}.`);
      return v;
    });
  }
  function parse(text, type) {
    if (!text.trim()) throw new Error('El arreglo no puede estar vacío.');
    const tokens = text.trim().split(/[\s,]+/);
    const values = tokens.map((token, i) => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token))
        throw new Error(`Elemento ${i + 1}: número inválido; usa punto decimal.`);
      return Number(token);
    });
    return validate(values, type);
  }
  function add(a, b, type) {
    if (type === 'uint8') return (a + b) & 255;
    if (type === 'int16') return ((a + b) << 16) >> 16;
    return Math.fround(Math.fround(a) + Math.fround(b));
  }
  function create(type, A, B) {
    A = validate(A, type); B = validate(B, type);
    if (A.length !== B.length) throw new Error('A y B deben tener la misma longitud.');
    const N = A.length, L = 128 / TYPES[type];
    return {type, A, B, N, L, groups:Math.floor(N/L), tail:N%L,
      Cs:Array(N).fill(null), Cv:Array(N).fill(null), sPos:0, vPos:0,
      scalarCount:0, vectorCount:0, tailCount:0, tick:0};
  }
  const done = s => s.sPos === s.N && s.vPos === s.N;
  function step(s) {
    if (done(s)) return null;
    s.tick++;
    let scalar = null, vector = null;
    if (s.sPos < s.N) {
      const i = s.sPos++;
      s.Cs[i] = add(s.A[i], s.B[i], s.type); s.scalarCount++;
      scalar = {indices:[i], results:[s.Cs[i]], tail:false};
    }
    if (s.vPos < s.N) {
      const tail = s.vPos >= s.groups * s.L, count = tail ? 1 : s.L;
      const indices = Array.from({length:count}, (_, j) => s.vPos + j);
      const results = indices.map(i => add(s.A[i], s.B[i], s.type));
      indices.forEach((i, j) => {s.Cv[i] = results[j];});
      s.vPos += count;
      if (tail) s.tailCount++; else s.vectorCount++;
      vector = {indices, results, tail};
    }
    return {scalar, vector};
  }
  function run(type, A, B) {
    const s = create(type, A, B);
    while (!done(s)) step(s);
    return s;
  }
  // Copias explícitas: JSON perdería -0 e Infinity.
  function copy(s) {
    return {...s,A:[...s.A],B:[...s.B],Cs:[...s.Cs],Cv:[...s.Cv]};
  }
  function timeline(type,A,B) {
    const s=create(type,A,B), states=[copy(s)], events=[null];
    while(!done(s)) {events.push(step(s));states.push(copy(s));}
    return {states,events};
  }
  function counts(type,N) {
    if(!Object.hasOwn(TYPES,type) || !Number.isInteger(N) || N<1 || N>MAX_N)
      throw new Error('Tipo o longitud inválidos.');
    const lanes=128/TYPES[type], groups=Math.floor(N/lanes), tail=N%lanes;
    return {scalar:N,vector:groups,tail,total:groups+tail,lanes,ratio:N/(groups+tail)};
  }
  function example(type, kind) {
    const L = 128 / TYPES[type];
    if (kind === 'limits') {
      if (type === 'uint8') return {A:[255,0,250,128], B:[1,0,10,128]};
      if (type === 'int16') return {A:[32767,-32768,-1,0], B:[1,-1,1,0]};
      return {A:[16777216,0.1,-2.5,0], B:[1,0.2,1.25,0]};
    }
    const N = kind === 'tail' ? L + 1 : L;
    return {A:Array.from({length:N}, (_, i) => i), B:Array(N).fill(1)};
  }
  const api = {TYPES, MAX_N, validate, parse, add, create, step, done, run, example, copy, timeline, counts};
  root.SimdEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
