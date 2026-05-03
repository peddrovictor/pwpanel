import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { storage } from "./firebase";
import { Ico } from "./Icons";
import {
  CLASSES, CLASS_LABELS, CLASS_COLORS, CULTIVOS, EVENT_TYPES,
  DEFAULT_DATA, resolveClass
} from "./constants";

const AUTH_KEY = "staff_auth";
const DATA_KEY = "clan_data";

/* ═══════════════ LOGIN ═══════════════ */
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("loading");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setMode(prev => prev === "loading" ? "register" : prev), 3000);
    (async () => {
      try {
        const stored = await storage.get(AUTH_KEY);
        const accounts = stored?.value ? JSON.parse(stored.value) : null;
        setMode(accounts && accounts.length > 0 ? "login" : "register");
      } catch { setMode("register"); }
      finally { clearTimeout(timeout); }
    })();
    return () => clearTimeout(timeout);
  }, []);

  const handleRegister = async () => {
    if (!user.trim() || !pass.trim()) { setErr("Preencha usuário e senha."); return; }
    if (pass.length < 4) { setErr("Senha deve ter pelo menos 4 caracteres."); return; }
    const accounts = [{ user: user.trim(), pass, role: "admin" }];
    await storage.save(AUTH_KEY, accounts);
    onLogin({ user: user.trim(), isAdmin: true });
  };

  const handleLogin = async () => {
    if (!user.trim() || !pass.trim()) { setErr("Preencha usuário e senha."); return; }
    try {
      const stored = await storage.get(AUTH_KEY);
      const accounts = stored?.value ? JSON.parse(stored.value) : [];
      const found = accounts.find(a => a.user === user.trim() && a.pass === pass);
      if (found) {
        const hasAnyAdmin = accounts.some(a => a.role === "admin");
        if (!hasAnyAdmin) {
          accounts[0].role = "admin";
          for (let i = 1; i < accounts.length; i++) { if (!accounts[i].role) accounts[i].role = "staff"; }
          await storage.save(AUTH_KEY, accounts);
        }
        onLogin({ user: found.user, isAdmin: found.role === "admin" });
      } else { setErr("Usuário ou senha incorretos."); }
    } catch { setErr("Erro ao verificar login."); }
  };

  if (mode === "loading") return (
    <div className="login-wrap">
      <div style={{color:"var(--gold)",fontFamily:"'Cinzel',serif",letterSpacing:4}}>Carregando...</div>
    </div>
  );

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>ROMA</h1>
        <div className="lsub">Painel da Staff</div>
        {err && <div className="login-err">{err}</div>}
        <input placeholder="Usuário" value={user} onChange={e => { setUser(e.target.value); setErr(""); }} />
        <input placeholder="Senha" type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())} />
        {mode === "login" && <button className="lbtn" onClick={handleLogin}>Entrar</button>}
        {mode === "register" && (
          <>
            <div style={{fontSize:".8rem",color:"var(--text-d)",marginBottom:10}}>Primeiro acesso — crie sua conta de administrador.</div>
            <button className="lbtn" onClick={handleRegister}>Criar Conta Admin</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN APP ═══════════════ */
export default function App() {
  const [auth, setAuth] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("members");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    const timeout = setTimeout(() => { setData(DEFAULT_DATA); setLoading(false); }, 4000);

    // Real-time sync: listen for changes
    const unsubscribe = storage.subscribe(DATA_KEY, (val) => {
      setData(val || DEFAULT_DATA);
      setLoading(false);
      clearTimeout(timeout);
    });

    // Also do an initial fetch
    (async () => {
      try {
        const s = await storage.get(DATA_KEY);
        if (s?.value) setData(JSON.parse(s.value));
        else setData(DEFAULT_DATA);
      } catch { setData(DEFAULT_DATA); }
      setLoading(false);
      clearTimeout(timeout);
    })();

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, [auth]);

  const save = useCallback(async (d) => {
    setData(d);
    await storage.save(DATA_KEY, d);
  }, []);

  if (!auth) return <LoginScreen onLogin={setAuth} />;

  if (loading || !data) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",color:"var(--gold)",fontFamily:"'Cinzel',serif",letterSpacing:4,fontSize:".9rem"}}>
      Carregando...
    </div>
  );

  const tabs = [
    { id:"members", label:"Membros", icon:Ico.users },
    { id:"events", label:"Presenças", icon:Ico.cal },
    { id:"tw", label:"Controle TW", icon:Ico.shield },
    { id:"pts", label:"Montar PTs", icon:Ico.swords },
    { id:"accounts", label:"Contas", icon:Ico.key },
    ...(auth.isAdmin ? [{ id:"staff", label:"Staff", icon:Ico.edit }] : []),
  ];

  return (
    <div className="app">
      <header className="hdr">
        <h1>ROMA</h1>
        <div className="sub">Perfect World — Painel do Clã</div>
        <div className="hdr-row">
          <span className="hdr-stat">
            {data.members.length} membros · logado como <strong style={{color:"var(--gold)"}}>{auth.user}</strong>
            {auth.isAdmin && <span className="badge b-gold" style={{marginLeft:6,fontSize:".5rem",verticalAlign:"middle"}}>ADMIN</span>}
          </span>
          <button className="logout-btn" onClick={()=>{setAuth(null);setData(null);setLoading(true);setTab("members");}}>Sair</button>
        </div>
      </header>
      <nav className="tabs">
        {tabs.map(t=>(
          <button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
      {tab==="members" && <MembersTab data={data} save={save}/>}
      {tab==="events" && <EventsTab data={data} save={save}/>}
      {tab==="tw" && <TWTab data={data} save={save}/>}
      {tab==="pts" && <PTBuilderTab data={data} save={save}/>}
      {tab==="accounts" && <AccountsTab data={data} save={save}/>}
      {tab==="staff" && auth.isAdmin && <StaffTab/>}
    </div>
  );
}

/* ═══════════════ MEMBERS ═══════════════ */
function MembersTab({ data, save }) {
  const [show, setShow] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState([]);
  const [editId, setEditId] = useState(null);
  const blank = {name:"",class:CLASSES[0],level:100,cultivo:CULTIVOS[0],whatsapp:""};
  const [form, setForm] = useState(blank);

  const parseBulk = (text) => {
    const lines = text.split("\n").filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[\t;,]+/).map(s => s.trim());
      if (!parts[0]) return null;
      return { name:parts[0], class:resolveClass(parts[1]||""), level:parseInt(parts[2])||100, cultivo:CULTIVOS[0], whatsapp:"", _raw:line };
    }).filter(Boolean);
    setBulkPreview(parsed);
  };

  const importBulk = () => {
    if (bulkPreview.length === 0) return;
    const existing = new Set(data.members.map(m => m.name.toLowerCase()));
    const newMembers = bulkPreview
      .filter(m => !existing.has(m.name.toLowerCase()))
      .map((m, i) => ({ name:m.name, class:m.class, level:m.level, cultivo:m.cultivo, whatsapp:m.whatsapp, id:Date.now()+i }));
    save({ ...data, members: [...data.members, ...newMembers] });
    setBulkText(""); setBulkPreview([]); setShowBulk(false);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    if (editId) {
      save({...data,members:data.members.map(m=>m.id===editId?{...m,...form}:m)});
      setEditId(null);
    } else {
      save({...data,members:[...data.members,{...form,id:Date.now()}]});
    }
    setForm(blank); setShow(false);
  };

  const startEdit = (m) => { setForm({name:m.name,class:m.class,level:m.level,cultivo:m.cultivo,whatsapp:m.whatsapp}); setEditId(m.id); setShow(true); };
  const remove = (id) => {
    save({
      ...data,
      members:data.members.filter(m=>m.id!==id),
      events:(data.events||[]).map(e=>({...e,present:(e.present||[]).filter(p=>p!==id)})),
      twWeeks:(data.twWeeks||[]).map(w=>({...w,confirmed:(w.confirmed||[]).filter(p=>p!==id),declined:(w.declined||[]).filter(p=>p!==id)})),
    });
  };
  const cancel = () => { setForm(blank); setEditId(null); setShow(false); };

  const exportExcel = () => {
    if (data.members.length === 0) return;
    const rows = data.members.map(m => ({ Nome:m.name, Classe:m.class, "Nível":m.level, Cultivo:m.cultivo, WhatsApp:m.whatsapp||"" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:20},{wch:8},{wch:8},{wch:22},{wch:18}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membros ROMA");
    XLSX.writeFile(wb, "ROMA_Membros.xlsx");
  };

  return (
    <div className="card">
      <div className="card-t">
        <span>Membros</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {data.members.length > 0 && <button className="btn btn-green" onClick={exportExcel}>{Ico.download} Excel</button>}
          <button className="btn btn-blue" onClick={()=>{setShowBulk(!showBulk);setShow(false);}}>⚡ Importar em Massa</button>
          <button className="btn" onClick={()=>{setEditId(null);setForm(blank);setShow(!show);setShowBulk(false);}}>{Ico.plus} Cadastrar</button>
        </div>
      </div>

      {showBulk && (
        <div className="form-box">
          <div style={{marginBottom:8}}>
            <label style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--text-d)"}}>Colar Dados em Massa</label>
            <div style={{fontSize:".78rem",color:"var(--text-d)",marginTop:2,marginBottom:8,lineHeight:1.5}}>
              Uma linha por membro: <strong style={{color:"var(--gold)"}}>Nome, Classe, Nível</strong>.
              Aceita vírgula, tab ou ponto e vírgula. Classes em PT-BR são convertidas.
            </div>
            <textarea value={bulkText} onChange={e=>{setBulkText(e.target.value);parseBulk(e.target.value);}}
              placeholder={"A, Bárbaro, 101\nBankai, Merc., 101\nBanshi, Feiti., 101\nou use abreviações:\nA, WB, 101"}
              style={{width:"100%",minHeight:120,resize:"vertical"}} />
          </div>
          {bulkPreview.length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginBottom:6}}>
                Pré-visualização ({bulkPreview.length})
              </div>
              <div className="tbl"><table>
                <thead><tr><th>Nome</th><th>Classe</th><th>Nível</th></tr></thead>
                <tbody>
                  {bulkPreview.map((m,i)=>{
                    const isDupe=data.members.some(x=>x.name.toLowerCase()===m.name.toLowerCase());
                    return (
                      <tr key={i} style={isDupe?{opacity:.4}:{}}>
                        <td style={{fontWeight:600}}>{m.name}{isDupe&&<span style={{fontSize:".7rem",color:"var(--red-l)",marginLeft:6}}>(já existe)</span>}</td>
                        <td><span className="badge" style={{background:CLASS_COLORS[m.class]+"22",color:CLASS_COLORS[m.class],border:`1px solid ${CLASS_COLORS[m.class]}55`}}>{m.class}</span></td>
                        <td>{m.level}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={importBulk} disabled={bulkPreview.length===0}>{Ico.check} Importar {bulkPreview.length}</button>
            <button className="btn btn-d" onClick={()=>{setShowBulk(false);setBulkText("");setBulkPreview([]);}}>Cancelar</button>
          </div>
        </div>
      )}

      {show && (
        <div className="form-box">
          <div className="fr">
            <div className="fg"><label>Nome</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nick"/></div>
            <div className="fg"><label>Classe</label><select value={form.class} onChange={e=>setForm({...form,class:e.target.value})}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg" style={{maxWidth:90}}><label>Nível</label><input type="number" value={form.level} onChange={e=>setForm({...form,level:+e.target.value})}/></div>
          </div>
          <div className="fr">
            <div className="fg"><label>Cultivo</label><select value={form.cultivo} onChange={e=>setForm({...form,cultivo:e.target.value})}>{CULTIVOS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><label>WhatsApp</label><input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="(99) 99999-9999"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={submit}>{Ico.check} {editId?"Salvar":"Cadastrar"}</button>
            <button className="btn btn-d" onClick={cancel}>Cancelar</button>
          </div>
        </div>
      )}

      {data.members.length===0
        ? <div className="empty">Nenhum membro cadastrado ainda.</div>
        : <>
          <div className="tbl"><table>
            <thead><tr><th>Nome</th><th>Classe</th><th>Nível</th><th>Cultivo</th><th>WhatsApp</th><th></th></tr></thead>
            <tbody>
              {data.members.map(m=>(
                <tr key={m.id}>
                  <td style={{fontWeight:600}}>{m.name}</td>
                  <td><span className="badge" style={{background:CLASS_COLORS[m.class]+"22",color:CLASS_COLORS[m.class],border:`1px solid ${CLASS_COLORS[m.class]}55`}}>{m.class}</span></td>
                  <td>{m.level}</td>
                  <td><span className="badge b-gold">{m.cultivo}</span></td>
                  <td style={{fontSize:".85rem",color:"var(--text-d)"}}>{m.whatsapp||"—"}</td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <button className="btn btn-s" onClick={()=>startEdit(m)} style={{marginRight:4}}>{Ico.edit}</button>
                    <button className="btn btn-s btn-d" onClick={()=>remove(m.id)}>{Ico.trash}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <ClassChart members={data.members}/>
        </>
      }
    </div>
  );
}

/* ═══════════════ CLASS CHART ═══════════════ */
function ClassChart({ members }) {
  const counts = CLASSES.reduce((a,c)=>{ a[c]=members.filter(m=>m.class===c).length; return a; },{});
  const chartData = CLASSES.map(c=>({ name:c, full:CLASS_LABELS[c], count:counts[c], fill:CLASS_COLORS[c] }));
  const total = members.length;
  const ideal = total>0?Math.round(total/CLASSES.length):0;
  const emptyClasses = CLASSES.filter(c=>counts[c]===0);
  const heavyClasses = CLASSES.filter(c=>counts[c]>ideal+1 && ideal>0);

  const Tip = ({active,payload})=>{
    if(!active||!payload?.length) return null;
    const d=payload[0].payload;
    return (
      <div style={{background:"#1A1512",border:"1px solid #332B1C",borderRadius:4,padding:"8px 12px",fontFamily:"'Cinzel',serif",fontSize:".75rem"}}>
        <div style={{color:d.fill,fontWeight:700,letterSpacing:1}}>{d.name}</div>
        <div style={{color:"#E0D8C8",fontSize:".85rem"}}>{d.full}</div>
        <div style={{color:"#C9A84C",marginTop:2}}>{d.count} membro{d.count!==1?"s":""}</div>
      </div>
    );
  };

  return (
    <div style={{marginTop:16,background:"var(--bg-i)",border:"1px solid var(--border)",borderRadius:4,padding:16}}>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:".75rem",fontWeight:700,color:"var(--gold)",letterSpacing:2,textTransform:"uppercase",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span>Balanceamento de Classes</span>
        <span style={{fontSize:".6rem",color:"var(--text-d)",fontWeight:400,letterSpacing:1}}>Ideal ≈ {ideal} por classe</span>
      </div>
      <div style={{width:"100%",height:200}}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{top:5,right:5,bottom:5,left:-15}}>
            <XAxis dataKey="name" tick={{fill:"#C9A84C",fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:1}} axisLine={{stroke:"#332B1C"}} tickLine={false}/>
            <YAxis tick={{fill:"#7A7060",fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip content={<Tip/>} cursor={{fill:"rgba(201,168,76,0.05)"}}/>
            <Bar dataKey="count" radius={[3,3,0,0]} maxBarSize={45}>
              {chartData.map((e,i)=><Cell key={i} fill={e.fill} fillOpacity={e.count===0?0.15:0.85} stroke={e.fill} strokeWidth={e.count===0?1:0} strokeDasharray={e.count===0?"3 3":"0"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,justifyContent:"center"}}>
        {CLASSES.map(c=>(
          <div key={c} style={{display:"flex",alignItems:"center",gap:4,fontSize:".7rem",color:counts[c]===0?"var(--text-d)":"var(--text)"}}>
            <span style={{width:8,height:8,borderRadius:1,background:CLASS_COLORS[c],opacity:counts[c]===0?.3:1,display:"inline-block"}}/>
            <span style={{fontFamily:"'Cinzel',serif",letterSpacing:1,fontWeight:600}}>{c}</span>
            <span style={{color:"var(--text-d)"}}>({counts[c]})</span>
          </div>
        ))}
      </div>
      {(emptyClasses.length>0||heavyClasses.length>0)&&(
        <div style={{marginTop:10,padding:"8px 12px",background:"var(--bg)",borderRadius:3,fontSize:".8rem",color:"var(--text-d)",lineHeight:1.6}}>
          {emptyClasses.length>0&&<div><span style={{color:"var(--red-l)"}}>⚠ Sem membros:</span> {emptyClasses.map((c,i)=><span key={c}><span style={{color:CLASS_COLORS[c],fontWeight:600}}>{c}</span>{i<emptyClasses.length-1?", ":""}</span>)}</div>}
          {heavyClasses.length>0&&<div><span style={{color:"var(--gold)"}}>⚖ Excesso:</span> {heavyClasses.map((c,i)=><span key={c}><span style={{color:CLASS_COLORS[c],fontWeight:600}}>{c}</span> ({counts[c]}){i<heavyClasses.length-1?", ":""}</span>)}</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ EVENTS ═══════════════ */
function EventsTab({ data, save }) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showRanking, setShowRanking] = useState(true);
  const blank = {name:"",type:EVENT_TYPES[0],date:"",present:[]};
  const [form, setForm] = useState(blank);
  const submit = () => { if(!form.name.trim()||!form.date) return; save({...data,events:[...data.events,{...form,id:Date.now()}]}); setForm(blank); setShow(false); };
  const removeEv = (id) => save({...data,events:data.events.filter(e=>e.id!==id)});
  const togglePresent = (evId,mId) => {
    save({...data,events:data.events.map(e=>{ if(e.id!==evId) return e; const p=e.present||[]; return {...e,present:p.includes(mId)?p.filter(x=>x!==mId):[...p,mId]}; })});
  };
  const toggleExpand = (id) => setExpanded(e=>({...e,[id]:!e[id]}));
  const sorted=[...(data.events||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const months=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const typeBadge={"TW":"b-red","World Boss":"b-gold","Marcial":"b-blue"};

  // Attendance ranking
  const totalEvents = (data.events||[]).length;
  const ranking = data.members.map(m => {
    const attended = (data.events||[]).filter(e => (e.present||[]).includes(m.id)).length;
    return { ...m, attended, pct: totalEvents > 0 ? Math.round(attended/totalEvents*100) : 0 };
  }).sort((a,b) => b.attended - a.attended);

  // Per-type breakdown
  const getTypeCount = (m, type) => (data.events||[]).filter(e => e.type === type && (e.present||[]).includes(m.id)).length;
  const getTypeTotal = (type) => (data.events||[]).filter(e => e.type === type).length;

  return (
    <div>
      {/* RANKING CARD */}
      {data.members.length > 0 && totalEvents > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-t" style={{cursor:"pointer"}} onClick={()=>setShowRanking(!showRanking)}>
            <span style={{display:"flex",alignItems:"center",gap:8}}>{Ico.trophy} Ranking de Presença</span>
            <span style={{display:"flex",alignItems:"center",gap:8}}>
              <span className="badge b-gold">{totalEvents} eventos</span>
              {showRanking ? Ico.chevDown : Ico.chevRight}
            </span>
          </div>
          {showRanking && (
            <div className="tbl"><table>
              <thead><tr><th>#</th><th>Nome</th><th>Classe</th><th>TW</th><th>W.Boss</th><th>Marcial</th><th>Total</th><th>%</th></tr></thead>
              <tbody>
                {ranking.map((m,i)=>{
                  const twC = getTypeCount(m,"TW"), wbC = getTypeCount(m,"World Boss"), mcC = getTypeCount(m,"Marcial");
                  const twT = getTypeTotal("TW"), wbT = getTypeTotal("World Boss"), mcT = getTypeTotal("Marcial");
                  const medalColor = i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":null;
                  return (
                    <tr key={m.id}>
                      <td style={{fontFamily:"'Cinzel',serif",fontWeight:700,color:medalColor||"var(--text-d)",fontSize:medalColor?".95rem":".8rem"}}>
                        {i<3 ? ["🥇","🥈","🥉"][i] : i+1}
                      </td>
                      <td style={{fontWeight:600}}>{m.name}</td>
                      <td><span className="badge" style={{background:CLASS_COLORS[m.class]+"22",color:CLASS_COLORS[m.class],border:`1px solid ${CLASS_COLORS[m.class]}55`}}>{m.class}</span></td>
                      <td style={{fontSize:".8rem"}}>{twT>0?<span style={{color:twC>0?"var(--text)":"var(--text-d)"}}>{twC}/{twT}</span>:"—"}</td>
                      <td style={{fontSize:".8rem"}}>{wbT>0?<span style={{color:wbC>0?"var(--text)":"var(--text-d)"}}>{wbC}/{wbT}</span>:"—"}</td>
                      <td style={{fontSize:".8rem"}}>{mcT>0?<span style={{color:mcC>0?"var(--text)":"var(--text-d)"}}>{mcC}/{mcT}</span>:"—"}</td>
                      <td style={{fontWeight:600}}>{m.attended}/{totalEvents}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:50,height:6,background:"var(--border)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:m.pct+"%",height:"100%",background:m.pct>=75?"var(--green-l)":m.pct>=50?"var(--gold)":"var(--red-l)",borderRadius:3,transition:"width .3s"}}/>
                          </div>
                          <span style={{fontSize:".75rem",color:m.pct>=75?"var(--green-l)":m.pct>=50?"var(--gold)":"var(--red-l)",fontWeight:600}}>{m.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* EVENTS CARD */}
      <div className="card">
        <div className="card-t">
          <span>Presenças em Eventos</span>
          <button className="btn" onClick={()=>setShow(!show)}>{Ico.plus} Novo Evento</button>
        </div>
        {show&&(
          <div className="form-box">
            <div className="fr">
              <div className="fg"><label>Nome do Evento</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: TW vs Phoenix"/></div>
              <div className="fg"><label>Tipo</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="fg"><label>Data</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
            </div>
            <button className="btn" onClick={submit}>{Ico.check} Criar Evento</button>
          </div>
        )}
        {data.members.length===0?<div className="empty">Cadastre membros na aba Membros primeiro.</div>
          :sorted.length===0?<div className="empty">Nenhum evento criado ainda.</div>
          :sorted.map(ev=>{
            const d=new Date(ev.date+"T12:00"); const present=ev.present||[]; const presCount=present.length; const ausCount=data.members.length-presCount;
            const isOpen = expanded[ev.id];
            return (
              <div key={ev.id} style={{marginBottom:8,background:"var(--bg-i)",border:"1px solid var(--border)",borderRadius:4,overflow:"hidden"}}>
                {/* Collapsed header - always visible */}
                <div
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer",gap:8}}
                  onClick={()=>toggleExpand(ev.id)}
                >
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                    <span style={{color:"var(--text-d)",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(90deg)":"none"}}>{Ico.chevRight}</span>
                    <span style={{fontFamily:"'Cinzel',serif",fontWeight:700,fontSize:".9rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.name}</span>
                    <span className={`badge ${typeBadge[ev.type]||"b-blue"}`} style={{flexShrink:0}}>{ev.type}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <span style={{fontSize:".75rem",color:"var(--text-d)"}}>{d.getDate()} {months[d.getMonth()]}</span>
                    <span style={{fontSize:".75rem",fontWeight:600,color:presCount>0?"var(--green-l)":"var(--text-d)"}}>{presCount}/{data.members.length}</span>
                    <button className="btn btn-s btn-d" onClick={e=>{e.stopPropagation();removeEv(ev.id);}}>{Ico.trash}</button>
                  </div>
                </div>
                {/* Expanded content */}
                {isOpen && (
                  <div style={{padding:"0 14px 14px"}}>
                    <div className="pgrid">
                      {data.members.map(m=>{ const isOn=present.includes(m.id); return (
                        <div key={m.id} className={`prow ${isOn?"on":""}`} onClick={()=>togglePresent(ev.id,m.id)}>
                          <span className="ck">{isOn&&Ico.check}</span><span className="pname">{m.name}</span><span className="pclass">{m.class}</span>
                        </div>
                      );})}
                    </div>
                    <div className="att-summary">
                      <span className="att-s-item"><span className="att-s-num" style={{color:"var(--green-l)"}}>{presCount}</span>Presentes</span>
                      <span className="att-s-item"><span className="att-s-num" style={{color:"var(--red-l)"}}>{ausCount}</span>Ausentes</span>
                      <span className="att-s-item"><span className="att-s-num" style={{color:"var(--gold)"}}>{data.members.length>0?Math.round(presCount/data.members.length*100):0}%</span>Participação</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ═══════════════ TW CONTROL ═══════════════ */
function TWTab({ data, save }) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [weekLabel, setWeekLabel] = useState("");
  const createWeek = () => { if(!weekLabel.trim()) return; save({...data,twWeeks:[{id:Date.now(),label:weekLabel,confirmed:[],declined:[]},...(data.twWeeks||[])]}); setWeekLabel(""); setShow(false); };
  const removeWeek = (id) => save({...data,twWeeks:(data.twWeeks||[]).filter(w=>w.id!==id)});
  const toggleExpand = (id) => setExpanded(e=>({...e,[id]:!e[id]}));
  const togglePlayer = (wId,mId,type) => {
    save({...data,twWeeks:(data.twWeeks||[]).map(w=>{
      if(w.id!==wId) return w; const conf=w.confirmed||[]; const decl=w.declined||[];
      if(type==="confirm"){ if(conf.includes(mId)) return {...w,confirmed:conf.filter(x=>x!==mId)}; return {...w,confirmed:[...conf,mId],declined:decl.filter(x=>x!==mId)}; }
      else { if(decl.includes(mId)) return {...w,declined:decl.filter(x=>x!==mId)}; return {...w,declined:[...decl,mId],confirmed:conf.filter(x=>x!==mId)}; }
    })});
  };

  return (
    <div className="card">
      <div className="card-t">
        <span>Controle Semanal — TW</span>
        <button className="btn" onClick={()=>setShow(!show)}>{Ico.plus} Nova Semana</button>
      </div>
      {show&&(<div className="form-box"><div className="fr"><div className="fg"><label>Identificação</label><input value={weekLabel} onChange={e=>setWeekLabel(e.target.value)} placeholder="Ex: Semana 05/05 — TW vs Phoenix"/></div></div><button className="btn" onClick={createWeek}>{Ico.check} Criar</button></div>)}
      {data.members.length===0?<div className="empty">Cadastre membros primeiro.</div>
        :(data.twWeeks||[]).length===0?<div className="empty">Nenhuma semana de TW criada.</div>
        :(data.twWeeks||[]).map(week=>{
          const conf=week.confirmed||[]; const decl=week.declined||[];
          const pending=data.members.filter(m=>!conf.includes(m.id)&&!decl.includes(m.id));
          const confM=data.members.filter(m=>conf.includes(m.id));
          const declM=data.members.filter(m=>decl.includes(m.id));
          const isOpen = expanded[week.id];
          return (
            <div key={week.id} className="tw-week" style={{padding:0,overflow:"hidden"}}>
              {/* Collapsed header */}
              <div
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer",gap:8}}
                onClick={()=>toggleExpand(week.id)}
              >
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                  <span style={{color:"var(--text-d)",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(90deg)":"none"}}>{Ico.chevRight}</span>
                  <span style={{fontFamily:"'Cinzel',serif",fontWeight:700,fontSize:".85rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{week.label}</span>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
                  <span className="badge b-green">{conf.length} vão</span>
                  <span className="badge b-red">{decl.length} não vão</span>
                  <span className="badge b-gold">{pending.length} pend.</span>
                  <button className="btn btn-s btn-d" onClick={e=>{e.stopPropagation();removeWeek(week.id);}}>{Ico.trash}</button>
                </div>
              </div>
              {/* Expanded content */}
              {isOpen && (
                <div style={{padding:"0 16px 16px"}}>
                  {pending.length>0&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Aguardando ({pending.length})</div>
                      {pending.map(m=>(
                        <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:3,fontSize:".85rem"}}>
                          <span style={{flex:1,fontWeight:600}}>{m.name}</span>
                          <span style={{fontSize:".75rem",color:"var(--text-d)",marginRight:8}}>{m.class}</span>
                          <button className="btn btn-s btn-green" onClick={()=>togglePlayer(week.id,m.id,"confirm")}>✓ Vai</button>
                          <button className="btn btn-s btn-d" onClick={()=>togglePlayer(week.id,m.id,"decline")}>✗ Não vai</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="tw-cols">
                    <div>
                      <div className="tw-col-h go">Confirmados ({confM.length})</div>
                      {confM.length===0?<div style={{fontSize:".8rem",color:"var(--text-d)",fontStyle:"italic",padding:"4px 8px"}}>Ninguém confirmado</div>
                        :confM.map(m=>(<div key={m.id} className="tw-player go" onClick={()=>togglePlayer(week.id,m.id,"confirm")}><span style={{color:"var(--green-l)",marginRight:4}}>●</span><span style={{fontWeight:600,flex:1}}>{m.name}</span><span style={{fontSize:".75rem",color:"var(--text-d)"}}>{m.class}</span></div>))}
                    </div>
                    <div>
                      <div className="tw-col-h no">Não Participam ({declM.length})</div>
                      {declM.length===0?<div style={{fontSize:".8rem",color:"var(--text-d)",fontStyle:"italic",padding:"4px 8px"}}>—</div>
                        :declM.map(m=>(<div key={m.id} className="tw-player no" onClick={()=>togglePlayer(week.id,m.id,"decline")}><span style={{color:"var(--red-l)",marginRight:4}}>●</span><span style={{flex:1}}>{m.name}</span><span style={{fontSize:".75rem"}}>{m.class}</span></div>))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      }
    </div>
  );
}

/* ═══════════════ PT BUILDER ═══════════════ */
function PTBuilderTab({ data, save }) {
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [dragPlayer, setDragPlayer] = useState(null);

  const weeks = data.twWeeks || [];
  const pts = data.twPTs || {};

  // Get current week's PTs or empty
  const weekPTs = selectedWeek ? (pts[selectedWeek] || []) : [];

  // Get confirmed players for selected week
  const getConfirmed = () => {
    if (!selectedWeek) return [];
    const week = weeks.find(w => w.id === selectedWeek);
    if (!week) return [];
    return (week.confirmed || [])
      .map(id => data.members.find(m => m.id === id))
      .filter(Boolean);
  };

  // Get players NOT assigned to any PT yet
  const getUnassigned = () => {
    const confirmed = getConfirmed();
    const assigned = new Set(weekPTs.flatMap(pt => pt.players || []));
    return confirmed.filter(m => !assigned.has(m.id));
  };

  const savePTs = (newPTs) => {
    const updated = { ...pts, [selectedWeek]: newPTs };
    save({ ...data, twPTs: updated });
  };

  const createPT = () => {
    const num = weekPTs.length + 1;
    savePTs([...weekPTs, { id: Date.now(), name: "PT " + num, players: [] }]);
  };

  const removePT = (ptId) => {
    savePTs(weekPTs.filter(pt => pt.id !== ptId));
  };

  const renamePT = (ptId, name) => {
    savePTs(weekPTs.map(pt => pt.id === ptId ? { ...pt, name } : pt));
  };

  const addPlayerToPT = (ptId, memberId) => {
    savePTs(weekPTs.map(pt => {
      if (pt.id !== ptId) return pt;
      if ((pt.players || []).length >= 10) return pt;
      if ((pt.players || []).includes(memberId)) return pt;
      return { ...pt, players: [...(pt.players || []), memberId] };
    }));
  };

  const removePlayerFromPT = (ptId, memberId) => {
    savePTs(weekPTs.map(pt => {
      if (pt.id !== ptId) return pt;
      return { ...pt, players: (pt.players || []).filter(id => id !== memberId) };
    }));
  };

  const movePlayer = (fromPtId, toPtId, memberId) => {
    savePTs(weekPTs.map(pt => {
      if (pt.id === fromPtId) return { ...pt, players: (pt.players || []).filter(id => id !== memberId) };
      if (pt.id === toPtId) {
        if ((pt.players || []).length >= 10) return pt;
        return { ...pt, players: [...(pt.players || []), memberId] };
      }
      return pt;
    }));
  };

  const confirmed = getConfirmed();
  const unassigned = getUnassigned();

  // Class composition for a PT
  const getClassCount = (players) => {
    const counts = {};
    players.forEach(id => {
      const m = data.members.find(x => x.id === id);
      if (m) counts[m.class] = (counts[m.class] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="card">
      <div className="card-t">
        <span>Montar PTs — TW</span>
      </div>

      {/* Week selector */}
      {weeks.length === 0 ? (
        <div className="empty">Crie uma semana de TW na aba "Controle TW" primeiro.</div>
      ) : (
        <>
          <div style={{marginBottom:16}}>
            <label style={{fontFamily:"'Cinzel',serif",fontSize:".55rem",letterSpacing:2,textTransform:"uppercase",color:"var(--text-d)",display:"block",marginBottom:4}}>Selecionar Semana de TW</label>
            <select
              value={selectedWeek || ""}
              onChange={e => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
              style={{width:"100%",maxWidth:400}}
            >
              <option value="">— Selecione uma semana —</option>
              {weeks.map(w => (
                <option key={w.id} value={w.id}>
                  {w.label} ({(w.confirmed || []).length} confirmados)
                </option>
              ))}
            </select>
          </div>

          {selectedWeek && confirmed.length === 0 && (
            <div className="empty">Nenhum player confirmado nessa semana. Confirme jogadores na aba "Controle TW".</div>
          )}

          {selectedWeek && confirmed.length > 0 && (
            <>
              {/* Stats bar */}
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16,padding:"10px 14px",background:"var(--bg)",borderRadius:4}}>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--gold)"}}>{confirmed.length}</span>Confirmados</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--green-l)"}}>{confirmed.length - unassigned.length}</span>Alocados</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:unassigned.length > 0 ? "var(--red-l)" : "var(--green-l)"}}>{unassigned.length}</span>Sem PT</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--gold)"}}>{weekPTs.length}</span>PTs</span>
              </div>

              {/* Unassigned pool */}
              <div style={{marginBottom:16,background:"var(--bg-i)",border:"1px solid var(--border)",borderRadius:4,padding:14}}>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:".65rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>Jogadores Disponíveis ({unassigned.length})</span>
                  <button className="btn" onClick={createPT}>{Ico.plus} Nova PT</button>
                </div>
                {unassigned.length === 0 ? (
                  <div style={{fontSize:".8rem",color:"var(--text-d)",fontStyle:"italic",padding:8}}>Todos os jogadores já estão alocados em PTs.</div>
                ) : (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {unassigned.map(m => (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={() => setDragPlayer({ id: m.id, fromPt: null })}
                        onDragEnd={() => setDragPlayer(null)}
                        style={{
                          display:"flex",alignItems:"center",gap:6,padding:"6px 10px",
                          background:"var(--bg)",border:"1px solid var(--border)",borderRadius:3,
                          cursor:"grab",fontSize:".85rem",transition:"all .2s",userSelect:"none"
                        }}
                        onMouseOver={e=>e.currentTarget.style.borderColor="var(--gold-d)"}
                        onMouseOut={e=>e.currentTarget.style.borderColor="var(--border)"}
                      >
                        <span style={{width:8,height:8,borderRadius:1,background:CLASS_COLORS[m.class],display:"inline-block"}}/>
                        <span style={{fontWeight:600}}>{m.name}</span>
                        <span style={{fontSize:".65rem",color:CLASS_COLORS[m.class],fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.class}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PT Cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:12}}>
                {weekPTs.map(pt => {
                  const ptPlayers = (pt.players || []).map(id => data.members.find(m => m.id === id)).filter(Boolean);
                  const classCount = getClassCount(pt.players || []);
                  const isFull = ptPlayers.length >= 10;

                  return (
                    <div
                      key={pt.id}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = isFull ? "var(--red)" : "var(--gold)"; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = "var(--border)";
                        if (dragPlayer && !isFull) {
                          if (dragPlayer.fromPt) movePlayer(dragPlayer.fromPt, pt.id, dragPlayer.id);
                          else addPlayerToPT(pt.id, dragPlayer.id);
                          setDragPlayer(null);
                        }
                      }}
                      style={{
                        background:"var(--bg-i)",border:"1px solid var(--border)",borderRadius:4,
                        padding:14,transition:"border-color .2s",position:"relative"
                      }}
                    >
                      {/* PT Header */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:6}}>
                        <input
                          value={pt.name}
                          onChange={e => renamePT(pt.id, e.target.value)}
                          style={{
                            background:"transparent",border:"none",borderBottom:"1px solid var(--border-g)",
                            color:"var(--gold)",fontFamily:"'Cinzel',serif",fontSize:".8rem",fontWeight:700,
                            letterSpacing:2,padding:"2px 4px",flex:1,outline:"none",textTransform:"uppercase"
                          }}
                        />
                        <span style={{
                          fontFamily:"'Cinzel',serif",fontSize:".65rem",letterSpacing:1,
                          color: isFull ? "var(--green-l)" : "var(--text-d)"
                        }}>
                          {ptPlayers.length}/10
                        </span>
                        <button className="btn btn-s btn-d" onClick={() => removePT(pt.id)}>{Ico.trash}</button>
                      </div>

                      {/* Capacity bar */}
                      <div style={{width:"100%",height:3,background:"var(--border)",borderRadius:2,marginBottom:10,overflow:"hidden"}}>
                        <div style={{
                          width: (ptPlayers.length / 10 * 100) + "%",
                          height:"100%",
                          background: isFull ? "var(--green-l)" : "var(--gold)",
                          borderRadius:2,transition:"width .3s"
                        }}/>
                      </div>

                      {/* Class composition mini badges */}
                      {Object.keys(classCount).length > 0 && (
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                          {Object.entries(classCount).map(([cls, cnt]) => (
                            <span key={cls} style={{
                              fontSize:".55rem",padding:"1px 6px",borderRadius:2,
                              background:CLASS_COLORS[cls]+"18",color:CLASS_COLORS[cls],
                              border:`1px solid ${CLASS_COLORS[cls]}40`,
                              fontFamily:"'Cinzel',serif",letterSpacing:1,fontWeight:600
                            }}>
                              {cnt}x {cls}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Players list */}
                      {ptPlayers.length === 0 ? (
                        <div style={{
                          padding:20,textAlign:"center",fontSize:".8rem",color:"var(--text-d)",
                          fontStyle:"italic",border:"1px dashed var(--border-g)",borderRadius:3
                        }}>
                          Arraste jogadores aqui
                        </div>
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",gap:3}}>
                          {ptPlayers.map((m, idx) => (
                            <div
                              key={m.id}
                              draggable
                              onDragStart={() => setDragPlayer({ id: m.id, fromPt: pt.id })}
                              onDragEnd={() => setDragPlayer(null)}
                              style={{
                                display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
                                background:"var(--bg)",borderRadius:3,fontSize:".85rem",
                                cursor:"grab",transition:"all .15s",userSelect:"none"
                              }}
                              onMouseOver={e=>e.currentTarget.style.background="var(--bg-h)"}
                              onMouseOut={e=>e.currentTarget.style.background="var(--bg)"}
                            >
                              <span style={{
                                width:16,height:16,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",
                                background:"var(--border)",fontSize:".6rem",color:"var(--text-d)",fontFamily:"'Cinzel',serif",flexShrink:0
                              }}>
                                {idx + 1}
                              </span>
                              <span style={{width:8,height:8,borderRadius:1,background:CLASS_COLORS[m.class],display:"inline-block",flexShrink:0}}/>
                              <span style={{fontWeight:600,flex:1}}>{m.name}</span>
                              <span style={{fontSize:".65rem",color:CLASS_COLORS[m.class],fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.class}</span>
                              <button
                                onClick={() => removePlayerFromPT(pt.id, m.id)}
                                style={{background:"none",border:"none",color:"var(--red-l)",cursor:"pointer",padding:2,opacity:.5,fontSize:".7rem"}}
                                onMouseOver={e=>e.currentTarget.style.opacity="1"}
                                onMouseOut={e=>e.currentTarget.style.opacity=".5"}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick add: click to add from unassigned */}
                      {!isFull && unassigned.length > 0 && (
                        <div style={{marginTop:8}}>
                          <select
                            value=""
                            onChange={e => { if (e.target.value) addPlayerToPT(pt.id, Number(e.target.value)); }}
                            style={{width:"100%",fontSize:".8rem",padding:"4px 8px"}}
                          >
                            <option value="">+ Adicionar jogador...</option>
                            {unassigned.map(m => (
                              <option key={m.id} value={m.id}>[{m.class}] {m.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add PT button when no PTs yet */}
              {weekPTs.length === 0 && (
                <div style={{textAlign:"center",padding:20}}>
                  <button className="btn" onClick={createPT}>{Ico.plus} Criar Primeira PT</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════ ACCOUNTS ═══════════════ */
function AccountsTab({ data, save }) {
  const [show, setShow] = useState(false);
  const [reveals, setReveals] = useState({});
  const blank = {charName:"",class:CLASSES[0],borrower:"",since:"",notes:"",login:"",senha:""};
  const [form, setForm] = useState(blank);
  const submit = () => {
    if(!form.charName.trim()||!form.borrower.trim()) return;
    save({...data,lentAccounts:[...(data.lentAccounts||[]),{...form,id:Date.now(),since:form.since||new Date().toISOString().split("T")[0]}]});
    setForm(blank); setShow(false);
  };
  const remove = (id) => save({...data,lentAccounts:(data.lentAccounts||[]).filter(a=>a.id!==id)});
  const toggleReveal = (id) => setReveals(r=>({...r,[id]:!r[id]}));

  return (
    <div className="card">
      <div className="card-t">
        <span>Contas Emprestadas</span>
        <button className="btn" onClick={()=>setShow(!show)}>{Ico.plus} Registrar</button>
      </div>
      {show&&(
        <div className="form-box">
          <div className="fr">
            <div className="fg"><label>Nome do Char</label><input value={form.charName} onChange={e=>setForm({...form,charName:e.target.value})} placeholder="Personagem"/></div>
            <div className="fg"><label>Classe</label><select value={form.class} onChange={e=>setForm({...form,class:e.target.value})}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><label>Emprestado Para</label><input value={form.borrower} onChange={e=>setForm({...form,borrower:e.target.value})} placeholder="Quem vai usar"/></div>
          </div>
          <div className="fr">
            <div className="fg"><label>Login da Conta</label><input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="E-mail ou login"/></div>
            <div className="fg"><label>Senha da Conta</label><input value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Senha" type="password"/></div>
          </div>
          <div className="fr">
            <div className="fg"><label>Desde</label><input type="date" value={form.since} onChange={e=>setForm({...form,since:e.target.value})}/></div>
            <div className="fg" style={{flex:2}}><label>Observação</label><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Motivo"/></div>
          </div>
          <button className="btn" onClick={submit}>{Ico.check} Registrar</button>
        </div>
      )}
      {(data.lentAccounts||[]).length===0?<div className="empty">Nenhuma conta emprestada no momento.</div>
        :<div className="tbl"><table>
          <thead><tr><th>Char</th><th>Classe</th><th>Usando</th><th>Login</th><th>Senha</th><th>Desde</th><th>Obs</th><th></th></tr></thead>
          <tbody>
            {(data.lentAccounts||[]).map(a=>(
              <tr key={a.id}>
                <td style={{fontWeight:600}}>{a.charName}</td>
                <td><span className="badge" style={{background:CLASS_COLORS[a.class]+"22",color:CLASS_COLORS[a.class],border:`1px solid ${CLASS_COLORS[a.class]}55`}}>{a.class}</span></td>
                <td>{a.borrower}</td>
                <td style={{fontSize:".85rem",fontFamily:"monospace",color:"var(--text-d)"}}>{a.login||"—"}</td>
                <td>{a.senha?(<div className="pw-wrap">{reveals[a.id]?<span style={{fontFamily:"monospace",fontSize:".85rem"}}>{a.senha}</span>:<span className="pw-mask">••••••</span>}<button className="pw-toggle" onClick={()=>toggleReveal(a.id)}>{reveals[a.id]?Ico.eyeOff:Ico.eye}</button></div>):"—"}</td>
                <td style={{color:"var(--text-d)",fontSize:".85rem"}}>{a.since}</td>
                <td style={{color:"var(--text-d)",fontStyle:"italic",fontSize:".85rem"}}>{a.notes||"—"}</td>
                <td><button className="btn btn-s btn-d" onClick={()=>remove(a.id)}>Devolver</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      }
    </div>
  );
}

/* ═══════════════ STAFF MANAGEMENT ═══════════════ */
function StaffTab() {
  const [accounts, setAccounts] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({user:"",pass:""});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [reveals, setReveals] = useState({});

  useEffect(() => {
    (async () => {
      try { const s = await storage.get(AUTH_KEY); if(s?.value) setAccounts(JSON.parse(s.value)); } catch {}
    })();
  }, []);

  const saveAccounts = async (accs) => { setAccounts(accs); await storage.save(AUTH_KEY, accs); };

  const addStaff = async () => {
    if(!form.user.trim()||!form.pass.trim()){ setErr("Preencha usuário e senha."); return; }
    if(form.pass.length<4){ setErr("Mínimo 4 caracteres."); return; }
    if(accounts.find(a=>a.user===form.user.trim())){ setErr("Usuário já existe."); return; }
    await saveAccounts([...accounts,{user:form.user.trim(),pass:form.pass,role:"staff"}]);
    setOk("Staff \""+form.user.trim()+"\" criado!"); setErr(""); setForm({user:"",pass:""}); setShow(false);
    setTimeout(()=>setOk(""),3000);
  };

  const removeStaff = async (u) => await saveAccounts(accounts.filter(a=>a.user!==u));
  const toggleReveal = (u) => setReveals(r=>({...r,[u]:!r[u]}));

  return (
    <div className="card">
      <div className="card-t">
        <span>Gerenciar Staff</span>
        <button className="btn" onClick={()=>{setShow(!show);setErr("");setOk("");}}>{Ico.plus} Nova Conta</button>
      </div>
      {ok&&<div style={{color:"var(--green-l)",fontSize:".85rem",marginBottom:10,padding:"8px 12px",background:"rgba(56,121,74,.08)",borderRadius:3}}>{ok}</div>}
      {show&&(
        <div className="form-box">
          {err&&<div style={{color:"var(--red-l)",fontSize:".85rem",marginBottom:8}}>{err}</div>}
          <div className="fr">
            <div className="fg"><label>Usuário</label><input value={form.user} onChange={e=>setForm({...form,user:e.target.value})} placeholder="Login do staff"/></div>
            <div className="fg"><label>Senha</label><input value={form.pass} onChange={e=>setForm({...form,pass:e.target.value})} placeholder="Mínimo 4 caracteres"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={addStaff}>{Ico.check} Criar Conta Staff</button>
            <button className="btn btn-d" onClick={()=>{setShow(false);setErr("");}}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="tbl"><table>
        <thead><tr><th>Usuário</th><th>Senha</th><th>Acesso</th><th></th></tr></thead>
        <tbody>
          {accounts.map(a=>(
            <tr key={a.user}>
              <td style={{fontWeight:600}}>{a.user}</td>
              <td><div className="pw-wrap">{reveals[a.user]?<span style={{fontFamily:"monospace",fontSize:".85rem"}}>{a.pass}</span>:<span className="pw-mask">••••••</span>}<button className="pw-toggle" onClick={()=>toggleReveal(a.user)}>{reveals[a.user]?Ico.eyeOff:Ico.eye}</button></div></td>
              <td><span className={"badge "+(a.role==="admin"?"b-gold":"b-blue")}>{a.role==="admin"?"ADMIN":"STAFF"}</span></td>
              <td>{a.role!=="admin"&&<button className="btn btn-s btn-d" onClick={()=>removeStaff(a.user)}>{Ico.trash} Remover</button>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div style={{marginTop:12,padding:"10px 12px",background:"var(--bg)",borderRadius:3,fontSize:".8rem",color:"var(--text-d)",lineHeight:1.6}}>
        Apenas o <strong style={{color:"var(--gold)"}}>ADMIN</strong> pode criar e remover contas de staff.
      </div>
    </div>
  );
}
