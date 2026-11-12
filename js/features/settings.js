import {state,$,toast} from '../core.js';
import {put} from '../storage.js';
export function applyPreferences(){document.documentElement.dataset.theme=state.prefs.theme==='light'?'light':'dark';document.documentElement.style.setProperty('--yellow',state.prefs.accent||'#f4d447');document.querySelectorAll('[data-theme]').forEach(button=>{const active=button.dataset.theme===state.prefs.theme;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});document.querySelectorAll('[data-accent]').forEach(button=>{const active=button.dataset.accent===state.prefs.accent;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});if($('customAccent'))$('customAccent').value=state.prefs.accent||'#f4d447'}
async function savePreferences(){try{await put('settings',{key:'preferences',value:state.prefs})}catch(error){toast('Could not save this preference')}}
export function setTheme(theme){state.prefs.theme=theme==='light'?'light':'dark';applyPreferences();savePreferences()}
export function setAccent(color){if(!/^#[0-9a-f]{6}$/i.test(color))return;state.prefs.accent=color;applyPreferences();savePreferences()}
