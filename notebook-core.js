(function (root) {
  'use strict';
  const statuses = ['待复习', '复习中', '已掌握'];
  function string(value, name, required = false) {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || value.length > 20000 || (required && !value.trim())) throw Error(name + '需为文字，且不超过 20000 字。');
    return value.trim();
  }
  function strings(value, name) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 100) throw Error(name + '需为最多 100 项的数组。');
    return value.map(x => string(x, name, true));
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('每条笔记需为对象。');
    const note = {};
    for (const field of ['title', 'question', 'original', 'alternative', 'grammar', 'improved', 'translation', 'source']) note[field] = string(raw[field], field, ['title', 'question'].includes(field));
    note.keyPoints = strings(raw.keyPoints, 'keyPoints');
    note.tags = strings(raw.tags, 'tags');
    if (!note.keyPoints.length && !note.grammar && !note.improved) throw Error('请至少提供回答要点、语法解释或改写句中的一项。');
    if (raw.examples !== undefined && (!Array.isArray(raw.examples) || raw.examples.length > 100)) throw Error('examples 需为最多 100 项的数组。');
    note.examples = (raw.examples || []).map(x => ({ english: string(x?.english, '例句英文', true), chinese: string(x?.chinese, '例句中文') }));
    note.status = raw.status === undefined ? statuses[0] : raw.status;
    if (!statuses.includes(note.status)) throw Error('复习状态仅支持：' + statuses.join('、'));
    note.id = string(raw.id, 'id') || 'note-' + crypto.randomUUID();
    note.createdAt = typeof raw.createdAt === 'string' && Number.isFinite(Date.parse(raw.createdAt)) ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
    note.updatedAt = typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt)) ? new Date(raw.updatedAt).toISOString() : note.createdAt;
    note.reviewedAt = typeof raw.reviewedAt === 'string' && Number.isFinite(Date.parse(raw.reviewedAt)) ? new Date(raw.reviewedAt).toISOString() : '';
    note.archived = raw.archived === true;
    return note;
  }
  function parse(text) {
    if (text.length > 2000000) throw Error('单次导入请小于 2 MB。');
    let raw;
    try { raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { throw Error('无法读取 JSON，请复制完整的笔记代码块。'); }
    if (raw?.schemaVersion !== undefined && raw.schemaVersion !== 1) throw Error('不支持此笔记格式版本。');
    const notes = Array.isArray(raw) ? raw : Array.isArray(raw?.notes) ? raw.notes : [raw];
    if (!notes.length || notes.length > 500) throw Error('每次可导入 1–500 条笔记。');
    return notes.map(normalize);
  }
  const fingerprint = n => JSON.stringify([n.title, n.question, n.original, n.alternative, n.keyPoints, n.grammar, n.improved, n.translation, n.examples, n.tags, n.source]);
  function merge(existing, incoming) {
    const result = [...existing], ids = new Set(existing.map(x => x.id)), contents = new Set(existing.map(fingerprint));
    let added = 0;
    for (const note of incoming) {
      const content = fingerprint(note);
      if (ids.has(note.id) || contents.has(content)) continue;
      result.push(note); ids.add(note.id); contents.add(content); added++;
    }
    return { notes: result, added, skipped: incoming.length - added };
  }
  root.JujianNotebook = { statuses, normalize, parse, merge };
})(typeof window === 'undefined' ? globalThis : window);
