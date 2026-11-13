import {state,$,esc,formatDuration,byId,toast} from '../core.js';
import {request,put} from '../storage.js';

const VERSION='1.0';
const DEFAULT_PROFILE={name:'',bio:'',joinedAt:Date.now()};
let profileData={...DEFAULT_PROFILE},range='week',recapBlob=null,recapMonth='',initialized=false;
const getTrack=item=>item.trackSnapshot||byId(item.trackId)||{};
const duration=item=>Math.max(0,Number(item.seconds)||0);
function initials(name){return String(name||'').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase()||'A'}
function periodStart(mode){const now=new Date(),start=new Date(now);if(mode==='day'){start.setHours(0,0,0,0);return start}if(mode==='month'){start.setDate(1);start.setHours(0,0,0,0);return start}start.setDate(start.getDate()-6);start.setHours(0,0,0,0);return start}
function filteredHistory(mode){const start=periodStart(mode).getTime();return state.history.filter(item=>(Number(item.startedAt)||0)>=start)}
function sumSeconds(items){const activeId=state.sessionRecord?.id;return items.filter(item=>activeId==null||item.id!==activeId).reduce((sum,item)=>sum+duration(item),0)+(state.sessionRecord&&items.some(item=>item.id===activeId)?Number(state.sessionRecord.seconds||0)+Number(state.pendingSeconds||0):0)}
function groupBy(items,keyFn,valueFn){const map=new Map();items.forEach(item=>{const key=keyFn(item)||'Unknown';map.set(key,(map.get(key)||0)+valueFn(item))});return [...map].sort((a,b)=>b[1]-a[1]).slice(0,5)}
function chartData(mode){
 const now=new Date(),buckets=[];
 if(mode==='day'){for(let h=0;h<24;h++){const start=new Date(now);start.setHours(h,0,0,0);const end=new Date(start);end.setHours(h+1);buckets.push({label:String(h).padStart(2,'0'),start:start.getTime(),end:end.getTime()})}}
 else {const count=mode==='month'?30:7;for(let n=count-1;n>=0;n--){const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-n);const end=new Date(start);end.setDate(end.getDate()+1);buckets.push({label:mode==='month'?String(start.getDate()):start.toLocaleDateString(undefined,{weekday:'short'}),start:start.getTime(),end:end.getTime()})}}
 return buckets.map(bucket=>({...bucket,seconds:state.history.filter(item=>item.startedAt>=bucket.start&&item.startedAt<bucket.end).reduce((sum,item)=>sum+duration(item),0)}))
}
function renderChart(){
 const values=chartData(range),max=Math.max(1,...values.map(item=>item.seconds));
 $('profileChart').innerHTML=values.map(item=>'<div class="profile-chart-bar" title="'+esc(item.label+': '+formatDuration(item.seconds))+'"><i style="height:'+Math.max(3,Math.round(item.seconds/max*100))+'%"></i><span>'+esc(item.label)+'</span></div>').join('');
 $('profileChart').setAttribute('aria-label',range==='day'?'Listening time by hour':range==='month'?'Listening time by day for the last 30 days':'Listening time by day for the last 7 days');
}
function renderTopLists(){
 const artists=groupBy(state.history,item=>getTrack(item).artist||item.artist,item=>duration(item));
 $('profileTopArtists').innerHTML=artists.length?artists.map(([name,seconds])=>'<div class="profile-ranking"><span>'+esc(name)+'</span><b>'+formatDuration(seconds)+'</b></div>').join(''):'<p class="subtle">Your top artists will appear as you listen.</p>';
 const tracks=groupBy(state.history,item=>getTrack(item).title||item.title||item.trackId,()=>1);
 $('profileTopTracks').innerHTML=tracks.length?tracks.map(([name,count])=>'<div class="profile-ranking"><span>'+esc(name)+'</span><b>'+count+' plays</b></div>').join(''):'<p class="subtle">Your most-played tracks will appear here.</p>';
 const genres=groupBy(state.history,item=>getTrack(item).genre||'',item=>duration(item)).filter(([name])=>name);
 $('profileTopGenres').innerHTML=genres.length?genres.map(([name,seconds])=>'<div class="profile-ranking"><span>'+esc(name)+'</span><b>'+formatDuration(seconds)+'</b></div>').join(''):'<p class="subtle">Genre insights appear when your music has genre information.</p>';
}
function renderStreak(){
 const played=new Set(state.history.filter(item=>duration(item)>=30).map(item=>new Date(item.startedAt).toDateString()));
 let streak=0,date=new Date();date.setHours(0,0,0,0);if(!played.has(date.toDateString()))date.setDate(date.getDate()-1);
 while(played.has(date.toDateString())&&streak<366){streak++;date.setDate(date.getDate()-1)}
 $('profileStreak').textContent=streak+' day'+(streak===1?'':'s');
}
function formatBytes(bytes){if(bytes<1024)return bytes+' B';const units=['KB','MB','GB','TB'];let value=bytes/1024,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return value.toFixed(value<10?1:0)+' '+units[index]}
async function renderDeviceInfo(){
 $('profileVersion').textContent=VERSION;$('profileJoined').textContent=profileData.joinedAt?new Date(profileData.joinedAt).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'—';
 try{const backup=await request('settings','readonly',store=>store.get('lastBackupAt'));$('profileBackup').textContent=backup?.value?'Last exported '+new Date(backup.value).toLocaleDateString():'No backup exported on this device'}catch{$('profileBackup').textContent='Backup status unavailable'}
 try{const estimate=await navigator.storage?.estimate?.();$('profileStorage').textContent=estimate&&Number.isFinite(estimate.usage)?formatBytes(estimate.usage)+' used on this device':'Not available in this browser'}catch{$('profileStorage').textContent='Not available'}
}
function renderIdentity(){
 $('profileName').textContent=profileData.name||'Your Auralis profile';$('profileBio').textContent=profileData.bio||'Add a little about yourself.';$('profileAvatar').textContent=initials(profileData.name);
 $('profileEditName').value=profileData.name||'';$('profileEditBio').value=profileData.bio||'';$('profileNamePrompt').hidden=!!profileData.name;$('profileEditForm').hidden=!!profileData.name;
}
export async function renderProfile(){
 const allSeconds=sumSeconds(state.history),week=filteredHistory('week');
 $('profileTotalTime').textContent=formatDuration(allSeconds);$('profilePlayCount').textContent=String(state.history.length);$('profileWeekTime').textContent=formatDuration(sumSeconds(week));
 renderChart();renderTopLists();renderStreak();renderIdentity();renderDeviceInfo();
}
async function loadProfile(){
 try{const record=await request('settings','readonly',store=>store.get('profile'));profileData={...DEFAULT_PROFILE,...(record?.value||{})};if(!record?.value?.joinedAt)profileData.joinedAt=Date.now();await put('settings',{key:'profile',value:profileData})}catch(error){toast('Profile details could not be loaded')}
 renderIdentity();
}
async function saveIdentity(event){
 event?.preventDefault();const name=$('profileEditName').value.trim().slice(0,40),bio=$('profileEditBio').value.trim().slice(0,160);
 if(!name){toast('Add a display name to save your profile');$('profileEditName').focus();return}
 profileData={...profileData,name,bio};try{await put('settings',{key:'profile',value:profileData});renderIdentity();$('profileEditForm').hidden=true;toast('Profile updated')}catch(error){toast('Could not save profile details')}
}
function groupNames(items,keyFn,valueFn){const map=new Map();items.forEach(item=>{const key=keyFn(item);if(key)map.set(key,(map.get(key)||0)+valueFn(item))});return [...map].sort((a,b)=>b[1]-a[1]).slice(0,3)}
async function buildRecap(){
 const now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime(),items=state.history.filter(item=>item.startedAt>=monthStart),seconds=items.reduce((sum,item)=>sum+duration(item),0),artists=groupNames(items,item=>getTrack(item).artist||item.artist,item=>duration(item)),tracks=groupNames(items,item=>getTrack(item).title||item.title,()=>1),genres=groupNames(items,item=>getTrack(item).genre, item=>duration(item));
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');ctx.fillStyle='#171318';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#fa2d48';ctx.fillRect(72,72,936,8);ctx.fillStyle='#fff';ctx.font='700 58px system-ui';ctx.fillText('AURALIS',72,170);ctx.font='500 34px system-ui';ctx.fillStyle='#d8cbd2';ctx.fillText(now.toLocaleDateString(undefined,{month:'long',year:'numeric'})+' listening recap',72,230);ctx.fillStyle='#fff';ctx.font='700 76px system-ui';ctx.fillText(formatDuration(seconds),72,370);ctx.font='30px system-ui';ctx.fillStyle='#c7bbc2';ctx.fillText('LISTENING TIME',72,420);ctx.fillStyle='#fff';ctx.font='700 54px system-ui';ctx.fillText(String(items.length),72,540);ctx.font='30px system-ui';ctx.fillStyle='#c7bbc2';ctx.fillText('TRACKS PLAYED',72,585);
 const sections=[['TOP ARTISTS',artists],['TOP TRACKS',tracks],['TOP GENRES',genres]];let y=700;for(const [heading,list] of sections){ctx.fillStyle='#fa8293';ctx.font='700 26px system-ui';ctx.fillText(heading,72,y);ctx.fillStyle='#fff';ctx.font='34px system-ui';ctx.fillText(list.length?list.map(([name])=>name).join(' · ').slice(0,48):'Not enough data yet',72,y+52);y+=145}
 ctx.fillStyle='#9d8f98';ctx.font='24px system-ui';ctx.fillText('Made with Auralis · Your music, your space',72,1260);
 return new Promise(resolve=>canvas.toBlob(blob=>resolve(blob),'image/png'))
}
async function generateRecap(){
 const blob=await buildRecap();if(!blob){toast('Could not create your recap image');return}recapBlob=blob;recapMonth=new Date().toISOString().slice(0,7);
 const url=URL.createObjectURL(blob);$('profileRecapPreview').src=url;$('profileRecapPreviewWrap').hidden=false;$('profileRecapActions').hidden=false;
}
function saveRecap(){if(!recapBlob)return;const url=URL.createObjectURL(recapBlob),link=document.createElement('a');link.href=url;link.download='auralis-monthly-recap.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function shareRecap(){if(!recapBlob){await generateRecap();if(!recapBlob)return}const file=new File([recapBlob],'auralis-monthly-recap.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'My Auralis listening recap',text:'My month in music'});return}catch(error){if(error.name==='AbortError')return}}saveRecap();toast('Sharing is unavailable here; recap saved instead')}
async function resetProfileActivity(){
 if(!confirm('Reset listening history, statistics and learned music preferences? Your imported music, playlists, profile details and backups will remain. This cannot be undone.'))return;
 try{
  if(state.db){await request('history','readwrite',store=>store.clear());await request('listeningSignals','readwrite',store=>store.clear());await put('settings',{key:'discoveryPreferences',value:{hiddenTrackIds:[],excludedArtists:[],excludedGenres:[]}})}
  state.history=[];state.listeningSignals=[];state.discoveryPreferences={hiddenTrackIds:[],excludedArtists:[],excludedGenres:[]};state.sessionRecord=null;state.sessionId=null;state.pendingSeconds=0;state.lastPosition=0;state.refreshAll();await renderProfile();toast('Listening history and learning reset')
 }catch(error){toast('Could not reset listening activity')}
}
export function initProfile(){
 if(initialized)return;initialized=true;loadProfile();
 $('profileEditToggle').addEventListener('click',()=>{$('profileEditForm').hidden=!$('profileEditForm').hidden});
 $('profileEditForm').addEventListener('submit',saveIdentity);
 $('profileRange').addEventListener('click',event=>{const button=event.target.closest('[data-profile-range]');if(!button)return;range=button.dataset.profileRange;$('profileRange').querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));renderChart()});
 $('profileGenerateRecap').addEventListener('click',generateRecap);$('profileSaveRecap').addEventListener('click',saveRecap);$('profileShareRecap').addEventListener('click',shareRecap);$('profileResetActivity').addEventListener('click',resetProfileActivity);
}

export function openProfile(){renderProfile();const monthKey=new Date().toISOString().slice(0,7);if(recapMonth!==monthKey)generateRecap()}
