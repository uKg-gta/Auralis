import {state,$,formatDuration,byId,trackRow,esc,icon,toast} from '../core.js';

const IDENTITY_KEY='auralis-profile-identity-v1';
let identity={displayName:'',bio:''};
function readIdentity(){
 try{const value=JSON.parse(localStorage.getItem(IDENTITY_KEY)||'{}');identity={displayName:String(value.displayName||value.name||'').slice(0,40),bio:String(value.bio||value.motto||'').slice(0,100)}}catch(error){identity={displayName:'',bio:''}}
}
function initials(name){const parts=String(name||'Auralis').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[parts.length-1][0]:parts[0]?.slice(0,2)||'A').toUpperCase()}
function renderIdentity(){
 const name=identity.displayName||'Your name',bio=identity.bio||'Your music, your mood.';
 $('profileDisplayName').textContent=name;$('profileBioDisplay').textContent=bio;$('profileAvatar').textContent=initials(identity.displayName||'Auralis');
 $('profileNameInput').value=identity.displayName;$('profileBioInput').value=identity.bio;
}
export function weeklySeconds(){
 const today=new Date();today.setHours(0,0,0,0);const days=[];let total=0;
 for(let offset=6;offset>=0;offset--){const date=new Date(today);date.setDate(today.getDate()-offset);const next=new Date(date);next.setDate(date.getDate()+1);let seconds=0;state.history.forEach(item=>{if((item.startedAt||0)>=date.getTime()&&(item.startedAt||0)<next.getTime())seconds+=Number(item.seconds)||0});if(offset===0&&state.sessionRecord)seconds+=Number(state.sessionRecord.seconds||0)+state.pendingSeconds;days.push({label:date.toLocaleDateString(undefined,{weekday:'short'}),seconds,height:Math.min(82,Math.max(3,Math.round(seconds/60)))});total+=seconds}
 return {days,total}
}
export function renderProfile(){
 renderIdentity();
 const allSeconds=state.history.reduce((sum,item)=>sum+(Number(item.seconds)||0),0)+(state.sessionRecord?Number(state.sessionRecord.seconds||0)+state.pendingSeconds:0),week=weeklySeconds(),hasHistory=state.history.length>0||!!state.sessionRecord;
 $('profileStats').hidden=!hasHistory;$('profileListeningTime').textContent=formatDuration(allSeconds);
 $('profileTrackCount').textContent=state.history.length?state.history.length+' listening '+(state.history.length===1?'session':'sessions')+' recorded':'Your listening story starts here.';
 $('profileWeekBars').innerHTML=week.days.map(day=>'<div class="week-bar"><i style="height:'+day.height+'px"></i>'+esc(day.label)+'</div>').join('');
 const artists={};state.history.forEach(item=>{const name=item.artist||'Unknown artist';artists[name]=(artists[name]||0)+(Number(item.seconds)||0)});
 const top=Object.keys(artists).sort((a,b)=>artists[b]-artists[a]).slice(0,5);$('profileArtists').hidden=!top.length;
 $('favoriteArtists').innerHTML=top.map(name=>'<button class="artist-result" data-open-artist="'+esc(name)+'"><span class="artist-result-icon">'+icon('artist')+'</span><span class="listinfo"><b>'+esc(name)+'</b><small>'+formatDuration(artists[name])+' listened</small></span>'+icon('chevron-right')+'</button>').join('');
 const plays={};state.history.forEach(item=>{if(item.trackId)plays[item.trackId]=(plays[item.trackId]||0)+1});
 const most=Object.keys(plays).sort((a,b)=>plays[b]-plays[a]).slice(0,5).map(byId).filter(track=>track&&track.source!=='local');
 $('profileMostPlayed').hidden=!most.length;$('mostPlayed').innerHTML=most.map(track=>trackRow(track)).join('');
}
export function initProfile(){
 readIdentity();renderIdentity();
 $('profileEditButton').addEventListener('click',()=>{$('profileEditPanel').hidden=false;$('profileNameInput').focus()});
 $('profileCancelButton').addEventListener('click',()=>{$('profileEditPanel').hidden=true;renderIdentity()});
 $('profileSaveButton').addEventListener('click',()=>{
  const next={displayName:$('profileNameInput').value.trim().slice(0,40),bio:$('profileBioInput').value.trim().slice(0,100)};
  try{localStorage.setItem(IDENTITY_KEY,JSON.stringify(next));identity=next;renderIdentity();$('profileEditPanel').hidden=true;toast('Profile saved')}catch(error){toast('Could not save profile on this device')}
 });
}
