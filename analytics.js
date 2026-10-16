// Only fixed action names and non-content metadata may leave the browser.
(()=>{
 const names=new Set(['practice_start','practice_complete','custom_library_create','custom_sentence_save','custom_import']);
 function excluded(){try{return !!localStorage.getItem('umami.disabled')}catch{return true}}
 window.jujianTrack=(name,data={})=>{
  if(!names.has(name)||excluded()||(window.location&&!/^https?:$/.test(window.location.protocol))||!window.umami?.track)return false;
  const safe={};
  if(['copy','translate'].includes(data.mode))safe.mode=data.mode;
  if(['sentence','paragraph'].includes(data.unit))safe.unit=data.unit;
  if(['builtin','custom'].includes(data.source))safe.source=data.source;
  if(/^([1-9]|[1-3][0-9]|4[0-6])$/.test(String(data.topic)))safe.topic=String(data.topic);
  if(['add','edit'].includes(data.action))safe.action=data.action;
  if(Number.isInteger(data.count)&&data.count>=0&&data.count<=5000)safe.count=data.count;
  try{const request=window.umami.track(name,safe);request?.catch?.(()=>{});return true}catch{return false}
 };
 const button=document.getElementById('analyticsToggle');
 function label(){if(button)button.textContent=excluded()?'本机已排除统计 · 点击恢复':'匿名使用统计 · 排除本机访问'}
 if(button)button.onclick=()=>{try{if(excluded())localStorage.removeItem('umami.disabled');else localStorage.setItem('umami.disabled','1');label();if(typeof toast==='function')toast('统计设置已保存，刷新后完全生效')}catch{if(typeof toast==='function')toast('浏览器未能保存统计设置')}};
 label();
})();
