// ---------------------------------------------------------------------------
// Runtime that builds the After Effects project from the PROJECT description.
// ExtendScript (ES3): no let/const, no arrow functions, no Array.map/forEach.
// ---------------------------------------------------------------------------

var WARNINGS = [];
var FOOTAGE = {};
var COMPS = {};

function warn(msg) {
  WARNINGS.push(msg);
}

function isAnim(v) {
  return v !== null && typeof v === "object" && !(v instanceof Array) && v.k !== undefined;
}

function mkShape(d) {
  var s = new Shape();
  s.vertices = d.v;
  s.inTangents = d.i;
  s.outTangents = d.o;
  s.closed = d.c ? true : false;
  return s;
}

function padValue(prop, v) {
  // 2D values on props that expect 3 values (or vice versa)
  if (!(v instanceof Array)) return v;
  var cur = prop.value;
  if (!(cur instanceof Array)) return v;
  if (v.length === cur.length) return v;
  var out = [];
  var i;
  for (i = 0; i < cur.length; i++) {
    if (i < v.length) out.push(v[i]);
    else out.push(prop.matchName.indexOf("Scale") >= 0 || prop.matchName.indexOf("Color") >= 0 ? (prop.matchName.indexOf("Color") >= 0 ? 1 : 100) : 0);
  }
  return out;
}

function easeAll(prop, influence) {
  var dims = 1;
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD) dims = 2;
  else if (t === PropertyValueType.ThreeD) dims = 3;
  else if (t === PropertyValueType.OneD || t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) dims = 1;
  else return;
  var k, d;
  for (k = 1; k <= prop.numKeys; k++) {
    var arr = [];
    for (d = 0; d < dims; d++) arr.push(new KeyframeEase(0, influence));
    try {
      prop.setTemporalEaseAtKey(k, arr, arr);
    } catch (e) {}
  }
}

function setV(prop, v, kind) {
  if (v === undefined || v === null || !prop) return;
  try {
    if (isAnim(v)) {
      var times = [];
      var vals = [];
      var i;
      for (i = 0; i < v.k.length; i++) {
        times.push(v.k[i][0]);
        var val = v.k[i][1];
        if (kind === "shape") val = mkShape(val);
        else val = padValue(prop, val);
        vals.push(val);
      }
      prop.setValuesAtTimes(times, vals);
      if (v.h) {
        for (i = 1; i <= prop.numKeys; i++) prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.HOLD);
      } else if (v.e) {
        easeAll(prop, v.e);
      }
    } else {
      prop.setValue(kind === "shape" ? mkShape(v) : padValue(prop, v));
    }
  } catch (e) {
    warn("No se pudo asignar " + prop.name + ": " + e.toString());
  }
}

function setTransform(group, tr, names) {
  if (!tr) return;
  if (tr.a !== undefined) setV(group.property(names.a), tr.a);
  if (tr.p !== undefined) setV(group.property(names.p), tr.p);
  if (tr.s !== undefined) setV(group.property(names.s), tr.s);
  if (tr.r !== undefined) setV(group.property(names.r), tr.r);
  if (tr.o !== undefined) setV(group.property(names.o), tr.o);
}

var LAYER_TR = {a: "ADBE Anchor Point", p: "ADBE Position", s: "ADBE Scale", r: "ADBE Rotate Z", o: "ADBE Opacity"};
var GROUP_TR = {a: "ADBE Vector Anchor", p: "ADBE Vector Position", s: "ADBE Vector Scale", r: "ADBE Vector Rotation", o: "ADBE Vector Group Opacity"};

function addItems(contents, items) {
  var i;
  for (i = 0; i < items.length; i++) {
    var it = items[i];
    try {
      if (it.t === "g") {
        var g = contents.addProperty("ADBE Vector Group");
        var gi = g.propertyIndex;
        if (it.n) g.name = it.n;
        addItems(contents.property(gi).property("ADBE Vectors Group"), it.it);
        setTransform(contents.property(gi).property("ADBE Vector Transform Group"), it.tr, GROUP_TR);
      } else if (it.t === "path") {
        var p = contents.addProperty("ADBE Vector Shape - Group");
        setV(p.property("ADBE Vector Shape"), it.d, "shape");
      } else if (it.t === "rect") {
        var r = contents.addProperty("ADBE Vector Shape - Rect");
        setV(r.property("ADBE Vector Rect Size"), it.sz);
        setV(r.property("ADBE Vector Rect Position"), it.p);
        if (it.r !== undefined) setV(r.property("ADBE Vector Rect Roundness"), it.r);
      } else if (it.t === "ell") {
        var el = contents.addProperty("ADBE Vector Shape - Ellipse");
        setV(el.property("ADBE Vector Ellipse Size"), it.sz);
        setV(el.property("ADBE Vector Ellipse Position"), it.p);
      } else if (it.t === "fill") {
        var f = contents.addProperty("ADBE Vector Graphic - Fill");
        setV(f.property("ADBE Vector Fill Color"), it.c);
        if (it.o !== undefined) setV(f.property("ADBE Vector Fill Opacity"), it.o);
      } else if (it.t === "stroke") {
        var s = contents.addProperty("ADBE Vector Graphic - Stroke");
        setV(s.property("ADBE Vector Stroke Color"), it.c);
        setV(s.property("ADBE Vector Stroke Width"), it.w);
        if (it.o !== undefined) setV(s.property("ADBE Vector Stroke Opacity"), it.o);
        if (it.lc) s.property("ADBE Vector Stroke Line Cap").setValue(it.lc);
        if (it.lj) s.property("ADBE Vector Stroke Line Join").setValue(it.lj);
      } else if (it.t === "merge") {
        var m = contents.addProperty("ADBE Vector Filter - Merge");
        m.property("ADBE Vector Merge Type").setValue(it.m);
      } else if (it.t === "trim") {
        var tr = contents.addProperty("ADBE Vector Filter - Trim");
        if (it.s !== undefined) setV(tr.property("ADBE Vector Trim Start"), it.s);
        if (it.e !== undefined) setV(tr.property("ADBE Vector Trim End"), it.e);
      }
    } catch (e) {
      warn("Forma '" + it.t + "': " + e.toString());
    }
  }
}

var JUST = null;
function justification(j) {
  if (!JUST) {
    JUST = {l: ParagraphJustification.LEFT_JUSTIFY, c: ParagraphJustification.CENTER_JUSTIFY, r: ParagraphJustification.RIGHT_JUSTIFY};
  }
  return JUST[j || "l"];
}

function styleText(td, st) {
  td.resetCharStyle();
  td.resetParagraphStyle();
  try {
    td.font = st.font;
  } catch (e) {
    warn("Fuente no instalada: " + st.font + " (instala las fuentes de la carpeta 'fuentes')");
  }
  td.fontSize = st.size;
  td.applyFill = st.fill ? true : false;
  if (st.fill) td.fillColor = [st.fill[0], st.fill[1], st.fill[2]];
  td.applyStroke = st.stroke ? true : false;
  if (st.stroke) {
    td.strokeColor = [st.stroke[0], st.stroke[1], st.stroke[2]];
    td.strokeWidth = st.sw;
    td.strokeOverFill = false;
  }
  if (st.track) td.tracking = st.track;
  if (st.lead) {
    try {
      td.autoLeading = false;
      td.leading = st.lead;
    } catch (e) {}
  }
  td.justification = justification(st.just);
  return td;
}

function buildText(layer, L) {
  var srcProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
  var td = srcProp.value;
  td.text = L.txt.s;
  styleText(td, L.txt);
  srcProp.setValue(td);
  if (L.txt.keys) {
    var i;
    for (i = 0; i < L.txt.keys.length; i++) {
      var tdk = srcProp.value;
      tdk.text = L.txt.keys[i][1];
      srcProp.setValueAtTime(L.txt.keys[i][0], tdk);
    }
  }
  if (L.anim) {
    var a;
    for (a = 0; a < L.anim.length; a++) {
      var A = L.anim[a];
      try {
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var an = animators.addProperty("ADBE Text Animator");
        var ai = an.propertyIndex;
        if (A.name) an.name = A.name;
        var props = animators.property(ai).property("ADBE Text Animator Properties");
        if (A.o !== undefined) setV(props.addProperty("ADBE Text Opacity"), A.o);
        if (A.s !== undefined) {
          var sp = animators.property(ai).property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D");
          setV(sp, [A.s, A.s, 100]);
        }
        if (A.p !== undefined) {
          var pp = animators.property(ai).property("ADBE Text Animator Properties").addProperty("ADBE Text Position 3D");
          setV(pp, [A.p[0], A.p[1], 0]);
        }
        var sel = animators.property(ai).property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        if (A.start !== undefined) setV(sel.property("ADBE Text Percent Start"), A.start);
        if (A.end !== undefined) setV(sel.property("ADBE Text Percent End"), A.end);
      } catch (e) {
        warn("Animador de texto en '" + L.name + "': " + e.toString());
      }
    }
  }
}

function blendMode(name) {
  if (name === "screen") return BlendingMode.SCREEN;
  if (name === "add") return BlendingMode.ADD;
  if (name === "multiply") return BlendingMode.MULTIPLY;
  if (name === "overlay") return BlendingMode.OVERLAY;
  return BlendingMode.NORMAL;
}

function baseFolder() {
  return new File($.fileName).parent;
}

function importFootage(id, rel, folder) {
  try {
    var f = new File(baseFolder().fsName + "/" + rel);
    if (!f.exists) {
      warn("Falta el archivo: " + rel);
      return null;
    }
    var item = app.project.importFile(new ImportOptions(f));
    item.parentFolder = folder;
    FOOTAGE[id] = item;
    return item;
  } catch (e) {
    warn("No se pudo importar " + rel + ": " + e.toString());
    return null;
  }
}

function buildLayer(comp, L, byName) {
  var layer = null;
  if (L.t === "null") {
    layer = comp.layers.addNull(L.dur || comp.duration);
    setV(layer.property("ADBE Transform Group").property("ADBE Anchor Point"), [0, 0]);
  } else if (L.t === "shape") {
    layer = comp.layers.addShape();
  } else if (L.t === "text") {
    layer = comp.layers.addText(L.txt.s);
  } else if (L.t === "solid" || L.t === "adjust") {
    layer = comp.layers.addSolid(L.color || [0, 0, 0], L.name, L.w || comp.width, L.h || comp.height, 1);
    if (L.t === "adjust") layer.adjustmentLayer = true;
  } else if (L.t === "comp") {
    if (!COMPS[L.src]) {
      warn("Precomp no encontrada: " + L.src);
      return null;
    }
    layer = comp.layers.add(COMPS[L.src]);
  } else if (L.t === "footage") {
    var src = FOOTAGE[L.src];
    if (!src) {
      layer = comp.layers.addSolid([0.2, 0.2, 0.2], L.name + " (falta archivo)", comp.width, comp.height, 1);
    } else {
      layer = comp.layers.add(src);
    }
  }
  if (!layer) return null;
  layer.name = L.name;
  if (L.parent && byName[L.parent]) layer.parent = byName[L.parent];
  if (L.start !== undefined) layer.startTime = L.start;
  if (L.tr) setTransform(layer.property("ADBE Transform Group"), L.tr, LAYER_TR);
  if (L.t === "shape" && L.items) addItems(layer.property("ADBE Root Vectors Group"), L.items);
  if (L.t === "text") buildText(layer, L);
  if (L.blend) layer.blendingMode = blendMode(L.blend);
  if (L.matte) {
    // This layer is the alpha matte of the layer right below it.
    try {
      comp.layer(layer.index + 1).trackMatteType = TrackMatteType.ALPHA;
    } catch (e) {
      warn("Mate en '" + L.name + "': " + e.toString());
    }
  }
  if (L.fx) {
    var i;
    for (i = 0; i < L.fx.length; i++) {
      try {
        var fx = layer.property("ADBE Effect Parade").addProperty(L.fx[i].m);
        var pk;
        for (pk in L.fx[i].p) {
          if (L.fx[i].p.hasOwnProperty(pk)) setV(fx.property(parseInt(pk, 10)), L.fx[i].p[pk]);
        }
      } catch (e) {
        warn("Efecto " + L.fx[i].m + " en '" + L.name + "': " + e.toString());
      }
    }
  }
  if (L.audio !== undefined) {
    try {
      setV(layer.property("ADBE Audio Group").property("ADBE Audio Levels"), L.audio);
    } catch (e) {
      warn("Audio en '" + L.name + "': " + e.toString());
    }
  }
  if (L.expr) {
    var ek;
    for (ek in L.expr) {
      if (L.expr.hasOwnProperty(ek)) {
        try {
          layer.property("ADBE Transform Group").property(LAYER_TR[ek]).expression = L.expr[ek];
        } catch (e) {
          warn("Expresión en '" + L.name + "': " + e.toString());
        }
      }
    }
  }
  if (L["in"] !== undefined) layer.inPoint = L["in"];
  if (L.out !== undefined) layer.outPoint = Math.min(L.out, comp.duration);
  else if (layer.outPoint > comp.duration) layer.outPoint = comp.duration;
  if (L.guide) layer.guideLayer = true;
  if (L.shy) layer.shy = true;
  byName[L.name] = layer;
  return layer;
}

function buildComp(C, folder) {
  var comp = app.project.items.addComp(C.name, C.w, C.h, 1, C.dur, C.fps);
  comp.bgColor = C.bg || [0, 0, 0];
  comp.parentFolder = folder;
  var byName = {};
  var i;
  for (i = 0; i < C.layers.length; i++) {
    try {
      buildLayer(comp, C.layers[i], byName);
    } catch (e) {
      warn("Capa '" + C.layers[i].name + "' en " + C.name + ": " + e.toString());
    }
  }
  COMPS[C.name] = comp;
  return comp;
}

function build(P) {
  app.beginUndoGroup("Premiere Pro + IA (proyecto editable)");
  var root = app.project.items.addFolder(P.name);
  var folders = {};
  var fi;
  for (fi = 0; fi < P.folders.length; fi++) {
    folders[P.folders[fi]] = app.project.items.addFolder(P.folders[fi]);
    folders[P.folders[fi]].parentFolder = root;
  }
  var id;
  for (id in P.footage) {
    if (P.footage.hasOwnProperty(id)) importFootage(id, P.footage[id].file, folders[P.footage[id].folder]);
  }
  var c;
  for (c = 0; c < P.comps.length; c++) {
    buildComp(P.comps[c], folders[P.comps[c].folder] || root);
  }
  app.endUndoGroup();
  var main = COMPS[P.main];
  if (main) main.openInViewer();
  var msg = "Proyecto creado: " + P.comps.length + " composiciones.\nAbre la composición '" + P.main + "'.";
  if (WARNINGS.length) {
    msg += "\n\nAvisos (" + WARNINGS.length + "):\n" + WARNINGS.slice(0, 15).join("\n");
  }
  alert(msg);
}
