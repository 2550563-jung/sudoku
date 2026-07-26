const $=s=>document.querySelector(s);
const THEMES=[
{name:"파랑",a:"#2563eb",s:"#dbeafe",g:"#1d4ed8"},
{name:"초록",a:"#16a34a",s:"#dcfce7",g:"#15803d"},
{name:"보라",a:"#7c3aed",s:"#ede9fe",g:"#6d28d9"},
{name:"핑크",a:"#db2777",s:"#fce7f3",g:"#be185d"},
{name:"주황",a:"#ea580c",s:"#ffedd5",g:"#c2410c"},
{name:"청록",a:"#0f766e",s:"#ccfbf1",g:"#115e59"},
{name:"검정",a:"#0f172a",s:"#e2e8f0",g:"#020617"}];
const levelNames={easy:"쉬움",medium:"보통",hard:"어려움"}, holes={easy:38,medium:46,hard:52};
let st={solution:[],puzzle:[],values:[],given:[],notes:Array.from({length:81},()=>[]),selected:-1,mistakes:0,seconds:0,paused:false,notesMode:false,history:[],difficulty:"medium",finished:false};
const board=$("#board"), msg=$("#message");
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function valid(b,r,c,n){for(let i=0;i<9;i++)if(b[r*9+i]===n||b[i*9+c]===n)return false;let br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(b[(br+y)*9+bc+x]===n)return false;return true}
function fill(b,i=0){while(i<81&&b[i])i++;if(i>=81)return true;let r=Math.floor(i/9),c=i%9;for(const n of shuffle([1,2,3,4,5,6,7,8,9]))if(valid(b,r,c,n)){b[i]=n;if(fill(b,i+1))return true;b[i]=0}return false}
function newGame(){let sol=Array(81).fill(0);fill(sol);let p=[...sol];for(const i of shuffle([...Array(81).keys()]).slice(0,holes[st.difficulty]))p[i]=0;st={solution:sol,puzzle:p,values:[...p],given:p.map(Boolean),notes:Array.from({length:81},()=>[]),selected:-1,mistakes:0,seconds:0,paused:false,notesMode:false,history:[],difficulty:st.difficulty,finished:false};$("#pause").textContent="일시정지";msg.textContent="";render();timeText();save()}
function noteGrid(ns){let d=document.createElement("div");d.className="note-grid";for(let n=1;n<=9;n++){let s=document.createElement("span");s.textContent=ns.includes(n)?n:"";d.appendChild(s)}return d}
function render(){board.innerHTML="";let sr=st.selected>=0?Math.floor(st.selected/9):-1,sc=st.selected>=0?st.selected%9:-1,sv=st.selected>=0?st.values[st.selected]:0;st.values.forEach((v,i)=>{let b=document.createElement("button");b.className="cell";b.type="button";let r=Math.floor(i/9),c=i%9;if(st.given[i])b.classList.add("given");if(c===2||c===5)b.classList.add("box-right");if(r===2||r===5)b.classList.add("box-bottom");if(st.selected>=0){let sameBox=Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc/3);if(r===sr||c===sc||sameBox)b.classList.add("peer");if(sv&&v===sv)b.classList.add("same");if(i===st.selected)b.classList.add("selected")}if(v&&!st.given[i]&&v!==st.solution[i])b.classList.add("bad");if(v)b.textContent=v;else if(st.notes[i].length)b.appendChild(noteGrid(st.notes[i]));b.onclick=()=>{if(!st.paused&&!st.finished){st.selected=i;render();save()}};board.appendChild(b)});$("#mistakes").textContent=`${st.mistakes} / 3`;$("#difficultyLabel").textContent=levelNames[st.difficulty];$("#difficulty").value=st.difficulty;$("#pauseOverlay").classList.toggle("hidden",!st.paused);$("#notes").classList.toggle("active",st.notesMode)}
function hist(i){st.history.push({i,v:st.values[i],n:[...st.notes[i]]});if(st.history.length>100)st.history.shift()}
function clearNotes(i,n){let r0=Math.floor(i/9),c0=i%9;for(let x=0;x<81;x++){let r=Math.floor(x/9),c=x%9,same=Math.floor(r/3)===Math.floor(r0/3)&&Math.floor(c/3)===Math.floor(c0/3);if(r===r0||c===c0||same)st.notes[x]=st.notes[x].filter(v=>v!==n)}}
function place(n){if(st.paused||st.finished||st.selected<0||st.given[st.selected])return;let i=st.selected;hist(i);if(st.notesMode&&n){st.values[i]=0;let set=new Set(st.notes[i]);set.has(n)?set.delete(n):set.add(n);st.notes[i]=[...set].sort();render();save();return}st.notes[i]=[];st.values[i]=n;if(n&&n!==st.solution[i]){st.mistakes++;msg.textContent="다시 확인해 보세요.";if(st.mistakes>=3){st.finished=true;modal("게임 종료","실수 3회에 도달했습니다.")}}else{msg.textContent="";if(n)clearNotes(i,n)}if(!st.finished&&st.values.every((v,x)=>v===st.solution[x])){st.finished=true;modal("축하합니다!",`${fmt(st.seconds)} 만에 완성했습니다.`)}render();save()}
function undo(){if(!st.history.length||st.paused||st.finished)return;let x=st.history.pop();st.values[x.i]=x.v;st.notes[x.i]=[...x.n];st.selected=x.i;msg.textContent="";render();save()}
function hint(){if(st.paused||st.finished)return;let i=st.selected;if(i<0||st.given[i]||st.values[i]===st.solution[i]){let c=st.values.map((v,x)=>(!st.given[x]&&v!==st.solution[x])?x:-1).filter(x=>x>=0);if(!c.length)return;i=c[Math.floor(Math.random()*c.length)]}st.selected=i;hist(i);st.values[i]=st.solution[i];st.notes[i]=[];clearNotes(i,st.solution[i]);msg.textContent="힌트를 사용했습니다.";render();save()}
function fmt(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}function timeText(){$("#timer").textContent=fmt(st.seconds)}function save(){localStorage.setItem("sudoku-game-v3",JSON.stringify(st))}
function load(){try{let d=JSON.parse(localStorage.getItem("sudoku-game-v3"));if(!d||d.solution?.length!==81)return false;st={...st,...d,notes:d.notes?.length===81?d.notes:Array.from({length:81},()=>[])};timeText();$("#pause").textContent=st.paused?"계속":"일시정지";render();return true}catch{return false}}
function modal(t,x){$("#modalTitle").textContent=t;$("#modalText").textContent=x;$("#modal").classList.remove("hidden")}
function applyTheme(i){let t=THEMES[i]||THEMES[0],r=document.documentElement.style;r.setProperty("--accent",t.a);r.setProperty("--soft",t.s);r.setProperty("--strong",t.g);$("#themeMeta").content=t.a;$("#themeSwatch").style.background=t.a;localStorage.setItem("sudoku-theme",i);document.querySelectorAll(".theme-chip").forEach((e,x)=>e.classList.toggle("active",x===i))}
THEMES.forEach((t,i)=>{let b=document.createElement("button");b.className="theme-chip";b.style.background=t.a;b.title=t.name;b.onclick=()=>applyTheme(i);$("#themePanel").appendChild(b)});applyTheme(+(localStorage.getItem("sudoku-theme")||0));
for(let n=1;n<=9;n++){let b=document.createElement("button");b.textContent=n;b.onclick=()=>place(n);$("#numberPad").appendChild(b)}
$("#themeToggle").onclick=()=>$("#themePanel").classList.toggle("open");
$("#newGame").onclick=()=>{st.difficulty=$("#difficulty").value;newGame()};
$("#difficulty").onchange=()=>{st.difficulty=$("#difficulty").value;newGame()};
$("#pause").onclick=()=>{if(st.finished)return;st.paused=!st.paused;$("#pause").textContent=st.paused?"계속":"일시정지";render();save()};
$("#undo").onclick=undo;$("#erase").onclick=()=>place(0);$("#hint").onclick=hint;
$("#notes").onclick=()=>{st.notesMode=!st.notesMode;msg.textContent=st.notesMode?"메모 모드가 켜졌습니다.":"";render();save()};
$("#modalButton").onclick=()=>{$("#modal").classList.add("hidden");newGame()};
if(!load())newGame();
setInterval(()=>{if(!st.paused&&!st.finished){st.seconds++;timeText();if(st.seconds%5===0)save()}},1000);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
