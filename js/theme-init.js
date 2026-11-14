(()=>{
 const KEY='auralis-visual-preferences-v1',fallback={theme:'dark',accent:'#fa2d48',largeText:false};
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null'),prefs=Object.assign({},fallback,saved||{}),theme=prefs.theme==='light'?'light':'dark',accent=/^#[0-9a-f]{6}$/i.test(prefs.accent||'')?prefs.accent:'#fa2d48';
  const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),lin=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4),lum=hex=>rgb(hex).map(lin).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),ratio=(a,b)=>{const c=[lum(a),lum(b)].sort((x,y)=>y-x);return(c[0]+.05)/(c[1]+.05)},mix=(a,b,n)=>'#'+rgb(a).map((v,i)=>Math.round(v*255+(rgb(b)[i]*255-v*255)*n).toString(16).padStart(2,'0')).join('');
  const bg=theme==='light'?'#f2f2f7':'#1c1c1e',toward=ratio('#000000',bg)>=ratio('#ffffff',bg)?'#000000':'#ffffff';let ink=accent;
  for(let i=0;i<=100&&ratio(ink,bg)<4.5;i++)ink=mix(accent,toward,(i+1)/100);
  const accentOn=ratio(accent,'#000000')>=ratio(accent,'#ffffff')?'#000000':'#ffffff',root=document.documentElement;
  root.dataset.theme=theme;root.classList.toggle('large-text',!!prefs.largeText);root.style.setProperty('--accent',accent);root.style.setProperty('--accent-ink',ink);root.style.setProperty('--accent-on',accentOn);
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='light'?'#ffffff':'#000000';
  document.addEventListener('DOMContentLoaded',()=>document.body.classList.toggle('large-text',!!prefs.largeText),{once:true});
 }catch(_){}
})();