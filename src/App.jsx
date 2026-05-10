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

// Firebase converts arrays to objects with numeric keys — convert back
function toArr(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every(k => !isNaN(k))) return Object.values(val);
  }
  return [];
}

// Ensure all fields exist and are proper arrays
function sanitize(d) {
  if (!d || typeof d !== "object") return { ...DEFAULT_DATA };
  const members = toArr(d.members).map(m => ({
    ...m,
    id: m.id || Date.now(),
    name: m.name || "",
    class: m.class || "WR",
    level: m.level || 100,
    cultivo: m.cultivo || "Nenhum",
    whatsapp: m.whatsapp || "",
    obs: m.obs || "",
  }));
  const events = toArr(d.events).map(e => ({
    ...e,
    id: e.id || Date.now(),
    name: e.name || "",
    type: e.type || "TW",
    date: e.date || "",
    present: toArr(e.present),
  }));
  const twWeeks = toArr(d.twWeeks).map(w => ({
    ...w,
    id: w.id || Date.now(),
    label: w.label || "",
    confirmed: toArr(w.confirmed),
    declined: toArr(w.declined),
  }));
  const lentAccounts = toArr(d.lentAccounts).map(a => ({
    ...a,
    id: a.id || Date.now(),
  }));
  const twPTs = d.twPTs && typeof d.twPTs === "object" && !Array.isArray(d.twPTs) ? d.twPTs : {};
  // Also sanitize PT players inside twPTs
  Object.keys(twPTs).forEach(key => {
    twPTs[key] = toArr(twPTs[key]).map(pt => ({
      ...pt,
      id: pt.id || Date.now(),
      name: pt.name || "PT",
      players: toArr(pt.players),
    }));
  });
  return {
    members, events, twWeeks, lentAccounts, twPTs,
    logs: toArr(d.logs || []),
    insignias: {
      queue: toArr(d.insignias?.queue || []),
      delivered: toArr(d.insignias?.delivered || []),
    },
  };
}

// Safe class color (fallback for unknown classes)
function cc(cls) { return CLASS_COLORS[cls] || "#7A7060"; }


/* ═══════════════ LOGIN ═══════════════ */
function LoginScreen({ onLogin, onPlayerView }) {
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
        {mode === "login" && (
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border-g)"}}>
            <div style={{fontSize:".75rem",color:"var(--text-d)",marginBottom:8}}>Não é staff?</div>
            <button className="lbtn" onClick={onPlayerView} style={{background:"rgba(58,90,122,.1)",borderColor:"rgba(58,90,122,.3)",color:"#6A9FBF"}}>
              Sou Membro do Clã
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN APP ═══════════════ */
export default function App() {
  const [auth, setAuth] = useState(null);
  const [playerView, setPlayerView] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("members");
  const [loading, setLoading] = useState(true);

  const isActive = auth || playerView;

  useEffect(() => {
    if (!isActive) return;
    const timeout = setTimeout(() => { setData(DEFAULT_DATA); setLoading(false); }, 4000);

    const unsubscribe = storage.subscribe(DATA_KEY, (val) => {
      setData(sanitize(val));
      setLoading(false);
      clearTimeout(timeout);
    });

    (async () => {
      try {
        const s = await storage.get(DATA_KEY);
        if (s?.value) setData(sanitize(JSON.parse(s.value)));
        else setData({ ...DEFAULT_DATA });
      } catch { setData({ ...DEFAULT_DATA }); }
      setLoading(false);
      clearTimeout(timeout);
    })();

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, [isActive]);

  const save = useCallback(async (d, logMsg) => {
    let updated = d;
    if (logMsg && auth) {
      const logs = toArr(d.logs || []);
      const entry = { ts: new Date().toISOString(), user: auth.user, action: logMsg };
      // Keep last 200 logs
      updated = { ...d, logs: [entry, ...logs].slice(0, 200) };
    }
    setData(updated);
    await storage.save(DATA_KEY, updated);
  }, [auth]);

  if (!isActive) return <LoginScreen onLogin={setAuth} onPlayerView={()=>setPlayerView(true)} />;

  if (loading || !data) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",color:"var(--gold)",fontFamily:"'Cinzel',serif",letterSpacing:4,fontSize:".9rem"}}>
      Carregando...
    </div>
  );

  if (playerView) return <PlayerView data={data} onBack={()=>{setPlayerView(false);setData(null);setLoading(true);}} />;

  const tabs = [
    { id:"members", label:"Membros", icon:Ico.users },
    { id:"events", label:"Presenças", icon:Ico.cal },
    { id:"tw", label:"Controle TW", icon:Ico.shield },
    { id:"pts", label:"Montar PTs", icon:Ico.swords },
    { id:"accounts", label:"Contas", icon:Ico.key },
    { id:"insignias", label:"Insígnias", icon:Ico.medal },
    ...(auth.isAdmin ? [{ id:"logs", label:"Logs", icon:Ico.clock }] : []),
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
      {tab==="insignias" && <InsigniasTab data={data} save={save}/>}
      {tab==="logs" && auth.isAdmin && <LogsTab data={data} save={save}/>}
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
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const blank = {name:"",class:CLASSES[0],level:100,cultivo:CULTIVOS[0],whatsapp:"",obs:""};
  const [form, setForm] = useState(blank);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const sortedMembers = [...data.members].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "class") cmp = (a.class||"").localeCompare(b.class||"");
    else if (sortCol === "level") cmp = (a.level||0) - (b.level||0);
    else if (sortCol === "cultivo") cmp = (a.cultivo||"").localeCompare(b.cultivo||"");
    else cmp = (a.name||"").localeCompare(b.name||"");
    return sortDir === "asc" ? cmp : -cmp;
  });
  const SortIco = ({ col }) => {
    if (sortCol !== col) return <span style={{opacity:.3,fontSize:".55rem"}}>⇅</span>;
    return <span style={{fontSize:".55rem"}}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };
  const classCounts = CLASSES.reduce((a, c) => { a[c] = data.members.filter(m => m.class === c).length; return a; }, {});

  // Sync roster (name-only)
  const [showSync, setShowSync] = useState(false);
  const [syncText, setSyncText] = useState("");
  const [syncResult, setSyncResult] = useState(null);

  // Bulk removal
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sortedMembers.length) setSelected(new Set());
    else setSelected(new Set(sortedMembers.map(m => m.id)));
  };

  const removeSelected = () => {
    if (selected.size === 0) return;
    const removeIds = selected;
    save({
      ...data,
      members: data.members.filter(m => !removeIds.has(m.id)),
      events: (data.events || []).map(e => ({ ...e, present: (e.present || []).filter(id => !removeIds.has(id)) })),
      twWeeks: (data.twWeeks || []).map(w => ({
        ...w,
        confirmed: (w.confirmed || []).filter(id => !removeIds.has(id)),
        declined: (w.declined || []).filter(id => !removeIds.has(id)),
      })),
      lentAccounts: (data.lentAccounts || []).filter(a => !removeIds.has(a.memberId)),
    }, `Removeu ${removeIds.size} membros em massa`);
    setSelected(new Set());
    setSelectMode(false);
  };

  const parseSync = (text) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    // Accept: just names, or name,class,level
    const parsed = lines.map(line => {
      const parts = line.split(/[\t;,]+/).map(s => s.trim());
      if (!parts[0]) return null;
      return { name: parts[0], class: resolveClass(parts[1] || ""), level: parseInt(parts[2]) || 100 };
    }).filter(Boolean);

    const pastedNames = new Set(parsed.map(p => p.name.toLowerCase()));
    const existingNames = new Set(data.members.map(m => m.name.toLowerCase()));

    const newPlayers = parsed.filter(p => !existingNames.has(p.name.toLowerCase()));
    const leftPlayers = data.members.filter(m => !pastedNames.has(m.name.toLowerCase()));
    const stayPlayers = data.members.filter(m => pastedNames.has(m.name.toLowerCase()));

    setSyncResult({ newPlayers, leftPlayers, stayPlayers, totalPasted: parsed.length });
  };

  const applySync = (addNew, removeLeft) => {
    if (!syncResult) return;
    let newMembers = [...data.members];
    let newEvents = [...(data.events || [])];
    let newTwWeeks = [...(data.twWeeks || [])];

    if (removeLeft && syncResult.leftPlayers.length > 0) {
      const removeIds = new Set(syncResult.leftPlayers.map(m => m.id));
      newMembers = newMembers.filter(m => !removeIds.has(m.id));
      newEvents = newEvents.map(e => ({ ...e, present: (e.present || []).filter(id => !removeIds.has(id)) }));
      newTwWeeks = newTwWeeks.map(w => ({
        ...w,
        confirmed: (w.confirmed || []).filter(id => !removeIds.has(id)),
        declined: (w.declined || []).filter(id => !removeIds.has(id)),
      }));
    }

    if (addNew && syncResult.newPlayers.length > 0) {
      const additions = syncResult.newPlayers.map((p, i) => ({
        name: p.name, class: p.class, level: p.level,
        cultivo: CULTIVOS[0], whatsapp: "", id: Date.now() + i
      }));
      newMembers = [...newMembers, ...additions];
    }

    save({ ...data, members: newMembers, events: newEvents, twWeeks: newTwWeeks },
      `Sincronizou lista${addNew && syncResult.newPlayers.length > 0 ? ` (+${syncResult.newPlayers.length} novos)` : ""}${removeLeft && syncResult.leftPlayers.length > 0 ? ` (-${syncResult.leftPlayers.length} removidos)` : ""}`);
    setSyncText(""); setSyncResult(null); setShowSync(false);
  };

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
    save({ ...data, members: [...data.members, ...newMembers] }, `Importou ${newMembers.length} membros em massa`);
    setBulkText(""); setBulkPreview([]); setShowBulk(false);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    if (editId) {
      save({...data,members:data.members.map(m=>m.id===editId?{...m,...form}:m)}, `Editou membro "${form.name}"`);
      setEditId(null);
    } else {
      save({...data,members:[...data.members,{...form,id:Date.now()}]}, `Cadastrou membro "${form.name}" (${form.class})`);
    }
    setForm(blank); setShow(false);
  };

  const startEdit = (m) => { setForm({name:m.name,class:m.class,level:m.level,cultivo:m.cultivo,whatsapp:m.whatsapp,obs:m.obs||""}); setEditId(m.id); setShow(false); };
  const remove = (id) => {
    const m = data.members.find(x => x.id === id);
    save({
      ...data,
      members:data.members.filter(m=>m.id!==id),
      events:(data.events||[]).map(e=>({...e,present:(e.present||[]).filter(p=>p!==id)})),
      twWeeks:(data.twWeeks||[]).map(w=>({...w,confirmed:(w.confirmed||[]).filter(p=>p!==id),declined:(w.declined||[]).filter(p=>p!==id)})),
      lentAccounts:(data.lentAccounts||[]).filter(a=>a.memberId!==id),
    }, `Removeu membro "${m?.name||id}"`);
  };

  const sendToLend = (m) => {
    const already = (data.lentAccounts||[]).some(a => a.memberId === m.id);
    if (already) return;
    const newAccount = {
      id: Date.now(),
      memberId: m.id,
      charName: m.name,
      class: m.class,
      borrower: "",
      login: "",
      senha: "",
      since: new Date().toISOString().split("T")[0],
      notes: "",
      status: "disponivel",
    };
    save({ ...data, lentAccounts: [...(data.lentAccounts||[]), newAccount] }, `Disponibilizou "${m.name}" para 0800`);
  };

  const isLent = (id) => (data.lentAccounts||[]).some(a => a.memberId === id);
  const cancel = () => { setForm(blank); setEditId(null); setShow(false); };

  const exportExcel = () => {
    if (data.members.length === 0) return;
    const rows = data.members.map(m => ({ Nome:m.name, Classe:m.class, "Nível":m.level, Cultivo:m.cultivo, WhatsApp:m.whatsapp||"", Obs:m.obs||"" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:20},{wch:8},{wch:8},{wch:22},{wch:18},{wch:12}];
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
          <button className="btn" style={{borderColor:"rgba(201,168,76,.4)",color:"var(--gold-b)",background:"rgba(201,168,76,.08)"}} onClick={()=>{setShowSync(!showSync);setShow(false);setShowBulk(false);setSyncResult(null);setSyncText("");}}>🔄 Sincronizar</button>
          {data.members.length > 0 && <button className={`btn ${selectMode?"btn-d":"btn-blue"}`} onClick={()=>{setSelectMode(!selectMode);setSelected(new Set());}}>{selectMode?"✗ Cancelar Seleção":"☑ Selecionar p/ Remover"}</button>}
          <button className="btn btn-blue" onClick={()=>{setShowBulk(!showBulk);setShow(false);setShowSync(false);}}>⚡ Importar em Massa</button>
          <button className="btn" onClick={()=>{setEditId(null);setForm(blank);setShow(!show);setShowBulk(false);setShowSync(false);}}>{Ico.plus} Cadastrar</button>
        </div>
      </div>

      {/* SYNC ROSTER */}
      {showSync && (
        <div className="form-box">
          <div style={{marginBottom:8}}>
            <label style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)"}}>Sincronizar com Lista Atual do Clã</label>
            <div style={{fontSize:".78rem",color:"var(--text-d)",marginTop:2,marginBottom:8,lineHeight:1.6}}>
              Cole a lista <strong style={{color:"var(--gold)"}}>completa e atual</strong> de membros do clã.
              Aceita <strong style={{color:"var(--text)"}}>só nomes</strong> (um por linha) ou <strong style={{color:"var(--text)"}}>Nome, Classe, Nível</strong>.
              <br/>O sistema compara e mostra quem <span style={{color:"var(--green-l)"}}>entrou</span> e quem <span style={{color:"var(--red-l)"}}>saiu</span>.
            </div>

            <textarea
              value={syncText}
              onChange={e => { setSyncText(e.target.value); if (e.target.value.trim()) parseSync(e.target.value); else setSyncResult(null); }}
              placeholder={"Cole a lista completa do clã aqui:\nbolo\nSupri\nTunico\nNikzinhuuum\n\nOu com classe e nível:\nbolo, WB, 101\nSupri, EA, 101"}
              style={{width:"100%",minHeight:140,resize:"vertical"}}
            />
          </div>

          {syncResult && (
            <div>
              {/* Summary */}
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12,padding:"10px 14px",background:"var(--bg)",borderRadius:4}}>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--gold)"}}>{syncResult.totalPasted}</span>Na lista</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--text)"}}>{syncResult.stayPlayers.length}</span>Permanecem</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--green-l)"}}>{syncResult.newPlayers.length}</span>Novos</span>
                <span className="att-s-item"><span className="att-s-num" style={{color:"var(--red-l)"}}>{syncResult.leftPlayers.length}</span>Saíram</span>
              </div>

              {/* New players */}
              {syncResult.newPlayers.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--green-l)",marginBottom:6,paddingBottom:4,borderBottom:"1px solid rgba(56,121,74,.3)"}}>
                    Novos Membros ({syncResult.newPlayers.length})
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:4}}>
                    {syncResult.newPlayers.map((p, i) => (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"rgba(56,121,74,.08)",border:"1px solid rgba(56,121,74,.2)",borderRadius:3,fontSize:".82rem"}}>
                        <span style={{color:"var(--green-l)",fontSize:".7rem",flexShrink:0}}>+</span>
                        <span style={{fontWeight:600,flex:1}}>{p.name}</span>
                        <span style={{fontSize:".6rem",color:cc(p.class),fontFamily:"'Cinzel',serif",letterSpacing:1}}>{p.class}</span>
                        <span style={{fontSize:".75rem",color:"var(--text-d)"}}>{p.level}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Left players */}
              {syncResult.leftPlayers.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--red-l)",marginBottom:6,paddingBottom:4,borderBottom:"1px solid rgba(155,44,44,.3)"}}>
                    Saíram do Clã ({syncResult.leftPlayers.length})
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:4}}>
                    {syncResult.leftPlayers.map(m => (
                      <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"rgba(155,44,44,.06)",border:"1px solid rgba(155,44,44,.2)",borderRadius:3,fontSize:".82rem",opacity:.8}}>
                        <span style={{color:"var(--red-l)",fontSize:".7rem",flexShrink:0}}>−</span>
                        <span style={{fontWeight:600,flex:1}}>{m.name}</span>
                        <span style={{fontSize:".6rem",color:cc(m.class),fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.class}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {syncResult.newPlayers.length === 0 && syncResult.leftPlayers.length === 0 && (
                <div style={{padding:16,textAlign:"center",color:"var(--green-l)",fontSize:".85rem"}}>
                  ✓ A lista está sincronizada! Nenhuma mudança detectada.
                </div>
              )}

              {/* Action buttons */}
              {(syncResult.newPlayers.length > 0 || syncResult.leftPlayers.length > 0) && (
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                  <button className="btn btn-green" onClick={() => applySync(true, true)}>
                    {Ico.check} Aplicar Tudo ({syncResult.newPlayers.length > 0 ? `+${syncResult.newPlayers.length}` : ""}{syncResult.newPlayers.length > 0 && syncResult.leftPlayers.length > 0 ? " / " : ""}{syncResult.leftPlayers.length > 0 ? `-${syncResult.leftPlayers.length}` : ""})
                  </button>
                  {syncResult.newPlayers.length > 0 && syncResult.leftPlayers.length > 0 && (
                    <>
                      <button className="btn" style={{borderColor:"rgba(56,121,74,.4)",color:"var(--green-l)"}} onClick={() => applySync(true, false)}>
                        Só adicionar novos (+{syncResult.newPlayers.length})
                      </button>
                      <button className="btn btn-d" onClick={() => applySync(false, true)}>
                        Só remover quem saiu (−{syncResult.leftPlayers.length})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="btn btn-d" onClick={() => { setShowSync(false); setSyncText(""); setSyncResult(null); }}>Cancelar</button>
          </div>
        </div>
      )}

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
                        <td><span className="badge" style={{background:cc(m.class)+"22",color:cc(m.class),border:`1px solid ${cc(m.class)}55`}}>{m.class}</span></td>
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

      {show && !editId && (
        <div className="form-box">
          <div className="fr">
            <div className="fg"><label>Nome</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nick"/></div>
            <div className="fg"><label>Classe</label><select value={form.class} onChange={e=>setForm({...form,class:e.target.value})}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg" style={{maxWidth:90}}><label>Nível</label><input type="number" value={form.level} onChange={e=>setForm({...form,level:+e.target.value})}/></div>
          </div>
          <div className="fr">
            <div className="fg"><label>Cultivo</label><select value={form.cultivo} onChange={e=>setForm({...form,cultivo:e.target.value})}>{CULTIVOS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><label>WhatsApp</label><input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="(99) 99999-9999"/></div>
            <div className="fg"><label>Obs</label><input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} placeholder="Ex: SEC"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={submit}>{Ico.check} Cadastrar</button>
            <button className="btn btn-d" onClick={cancel}>Cancelar</button>
          </div>
        </div>
      )}

      {data.members.length===0
        ? <div className="empty">Nenhum membro cadastrado ainda.</div>
        : <>
          {/* CLASS SUMMARY */}
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14,padding:"10px 14px",background:"var(--bg)",borderRadius:4}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginRight:4}}>
              <span style={{fontSize:"1.2rem",fontWeight:700,marginRight:4}}>{data.members.length}</span>membros
            </div>
            <div style={{width:1,height:24,background:"var(--border-g)"}}/>
            {CLASSES.map(c => classCounts[c] > 0 && (
              <div key={c} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:10,borderRadius:2,background:cc(c),display:"inline-block"}}/>
                <span style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",fontWeight:700,color:cc(c),letterSpacing:1}}>{c}</span>
                <span style={{fontSize:".8rem",fontWeight:600,color:"var(--text)"}}>{classCounts[c]}</span>
              </div>
            ))}
          </div>
          {/* Bulk removal bar */}
          {selectMode && (
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,padding:"10px 14px",background:"rgba(155,44,44,.08)",border:"1px solid rgba(155,44,44,.25)",borderRadius:4,flexWrap:"wrap"}}>
              <button className="btn btn-s" onClick={selectAll} style={{color:"var(--gold)"}}>
                {selected.size === sortedMembers.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </button>
              <span style={{fontSize:".8rem",color:"var(--text-d)",flex:1}}>
                <strong style={{color:"var(--red-l)"}}>{selected.size}</strong> selecionado{selected.size !== 1 ? "s" : ""}
              </span>
              {selected.size > 0 && (
                <button className="btn btn-d" onClick={removeSelected}>
                  {Ico.trash} Remover {selected.size} membro{selected.size !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
          <div className="tbl"><table>
            <thead><tr>
              {selectMode && <th style={{width:30}}></th>}
              <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>handleSort("name")}>Nome <SortIco col="name"/></th>
              <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>handleSort("class")}>Classe <SortIco col="class"/></th>
              <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>handleSort("level")}>Nível <SortIco col="level"/></th>
              <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>handleSort("cultivo")}>Cultivo <SortIco col="cultivo"/></th>
              <th>WhatsApp</th>
              <th>Obs</th>
              {!selectMode && <th></th>}
            </tr></thead>
            <tbody>
              {sortedMembers.map(m=>{
                const isEditing = editId === m.id;
                return (
                <tr key={m.id}
                  onClick={selectMode ? ()=>toggleSelect(m.id) : undefined}
                  style={selectMode ? {cursor:"pointer"} : isEditing ? {background:"rgba(201,168,76,.05)"} : {}}
                >
                  {selectMode && <td>
                    <span style={{
                      width:18,height:18,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",
                      background: selected.has(m.id) ? "var(--red)" : "var(--bg-i)",
                      border: `1.5px solid ${selected.has(m.id) ? "var(--red-l)" : "var(--border-g)"}`,
                      transition:"all .15s"
                    }}>{selected.has(m.id) && Ico.check}</span>
                  </td>}

                  {isEditing ? (
                    <>
                      <td><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:"4px 6px",fontSize:".85rem"}}/></td>
                      <td><select value={form.class} onChange={e=>setForm({...form,class:e.target.value})} style={{padding:"4px 4px",fontSize:".8rem"}}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></td>
                      <td><input type="number" value={form.level} onChange={e=>setForm({...form,level:+e.target.value})} style={{width:60,padding:"4px 6px",fontSize:".85rem"}}/></td>
                      <td><select value={form.cultivo} onChange={e=>setForm({...form,cultivo:e.target.value})} style={{padding:"4px 4px",fontSize:".75rem"}}>{CULTIVOS.map(c=><option key={c}>{c}</option>)}</select></td>
                      <td><input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="(99) 99999-9999" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
                      <td><input value={form.obs||""} onChange={e=>setForm({...form,obs:e.target.value})} placeholder="Ex: SEC" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <button className="btn btn-s btn-green" onClick={submit} style={{marginRight:4}}>{Ico.check}</button>
                        <button className="btn btn-s btn-d" onClick={cancel}>✗</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{fontWeight:600}}>{m.name}</td>
                      <td><span className="badge" style={{background:cc(m.class)+"22",color:cc(m.class),border:`1px solid ${cc(m.class)}55`}}>{m.class}</span></td>
                      <td>{m.level}</td>
                      <td><span className="badge b-gold">{m.cultivo}</span></td>
                      <td style={{fontSize:".85rem",color:"var(--text-d)"}}>{m.whatsapp||"—"}</td>
                      <td style={{fontSize:".82rem",color:m.obs?"var(--gold)":"var(--text-d)",fontWeight:m.obs?600:400}}>{m.obs||"—"}</td>
                      {!selectMode && <td style={{whiteSpace:"nowrap"}}>
                        <button className="btn btn-s" onClick={()=>startEdit(m)} style={{marginRight:4}}>{Ico.edit}</button>
                        {!isLent(m.id)
                          ? <button className="btn btn-s" style={{marginRight:4,borderColor:"rgba(201,168,76,.4)",color:"var(--gold)",background:"rgba(201,168,76,.08)",fontSize:".5rem"}} onClick={()=>sendToLend(m)} title="Disponibilizar para 0800">{Ico.key}</button>
                          : <span className="badge b-gold" style={{fontSize:".45rem",marginRight:4,verticalAlign:"middle"}}>0800</span>
                        }
                        <button className="btn btn-s btn-d" onClick={()=>remove(m.id)}>{Ico.trash}</button>
                      </td>}
                    </>
                  )}
                </tr>
              );})}
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
  const chartData = CLASSES.map(c=>({ name:c, full:CLASS_LABELS[c], count:counts[c], fill:cc(c) }));
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
            <span style={{width:8,height:8,borderRadius:1,background:cc(c),opacity:counts[c]===0?.3:1,display:"inline-block"}}/>
            <span style={{fontFamily:"'Cinzel',serif",letterSpacing:1,fontWeight:600}}>{c}</span>
            <span style={{color:"var(--text-d)"}}>({counts[c]})</span>
          </div>
        ))}
      </div>
      {(emptyClasses.length>0||heavyClasses.length>0)&&(
        <div style={{marginTop:10,padding:"8px 12px",background:"var(--bg)",borderRadius:3,fontSize:".8rem",color:"var(--text-d)",lineHeight:1.6}}>
          {emptyClasses.length>0&&<div><span style={{color:"var(--red-l)"}}>⚠ Sem membros:</span> {emptyClasses.map((c,i)=><span key={c}><span style={{color:cc(c),fontWeight:600}}>{c}</span>{i<emptyClasses.length-1?", ":""}</span>)}</div>}
          {heavyClasses.length>0&&<div><span style={{color:"var(--gold)"}}>⚖ Excesso:</span> {heavyClasses.map((c,i)=><span key={c}><span style={{color:cc(c),fontWeight:600}}>{c}</span> ({counts[c]}){i<heavyClasses.length-1?", ":""}</span>)}</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ ATTENDANCE PANEL ═══════════════ */
function AttendancePanel({ members, present, onToggle, onBulkToggle }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState(null);
  const [showMode, setShowMode] = useState("all"); // all, present, absent

  const presSet = new Set(present);
  const presCount = members.filter(m => presSet.has(m.id)).length;
  const ausCount = members.length - presCount;

  // Filter members
  const filtered = members.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (classFilter && m.class !== classFilter) return false;
    if (showMode === "present" && !presSet.has(m.id)) return false;
    if (showMode === "absent" && presSet.has(m.id)) return false;
    return true;
  });

  // Sort: present first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const aP = presSet.has(a.id) ? 0 : 1;
    const bP = presSet.has(b.id) ? 0 : 1;
    if (aP !== bP) return aP - bP;
    return a.name.localeCompare(b.name);
  });

  const filteredIds = filtered.map(m => m.id);
  const filteredAbsentIds = filtered.filter(m => !presSet.has(m.id)).map(m => m.id);
  const filteredPresentIds = filtered.filter(m => presSet.has(m.id)).map(m => m.id);

  // Class counts for filter buttons
  const classCounts = CLASSES.reduce((a, c) => { a[c] = members.filter(m => m.class === c).length; return a; }, {});

  return (
    <div style={{padding:"0 14px 14px"}}>
      {/* Search + filters bar */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:180}}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            style={{width:"100%",paddingLeft:10,fontSize:".85rem"}}
          />
        </div>
        {/* Quick actions */}
        <button className="btn btn-s btn-green" onClick={() => onBulkToggle(filteredAbsentIds, true)} disabled={filteredAbsentIds.length === 0}>
          ✓ Marcar filtrados ({filteredAbsentIds.length})
        </button>
        <button className="btn btn-s btn-d" onClick={() => onBulkToggle(filteredPresentIds, false)} disabled={filteredPresentIds.length === 0}>
          ✗ Desmarcar filtrados
        </button>
      </div>

      {/* Class filter chips */}
      <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <button
          onClick={() => setClassFilter(null)}
          className="btn btn-s"
          style={!classFilter ? {background:"rgba(201,168,76,.2)",borderColor:"var(--gold)"} : {}}
        >Todas</button>
        {CLASSES.filter(c => classCounts[c] > 0).map(c => (
          <button
            key={c}
            onClick={() => setClassFilter(classFilter === c ? null : c)}
            className="btn btn-s"
            style={classFilter === c
              ? {background:cc(c)+"30",borderColor:cc(c),color:cc(c)}
              : {color:"var(--text-d)"}}
          >
            {c} ({classCounts[c]})
          </button>
        ))}
      </div>

      {/* View mode tabs */}
      <div style={{display:"flex",gap:4,marginBottom:10}}>
        {[
          {id:"all",label:`Todos (${members.length})`},
          {id:"present",label:`Presentes (${presCount})`},
          {id:"absent",label:`Ausentes (${ausCount})`},
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setShowMode(v.id)}
            className="btn btn-s"
            style={showMode === v.id
              ? {background:"rgba(201,168,76,.15)",borderColor:"var(--gold-d)",color:"var(--gold)"}
              : {color:"var(--text-d)"}}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Members grid - compact */}
      {sorted.length === 0 ? (
        <div style={{padding:16,textAlign:"center",color:"var(--text-d)",fontStyle:"italic",fontSize:".85rem"}}>
          Nenhum membro encontrado.
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:4}}>
          {sorted.map(m => {
            const isOn = presSet.has(m.id);
            return (
              <div
                key={m.id}
                onClick={() => onToggle(m.id)}
                style={{
                  display:"flex",alignItems:"center",gap:6,padding:"6px 8px",
                  background: isOn ? "rgba(56,121,74,.1)" : "var(--bg)",
                  border: `1px solid ${isOn ? "rgba(56,121,74,.3)" : "var(--border)"}`,
                  borderRadius:3,cursor:"pointer",transition:"all .15s",fontSize:".82rem"
                }}
              >
                <span style={{
                  width:16,height:16,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",
                  background: isOn ? "var(--green)" : "var(--bg-i)",
                  border: `1.5px solid ${isOn ? "var(--green-l)" : "var(--border-g)"}`,
                  flexShrink:0,transition:"all .15s"
                }}>
                  {isOn && Ico.check}
                </span>
                <span style={{fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                <span style={{fontSize:".6rem",color:cc(m.class),fontFamily:"'Cinzel',serif",letterSpacing:1,flexShrink:0}}>{m.class}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="att-summary" style={{marginTop:10}}>
        <span className="att-s-item"><span className="att-s-num" style={{color:"var(--green-l)"}}>{presCount}</span>Presentes</span>
        <span className="att-s-item"><span className="att-s-num" style={{color:"var(--red-l)"}}>{ausCount}</span>Ausentes</span>
        <span className="att-s-item"><span className="att-s-num" style={{color:"var(--gold)"}}>{members.length > 0 ? Math.round(presCount/members.length*100) : 0}%</span>Participação</span>
      </div>
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
  const submit = () => { if(!form.name.trim()||!form.date) return; save({...data,events:[...data.events,{...form,id:Date.now()}]}, `Criou evento "${form.name}" (${form.type})`); setForm(blank); setShow(false); };
  const removeEv = (id) => { const ev = data.events.find(e=>e.id===id); save({...data,events:data.events.filter(e=>e.id!==id)}, `Removeu evento "${ev?.name||id}"`); };
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
                      <td><span className="badge" style={{background:cc(m.class)+"22",color:cc(m.class),border:`1px solid ${cc(m.class)}55`}}>{m.class}</span></td>
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
                  <AttendancePanel
                    members={data.members}
                    present={present}
                    onToggle={(mId) => togglePresent(ev.id, mId)}
                    onBulkToggle={(ids, add) => {
                      const p = ev.present || [];
                      const newPresent = add
                        ? [...new Set([...p, ...ids])]
                        : p.filter(id => !ids.includes(id));
                      save({...data, events: data.events.map(e => e.id === ev.id ? {...e, present: newPresent} : e)});
                    }}
                  />
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
  const [sortCol, setSortCol] = useState("name"); // name, class
  const [sortDir, setSortDir] = useState("asc");
  const createWeek = () => { if(!weekLabel.trim()) return; save({...data,twWeeks:[{id:Date.now(),label:weekLabel,confirmed:[],declined:[]},...(data.twWeeks||[])]}, `Criou semana TW "${weekLabel}"`); setWeekLabel(""); setShow(false); };
  const removeWeek = (id) => { const w = (data.twWeeks||[]).find(x=>x.id===id); save({...data,twWeeks:(data.twWeeks||[]).filter(w=>w.id!==id)}, `Removeu semana TW "${w?.label||id}"`); };
  const toggleExpand = (id) => setExpanded(e=>({...e,[id]:!e[id]}));
  const togglePlayer = (wId,mId,type) => {
    save({...data,twWeeks:(data.twWeeks||[]).map(w=>{
      if(w.id!==wId) return w; const conf=w.confirmed||[]; const decl=w.declined||[];
      if(type==="confirm"){ if(conf.includes(mId)) return {...w,confirmed:conf.filter(x=>x!==mId)}; return {...w,confirmed:[...conf,mId],declined:decl.filter(x=>x!==mId)}; }
      else { if(decl.includes(mId)) return {...w,declined:decl.filter(x=>x!==mId)}; return {...w,declined:[...decl,mId],confirmed:conf.filter(x=>x!==mId)}; }
    })});
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sortMembers = (list) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "class") cmp = a.class.localeCompare(b.class);
      else cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{opacity:.3,fontSize:".6rem"}}>⇅</span>;
    return <span style={{fontSize:".6rem"}}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  // Class summary
  const classCounts = CLASSES.reduce((a, c) => { a[c] = data.members.filter(m => m.class === c).length; return a; }, {});

  return (
    <div>
      {/* CLASS SUMMARY BAR */}
      {data.members.length > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginRight:8}}>
              <span style={{fontSize:"1.2rem",fontWeight:700,marginRight:4}}>{data.members.length}</span>membros
            </div>
            <div style={{width:1,height:24,background:"var(--border-g)"}}/>
            {CLASSES.map(c => classCounts[c] > 0 && (
              <div key={c} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:10,height:10,borderRadius:2,background:cc(c),display:"inline-block"}}/>
                <span style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",fontWeight:700,color:cc(c),letterSpacing:1}}>{c}</span>
                <span style={{fontSize:".8rem",fontWeight:600,color:"var(--text)"}}>{classCounts[c]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

            // Class breakdown for confirmed
            const confClassCounts = CLASSES.reduce((a,c)=>{ a[c]=confM.filter(m=>m.class===c).length; return a; },{});

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
                    {/* Confirmed class breakdown */}
                    {confM.length > 0 && (
                      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                        <span style={{fontFamily:"'Cinzel',serif",fontSize:".55rem",letterSpacing:2,textTransform:"uppercase",color:"var(--text-d)"}}>Composição:</span>
                        {CLASSES.map(c => confClassCounts[c] > 0 && (
                          <span key={c} style={{fontSize:".6rem",padding:"2px 6px",borderRadius:2,background:cc(c)+"18",color:cc(c),border:`1px solid ${cc(c)}40`,fontFamily:"'Cinzel',serif",letterSpacing:1,fontWeight:600}}>
                            {confClassCounts[c]}x {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {pending.length>0&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold)",marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Aguardando ({pending.length})</div>
                        {/* Sortable header */}
                        <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",marginBottom:2}}>
                          <span onClick={()=>handleSort("name")} style={{flex:1,fontFamily:"'Cinzel',serif",fontSize:".55rem",letterSpacing:2,textTransform:"uppercase",color:"var(--text-d)",cursor:"pointer",userSelect:"none",display:"flex",alignItems:"center",gap:4}}>
                            Nome <SortIcon col="name"/>
                          </span>
                          <span onClick={()=>handleSort("class")} style={{fontFamily:"'Cinzel',serif",fontSize:".55rem",letterSpacing:2,textTransform:"uppercase",color:"var(--text-d)",cursor:"pointer",userSelect:"none",display:"flex",alignItems:"center",gap:4,marginRight:140}}>
                            Classe <SortIcon col="class"/>
                          </span>
                        </div>
                        {sortMembers(pending).map(m=>(
                          <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:3,fontSize:".85rem"}}>
                            <span style={{flex:1,fontWeight:600}}>{m.name}</span>
                            <span style={{fontSize:".65rem",color:cc(m.class),fontFamily:"'Cinzel',serif",letterSpacing:1,width:35,textAlign:"center"}}>{m.class}</span>
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
                          :sortMembers(confM).map(m=>(<div key={m.id} className="tw-player go" onClick={()=>togglePlayer(week.id,m.id,"confirm")}><span style={{color:"var(--green-l)",marginRight:4}}>●</span><span style={{fontWeight:600,flex:1}}>{m.name}</span><span style={{fontSize:".7rem",color:cc(m.class),fontFamily:"'Cinzel',serif"}}>{m.class}</span></div>))}
                      </div>
                      <div>
                        <div className="tw-col-h no">Não Participam ({declM.length})</div>
                        {declM.length===0?<div style={{fontSize:".8rem",color:"var(--text-d)",fontStyle:"italic",padding:"4px 8px"}}>—</div>
                          :sortMembers(declM).map(m=>(<div key={m.id} className="tw-player no" onClick={()=>togglePlayer(week.id,m.id,"decline")}><span style={{color:"var(--red-l)",marginRight:4}}>●</span><span style={{flex:1}}>{m.name}</span><span style={{fontSize:".7rem"}}>{m.class}</span></div>))}
                      </div>
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
                        <span style={{width:8,height:8,borderRadius:1,background:cc(m.class),display:"inline-block"}}/>
                        <span style={{fontWeight:600}}>{m.name}</span>
                        <span style={{fontSize:".65rem",color:cc(m.class),fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.class}</span>
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
                              background:cc(cls)+"18",color:cc(cls),
                              border:`1px solid ${cc(cls)}40`,
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
                              <span style={{width:8,height:8,borderRadius:1,background:cc(m.class),display:"inline-block",flexShrink:0}}/>
                              <span style={{fontWeight:600,flex:1}}>{m.name}</span>
                              <span style={{fontSize:".65rem",color:cc(m.class),fontFamily:"'Cinzel',serif",letterSpacing:1}}>{m.class}</span>
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

/* ═══════════════ PLAYER VIEW (READ-ONLY) ═══════════════ */
function PlayerView({ data, onBack }) {
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState("ranking");

  const totalEvents = (data.events || []).length;
  const classCounts = CLASSES.reduce((a, c) => { a[c] = data.members.filter(m => m.class === c).length; return a; }, {});

  const ranking = data.members.map(m => {
    const attended = (data.events || []).filter(e => (e.present || []).includes(m.id)).length;
    return { ...m, attended, pct: totalEvents > 0 ? Math.round(attended / totalEvents * 100) : 0 };
  }).sort((a, b) => b.attended - a.attended);

  const getTypeCount = (m, type) => (data.events || []).filter(e => e.type === type && (e.present || []).includes(m.id)).length;
  const getTypeTotal = (type) => (data.events || []).filter(e => e.type === type).length;

  const filtered = search
    ? ranking.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : ranking;

  const weeks = data.twWeeks || [];
  const ins = data.insignias || { queue: [], delivered: [] };

  const tabs = [
    { id: "ranking", label: "Ranking" },
    { id: "membros", label: "Membros" },
    { id: "tw", label: "TW" },
    { id: "insignias", label: "Insígnias" },
  ];

  return (
    <div className="app">
      <header className="hdr">
        <h1>ROMA</h1>
        <div className="sub">Perfect World — Painel do Clã</div>
        <div className="hdr-row">
          <span className="hdr-stat">{data.members.length} membros</span>
          <button className="logout-btn" onClick={onBack}>← Voltar</button>
        </div>
      </header>

      {/* Class summary */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: ".7rem", letterSpacing: 2, textTransform: "uppercase", color: "var(--gold)", marginRight: 8 }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, marginRight: 4 }}>{data.members.length}</span>membros
          </div>
          <div style={{ width: 1, height: 24, background: "var(--border-g)" }} />
          {CLASSES.map(c => classCounts[c] > 0 && (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: cc(c), display: "inline-block" }} />
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: ".7rem", fontWeight: 700, color: cc(c), letterSpacing: 1 }}>{c}</span>
              <span style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text)" }}>{classCounts[c]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <nav className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${viewTab === t.id ? "on" : ""}`} onClick={() => setViewTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* RANKING TAB */}
      {viewTab === "ranking" && (
        <div className="card">
          <div className="card-t">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{Ico.trophy} Ranking de Presença</span>
            <span className="badge b-gold">{totalEvents} eventos</span>
          </div>

          {totalEvents === 0 ? (
            <div className="empty">Nenhum evento registrado ainda.</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..."
                  style={{ width: "100%", maxWidth: 300, padding: "7px 10px", fontSize: ".85rem" }} />
              </div>
              <div className="tbl"><table>
                <thead><tr><th>#</th><th>Nome</th><th>Classe</th><th>TW</th><th>W.Boss</th><th>Marcial</th><th>Total</th><th>%</th></tr></thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const realIdx = ranking.indexOf(m);
                    const twC = getTypeCount(m, "TW"), wbC = getTypeCount(m, "World Boss"), mcC = getTypeCount(m, "Marcial");
                    const twT = getTypeTotal("TW"), wbT = getTypeTotal("World Boss"), mcT = getTypeTotal("Marcial");
                    const medalColor = realIdx === 0 ? "#FFD700" : realIdx === 1 ? "#C0C0C0" : realIdx === 2 ? "#CD7F32" : null;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, color: medalColor || "var(--text-d)", fontSize: medalColor ? ".95rem" : ".8rem" }}>
                          {realIdx < 3 ? ["🥇", "🥈", "🥉"][realIdx] : realIdx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td><span className="badge" style={{ background: cc(m.class) + "22", color: cc(m.class), border: `1px solid ${cc(m.class)}55` }}>{m.class}</span></td>
                        <td style={{ fontSize: ".8rem" }}>{twT > 0 ? <span style={{ color: twC > 0 ? "var(--text)" : "var(--text-d)" }}>{twC}/{twT}</span> : "—"}</td>
                        <td style={{ fontSize: ".8rem" }}>{wbT > 0 ? <span style={{ color: wbC > 0 ? "var(--text)" : "var(--text-d)" }}>{wbC}/{wbT}</span> : "—"}</td>
                        <td style={{ fontSize: ".8rem" }}>{mcT > 0 ? <span style={{ color: mcC > 0 ? "var(--text)" : "var(--text-d)" }}>{mcC}/{mcT}</span> : "—"}</td>
                        <td style={{ fontWeight: 600 }}>{m.attended}/{totalEvents}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 50, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: m.pct + "%", height: "100%", background: m.pct >= 75 ? "var(--green-l)" : m.pct >= 50 ? "var(--gold)" : "var(--red-l)", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: ".75rem", color: m.pct >= 75 ? "var(--green-l)" : m.pct >= 50 ? "var(--gold)" : "var(--red-l)", fontWeight: 600 }}>{m.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      {/* MEMBROS TAB */}
      {viewTab === "membros" && (
        <div className="card">
          <div className="card-t"><span>Membros do Clã</span></div>
          <div style={{ marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..."
              style={{ width: "100%", maxWidth: 300, padding: "7px 10px", fontSize: ".85rem" }} />
          </div>
          <div className="tbl"><table>
            <thead><tr><th>Nome</th><th>Classe</th><th>Nível</th><th>Cultivo</th><th>Obs</th></tr></thead>
            <tbody>
              {(search ? data.members.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : data.members)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td><span className="badge" style={{ background: cc(m.class) + "22", color: cc(m.class), border: `1px solid ${cc(m.class)}55` }}>{m.class}</span></td>
                    <td>{m.level}</td>
                    <td><span className="badge b-gold">{m.cultivo}</span></td>
                    <td style={{ fontSize: ".82rem", color: m.obs ? "var(--gold)" : "var(--text-d)", fontWeight: m.obs ? 600 : 400 }}>{m.obs || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* TW TAB */}
      {viewTab === "tw" && (
        <div className="card">
          <div className="card-t"><span>Controle de TW</span></div>
          {weeks.length === 0 ? <div className="empty">Nenhuma TW registrada.</div>
            : weeks.map(week => {
              const conf = week.confirmed || [];
              const decl = week.declined || [];
              const confM = data.members.filter(m => conf.includes(m.id));
              const declM = data.members.filter(m => decl.includes(m.id));
              const confClassCounts = CLASSES.reduce((a, c) => { a[c] = confM.filter(m => m.class === c).length; return a; }, {});
              return (
                <div key={week.id} style={{ marginBottom: 12, background: "var(--bg-i)", border: "1px solid var(--border)", borderRadius: 4, padding: 14 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: ".85rem", color: "var(--gold)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span>{week.label}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="badge b-green">{conf.length} vão</span>
                      <span className="badge b-red">{decl.length} não vão</span>
                    </div>
                  </div>
                  {confM.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {CLASSES.map(c => confClassCounts[c] > 0 && (
                        <span key={c} style={{ fontSize: ".6rem", padding: "2px 6px", borderRadius: 2, background: cc(c) + "18", color: cc(c), border: `1px solid ${cc(c)}40`, fontFamily: "'Cinzel',serif", letterSpacing: 1, fontWeight: 600 }}>
                          {confClassCounts[c]}x {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="tw-cols">
                    <div>
                      <div className="tw-col-h go">Confirmados ({confM.length})</div>
                      {confM.length === 0 ? <div style={{ fontSize: ".8rem", color: "var(--text-d)", fontStyle: "italic", padding: "4px 8px" }}>—</div>
                        : confM.sort((a, b) => a.class.localeCompare(b.class)).map(m => (
                          <div key={m.id} className="tw-player go">
                            <span style={{ color: "var(--green-l)", marginRight: 4 }}>●</span>
                            <span style={{ fontWeight: 600, flex: 1 }}>{m.name}</span>
                            <span style={{ fontSize: ".7rem", color: cc(m.class), fontFamily: "'Cinzel',serif" }}>{m.class}</span>
                          </div>
                        ))}
                    </div>
                    <div>
                      <div className="tw-col-h no">Não Participam ({declM.length})</div>
                      {declM.length === 0 ? <div style={{ fontSize: ".8rem", color: "var(--text-d)", fontStyle: "italic", padding: "4px 8px" }}>—</div>
                        : declM.map(m => (
                          <div key={m.id} className="tw-player no">
                            <span style={{ color: "var(--red-l)", marginRight: 4 }}>●</span>
                            <span style={{ flex: 1 }}>{m.name}</span>
                            <span style={{ fontSize: ".7rem" }}>{m.class}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* INSIGNIAS TAB */}
      {viewTab === "insignias" && (
        <div>
          {/* Rules */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t"><span>Regras — Insígnias Intrépidas (35k Fama)</span></div>
            {["Ter 6 provas.","Participar de todos eventos.","Disponibilizar as contas em caso de ausência (responsabilidade da staff).","Ter no mínimo 5 presenças.","Em caso de empate = sorteio entre os players."].map((r,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"6px 8px",fontSize:".85rem",alignItems:"flex-start"}}>
                <span style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",fontWeight:700,color:"var(--gold)",flexShrink:0,width:20,textAlign:"center"}}>{i+1}.</span>
                <span style={{color:"var(--text)",lineHeight:1.5}}>{r}</span>
              </div>
            ))}
          </div>

          {/* Queue */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t"><span>Fila de Solicitação ({(ins.queue||[]).length})</span></div>
            {(ins.queue||[]).length === 0 ? <div className="empty">Fila vazia.</div>
              : <div className="tbl"><table>
                <thead><tr><th>#</th><th>Nome</th><th>Classe</th><th>Arma</th><th>Desde</th></tr></thead>
                <tbody>
                  {(ins.queue||[]).map((q,idx)=>(
                    <tr key={q.id}>
                      <td style={{fontFamily:"'Cinzel',serif",fontWeight:700,color:"var(--gold)",textAlign:"center",fontSize:"1rem"}}>{idx+1}º</td>
                      <td style={{fontWeight:600}}>{q.name}</td>
                      <td><span className="badge" style={{background:cc(q.class)+"22",color:cc(q.class),border:`1px solid ${cc(q.class)}55`}}>{q.class}</span></td>
                      <td style={{color:"var(--gold)",fontWeight:600}}>{q.weapon||"—"}</td>
                      <td style={{fontSize:".82rem",color:"var(--text-d)"}}>{q.addedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            }
          </div>

          {/* Delivered */}
          <div className="card">
            <div className="card-t"><span>Armas Entregues ({(ins.delivered||[]).length})</span></div>
            {(ins.delivered||[]).length === 0 ? <div className="empty">Nenhuma arma entregue ainda.</div>
              : <div className="tbl"><table>
                <thead><tr><th>Nome</th><th>Classe</th><th>Arma</th><th>Entregue em</th></tr></thead>
                <tbody>
                  {(ins.delivered||[]).map(d=>(
                    <tr key={d.id} style={{opacity:.75}}>
                      <td style={{fontWeight:600}}>{d.name}</td>
                      <td><span className="badge" style={{background:cc(d.class)+"22",color:cc(d.class),border:`1px solid ${cc(d.class)}55`}}>{d.class}</span></td>
                      <td style={{color:"var(--gold)",fontWeight:600}}>{d.weapon||"—"}</td>
                      <td style={{fontSize:".82rem",color:"var(--green-l)",fontWeight:600}}>{d.deliveredAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            }
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px 0", fontSize: ".75rem", color: "var(--text-d)" }}>
        Dúvidas? Fale com um membro da staff.
      </div>
    </div>
  );
}

/* ═══════════════ ACCOUNTS ═══════════════ */
function AccountsTab({ data, save }) {
  const [reveals, setReveals] = useState({});
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({borrower:"",login:"",senha:"",notes:""});

  const accounts = data.lentAccounts || [];
  const disponivel = accounts.filter(a => a.status === "disponivel" || !a.borrower);
  const emprestado = accounts.filter(a => a.status === "emprestado" && a.borrower);

  const remove = (id) => { const a = accounts.find(x=>x.id===id); save({...data, lentAccounts: accounts.filter(a => a.id !== id)}, `Removeu conta "${a?.charName||id}" do 0800`); };
  const toggleReveal = (id) => setReveals(r => ({...r, [id]: !r[id]}));

  const startEdit = (a) => {
    setForm({ borrower: a.borrower||"", login: a.login||"", senha: a.senha||"", notes: a.notes||"" });
    setEditId(a.id);
  };

  const saveEdit = () => {
    const acc = accounts.find(a=>a.id===editId);
    const action = form.borrower.trim() && !acc?.borrower
      ? `Emprestou "${acc?.charName}" para "${form.borrower}"`
      : `Editou conta "${acc?.charName}"`;
    save({...data, lentAccounts: accounts.map(a => {
      if (a.id !== editId) return a;
      return {
        ...a,
        ...form,
        status: form.borrower.trim() ? "emprestado" : "disponivel",
        since: form.borrower.trim() && !a.borrower ? new Date().toISOString().split("T")[0] : a.since,
      };
    })}, action);
    setEditId(null);
  };

  const devolver = (id) => {
    const a = accounts.find(x=>x.id===id);
    save({...data, lentAccounts: accounts.map(a => {
      if (a.id !== id) return a;
      return { ...a, borrower: "", status: "disponivel" };
    })}, `Devolveu conta "${a?.charName}"`);
  };

  const renderRow = (a) => {
    const isEditing = editId === a.id;
    return (
      <tr key={a.id} style={isEditing ? {background:"rgba(201,168,76,.05)"} : {}}>
        <td style={{fontWeight:600}}>{a.charName}</td>
        <td><span className="badge" style={{background:cc(a.class)+"22",color:cc(a.class),border:`1px solid ${cc(a.class)}55`}}>{a.class}</span></td>
        {isEditing ? (
          <>
            <td><input value={form.borrower} onChange={e=>setForm({...form,borrower:e.target.value})} placeholder="Quem vai usar" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
            <td><input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="Login" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
            <td><input value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Senha" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
            <td><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Obs" style={{width:"100%",padding:"4px 6px",fontSize:".82rem"}}/></td>
            <td style={{whiteSpace:"nowrap"}}>
              <button className="btn btn-s btn-green" onClick={saveEdit} style={{marginRight:4}}>{Ico.check}</button>
              <button className="btn btn-s btn-d" onClick={()=>setEditId(null)}>✗</button>
            </td>
          </>
        ) : (
          <>
            <td style={{color: a.borrower ? "var(--text)" : "var(--text-d)", fontStyle: a.borrower ? "normal" : "italic"}}>
              {a.borrower || "—"}
            </td>
            <td style={{fontSize:".85rem",fontFamily:"monospace",color:"var(--text-d)"}}>{a.login||"—"}</td>
            <td>{a.senha ? (
              <div className="pw-wrap">
                {reveals[a.id] ? <span style={{fontFamily:"monospace",fontSize:".85rem"}}>{a.senha}</span> : <span className="pw-mask">••••••</span>}
                <button className="pw-toggle" onClick={()=>toggleReveal(a.id)}>{reveals[a.id]?Ico.eyeOff:Ico.eye}</button>
              </div>
            ) : "—"}</td>
            <td style={{color:"var(--text-d)",fontStyle:"italic",fontSize:".85rem"}}>{a.notes||"—"}</td>
            <td style={{whiteSpace:"nowrap"}}>
              <button className="btn btn-s" onClick={()=>startEdit(a)} style={{marginRight:4}}>{Ico.edit}</button>
              {a.borrower && <button className="btn btn-s btn-green" onClick={()=>devolver(a.id)} style={{marginRight:4}}>Devolver</button>}
              <button className="btn btn-s btn-d" onClick={()=>remove(a.id)}>{Ico.trash}</button>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div>
      {/* DISPONÍVEIS */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-t">
          <span>Disponíveis para 0800 ({disponivel.length})</span>
        </div>
        {disponivel.length === 0
          ? <div className="empty">Nenhuma conta disponível. Use o botão 🔑 na aba Membros para disponibilizar.</div>
          : <div className="tbl"><table>
            <thead><tr><th>Char</th><th>Classe</th><th>Usando</th><th>Login</th><th>Senha</th><th>Obs</th><th></th></tr></thead>
            <tbody>{disponivel.map(renderRow)}</tbody>
          </table></div>
        }
      </div>

      {/* EMPRESTADAS */}
      <div className="card">
        <div className="card-t">
          <span>Emprestadas ({emprestado.length})</span>
        </div>
        {emprestado.length === 0
          ? <div className="empty">Nenhuma conta emprestada no momento.</div>
          : <div className="tbl"><table>
            <thead><tr><th>Char</th><th>Classe</th><th>Usando</th><th>Login</th><th>Senha</th><th>Obs</th><th></th></tr></thead>
            <tbody>{emprestado.map(renderRow)}</tbody>
          </table></div>
        }
      </div>
    </div>
  );
}

/* ═══════════════ INSIGNIAS ═══════════════ */
function InsigniasTab({ data, save }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [weapon, setWeapon] = useState("");
  const [notes, setNotes] = useState("");

  const ins = data.insignias || { queue: [], delivered: [] };
  const queue = ins.queue || [];
  const delivered = ins.delivered || [];

  // Members not already in queue or delivered
  const available = data.members.filter(m =>
    !queue.some(q => q.memberId === m.id) &&
    !delivered.some(d => d.memberId === m.id)
  );

  const filteredAvailable = search
    ? available.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  const addToQueue = () => {
    if (!selectedMember) return;
    const m = data.members.find(x => x.id === Number(selectedMember));
    if (!m) return;
    const entry = {
      id: Date.now(),
      memberId: m.id,
      name: m.name,
      class: m.class,
      weapon: weapon || "—",
      notes: notes || "",
      addedAt: new Date().toISOString().split("T")[0],
      position: queue.length + 1,
    };
    save({
      ...data,
      insignias: { ...ins, queue: [...queue, entry] }
    }, `Adicionou "${m.name}" à fila de insígnias`);
    setSelectedMember(""); setWeapon(""); setNotes(""); setShowAdd(false);
  };

  const removeFromQueue = (id) => {
    const entry = queue.find(q => q.id === id);
    save({
      ...data,
      insignias: { ...ins, queue: queue.filter(q => q.id !== id) }
    }, `Removeu "${entry?.name||id}" da fila de insígnias`);
  };

  const markDelivered = (id) => {
    const entry = queue.find(q => q.id === id);
    if (!entry) return;
    const deliveredEntry = {
      ...entry,
      deliveredAt: new Date().toISOString().split("T")[0],
    };
    save({
      ...data,
      insignias: {
        queue: queue.filter(q => q.id !== id),
        delivered: [deliveredEntry, ...delivered],
      }
    }, `Entregou insígnia para "${entry.name}" (${entry.weapon})`);
  };

  const moveInQueue = (id, dir) => {
    const idx = queue.findIndex(q => q.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= queue.length) return;
    const newQueue = [...queue];
    [newQueue[idx], newQueue[newIdx]] = [newQueue[newIdx], newQueue[idx]];
    save({ ...data, insignias: { ...ins, queue: newQueue } });
  };

  const undoDelivery = (id) => {
    const entry = delivered.find(d => d.id === id);
    if (!entry) return;
    const { deliveredAt, ...queueEntry } = entry;
    save({
      ...data,
      insignias: {
        queue: [...queue, queueEntry],
        delivered: delivered.filter(d => d.id !== id),
      }
    }, `Desfez entrega de "${entry.name}"`);
  };

  const RULES = [
    "Ter 6 provas.",
    "Participar de todos eventos.",
    "Disponibilizar as contas em caso de ausência (responsabilidade da staff).",
    "Ter no mínimo 5 presenças.",
    "Em caso de empate = sorteio entre os players.",
  ];

  return (
    <div>
      {/* RULES */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-t">
          <span>Regras para Retirada — Insígnias Intrépidas (35k Fama)</span>
        </div>
        <div style={{padding:"4px 0"}}>
          {RULES.map((r, i) => (
            <div key={i} style={{display:"flex",gap:10,padding:"6px 8px",fontSize:".85rem",alignItems:"flex-start"}}>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:".7rem",fontWeight:700,color:"var(--gold)",flexShrink:0,marginTop:1,width:20,textAlign:"center"}}>{i+1}.</span>
              <span style={{color:"var(--text)",lineHeight:1.5}}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QUEUE */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-t">
          <span>Fila de Solicitação ({queue.length})</span>
          <button className="btn" onClick={()=>setShowAdd(!showAdd)}>{Ico.plus} Adicionar à Fila</button>
        </div>

        {showAdd && (
          <div className="form-box">
            <div className="fr">
              <div className="fg" style={{flex:2}}>
                <label>Membro</label>
                <select value={selectedMember} onChange={e=>setSelectedMember(e.target.value)}>
                  <option value="">— Selecionar membro —</option>
                  {filteredAvailable.sort((a,b)=>a.name.localeCompare(b.name)).map(m => (
                    <option key={m.id} value={m.id}>[{m.class}] {m.name}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Arma Desejada</label>
                <input value={weapon} onChange={e=>setWeapon(e.target.value)} placeholder="Ex: Lança, Espada, Arco..."/>
              </div>
              <div className="fg">
                <label>Obs</label>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observação"/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" onClick={addToQueue} disabled={!selectedMember}>{Ico.check} Adicionar</button>
              <button className="btn btn-d" onClick={()=>setShowAdd(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="empty">Fila vazia — nenhuma solicitação pendente.</div>
        ) : (
          <div className="tbl"><table>
            <thead><tr><th style={{width:40}}>#</th><th>Nome</th><th>Classe</th><th>Arma</th><th>Solicitado em</th><th>Obs</th><th></th></tr></thead>
            <tbody>
              {queue.map((q, idx) => (
                <tr key={q.id}>
                  <td style={{fontFamily:"'Cinzel',serif",fontWeight:700,color:"var(--gold)",textAlign:"center",fontSize:"1rem"}}>
                    {idx + 1}º
                  </td>
                  <td style={{fontWeight:600}}>{q.name}</td>
                  <td><span className="badge" style={{background:cc(q.class)+"22",color:cc(q.class),border:`1px solid ${cc(q.class)}55`}}>{q.class}</span></td>
                  <td style={{color:"var(--gold)",fontWeight:600}}>{q.weapon||"—"}</td>
                  <td style={{fontSize:".82rem",color:"var(--text-d)"}}>{q.addedAt}</td>
                  <td style={{fontSize:".82rem",color:"var(--text-d)",fontStyle:"italic"}}>{q.notes||"—"}</td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <button className="btn btn-s" onClick={()=>moveInQueue(q.id,-1)} disabled={idx===0} style={{marginRight:2,opacity:idx===0?.3:1}} title="Subir">▲</button>
                    <button className="btn btn-s" onClick={()=>moveInQueue(q.id,1)} disabled={idx===queue.length-1} style={{marginRight:4,opacity:idx===queue.length-1?.3:1}} title="Descer">▼</button>
                    <button className="btn btn-s btn-green" onClick={()=>markDelivered(q.id)} style={{marginRight:4}} title="Marcar como entregue">✓ Entregar</button>
                    <button className="btn btn-s btn-d" onClick={()=>removeFromQueue(q.id)} title="Remover da fila">{Ico.trash}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* DELIVERED */}
      <div className="card">
        <div className="card-t">
          <span>Armas Entregues ({delivered.length})</span>
        </div>
        {delivered.length === 0 ? (
          <div className="empty">Nenhuma arma entregue ainda.</div>
        ) : (
          <div className="tbl"><table>
            <thead><tr><th>Nome</th><th>Classe</th><th>Arma</th><th>Solicitado</th><th>Entregue</th><th>Obs</th><th></th></tr></thead>
            <tbody>
              {delivered.map(d => (
                <tr key={d.id} style={{opacity:.75}}>
                  <td style={{fontWeight:600}}>{d.name}</td>
                  <td><span className="badge" style={{background:cc(d.class)+"22",color:cc(d.class),border:`1px solid ${cc(d.class)}55`}}>{d.class}</span></td>
                  <td style={{color:"var(--gold)",fontWeight:600}}>{d.weapon||"—"}</td>
                  <td style={{fontSize:".82rem",color:"var(--text-d)"}}>{d.addedAt}</td>
                  <td style={{fontSize:".82rem",color:"var(--green-l)",fontWeight:600}}>{d.deliveredAt}</td>
                  <td style={{fontSize:".82rem",color:"var(--text-d)",fontStyle:"italic"}}>{d.notes||"—"}</td>
                  <td><button className="btn btn-s" onClick={()=>undoDelivery(d.id)} title="Desfazer entrega" style={{fontSize:".5rem"}}>↩ Desfazer</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ LOGS ═══════════════ */
function LogsTab({ data, save }) {
  const [filter, setFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const logs = toArr(data.logs || []);

  const staffUsers = [...new Set(logs.map(l => l.user).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (userFilter && l.user !== userFilter) return false;
    if (filter && !l.action?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const clearLogs = () => {
    save({ ...data, logs: [] }, "Limpou o histórico de logs");
  };

  const formatDate = (ts) => {
    try {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ts; }
  };

  // Group by date
  const groupByDay = (logs) => {
    const groups = {};
    logs.forEach(l => {
      const day = l.ts ? l.ts.split("T")[0] : "unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(l);
    });
    return groups;
  };

  const groups = groupByDay(filtered);
  const days = Object.keys(groups).sort().reverse();

  const dayLabel = (day) => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (day === today) return "Hoje";
    if (day === yesterday) return "Ontem";
    try {
      const d = new Date(day + "T12:00");
      const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    } catch { return day; }
  };

  return (
    <div className="card">
      <div className="card-t">
        <span style={{display:"flex",alignItems:"center",gap:8}}>{Ico.clock} Histórico de Ações</span>
        <div style={{display:"flex",gap:6}}>
          <span className="badge b-gold">{logs.length} registros</span>
          {logs.length > 0 && <button className="btn btn-s btn-d" onClick={clearLogs}>{Ico.trash} Limpar</button>}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar ação..."
          style={{flex:1,minWidth:150,padding:"6px 10px",fontSize:".85rem"}} />
        <select value={userFilter} onChange={e=>setUserFilter(e.target.value)} style={{padding:"6px 10px",fontSize:".85rem"}}>
          <option value="">Todos os staffs</option>
          {staffUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{logs.length === 0 ? "Nenhuma ação registrada ainda." : "Nenhuma ação encontrada com esses filtros."}</div>
      ) : (
        days.map(day => (
          <div key={day} style={{marginBottom:16}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:2,textTransform:"uppercase",color:"var(--gold-d)",marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>
              {dayLabel(day)}
            </div>
            {groups[day].map((l, i) => (
              <div key={i} style={{display:"flex",gap:10,padding:"6px 8px",fontSize:".82rem",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
                <span style={{fontSize:".7rem",color:"var(--text-d)",fontFamily:"monospace",flexShrink:0,minWidth:42}}>
                  {formatDate(l.ts).split(" ")[1]}
                </span>
                <span style={{fontWeight:600,color:"var(--gold)",fontSize:".75rem",flexShrink:0,minWidth:60,fontFamily:"'Cinzel',serif",letterSpacing:1}}>
                  {l.user}
                </span>
                <span style={{flex:1,color:"var(--text)"}}>{l.action}</span>
              </div>
            ))}
          </div>
        ))
      )}
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
