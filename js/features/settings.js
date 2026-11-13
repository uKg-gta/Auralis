import {state,$,toast} from '../core.js';
import {put} from '../storage.js';
function rgb(hex){const value=hex.replace('#','');return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16)/255)}
function linear(value){return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4)}
function luminance(hex){return rgb(hex).map(linear).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)}
export function contrastRatio(first,second){const values=[luminance(first),luminance(second)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05)}
function mix(hex,target,amount){const source=rgb(hex).map(value=>value*255),destination=rgb(target).map(value=>value*255);return '#'+source.map((value,index)=>Math.round(value+(destination[index]-value)*amount).toString(16).padStart(2,'0')).join('')}
function accessibleAccent(hex,background){const direction=contrastRatio('#000000',background)>=contrastRatio('#ffffff',background)?'#000000':'#ffffff';let candidate=hex;for(let step=0;step<=100;step++){if(contrastRatio(candidate,background)>=4.5)return candidate;candidate=mix(hex,direction,(step+1)/100)}return direction}
function accentForeground(hex){return contrastRatio(hex,'#000000')>=contrastRatio(hex,'#ffffff')?'#000000':'#ffffff'}
export function applyPreferences(){
 const theme=state.prefs.theme==='light'?'light':'dark',accent=/^#[0-9a-f]{6}$/i.test(state.prefs.accent||'')?state.prefs.accent:'#fa2d48',background=theme==='light'?'#f2f2f7':'#1c1c1e';
 document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--accent',accent);document.documentElement.style.setProperty('--accent-ink',accessibleAccent(accent,background));document.documentElement.style.setProperty('--accent-on',accentForeground(accent));
 document.body.classList.toggle('large-text',!!state.prefs.largeText);
 document.querySelectorAll('[data-theme]').forEach(button=>{const active=button.dataset.theme===theme;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('[data-accent]').forEach(button=>{const active=button.dataset.accent===accent;button.style.setProperty('--swatch',button.dataset.accent);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 if($('customAccent'))$('customAccent').value=accent;if($('largeText'))$('largeText').checked=!!state.prefs.largeText;if($('defaultLibrarySort'))$('defaultLibrarySort').value=state.prefs.librarySort||'recent'
}
async function savePreferences(){try{await put('settings',{key:'preferences',value:state.prefs})}catch(error){toast('Could not save this preference')}}
export function setTheme(theme){state.prefs.theme=theme==='light'?'light':'dark';applyPreferences();savePreferences()}
export function setAccent(color){if(!/^#[0-9a-f]{6}$/i.test(color))return;state.prefs.accent=color.toLowerCase();applyPreferences();savePreferences()}
export function setLargeText(enabled){state.prefs.largeText=!!enabled;applyPreferences();savePreferences()}
function formatBytes(bytes){if(!Number.isFinite(bytes)||bytes<0)return 'Not available';if(bytes<1024)return bytes+' B';const units=['KB','MB','GB','TB'];let value=bytes/1024,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return value.toFixed(value<10?1:0)+' '+units[index]}
export async function refreshStorageInfo(){
 const output=$('storageInfo');if(!output)return;
 if(!navigator.storage||typeof navigator.storage.estimate!=='function'){output.textContent='Storage estimates are not available here. Your music remains in this browser.';return}
 try{const estimate=await navigator.storage.estimate(),used=estimate.usage,quota=estimate.quota;if(Number.isFinite(used)&&Number.isFinite(quota)&&quota>0){const percent=Math.min(100,Math.round(used/quota*100));output.textContent='About '+formatBytes(used)+' of '+formatBytes(quota)+' browser storage used ('+percent+'%). This estimate includes other site data.'}else output.textContent='Your imported audio, playlists, tags and settings are stored in this browser.'}catch(error){output.textContent='Storage details are unavailable. Export a backup before clearing browser data.'}
}
export async function requestPersistentStorage(silent=false){
 if(!navigator.storage||typeof navigator.storage.persist!=='function'){if(!silent)toast('Persistent storage is not available in this browser');return false}
 try{const granted=await navigator.storage.persist();if(!silent)toast(granted?'Auralis storage is protected from automatic cleanup':'The browser did not grant persistent storage');return granted}catch(error){if(!silent)toast('Could not request persistent storage');return false}
}


