// Minimal simulation of the After Effects scripting DOM, strict enough to catch
// wrong matchNames, bad value shapes, invalid keyframe calls and missing files.
//   node ae/mock-ae.cjs ../after-effects/PremiereIA_AE.jsx
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsxPath = path.resolve(process.argv[2]);
const errors = [];
const fail = (msg) => {
  errors.push(msg);
  throw new Error(msg);
};

const PVT = {NO_VALUE: 0, ThreeD_SPATIAL: 1, ThreeD: 2, TwoD_SPATIAL: 3, TwoD: 4, OneD: 5, COLOR: 6, CUSTOM_VALUE: 7, MARKER: 8, LAYER_INDEX: 9, MASK_INDEX: 10, SHAPE: 11, TEXT_DOCUMENT: 12};

class Shape {
  constructor() {
    this.vertices = [];
    this.inTangents = [];
    this.outTangents = [];
    this.closed = true;
  }
}
class TextDocument {
  constructor(t) {
    this.text = t;
    this.fontSize = 36;
  }
  resetCharStyle() {}
  resetParagraphStyle() {}
  set fillColor(v) {
    if (!Array.isArray(v) || v.length !== 3) fail(`TextDocument.fillColor needs 3 values, got ${JSON.stringify(v)}`);
    this._fill = v;
  }
  get fillColor() {
    return this._fill;
  }
  set strokeColor(v) {
    if (!Array.isArray(v) || v.length !== 3) fail(`TextDocument.strokeColor needs 3 values, got ${JSON.stringify(v)}`);
    this._stroke = v;
  }
  get strokeColor() {
    return this._stroke;
  }
}
class KeyframeEase {
  constructor(speed, influence) {
    if (influence < 0.1 || influence > 100) fail('KeyframeEase influence out of range');
    this.speed = speed;
    this.influence = influence;
  }
}

const dimsOf = (t) => ({[PVT.ThreeD_SPATIAL]: 3, [PVT.ThreeD]: 3, [PVT.TwoD_SPATIAL]: 2, [PVT.TwoD]: 2, [PVT.OneD]: 1, [PVT.COLOR]: 4})[t];

let stats = {props: 0, keys: 0, layers: 0, comps: 0, text: 0, expr: 0};

class Property {
  constructor(matchName, type, value, opts = {}) {
    this.matchName = matchName;
    this.name = opts.name || matchName;
    this.propertyValueType = type;
    this.value = value;
    this.keys = [];
    this.min = opts.min;
    this.max = opts.max;
    this.isProperty = true;
    stats.props++;
  }
  get numKeys() {
    return this.keys.length;
  }
  check(v) {
    const t = this.propertyValueType;
    if (t === PVT.SHAPE) {
      if (!(v instanceof Shape)) fail(`${this.matchName}: expected Shape`);
      const n = v.vertices.length;
      if (n === 0 || v.inTangents.length !== n || v.outTangents.length !== n) fail(`${this.matchName}: bad shape arrays`);
      for (const a of [v.vertices, v.inTangents, v.outTangents]) for (const p of a) if (p.length !== 2 || p.some((x) => typeof x !== 'number' || !isFinite(x))) fail(`${this.matchName}: bad vertex ${JSON.stringify(p)}`);
      return;
    }
    if (t === PVT.TEXT_DOCUMENT) {
      if (!(v instanceof TextDocument)) fail(`${this.matchName}: expected TextDocument`);
      return;
    }
    const d = dimsOf(t);
    if (d === 1) {
      if (typeof v !== 'number' || !isFinite(v)) fail(`${this.matchName}: expected number, got ${JSON.stringify(v)}`);
      if (this.min !== undefined && v < this.min) fail(`${this.matchName}: ${v} < min ${this.min}`);
      if (this.max !== undefined && v > this.max) fail(`${this.matchName}: ${v} > max ${this.max}`);
      return;
    }
    if (!Array.isArray(v)) fail(`${this.matchName}: expected array, got ${JSON.stringify(v)}`);
    const okLen = t === PVT.ThreeD_SPATIAL || t === PVT.ThreeD ? [2, 3] : [d];
    if (!okLen.includes(v.length)) fail(`${this.matchName}: expected ${okLen.join('/')} values, got ${v.length}`);
    if (v.some((x) => typeof x !== 'number' || !isFinite(x))) fail(`${this.matchName}: non-finite value ${JSON.stringify(v)}`);
    if (t === PVT.COLOR && v.some((x) => x < 0 || x > 1)) fail(`${this.matchName}: color out of range ${JSON.stringify(v)}`);
  }
  setValue(v) {
    if (this.keys.length) fail(`${this.matchName}: setValue on keyframed property`);
    this.check(v);
    this.value = v;
  }
  setValueAtTime(t, v) {
    this.check(v);
    if (typeof t !== 'number' || !isFinite(t)) fail(`${this.matchName}: bad time`);
    this.keys.push({t, v});
    this.keys.sort((a, b) => a.t - b.t);
    stats.keys++;
  }
  setValuesAtTimes(ts, vs) {
    if (ts.length !== vs.length || ts.length === 0) fail(`${this.matchName}: times/values mismatch`);
    for (let i = 0; i < ts.length; i++) {
      if (i && ts[i] <= ts[i - 1]) fail(`${this.matchName}: times not increasing at ${i} (${ts[i - 1]} -> ${ts[i]})`);
      this.setValueAtTime(ts[i], vs[i]);
    }
  }
  setInterpolationTypeAtKey(i) {
    if (i < 1 || i > this.keys.length) fail(`${this.matchName}: key ${i} out of range`);
  }
  setTemporalEaseAtKey(i, a, b) {
    if (i < 1 || i > this.keys.length) fail(`${this.matchName}: ease key out of range`);
    const t = this.propertyValueType;
    const want = t === PVT.TwoD ? 2 : t === PVT.ThreeD ? 3 : 1;
    if (a.length !== want || b.length !== want) fail(`${this.matchName}: ease array length ${a.length}, want ${want}`);
  }
  set expression(e) {
    if (typeof e !== 'string') fail('expression must be string');
    try {
      new Function(`var time=0, value=null; function timeToFrames(t){return t*30} return (function(){${e.replace(/;?\s*\[/, ';return [')}})()`);
    } catch (err) {
      fail(`${this.matchName}: expression syntax error: ${err.message}\n${e}`);
    }
    this._expr = e;
    stats.expr++;
  }
  get expression() {
    return this._expr || '';
  }
}

// spec: matchName -> factory of children
const TR_LAYER = () => [
  new Property('ADBE Anchor Point', PVT.ThreeD_SPATIAL, [0, 0, 0]),
  new Property('ADBE Position', PVT.ThreeD_SPATIAL, [960, 540, 0]),
  new Property('ADBE Scale', PVT.ThreeD, [100, 100, 100]),
  new Property('ADBE Rotate Z', PVT.OneD, 0),
  new Property('ADBE Opacity', PVT.OneD, 100, {min: 0, max: 100}),
];
const TR_VECTOR = () => [
  new Property('ADBE Vector Anchor', PVT.TwoD_SPATIAL, [0, 0]),
  new Property('ADBE Vector Position', PVT.TwoD_SPATIAL, [0, 0]),
  new Property('ADBE Vector Scale', PVT.TwoD, [100, 100]),
  new Property('ADBE Vector Skew', PVT.OneD, 0),
  new Property('ADBE Vector Skew Axis', PVT.OneD, 0),
  new Property('ADBE Vector Rotation', PVT.OneD, 0),
  new Property('ADBE Vector Group Opacity', PVT.OneD, 100, {min: 0, max: 100}),
];

const VECTOR_ITEMS = {
  'ADBE Vector Group': () => new Group('ADBE Vector Group', [new Group('ADBE Vectors Group', [], VECTOR_ITEMS), new Group('ADBE Vector Transform Group', TR_VECTOR())]),
  'ADBE Vector Shape - Group': () => new Group('ADBE Vector Shape - Group', [new Property('ADBE Vector Shape', PVT.SHAPE, new Shape())]),
  'ADBE Vector Shape - Rect': () =>
    new Group('ADBE Vector Shape - Rect', [
      new Property('ADBE Vector Rect Size', PVT.TwoD, [100, 100]),
      new Property('ADBE Vector Rect Position', PVT.TwoD_SPATIAL, [0, 0]),
      new Property('ADBE Vector Rect Roundness', PVT.OneD, 0, {min: 0}),
    ]),
  'ADBE Vector Shape - Ellipse': () =>
    new Group('ADBE Vector Shape - Ellipse', [new Property('ADBE Vector Ellipse Size', PVT.TwoD, [100, 100]), new Property('ADBE Vector Ellipse Position', PVT.TwoD_SPATIAL, [0, 0])]),
  'ADBE Vector Graphic - Fill': () =>
    new Group('ADBE Vector Graphic - Fill', [new Property('ADBE Vector Fill Color', PVT.COLOR, [1, 0, 0, 1]), new Property('ADBE Vector Fill Opacity', PVT.OneD, 100, {min: 0, max: 100})]),
  'ADBE Vector Graphic - Stroke': () =>
    new Group('ADBE Vector Graphic - Stroke', [
      new Property('ADBE Vector Stroke Color', PVT.COLOR, [1, 1, 1, 1]),
      new Property('ADBE Vector Stroke Opacity', PVT.OneD, 100, {min: 0, max: 100}),
      new Property('ADBE Vector Stroke Width', PVT.OneD, 2, {min: 0}),
      new Property('ADBE Vector Stroke Line Cap', PVT.OneD, 1, {min: 1, max: 3}),
      new Property('ADBE Vector Stroke Line Join', PVT.OneD, 1, {min: 1, max: 3}),
    ]),
  'ADBE Vector Filter - Merge': () => new Group('ADBE Vector Filter - Merge', [new Property('ADBE Vector Merge Type', PVT.OneD, 1, {min: 1, max: 5})]),
  'ADBE Vector Filter - Trim': () =>
    new Group('ADBE Vector Filter - Trim', [
      new Property('ADBE Vector Trim Start', PVT.OneD, 0, {min: 0, max: 100}),
      new Property('ADBE Vector Trim End', PVT.OneD, 100, {min: 0, max: 100}),
      new Property('ADBE Vector Trim Offset', PVT.OneD, 0),
    ]),
};

const TEXT_ANIM_PROPS = {
  'ADBE Text Opacity': () => new Property('ADBE Text Opacity', PVT.OneD, 100, {min: 0, max: 100}),
  'ADBE Text Scale 3D': () => new Property('ADBE Text Scale 3D', PVT.ThreeD, [100, 100, 100]),
  'ADBE Text Position 3D': () => new Property('ADBE Text Position 3D', PVT.ThreeD_SPATIAL, [0, 0, 0]),
};
const TEXT_SELECTORS = {
  'ADBE Text Selector': () =>
    new Group('ADBE Text Selector', [
      new Property('ADBE Text Percent Start', PVT.OneD, 0, {min: 0, max: 100}),
      new Property('ADBE Text Percent End', PVT.OneD, 100, {min: 0, max: 100}),
      new Property('ADBE Text Percent Offset', PVT.OneD, 0, {min: -100, max: 100}),
    ]),
};
const TEXT_ANIMATORS = {
  'ADBE Text Animator': () => new Group('ADBE Text Animator', [new Group('ADBE Text Selectors', [], TEXT_SELECTORS), new Group('ADBE Text Animator Properties', [], TEXT_ANIM_PROPS)]),
};
const EFFECTS = {
  'ADBE Noise': () =>
    new Group('ADBE Noise', [new Property('ADBE Noise-0001', PVT.OneD, 0, {min: 0, max: 100}), new Property('ADBE Noise-0002', PVT.OneD, 1), new Property('ADBE Noise-0003', PVT.OneD, 1)]),
};

class Group {
  constructor(matchName, children, allowed) {
    this.matchName = matchName;
    this._name = matchName;
    this.children = children;
    this.allowed = allowed;
    children.forEach((c) => (c.parentProperty = this));
  }
  get name() {
    return this._name;
  }
  set name(n) {
    this._name = n;
  }
  get numProperties() {
    return this.children.length;
  }
  get propertyIndex() {
    return this.parentProperty ? this.parentProperty.children.indexOf(this) + 1 : 1;
  }
  property(k) {
    if (typeof k === 'number') {
      const c = this.children[k - 1];
      if (!c) fail(`${this.matchName}: no property #${k}`);
      return c;
    }
    const c = this.children.find((x) => x.matchName === k || x.name === k);
    if (!c) fail(`${this.matchName}: no property '${k}'`);
    return c;
  }
  addProperty(m) {
    if (!this.allowed || !this.allowed[m]) fail(`${this.matchName}: cannot add '${m}'`);
    const c = this.allowed[m]();
    c.parentProperty = this;
    this.children.push(c);
    return c;
  }
}

class Layer {
  constructor(comp, kind, extra = {}) {
    this.comp = comp;
    this.kind = kind;
    this.name = kind;
    this._parent = null;
    this.startTime = 0;
    this.inPoint = 0;
    this.outPoint = extra.dur ?? comp.duration;
    this.groups = [new Group('ADBE Transform Group', TR_LAYER()), new Group('ADBE Effect Parade', [], EFFECTS)];
    if (kind === 'shape') this.groups.push(new Group('ADBE Root Vectors Group', [], VECTOR_ITEMS));
    if (kind === 'text') {
      this.groups.push(
        new Group('ADBE Text Properties', [new Property('ADBE Text Document', PVT.TEXT_DOCUMENT, new TextDocument(extra.text)), new Group('ADBE Text Animators', [], TEXT_ANIMATORS)]),
      );
      stats.text++;
    }
    if (extra.audio) this.groups.push(new Group('ADBE Audio Group', [new Property('ADBE Audio Levels', PVT.TwoD, [0, 0])]));
    stats.layers++;
  }
  property(k) {
    const g = this.groups.find((x) => x.matchName === k);
    if (!g) fail(`layer '${this.name}' (${this.kind}): no group '${k}'`);
    return g;
  }
  get index() {
    return this.comp._layers.indexOf(this) + 1;
  }
  set parent(p) {
    if (p && p.comp !== this.comp) fail('parent in another comp');
    if (p === this) fail('self parent');
    this._parent = p;
  }
  get parent() {
    return this._parent;
  }
  set trackMatteType(t) {
    if (this.index === 1) fail(`track matte on top layer '${this.name}'`);
    this._matte = t;
  }
}

class CompItem {
  constructor(name, w, h, pa, dur, fps) {
    if (!(w > 0 && h > 0 && dur > 0 && fps > 0)) fail(`bad comp ${name}`);
    Object.assign(this, {name, width: w, height: h, duration: dur, frameRate: fps});
    this._layers = [];
    stats.comps++;
    const self = this;
    this.layers = {
      _add(l) {
        self._layers.unshift(l);
        return l;
      },
      addNull(d) {
        return this._add(new Layer(self, 'null', {dur: d}));
      },
      addShape() {
        return this._add(new Layer(self, 'shape'));
      },
      addText(t) {
        if (typeof t !== 'string') fail('addText needs string');
        return this._add(new Layer(self, 'text', {text: t}));
      },
      addSolid(color, name, w, h, pa) {
        if (!Array.isArray(color) || color.length !== 3) fail(`addSolid color must have 3 values: ${JSON.stringify(color)}`);
        return this._add(new Layer(self, 'solid'));
      },
      add(item) {
        if (!item) fail('layers.add(undefined)');
        return this._add(new Layer(self, item instanceof CompItem ? 'precomp' : 'footage', {audio: item.hasAudio}));
      },
    };
  }
  layer(i) {
    return this._layers[i - 1];
  }
  openInViewer() {}
}

const baseDir = path.dirname(jsxPath);
const imported = [];
const ctx = {
  app: {
    beginUndoGroup() {},
    endUndoGroup() {},
    project: {
      items: {
        addComp: (...a) => new CompItem(...a),
        addFolder: (n) => ({name: n}),
      },
      importFile(opts) {
        const f = opts.file;
        imported.push(f.fsName);
        return {name: path.basename(f.fsName), hasAudio: /\.(wav|mp3)$/i.test(f.fsName)};
      },
    },
  },
  $: {fileName: jsxPath},
  File: class {
    constructor(p) {
      this.fsName = p;
    }
    get exists() {
      return fs.existsSync(this.fsName);
    }
    get parent() {
      return {fsName: path.dirname(this.fsName)};
    }
  },
  ImportOptions: class {
    constructor(f) {
      this.file = f;
    }
  },
  Shape,
  KeyframeEase,
  PropertyValueType: PVT,
  KeyframeInterpolationType: {LINEAR: 6612, BEZIER: 6613, HOLD: 6614},
  ParagraphJustification: {LEFT_JUSTIFY: 7413, CENTER_JUSTIFY: 7415, RIGHT_JUSTIFY: 7414},
  TrackMatteType: {ALPHA: 5013},
  BlendingMode: {NORMAL: 5212, SCREEN: 5220, ADD: 5215, MULTIPLY: 5216, OVERLAY: 5222},
  alert: (m) => console.log('--- alert ---\n' + m),
};
let src = fs.readFileSync(jsxPath, 'utf8').replace(/^#target.*$/m, '');
// Wrap warn() so that every runtime warning is reported as an error too.
src = src.replace('function warn(msg) {', 'function warn(msg) { __warn(msg);');
ctx.__warn = (m) => errors.push('warn: ' + m);
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(src, ctx, {filename: jsxPath});
console.log(`simulated in ${Date.now() - t0} ms`, stats, `imported ${imported.length} files`);
const uniq = [...new Set(errors)];
console.log(uniq.length ? `ERRORS (${uniq.length}):\n` + uniq.slice(0, 40).join('\n') : 'NO ERRORS');
process.exit(uniq.length ? 1 : 0);
