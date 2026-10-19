(() => {
  'use strict';
  const core = window.JujianNotebook, KEY = 'jujian-notebook-v1';
  const $ = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  let notes = [], selected = '', pending = null, ready = false, blocked = false;
  const prompt = `请在本次英语问题讲解结束后，额外输出一份可导入句间的笔记，后续本对话中的英语问题也沿用此格式。只提炼当前问答，不编造原话或未讨论的结论。对有歧义的语法说明不同解读；推荐句与原句分开，例句附中文。使用以下 JSON 格式，用一个 json 代码块输出，不要在 JSON 内写注释；不适用的文字字段填空字符串、数组填 []。status 固定为“待复习”。不要添加 id、日期或虚构来源。不包含账号或其他私人信息。此流程由我手动复制导入，不代表自动同步。
{
  "schemaVersion": 1,
  "notes": [{
    "title": "简短知识点标题",
    "question": "我的问题",
    "original": "讨论的原英文句子",
    "alternative": "我提出的改写（如有）",
    "keyPoints": ["回答的重要结论"],
    "grammar": "语法、结构、修饰范围与适用条件",
    "improved": "推荐的清晰自然英文表达",
    "translation": "推荐句的中文",
    "examples": [{"english": "迁移例句", "chinese": "中文及用途"}],
    "tags": ["语法", "雅思写作"],
    "status": "待复习",
    "source": ""
  }]
}`;
  const nav = document.createElement('button'); nav.className = 'nav'; nav.id = 'notebookNav';
  nav.innerHTML = '▤ <span>英语问答笔记</span>';
  $('starNav').after(nav);
  const dialog = document.createElement('dialog'); dialog.id = 'notebookDialog'; dialog.setAttribute('aria-labelledby', 'nbTitle');
  dialog.innerHTML = `<div class="dialog-top"><div><span class="eyebrow">ASK · UNDERSTAND · REMEMBER</span><h2 id="nbTitle">把每一次疑问，变成积累。</h2></div><button class="quiet" id="nbClose" aria-label="关闭英语笔记本">✕</button></div>
  <p class="nb-note">ChatGPT 整理 → 复制笔记 → 粘贴导入 → 定期复习。笔记仅保存在当前浏览器，换设备请导出备份。未来对话的自动同步尚未接入，需要另行授权集成。</p>
  <div class="nb-toolbar"><button class="primary" id="nbImport">粘贴导入笔记</button><button class="secondary" id="nbNew">手动记一条</button><button class="secondary" id="nbGuide">复制 ChatGPT 整理指令</button><button class="quiet" id="nbExport">导出全部笔记</button><button class="quiet" id="nbFileButton">导入 JSON 文件</button><input id="nbFile" type="file" accept=".json,application/json" hidden></div>
  <p id="nbMessage" role="status" aria-live="polite"></p>
  <section id="nbHome"><div class="nb-filters"><input id="nbSearch" aria-label="搜索笔记" placeholder="搜索问题、知识点、英文或标签"><select id="nbStatus" aria-label="筛选复习状态"><option value="">全部状态</option>${core.statuses.map(s => `<option>${s}</option>`).join('')}</select><label><input type="checkbox" id="nbArchived"> 归档箱</label></div><p class="nb-note" id="nbCount"></p><div class="nb-layout"><div class="nb-list" id="nbList" aria-label="笔记列表"></div><article class="nb-detail" id="nbDetail" aria-label="笔记详情"></article></div></section>
  <section id="nbImportPane" hidden><button class="quiet nb-back" data-home>← 返回笔记本</button><h3>粘贴 ChatGPT 的笔记</h3><p class="nb-note">复制完整 JSON 代码块即可，也支持带代码围栏粘贴。先预览，再确认；重复 ID 或相同内容会跳过，不覆盖已有笔记。</p><label class="nb-field">笔记 JSON<textarea id="nbPaste" spellcheck="false" placeholder="在此粘贴 ChatGPT 整理的 JSON…"></textarea></label><button class="secondary" id="nbPreview">预览导入</button><div id="nbImportPreview"></div><button class="primary" id="nbCommit" hidden>确认导入</button></section>
  <section id="nbGuidePane" hidden><button class="quiet nb-back" data-home>← 返回笔记本</button><h3>把这段指令发给 ChatGPT</h3><p class="nb-note">此指令约定当前对话的整理格式。新开对话时请再次粘贴，或将它保存到你自己的常用指令。整理结果仍需你手动导入句间。</p><button class="secondary" id="nbCopyPrompt">复制整理指令</button><pre id="nbPrompt"></pre></section>
  <form id="nbEditor" hidden><button type="button" class="quiet nb-back" data-home>← 返回笔记本</button><h3 id="nbEditorTitle">记一条英语笔记</h3><div id="nbFields"></div><button type="submit" class="primary">保存笔记</button></form>`;
  document.body.append(dialog);
  $('nbPrompt').textContent = prompt;
  const fields = { title:'标题', question:'我的问题', original:'原句', alternative:'我的改写', keyPoints:'回答要点（每行一条）', grammar:'语法解释', improved:'推荐改写句', translation:'推荐句中文', examples:'例句（每行：英文 | 中文）', tags:'标签（逗号分隔）', source:'来源 / 对话链接（可选）' };
  $('nbFields').innerHTML = Object.entries(fields).map(([key,label]) => `<label class="nb-field">${label}${['title','tags','source'].includes(key) ? `<input id="nbField-${key}" maxlength="20000" ${key==='title'?'required':''}>` : `<textarea id="nbField-${key}" maxlength="20000" ${key==='question'?'required':''}></textarea>`}</label>`).join('');
  const message = text => { $('nbMessage').textContent = text; };
  function pane(id) { for (const name of ['nbHome','nbImportPane','nbGuidePane','nbEditor']) $(name).hidden = name !== id; message(''); }
  function save(next) {
    if (blocked) throw Error('原有笔记暂时无法读取，已停止写入以保护数据。请先检查浏览器存储设置。');
    try { localStorage.setItem(KEY, JSON.stringify({schemaVersion:1, notes:next})); } catch { throw Error('浏览器未能保存，可能存储空间已满或被禁用。本次修改未保存，请先导出备份。'); }
    notes = next;
  }
  async function open() {
    if (dialog.open) return;
    dialog.showModal();
    if (!ready) {
      try {
        const stored = localStorage.getItem(KEY);
        if (stored !== null) {
          const raw = JSON.parse(stored);
          if (raw.schemaVersion !== 1 || !Array.isArray(raw.notes)) throw Error('笔记存储格式异常');
          notes = raw.notes.map(core.normalize);
        } else {
          const response = { ok: true, text: async () => JSON.stringify({"schemaVersion":1,"notes":[{"id":"jujian-by-attending-school-20261019","title":"by attending school 放在哪里？修饰范围与因果表达","question":"原句把 by attending school 放在 gain real-life knowledge 后。我觉得应写成 gain real-life knowledge and handle matters easily in their daily lives by attending school。这样是不是更符合中文？","original":"People gain real-life knowledge by attending school and handle matters easily in their daily lives.","alternative":"People gain real-life knowledge and handle matters easily in their daily lives by attending school.","keyPoints":["by + 动名词表示方式或手段，即‘通过做某事’。位置会影响读者首先把它与哪个动作联系起来，但不能仅凭就近原则断言唯一解释。","原句中 by attending school 位于第一个并列谓语内，最自然地修饰 gain real-life knowledge；and 连接两个动作，本身没有把‘从而’这一因果关系写明。","你的后置写法有道理：句末状语在合适语境下可以覆盖两个并列动作。但它也可能被读成主要修饰 handle matters，并不能保证消除歧义。","如果想强调上学同时带来两种益处，可把 By attending school 放在句首；如果想强调知识帮助处理日常事务，宜直接写出因果关系。"],"grammar":"原句结构：People [gain real-life knowledge by attending school] and [handle matters easily in their daily lives]。两个谓语共享主语 People。用户改写把方式状语置于整个并列结构之后，存在宽范围与局部范围解读。句首 By attending school, people ... and ... 更容易提示共同的方式背景；which helps them ... 则明确‘获得知识 → 更好处理日常事务’。这里不宜把中文词序直接当成英文状语位置的规则。","improved":"By attending school, people gain practical knowledge, which helps them deal more effectively with everyday problems.","translation":"人们通过上学获得实用知识，这有助于他们更有效地应对日常问题。","examples":[{"english":"By attending school, people gain practical knowledge and develop skills for everyday life.","chinese":"通过上学，人们获得实用知识，并培养日常生活所需的技能。（强调共同方式）"},{"english":"Attending school equips people with practical knowledge, enabling them to deal more effectively with everyday problems.","chinese":"上学使人们掌握实用知识，从而能更有效地应对日常问题。（强调因果）"}],"tags":["语法","状语位置","修饰范围","因果表达","教育","雅思写作"],"status":"待复习","source":"雅思备考计划评估 · https://chatgpt.com/c/6ad596b5-7190-83e8-a98e-424b03b68dbe · 根据用户提供的问句重新整理；原对话回答正文未能读取，非逐字摘录。","createdAt":"2026-10-19T12:00:00+08:00"}]}) };
          if (!response.ok) throw Error('示例笔记暂时加载失败，请稍后重新打开');
          notes = core.parse(await response.text());
          save(notes);
        }
        ready = true;
      } catch (error) { blocked = true; message('读取 / 保存失败：' + error.message + '。请保留当前浏览器数据。'); render(); return; }
    }
    pane('nbHome'); render();
  }
  function visible() {
    const query = $('nbSearch').value.trim().toLowerCase(), status = $('nbStatus').value;
    return notes.filter(n => n.archived === $('nbArchived').checked && (!status || n.status === status) && (!query || JSON.stringify(n).toLowerCase().includes(query))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  function textBlock(label, text, extra='') { return text ? `<h4>${label}</h4><div class="nb-text ${extra}">${esc(text)}</div>` : ''; }
  function render() {
    const list = visible(); if (!list.some(n => n.id === selected)) selected = list[0]?.id || '';
    $('nbCount').textContent = `共 ${notes.filter(n=>!n.archived).length} 条笔记 · 待复习 ${notes.filter(n=>!n.archived&&n.status==='待复习').length} 条 · 当前显示 ${list.length} 条`;
    $('nbList').innerHTML = list.map(n=>`<button class="nb-item" data-note="${esc(n.id)}" aria-pressed="${n.id===selected}"><strong>${esc(n.title)}</strong><small>${esc(n.status)} · ${new Date(n.createdAt).toLocaleDateString('zh-CN')}<br>${esc(n.tags.join(' / '))}</small></button>`).join('') || '<p class="nb-note">这里还没有笔记。试试清空筛选，或粘贴导入一条。</p>';
    const n = notes.find(n=>n.id===selected);
    $('nbDetail').innerHTML = n ? `<div class="nb-tags">${n.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><h3>${esc(n.title)}</h3>${textBlock('我的问题',n.question)}${textBlock('讨论的原句',n.original,'nb-english')}${textBlock('我提出的改写',n.alternative,'nb-english')}${n.keyPoints.length?'<h4>回答要点</h4><ul>'+n.keyPoints.map(t=>`<li class="nb-text">${esc(t)}</li>`).join('')+'</ul>':''}${textBlock('语法与修饰范围',n.grammar)}${textBlock('推荐表达',n.improved,'nb-english nb-highlight')}${textBlock('推荐句中文',n.translation)}${n.examples.length?'<h4>举一反三</h4>'+n.examples.map(e=>`<p class="nb-english">${esc(e.english)}</p><p class="nb-text">${esc(e.chinese)}</p>`).join(''):''}${textBlock('来源',n.source,'nb-source')}<div class="nb-actions"><label>复习状态 <select id="nbReviewStatus" class="nb-review-select" aria-label="此笔记复习状态">${core.statuses.map(s=>`<option ${s===n.status?'selected':''}>${s}</option>`).join('')}</select></label><button class="secondary" id="nbReviewed">今天复习过了</button><button class="quiet" id="nbEdit">编辑笔记</button><button class="quiet nb-danger" id="nbArchive">${n.archived?'恢复笔记':'移入归档箱'}</button></div><p class="nb-note">${n.reviewedAt?'最近复习：'+new Date(n.reviewedAt).toLocaleString('zh-CN'):'还未记录复习'} · 状态由你自行标记</p>` : '<p class="nb-note">选择一条笔记，重新理解，再练习表达。</p>';
  }
  function edit(n) {
    pane('nbEditor'); $('nbEditor').dataset.editId = n?.id || '';
    $('nbEditorTitle').textContent = n ? '编辑英语笔记' : '记一条英语笔记';
    for (const key of Object.keys(fields)) $('nbField-'+key).value = key==='keyPoints' ? (n?.keyPoints||[]).join('\n') : key==='examples' ? (n?.examples||[]).map(e=>e.english+' | '+e.chinese).join('\n') : key==='tags' ? (n?.tags||[]).join(', ') : n?.[key] || '';
    $('nbField-title').focus();
  }
  function preview() {
    pending = core.parse($('nbPaste').value);
    const result = core.merge(notes, pending);
    $('nbImportPreview').innerHTML = '<p class="nb-note">'+result.added+' 条可新增 · '+result.skipped+' 条重复，将跳过</p>'+pending.map(n=>`<div class="nb-item"><strong>${esc(n.title)}</strong><small>${esc(n.question)}<br>${esc(n.improved)}<br>${esc(n.status)} · ${esc(n.tags.join(' / '))}</small></div>`).join('');
    $('nbCommit').hidden = !result.added;
    message('预览完成。确认后才会写入笔记本。');
  }
  const attempt = fn => (...args) => { try { fn(...args); } catch(e) { message(e.message); } };
  nav.onclick = open;
  $('nbClose').onclick = () => dialog.close();
  dialog.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{pane('nbHome');render();});
  $('nbImport').onclick = () => { pane('nbImportPane'); $('nbPaste').focus(); };
  $('nbGuide').onclick = () => pane('nbGuidePane');
  $('nbCopyPrompt').onclick = async () => { try { await navigator.clipboard.writeText(prompt); message('已复制。请粘贴到你的 ChatGPT 英语学习对话。'); } catch { message('浏览器未允许复制，请手动选中下方指令复制。'); } };
  $('nbNew').onclick = () => edit();
  $('nbPreview').onclick = attempt(preview);
  $('nbPaste').oninput = () => { pending=null; $('nbCommit').hidden=true; $('nbImportPreview').textContent=''; };
  $('nbCommit').onclick = attempt(() => {
    if (!pending) return;
    const result = core.merge(notes,pending); save(result.notes); selected=pending.find(n=>!notes.some(x=>x.id===n.id))?.id || pending[0]?.id;
    pending=null; $('nbPaste').value=''; $('nbImportPreview').textContent=''; $('nbCommit').hidden=true;
    $('nbSearch').value=''; $('nbStatus').value=''; $('nbArchived').checked=false;
    pane('nbHome');render();message(`已保存 ${result.added} 条，跳过 ${result.skipped} 条重复笔记。`);
  });
  $('nbFileButton').onclick=()=>{ $('nbFile').value=''; $('nbFile').click(); };
  $('nbFile').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    if(file.size>2000000){message('文件请小于 2 MB。');return;}
    try {const text=await file.text();pane('nbImportPane');$('nbPaste').value=text;pending=null;$('nbCommit').hidden=true;$('nbImportPreview').textContent='';preview();}catch(error){message(error.message);}
  };
  $('nbExport').onclick=()=>{
    const blob=new Blob([JSON.stringify({schemaVersion:1,notes},null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='句间英语笔记-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出全部笔记（包含归档箱）。');
  };
  $('nbSearch').oninput=render;$('nbStatus').onchange=render;$('nbArchived').onchange=render;
  $('nbList').onclick=e=>{const b=e.target.closest('[data-note]');if(b){selected=b.dataset.note;render();}};
  $('nbDetail').onchange=attempt(e=>{if(e.target.id!=='nbReviewStatus')return;save(notes.map(n=>n.id===selected?{...n,status:e.target.value,updatedAt:new Date().toISOString()}:n));render();message('复习状态已保存。');});
  $('nbDetail').onclick=attempt(e=>{
    const id=e.target.closest('button')?.id,n=notes.find(n=>n.id===selected);if(!n)return;
    if(id==='nbEdit'){edit(n);return;}
    if(id==='nbReviewed'||id==='nbArchive'){
      const now=new Date().toISOString();save(notes.map(x=>x.id===selected?{...x,updatedAt:now,...(id==='nbReviewed'?{reviewedAt:now}:{archived:!x.archived})}:x));render();message(id==='nbReviewed'?'已记录今日复习。':'已保存，可在归档箱恢复。');
    }
  });
  $('nbEditor').onsubmit=attempt(e=>{
    e.preventDefault();const old=notes.find(n=>n.id===$('nbEditor').dataset.editId), raw={...old};
    for(const key of Object.keys(fields))raw[key]=$('nbField-'+key).value.trim();
    raw.keyPoints=raw.keyPoints.split('\n').map(s=>s.trim()).filter(Boolean);
    raw.tags=raw.tags.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
    raw.examples=raw.examples.split('\n').filter(s=>s.trim()).map(s=>{const i=s.indexOf('|');return {english:(i<0?s:s.slice(0,i)).trim(),chinese:i<0?'':s.slice(i+1).trim()};});
    raw.updatedAt=new Date().toISOString();const n=core.normalize(raw);
    save(old?notes.map(x=>x.id===old.id?n:x):core.merge(notes,[n]).notes);selected=n.id;pane('nbHome');render();message('笔记已保存。');
  });
  window.addEventListener('storage',e=>{if(e.key===KEY&&ready){blocked=true;message('另一标签页已修改笔记。请刷新页面后再继续，避免覆盖新内容。');}});
})();
