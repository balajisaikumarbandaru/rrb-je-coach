/* Offline stand-in for the coach's online store: seed data from data.js, the viewer's own writes in localStorage.
   Implements the small part of the store API the coach uses (doc/collection, get, set, add, onSnapshot). */
(function () {
  var SEED = window.RRBJE_SEED || {};
  var KEY = 'rrbje-db-v1';
  var overlay = {};
  try { overlay = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { overlay = {}; }
  var listeners = new Set();
  function get(p) { return Object.prototype.hasOwnProperty.call(overlay, p) ? overlay[p] : SEED[p]; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(overlay)); }
    catch (e) { window.__storageFull = true; }
  }
  function fire() { listeners.forEach(function (f) { f(); }); }
  function snap(p) {
    var d = get(p);
    return { id: p.split('/').pop(), exists: d != null, data: function () { return d == null ? undefined : d; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function colDocs(c) {
    var depth = c.split('/').length + 1, keys = new Set(Object.keys(SEED).concat(Object.keys(overlay)));
    return Array.from(keys).filter(function (k) { return k.indexOf(c + '/') === 0 && k.split('/').length === depth && get(k) != null; }).sort().map(snap);
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function docRef(p) {
    return {
      id: p.split('/').pop(), path: p,
      get: function () { return Promise.resolve(snap(p)); },
      set: function (d) { overlay[p] = JSON.parse(JSON.stringify(d)); save(); fire(); return Promise.resolve(); },
      update: function (d) { overlay[p] = Object.assign({}, get(p) || {}, d); save(); fire(); return Promise.resolve(); },
      delete: function () { overlay[p] = null; save(); fire(); return Promise.resolve(); },
      onSnapshot: function (next) { var f = function () { next(snap(p)); }; listeners.add(f); setTimeout(f, 0); return function () { listeners.delete(f); }; },
      collection: function (c) { return colRef(p + '/' + c); }
    };
  }
  function colRef(c) {
    return {
      path: c,
      doc: function (id) { return docRef(c + '/' + (id || newId())); },
      add: function (d) { var r = docRef(c + '/' + newId()); return r.set(d).then(function () { return r; }); },
      get: function () { var docs = colDocs(c); return Promise.resolve({ docs: docs, size: docs.length, empty: !docs.length }); },
      onSnapshot: function (next) {
        var f = function () { var docs = colDocs(c); next({ docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: {} }); };
        listeners.add(f); setTimeout(f, 0); return function () { listeners.delete(f); };
      }
    };
  }
  var db = { doc: docRef, collection: colRef };
  window.claude = { use: function (name) { return Promise.resolve(name === 'db' ? db : null); } };
  window.__standalone = true;
})();
