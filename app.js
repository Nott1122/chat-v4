const $=s=>document.querySelector(s);const auth=$('#auth'),app=$('#app');const tl=$('#tab-login'),tr=$('#tab-reg');
tl.onclick=()=>{tl.classList.add('active');tr.classList.remove('active');$('#login-form').classList.remove('hidden');$('#reg-form').classList.add('hidden')};
tr.onclick=()=>{tr.classList.add('active');tl.classList.remove('active');$('#reg-form').classList.remove('hidden');$('#login-form').classList.add('hidden')};
let token,user,socket;async function api(p,b){const r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json','x-token':token||''},body:JSON.stringify(b)});return r.json()}
$('#r-btn').onclick=async()=>{const name=$('#r-name').value.trim(),email=$('#r-email').value.trim(),pass=$('#r-pass').value;let photo='';const f=$('#r-photo').files[0];if(f)photo=await toBase64(f);const r=await api('/api/register',{name,email,pass,photo});if(r.error)return alert('Erro: '+r.error);start(r)};
$('#l-btn').onclick=async()=>{const email=$('#l-email').value.trim(),pass=$('#l-pass').value;const r=await api('/api/login',{email,pass});if(r.error)return alert('Erro: '+r.error);start(r)};
$('#logout').onclick=()=>{localStorage.clear();location.reload()};function start(r){token=r.token;user=r.user;localStorage.setItem('c4',JSON.stringify(r));auth.classList.add('hidden');app.classList.remove('hidden');connect()}
function connect(){socket=io({auth:{token}});socket.on('connect',load);socket.on('msg',add);socket.on('online',onl)}
async function load(){const m=await fetch('/api/messages',{headers:{'x-token':token}}).then(r=>r.json());$('#msgs').innerHTML='';m.forEach(add)}
function add(m){const d=document.createElement('div');d.className='msg'+(m.userId===user.id?' me':'');d.innerHTML=`<img src="${m.photo||'https://i.pravatar.cc/100'}"><div class="bubble"><b>${m.name}</b><div>${esc(m.text)}</div></div>`;$('#msgs').appendChild(d);$('#msgs').scrollTop=1e9}
function onl(l){$('#online').innerHTML='<h4>Online</h4>'+l.map(u=>`<div class="user"><img src="${u.photo||'https://i.pravatar.cc/100'}"><span>${u.name}</span></div>`).join('')}
$('#send').onclick=send;$('#msg').onkeydown=e=>{if(e.key==='Enter')send()};function send(){const t=$('#msg').value.trim();if(!t)return;socket.emit('msg',t);$('#msg').value=''}
function esc(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toBase64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
const s=localStorage.getItem('c4');if(s)start(JSON.parse(s));