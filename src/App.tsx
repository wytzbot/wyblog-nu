import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity, AlignCenter, AlignLeft, AlignRight, Bold, Bot, ChevronDown, ChevronRight,
  CircleHelp, Code2, Copy, ExternalLink, Eye, FileText, FolderOpen, Grid2X2,
  Highlighter, ImagePlus, Italic, Link2, Menu, Palette, PanelLeft,
  Redo2, RotateCcw, Save, Search, Settings, Sparkles, Trash2, Type,
  Undo2, Video, X, Zap, Star, Wifi, WifiOff, Bell, Check, Clock, List, Quote, Strikethrough, WandSparkles, CreditCard, ListOrdered, Minus
} from "lucide-react";
import { plugins } from "./data";
import type { Plugin } from "./types";
import { authorizeProPayment, connectBlogger, deleteBloggerPage, generateSEOSuggestions, getBillingConfig, getBlogPages, getBlogPosts, getConnectionStatus, getBillingStatus, runDiagnosis, saveBloggerPage, saveBloggerPost, startProCheckout, verifyProPayment } from "./api";
import { enableWyBlogNotifications } from "./firebase";
import { clearDraftCloud, loadDraftCloud, loadNotifications, loadSEOSuggestions, saveDraftCloud, markNotificationRead } from "./cloud";

type Tab = "home" | "posts" | "pages" | "plugins" | "diagnosis" | "notifications";
type EditorMode = "visual" | "html";

const initialHtml = "";

function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [blogConnected, setBlogConnected] = useState(false);
  const [hasBlog, setHasBlog] = useState(false);
  const [plan, setPlan] = useState<"free"|"pro">("free");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [notifications, setNotifications] = useState<import("./types").NotificationItem[]>([]);
  const [suggestions, setSuggestions] = useState<import("./types").SEOSuggestion[]>([]);
  const [welcome, setWelcome] = useState(() => localStorage.getItem("wyblog:welcome-complete") !== "1");
  const [diagnosisBusy, setDiagnosisBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [diagnosis, setDiagnosis] = useState<import("./types").DiagnosisSummary | null>(null);
  const [postStats, setPostStats] = useState<{posts:number}|null>(null);
  const [blogName, setBlogName] = useState<string | null>(null);
  const [blogUrl, setBlogUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);


  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab") as Tab | null;
    if (requestedTab && ["home","posts","pages","plugins","diagnosis","notifications"].includes(requestedTab)) setTab(requestedTab);
    if (params.get("blogger") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
      if (active) showNotice("Blogger connected successfully.");
    } else if (params.get("blogger") === "connected-no-blog") {
      const message = params.get("message") || "Google account connected, but no blog was found on it.";
      window.history.replaceState({}, "", window.location.pathname);
      if (active) showNotice(message);
    } else if (params.get("blogger") === "error") {
      const message = params.get("message") || "Blogger connection was not completed.";
      window.history.replaceState({}, "", window.location.pathname);
      if (active) showNotice(message);
    }
    const paymentRef = params.get("tx_ref");
    if (paymentRef) {
      void verifyProPayment(paymentRef).then(async result => {
        const fresh = await getBillingStatus(); setPlan(fresh.plan);
        showNotice(result.status === "succeeded" && fresh.plan === "pro" ? "Payment verified. WyBlog Pro is now active." : "Payment is still processing. Open Alerts to check the payment status.");
      }).catch((error) => showNotice(error instanceof Error ? error.message : "Payment could not be verified."));
      window.history.replaceState({}, "", window.location.pathname);
    }
    void getConnectionStatus().then(async (result) => {
      if (!active) return;
      const connected = Boolean(result.connected);
      setBlogConnected(connected);
      setHasBlog(Boolean((result as any).hasBlog));
      setBlogName(result.blogName || null);
      setBlogUrl(result.blogUrl || null);
      setAccountEmail(result.accountEmail || "");
      setAccountName(result.accountName || "");
      if (connected) {
        try {
          const data = await getBlogPosts();
          if (active) setPostStats({ posts: data.posts.length });
        } catch {
          if (active) setPostStats(null);
        }
      }
    }).catch(() => {
      if (active) { setBlogConnected(false); setPostStats(null); setBlogName(null); setBlogUrl(null); setAccountEmail(""); setAccountName(""); }
    });
    void getBillingStatus().then((result) => { if (active) setPlan(result.plan); }).catch(() => { if (active) setPlan("free"); });
    void Promise.all([loadNotifications().catch(()=>[]), loadSEOSuggestions().catch(()=>[])]).then(([n,s])=>{if(active){setNotifications(n);setSuggestions(s);}});
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    const openEditor=()=>setEditorOpen(true);
    window.addEventListener("wyblog:open-editor",openEditor);
    return()=>window.removeEventListener("wyblog:open-editor",openEditor);
  },[]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    try { await connectBlogger(); }
    catch (e) { setConnecting(false); showNotice(e instanceof Error ? e.message : "Could not start Google Blogger connection."); }
  };

  const handleDiagnosis = async () => {
    if (!hasBlog || diagnosisBusy) { if (!hasBlog) showNotice(blogConnected ? "No blog found on this account yet — create one at blogger.com, then reconnect." : "Connect Blogger before running a site diagnosis."); return; }
    setDiagnosisBusy(true);
    try { const result = await runDiagnosis(); if (result.diagnosis && typeof result.diagnosis === "object") setDiagnosis(result.diagnosis as import("./types").DiagnosisSummary); showNotice(result.cached ? "Today’s diagnosis is already available." : "Today’s site diagnosis is ready."); }
    catch(error) { showNotice(error instanceof Error ? error.message : "Daily site diagnosis failed."); }
    finally { setDiagnosisBusy(false); }
  };

  const openBlog = () => { if (!blogUrl) { showNotice("Connect Blogger first to open your real blog."); return; } window.open(blogUrl, "_blank", "noopener,noreferrer"); };
  const openBlogger = () => window.open("https://www.blogger.com/", "_blank", "noopener,noreferrer");

  if (welcome) return <WelcomeOnboarding onDone={() => { localStorage.setItem("wyblog:welcome-complete", "1"); setWelcome(false); }} />;
  if (editorOpen) return <EditorPage onClose={() => setEditorOpen(false)} onNotice={showNotice} blogConnected={hasBlog} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div><strong>WyBlog</strong><span>Blogger, simplified.</span></div>
        </div>
        <div className="top-actions"><span className={`connection-pill ${online ? "online" : "offline"}`} title={online ? "Internet connection available" : "Offline mode — remote actions may fail"}>{online ? <Wifi size={14}/> : <WifiOff size={14}/>}<span>{online ? "Online" : "Offline"}</span></span>
          <button className="icon-btn" aria-label="Search posts" onClick={() => { setTab("posts"); }}><Search size={19}/></button>
          <button className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={20}/></button>
        </div>
      </header>

      <main className="content">
        {!blogConnected && (
          <section className="welcome-card">
            <div className="spark"><Sparkles size={24}/></div>
            <div className="welcome-copy">
              <p className="eyebrow">WELCOME TO WYBLOG</p>
              <h1>Make Blogger feel modern.</h1>
              <p>Manage content, improve SEO, monitor site health and use a cleaner writing experience without replacing Blogger as your publishing backend.</p>
              <button className="primary" onClick={handleConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect Blogger"} <ChevronRight size={17}/></button>
            </div>
          </section>
        )}

        <section className="blog-row">
          <div>
            <span className="muted">CURRENT BLOG</span>
            <h2>{blogConnected ? (hasBlog ? "Connected Blogger site" : `Connected as ${accountEmail || "Google account"}`) : "No Blogger site connected"}</h2>
            <span className="demo-url">{blogConnected ? (hasBlog ? (blogUrl || blogName || "Connected · sync available") : "No blog found on this account — create one at blogger.com, then reconnect") : "Connect Blogger to load live data"}</span>
          </div>
          <button className="secondary" onClick={handleConnect} disabled={connecting}><Zap size={16}/> {connecting ? "Connecting…" : blogConnected ? "Reconnect" : "Connect"}</button>
        </section>

        {tab === "home" && <Home onEdit={() => setEditorOpen(true)} diagnosis={diagnosis} postStats={postStats} plan={plan} onDiagnosis={() => setTab("diagnosis")} plugins={plugins} onNotice={showNotice}/>}
        {tab === "posts" && <PostsView onEdit={() => setEditorOpen(true)} onNotice={showNotice} onLoadPosts={getBlogPosts} hasBlog={hasBlog}/>}
        {tab === "pages" && <PagesView onNotice={showNotice} hasBlog={hasBlog}/>}
        {tab === "plugins" && <PluginsView plan={plan} onNotice={showNotice} onUpgrade={()=>setCheckoutOpen(true)}/>}
        {tab === "diagnosis" && <DiagnosisView diagnosis={diagnosis} busy={diagnosisBusy} onRun={handleDiagnosis} onUpgrade={()=>setCheckoutOpen(true)} onNotice={showNotice}/>}
        {tab === "notifications" && <NotificationsView plan={plan} notifications={notifications} suggestions={suggestions} onRefresh={async()=>{setNotifications(await loadNotifications().catch(()=>[]));setSuggestions(await loadSEOSuggestions().catch(()=>[]));}} onGenerate={async()=>{try{await generateSEOSuggestions();setSuggestions(await loadSEOSuggestions());setNotifications(await loadNotifications());showNotice("SEO suggestions refreshed.");}catch(e){showNotice(e instanceof Error?e.message:"Could not generate suggestions.");}}} onRead={async id=>{await markNotificationRead(id);setNotifications(v=>v.map(n=>n.id===id?{...n,read:true}:n));}} onUpgrade={()=>setCheckoutOpen(true)} onNotice={showNotice}/> }
      </main>

      <nav className="bottom-nav">
        <NavButton active={tab==="home"} icon={<Grid2X2/>} label="Home" onClick={()=>setTab("home")}/>
        <NavButton active={tab==="posts"} icon={<FileText/>} label="Posts" onClick={()=>setTab("posts")}/>
        <NavButton active={tab==="pages"} icon={<FileText/>} label="Pages" onClick={()=>setTab("pages")}/>
        <NavButton active={tab==="plugins"} icon={<Zap/>} label="Plugins" onClick={()=>setTab("plugins")}/>
        <NavButton active={tab==="notifications"} icon={<Bell/>} label="Alerts" onClick={()=>setTab("notifications")}/>
        <NavButton active={tab==="diagnosis"} icon={<Bot/>} label="Diagnosis" onClick={()=>setTab("diagnosis")}/>
      </nav>

      {menuOpen && <MenuDrawer close={()=>setMenuOpen(false)} openBlog={openBlog} openBlogger={openBlogger} setTab={setTab} onEdit={()=>setEditorOpen(true)} onNotice={showNotice} onEnableNotifications={async()=>{try{const result=await enableWyBlogNotifications(); if(result.token){const { registerPushToken }=await import("./api"); await registerPushToken(result.token); showNotice("Notifications enabled and registered with WyBlog.");} else showNotice(`Notifications not enabled: ${result.reason||"unknown reason"}.`);}catch(error){showNotice(error instanceof Error?error.message:"Could not enable notifications on this device.")}}} onUpgrade={()=>setCheckoutOpen(true)}/>}
      {checkoutOpen && <ProCheckout accountEmail={accountEmail} accountName={accountName} close={()=>setCheckoutOpen(false)} onSuccess={async()=>{setCheckoutOpen(false);const b=await getBillingStatus().catch(()=>({plan:"free" as const,status:"inactive",activeUntil:null}));setPlan(b.plan);showNotice("Payment successful. WyBlog Pro is now active.");}} onNotice={showNotice}/>}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function Home({onEdit,diagnosis,postStats,plan,onDiagnosis,plugins,onNotice}:{onEdit:()=>void;diagnosis:import("./types").DiagnosisSummary|null;postStats:{posts:number}|null;plan:"free"|"pro";onDiagnosis:()=>void;plugins:Plugin[];onNotice:(s:string)=>void}) {
  return <>
    <section className="quick-actions">
      <button className="quick-main" onClick={onEdit}><PenIcon/><span><b>Write article</b><small>Start with a blank article</small></span><ChevronRight/></button>
      <button onClick={()=>onNotice(postStats ? "Search is available from the Posts screen after the latest sync." : "Connect Blogger to search real posts.")}><Search/><span>Search posts</span></button>
      <button onClick={()=>onNotice(diagnosis ? "Open Diagnosis to review the latest connected-site scan." : "Run a connected-site diagnosis to generate real metrics.")}><Eye/><span>Site health</span></button>
    </section>
    <section className="stats-grid">
      <Stat label="Posts" value={postStats ? postStats.posts : "—"}/>
      <Stat label="SEO score" value={diagnosis ? `${diagnosis.seoScore}/100` : "—"}/>
      <Stat label="Broken links" value={diagnosis ? diagnosis.brokenLinks : "—"}/>
      <Stat label="Plan" value={plan === "pro" ? "Pro" : "Free"}/>
    </section>
    <section className="section-heading"><div><p className="eyebrow">TOOLS</p><h2>Useful tools</h2></div></section>
    <div className="home-grid">
      <button className="feature-card" onClick={()=>onNotice("Connect Blogger and use the plugin market to integrate article tools.")}><Zap/><b>{plugins.length} plugins</b><span>Free and Pro integrations with instructions.</span></button>
      <button className="feature-card" onClick={onDiagnosis}><Bot/><b>Daily site diagnosis</b><span>{diagnosis ? "Today’s connected scan available." : "One real AI scan per day."}</span></button>
    </div>
  </>;
}

function Stat({label,value}:{label:string;value:string|number}){return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>}
function NavButton({active,icon,label,onClick}:{active:boolean;icon:ReactNode;label:string;onClick:()=>void}){return <button className={`nav-item ${active?"active":""}`} onClick={onClick}>{icon}<span>{label}</span></button>}

function PostsView({onEdit,onNotice,onLoadPosts,hasBlog}:{onEdit:()=>void;onNotice:(s:string)=>void;onLoadPosts:()=>Promise<{posts:unknown[]}>;hasBlog:boolean}) {
 const [posts,setPosts]=useState<unknown[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const load=async(silent=false)=>{if(!hasBlog)return;setLoading(true);try{const result=await onLoadPosts();setPosts(result.posts||[]);setLoaded(true);if(!silent)onNotice(result.posts?.length?`Loaded ${result.posts.length} Blogger posts.`:"Blogger returned no posts for this blog.");}catch(error){if(!silent)onNotice(error instanceof Error?error.message:"Could not load Blogger posts.");}finally{setLoading(false);}};
 useEffect(()=>{void load(true);const onVisible=()=>{if(document.visibilityState==="visible")void load(true)};document.addEventListener("visibilitychange",onVisible);return()=>document.removeEventListener("visibilitychange",onVisible);},[hasBlog]);
 const filtered=posts.filter(post=>{const p=post as {title?:string;content?:string}; const q=query.trim().toLowerCase(); return !q||`${p.title||""} ${p.content||""}`.toLowerCase().includes(q);});
 if(!hasBlog)return <div><section className="section-heading"><div><p className="eyebrow">CONTENT</p><h1>Your posts</h1><p className="section-sub">Connect a Blogger site first. Once connected, posts load automatically when this screen opens.</p></div></section><div className="empty-state"><strong>No Blogger site connected.</strong><p>Connect Blogger above, then return here. You won't need to manually refresh just to load posts.</p></div></div>;
 return <div><section className="section-heading"><div><p className="eyebrow">CONTENT</p><h1>Your posts</h1><p className="section-sub">Live Blogger posts load automatically. Refresh only when you want to force a fresh sync.</p></div><div className="editor-head-actions"><button className="secondary small" onClick={()=>void load(false)} disabled={loading}><RotateCcw size={14}/>{loading?"Syncing…":"Refresh"}</button><button className="primary small" onClick={onEdit}>New article</button></div></section><div className="post-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search loaded posts…" aria-label="Search loaded posts"/></div>{loading&&!loaded?<div className="empty-state"><strong>Loading Blogger posts…</strong><p>Fetching the latest posts from your connected blog.</p></div>:!loaded?<div className="empty-state"><strong>Waiting for Blogger posts…</strong><p>The first sync starts automatically.</p></div>:<div className="post-list">{filtered.map((post,index)=>{const item=post as {id?:string;title?:string;published?:string;url?:string};return <button className="post-row" key={item.id||index} onClick={()=>item.url?window.open(item.url,"_blank","noopener,noreferrer"):onNotice("This Blogger post has no public URL.")}><div className="post-number">{index+1}</div><div><strong>{item.title||"Untitled post"}</strong><span>{item.published?new Date(item.published).toLocaleDateString():"Blogger post"}</span></div><ChevronRight/></button>})}</div>}{loaded&&posts.length===0&&<div className="empty-state"><strong>No posts found.</strong><p>This Blogger blog currently has no posts.</p></div>}{loaded&&posts.length>0&&filtered.length===0&&<div className="empty-state"><strong>No matching posts.</strong><p>Try another search term.</p></div>}</div>;
}

const PAGE_TEMPLATES:{name:string;title:string;content:string}[]=[
 {name:"About",title:"About",content:"<h2>About this blog</h2><p>Tell your readers who you are, what this blog is about, and what they can expect here.</p>"},
 {name:"Privacy Policy",title:"Privacy Policy",content:"<h2>Privacy Policy</h2><p>Explain what information your blog collects, how it is used, cookies or analytics you use, and how readers can contact you about privacy.</p><p><strong>Important:</strong> Customize this page for your actual services, tools, analytics, advertising and legal requirements before publishing.</p>"},
 {name:"Contact",title:"Contact",content:"<h2>Contact</h2><p>Tell readers how they can contact you. Add your preferred email address or other public contact method here.</p>"},
];

function PagesView({onNotice,hasBlog}:{onNotice:(s:string)=>void;hasBlog:boolean}){
 const [pages,setPages]=useState<any[]>([]);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [editing,setEditing]=useState<any|null>(null);const [deleteId,setDeleteId]=useState<string|null>(null);const [query,setQuery]=useState("");const [showTemplates,setShowTemplates]=useState(false);
 const load=async(silent=false)=>{if(!hasBlog)return;setLoading(true);try{const r=await getBlogPages();setPages(r.pages||[]);if(!silent)onNotice(`Loaded ${r.pages?.length||0} Blogger pages.`);}catch(e){if(!silent)onNotice(e instanceof Error?e.message:"Could not load Blogger pages.");}finally{setLoading(false);}};
 useEffect(()=>{void load(true);const onVisible=()=>{if(document.visibilityState==="visible")void load(true)};document.addEventListener("visibilitychange",onVisible);return()=>document.removeEventListener("visibilitychange",onVisible);},[hasBlog]);
 const filtered=pages.filter(p=>{const q=query.trim().toLowerCase();return !q||`${p.title||""} ${p.content||""}`.toLowerCase().includes(q);});
 const save=async(title:string,content:string,published:boolean,id?:string)=>{setSaving(true);try{const r=await saveBloggerPage({id,title,content,published});await load(true);setEditing(null);setShowTemplates(false);onNotice(id?"Blogger page updated successfully.":published?"Blogger page published successfully.":"Blogger page saved as a draft.");if(r.url){} }catch(e){onNotice(e instanceof Error?e.message:"Could not save Blogger page.");}finally{setSaving(false);}};
 const remove=async(id:string)=>{setLoading(true);try{await deleteBloggerPage(id);setPages(v=>v.filter(p=>String(p.id)!==String(id)));onNotice("Blogger page deleted.");}catch(e){onNotice(e instanceof Error?e.message:"Could not delete Blogger page.");}finally{setLoading(false);}};
 if(!hasBlog)return <div><section className="section-heading"><div><p className="eyebrow">BLOGGER PAGES</p><h1>About, Privacy, Contact & more</h1><p className="section-sub">These are Blogger Pages — separate from your posts. Connect your blog to manage them here.</p></div></section><div className="empty-state"><strong>No Blogger site connected.</strong><p>Connect Blogger above, then this screen will load the pages that already exist on your blog.</p></div></div>;
 return <div><section className="section-heading"><div><p className="eyebrow">BLOGGER PAGES</p><h1>Static pages</h1><p className="section-sub">Manage pages such as About, Privacy Policy, Contact, Disclaimer and Terms directly in Blogger.</p></div><div className="editor-head-actions"><button className="secondary small" onClick={()=>void load(false)} disabled={loading}><RotateCcw size={14}/>{loading?"Syncing…":"Refresh"}</button><button className="primary small" onClick={()=>setShowTemplates(true)}>New page</button></div></section><div className="post-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search pages…" aria-label="Search pages"/></div>{loading&&!pages.length?<div className="empty-state"><strong>Loading Blogger pages…</strong><p>Fetching your site's static pages.</p></div>:filtered.length?<div className="page-list">{filtered.map((p,i)=><article className="page-row" key={p.id||i}><div className="page-row-icon"><FileText size={17}/></div><div className="page-row-copy"><strong>{p.title||"Untitled page"}</strong><span>{p.status||"LIVE"} · {p.updated?new Date(p.updated).toLocaleDateString():p.published?new Date(p.published).toLocaleDateString():"Blogger page"}</span></div><div className="page-row-actions"><button className="secondary small" onClick={()=>setEditing(p)}>Edit</button>{p.url&&<button className="icon-btn" aria-label={`Open ${p.title||"page"}`} onClick={()=>window.open(p.url,"_blank","noopener,noreferrer")}><ExternalLink size={16}/></button>}<button className="icon-btn danger-icon" aria-label={`Delete ${p.title||"page"}`} onClick={()=>setDeleteId(String(p.id))}><Trash2 size={16}/></button></div></article>)}</div>:<div className="empty-state"><strong>No Blogger pages yet.</strong><p>Create an About, Privacy Policy, Contact or custom page. Pages are stored in your Blogger blog, not only on this device.</p><button className="primary small" onClick={()=>setShowTemplates(true)}>Create your first page</button></div>}{(showTemplates||editing)&&<PageEditorModal page={editing} templates={PAGE_TEMPLATES} saving={saving} close={()=>{setShowTemplates(false);setEditing(null)}} onSave={save}/>} {deleteId&&<div className="confirm-backdrop" onClick={()=>setDeleteId(null)}><div className="confirm-card" onClick={e=>e.stopPropagation()}><h3>Delete this page?</h3><p>This will delete the Blogger Page from your blog. This cannot be undone from WyBlog.</p><div><button className="secondary" onClick={()=>setDeleteId(null)}>Cancel</button><button className="danger filled" onClick={async()=>{const id=deleteId;setDeleteId(null);await remove(id)}}>Delete page</button></div></div></div>}</div>;
}

function PageEditorModal({page,templates,saving,close,onSave}:{page:any|null;templates:{name:string;title:string;content:string}[];saving:boolean;close:()=>void;onSave:(title:string,content:string,published:boolean,id?:string)=>Promise<void>}){
 const editorRef=useRef<HTMLDivElement>(null);
 const savedSelection=useRef<Range|null>(null);
 const [title,setTitle]=useState(page?.title||"");
 const [content,setContent]=useState(page?.content||"");
 const [published,setPublished]=useState(page?.status!=="DRAFT");
 const [mode,setMode]=useState<EditorMode>("visual");
 const [templateOpen,setTemplateOpen]=useState(!page);
 const [preview,setPreview]=useState(false);
 const [linkDialog,setLinkDialog]=useState(false);
 const [linkUrl,setLinkUrl]=useState("");
 const [linkTitle,setLinkTitle]=useState("");
 const [mediaKind,setMediaKind]=useState<"image"|"video"|null>(null);
 const [mediaUrl,setMediaUrl]=useState("");
 const [wordCount,setWordCount]=useState(0);

 useEffect(()=>{
   if(editorRef.current && mode==="visual" && editorRef.current.innerHTML!==content) editorRef.current.innerHTML=content;
 },[mode,content]);
 useEffect(()=>{
   if(!editorRef.current) return;
   editorRef.current.innerHTML=content||"";
   const plain=(editorRef.current.innerText||"").trim();
   setWordCount(plain?plain.split(/\s+/).length:0);
 },[]);
 const sync=()=>{
   if(!editorRef.current)return;
   const next=editorRef.current.innerHTML;
   setContent(next);
   const plain=(editorRef.current.innerText||"").trim();
   setWordCount(plain?plain.split(/\s+/).length:0);
 };
 const saveSelection=()=>{const sel=window.getSelection();if(sel&&sel.rangeCount)savedSelection.current=sel.getRangeAt(0).cloneRange()};
 const restoreSelection=()=>{const sel=window.getSelection();if(sel&&savedSelection.current){sel.removeAllRanges();sel.addRange(savedSelection.current)}};
 const command=(cmd:string,value?:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand(cmd,false,value);sync();saveSelection()};
 const insertHtml=(fragment:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand("insertHTML",false,fragment);sync();saveSelection()};
 const insertText=(text:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand("insertText",false,text);sync();saveSelection()};
 const openGoogle=()=>{const text=window.getSelection()?.toString().trim();window.open("https://www.google.com/search?q="+encodeURIComponent(text||title),"_blank","noopener,noreferrer")};
 const openLinkDialog=()=>{saveSelection();setLinkUrl("");setLinkTitle("");setLinkDialog(true)};
 const applyLink=()=>{
   const url=linkUrl.trim();
   if(!url){return}
   if(!/^https?:\/\//i.test(url)){return}
   restoreSelection();editorRef.current?.focus();document.execCommand("createLink",false,url);
   const range=savedSelection.current;const root=editorRef.current;
   if(linkTitle.trim()&&range&&root){
     let node:Element|null=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
     const anchor=node?.closest("a")||root.querySelector(`a[href="${CSS.escape(url)}"]`);
     anchor?.setAttribute("title",linkTitle.trim());
   }
   sync();setLinkDialog(false);
 };
 const openMedia=(kind:"image"|"video")=>{saveSelection();setMediaKind(kind);setMediaUrl("")};
 const applyMedia=()=>{
   const url=mediaUrl.trim();
   if(!/^https:\/\//i.test(url))return;
   if(mediaKind==="image")insertHtml(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto" />`);
   else if(mediaKind==="video")insertHtml(`<video controls style="max-width:100%"><source src="${escapeHtml(url)}"></video>`);
   setMediaKind(null);setMediaUrl("");
 };
 const apply=(t:{title:string;content:string})=>{setTitle(t.title);setContent(t.content);setTemplateOpen(false);setMode("visual")};
 const submit=(status=published)=>{if(!title.trim()||!content.replace(/<[^>]*>/g," ").trim())return;void onSave(title.trim(),content,status,page?.id?String(page.id):undefined)};
 return <div className="page-editor-overlay">
   <div className="editor-shell page-editor-shell">
     <header className="editor-head">
       <button className="icon-btn" onClick={close} aria-label="Close page editor"><X/></button>
       <div><strong>Page Editor</strong><span>{page?"Edit Blogger Page":"Create Blogger Page"}</span></div>
       <div className="editor-head-actions">
         <button className="secondary small" onClick={()=>setPreview(true)}><Eye/> Preview</button>
         <button className="secondary small" onClick={()=>{setPublished(false);submit(false)}} disabled={saving||!title.trim()||!content.trim()}><Save/> {saving?"Saving…":"Save draft"}</button>
         <button className="primary small" onClick={()=>{setPublished(true);void onSave(title.trim(),content,true,page?.id?String(page.id):undefined)}} disabled={saving||!title.trim()||!content.trim()}><Zap/> {saving?"Publishing…":"Publish"}</button>
       </div>
     </header>
     <main className="editor-main">
       {templateOpen&&!page&&<div className="page-templates"><strong>Start from a template</strong><div>{templates.map(t=><button key={t.name} className="secondary small" onClick={()=>apply(t)}>{t.name}</button>)}<button className="secondary small" onClick={()=>setTemplateOpen(false)}>Blank page</button></div></div>}
       <input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Page title" aria-label="Page title"/>
       <div className="editor-grid">
         <section>
           <div className="floating-toolbar" onPointerDown={e=>{if((e.target as HTMLElement).closest("button"))e.preventDefault()}}>
             <ToolbarButton icon={<Undo2/>} label="Undo" onClick={()=>command("undo")}/><ToolbarButton icon={<Redo2/>} label="Redo" onClick={()=>command("redo")}/>
             <ToolbarButton icon={<Bold/>} label="Bold" onClick={()=>command("bold")}/><ToolbarButton icon={<Italic/>} label="Italic" onClick={()=>command("italic")}/>
             <select aria-label="Font" onChange={e=>command("fontName",e.target.value)} defaultValue="Arial"><option value="Arial">Font</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Times New Roman">Times</option></select>
             <select aria-label="Heading size" onChange={e=>command("formatBlock",e.target.value)} defaultValue="p"><option value="p">Body</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option><option value="h5">H5</option><option value="h6">H6</option></select>
             <ToolbarButton icon={<AlignLeft/>} label="Left" onClick={()=>command("justifyLeft")}/><ToolbarButton icon={<AlignCenter/>} label="Center" onClick={()=>command("justifyCenter")}/><ToolbarButton icon={<AlignRight/>} label="Right" onClick={()=>command("justifyRight")}/>
             <ToolbarButton icon={<List/>} label="Bulleted list" onClick={()=>command("insertUnorderedList")}/><ToolbarButton icon={<ListOrdered/>} label="Numbered list" onClick={()=>command("insertOrderedList")}/><ToolbarButton icon={<Quote/>} label="Quote" onClick={()=>command("formatBlock","blockquote")}/><ToolbarButton icon={<Strikethrough/>} label="Strikethrough" onClick={()=>command("strikeThrough")}/><ToolbarButton icon={<Minus/>} label="Divider" onClick={()=>insertHtml("<hr />")}/>
             <label className="color-tool" title="Text color"><Type/><input type="color" defaultValue="#111111" onChange={e=>command("foreColor",e.target.value)}/></label>
             <label className="color-tool" title="Highlight"><Highlighter/><input type="color" defaultValue="#fff2a8" onChange={e=>command("hiliteColor",e.target.value)}/></label>
             <ToolbarButton icon={<Link2/>} label="Link" onClick={openLinkDialog}/><ToolbarButton icon={<Search/>} label="Google search" onClick={openGoogle}/>
             <ToolbarButton icon={<Copy/>} label="Copy" onClick={()=>{const text=window.getSelection()?.toString()||"";if(text&&navigator.clipboard)void navigator.clipboard.writeText(text)}}/>
             <ToolbarButton icon={<ImagePlus/>} label="Image URL" onClick={()=>openMedia("image")}/><ToolbarButton icon={<Video/>} label="Video URL" onClick={()=>openMedia("video")}/>
             <ToolbarButton icon={<span className="asterisk">＊</span>} label="Asterisk" onClick={()=>insertText("＊")}/><ToolbarButton icon={<RotateCcw/>} label="Clear formatting" onClick={()=>command("removeFormat")}/>
             <ToolbarButton icon={<Code2/>} label="HTML" onClick={()=>setMode(mode==="visual"?"html":"visual")}/>
           </div>
           {mode==="visual"?<div ref={editorRef} className="rich-editor page-rich-editor" contentEditable suppressContentEditableWarning onInput={sync} onMouseUp={saveSelection} onKeyUp={saveSelection} onTouchEnd={saveSelection} data-placeholder="Start writing your page…"/>:<textarea className="html-editor" value={content} onChange={e=>setContent(e.target.value)} spellCheck={false} aria-label="HTML source"/>}
           <div className="editor-foot"><span>{wordCount.toLocaleString()} words</span><span>{mode==="html"?"HTML source mode":"Visual mode"}</span></div>
           <div className="editor-upload-row"><button className="secondary small" onClick={()=>setMode(mode==="visual"?"html":"visual")}><Code2/> {mode==="visual"?"Switch to HTML":"Switch to visual"}</button></div>
         </section>
         <aside className="editor-side">
           <Collapsible title="Page publishing" open={true} onToggle={()=>{}}><label className="page-publish"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/><span><strong>{published?"Publish page":"Save as draft"}</strong><small>{published?"The page will be live on Blogger.":"Keep the page as a Blogger draft."}</small></span></label><button className="primary small" style={{width:"100%"}} disabled={saving||!title.trim()||!content.trim()} onClick={()=>submit()}>{saving?"Saving…":published?"Publish page":"Save draft"}</button></Collapsible>
           <Collapsible title="Blogger page" open={true} onToggle={()=>{}}><p className="side-note">This editor writes the page body as HTML to Blogger. Use the HTML switch when you need exact markup, embeds or custom page structure.</p></Collapsible>
         </aside>
       </div>
     </main>
   </div>
   {preview&&<Preview title={title} html={content} close={()=>setPreview(false)}/>} 
   {mediaKind&&<MediaDialog kind={mediaKind} url={mediaUrl} setUrl={setMediaUrl} cancel={()=>setMediaKind(null)} apply={applyMedia}/>} 
   {linkDialog&&<LinkDialog url={linkUrl} title={linkTitle} setUrl={setLinkUrl} setTitle={setLinkTitle} cancel={()=>setLinkDialog(false)} apply={applyLink}/>} 
 </div>;
}
function idOrUndefined(page:any){return page?.id?String(page.id):undefined}

function PluginsView({plan,onNotice,onUpgrade}:{plan:"free"|"pro";onNotice:(s:string)=>void;onUpgrade:()=>void}) {
 const catalog = plugins;
 const [filter,setFilter]=useState("All");
 const [query,setQuery]=useState("");
 const [favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem("wyblog:plugin-favorites")||"[]")}catch{return []}});
 const [selected,setSelected]=useState<Plugin|null>(null);
 const categories=useMemo(()=>["All","Favorites",...Array.from(new Set(catalog.map(p=>p.category)))],[catalog]);
 const toggleFavorite=(id:string)=>setFavorites(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];localStorage.setItem("wyblog:plugin-favorites",JSON.stringify(next));return next});
 const normalized=query.trim().toLowerCase();
 const visible=catalog.filter(p=>{
   const categoryOk=filter==="All"||(filter==="Favorites"?favorites.includes(p.id):p.category===filter);
   const queryOk=!normalized||`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(normalized);
   return categoryOk&&queryOk;
 });
 return <div><section className="section-heading"><div><p className="eyebrow">PLUGIN MARKET</p><h1>SEO, growth & integrations.</h1><p className="section-sub">Every plugin includes step-by-step integration instructions. Pro plugins unlock together after verified payment.</p></div></section><div className="plugin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search plugins…" aria-label="Search plugins"/></div><div className="chips">{categories.map(c=><button key={c} className={filter===c?"chip active":"chip"} onClick={()=>setFilter(c)}>{c}</button>)}</div><div className="plugin-list">{visible.length?visible.map(p=><PluginCard key={p.id} plugin={p} favorite={favorites.includes(p.id)} onFavorite={()=>toggleFavorite(p.id)} onAction={()=>setSelected(p)}/>):<div className="empty-state"><strong>No plugins found.</strong><p>Try another search or category.</p></div>}</div>{selected&&<PluginDetails plugin={selected} plan={plan} favorite={favorites.includes(selected.id)} onFavorite={()=>toggleFavorite(selected.id)} close={()=>setSelected(null)} onNotice={onNotice} onUpgrade={onUpgrade}/>}</div>;
}

function PluginCard({plugin,favorite,onFavorite,onAction}:{plugin:Plugin;favorite:boolean;onFavorite:()=>void;onAction:()=>void}){const installed=Boolean(localStorage.getItem(`wyblog:plugin-installed:${plugin.id}`));return <article className="plugin-card"><div className="plugin-icon"><Zap size={18}/></div><div className="plugin-card-copy"><div className="plugin-title">{plugin.name}{plugin.pro&&<span className="pro-tag">PRO</span>}</div><p>{plugin.description}</p><small>{plugin.category} · {plugin.instructions.length} integration steps</small></div><button className="plugin-star" aria-label={favorite?`Remove ${plugin.name} from favorites`:`Add ${plugin.name} to favorites`} title={favorite?"Remove favorite":"Add favorite"} onClick={e=>{e.stopPropagation();onFavorite()}}><Star size={16} fill={favorite?"currentColor":"none"}/></button><button onClick={onAction}>{installed?<><Check size={14}/> Installed</>:"Instructions"}</button></article>}

function PluginDetails({plugin,plan,favorite,onFavorite,close,onNotice,onUpgrade}:{plugin:Plugin;plan:"free"|"pro";favorite:boolean;onFavorite:()=>void;close:()=>void;onNotice:(s:string)=>void;onUpgrade:()=>void}){
 const locked=Boolean(plugin.pro&&plan!=="pro");
 const installed=Boolean(localStorage.getItem(`wyblog:plugin-installed:${plugin.id}`));
 const canArticleIntegrate=plugin.integrationTarget==="article-start"||plugin.integrationTarget==="article-end";
 const copy=()=>{if(locked){onUpgrade();return;}if(!navigator.clipboard){onNotice("Clipboard access is unavailable in this browser. Select and copy the code manually.");return;}void navigator.clipboard.writeText(plugin.snippet).then(()=>onNotice("Plugin code copied."),()=>onNotice("Clipboard access was blocked. Select the code manually."))};
 const integrate=()=>{
   if(locked){onUpgrade();return;}
   if(!canArticleIntegrate){onNotice(plugin.integrationTarget==="theme"?"This plugin belongs in Blogger Theme, not inside a post. Open the instructions for the exact location.":"This plugin runs through WyBlog/server integration and cannot be safely injected into a post.");return;}
   if(installed){onNotice(`${plugin.name} is already installed for this draft. Double integration is disabled.`);return;}
   localStorage.setItem("wyblog:pending-plugin",JSON.stringify({id:plugin.id,name:plugin.name,snippet:plugin.snippet,target:plugin.integrationTarget}));
   close();
   window.dispatchEvent(new CustomEvent("wyblog:open-editor"));
 };
 return <div className="confirm-backdrop"><div className="confirm-card plugin-detail"><div className="plugin-detail-head"><div><h3>{plugin.name}{plugin.pro&&<span className="pro-tag">PRO</span>}</h3><p>{plugin.description}</p></div><div className="plugin-detail-head-actions"><button className="icon-btn" onClick={onFavorite} aria-label={favorite?"Remove favorite":"Add favorite"} title={favorite?"Remove favorite":"Add favorite"}><Star size={17} fill={favorite?"currentColor":"none"}/></button><button className="icon-btn" onClick={close} aria-label="Close"><X/></button></div></div>{plugin.pro&&<div className="plugin-pro-note">{locked?"Pro required · $1/month or ₦1,000/month · all Pro plugins unlock together.":"Pro active · this plugin is unlocked."}</div>}<h4>How to integrate</h4><ol>{plugin.instructions.map((x,i)=><li key={i}>{x}</li>)}</ol>{plugin.requirements?.length?<><h4>Requirements</h4><ul className="plugin-requirements">{plugin.requirements.map(x=><li key={x}>{x}</li>)}</ul></>:null}<h4>Integration</h4><p className="plugin-integration-note">{canArticleIntegrate?"One tap adds this plugin to the article at its supported insertion point. You can still edit or remove it before publishing.":plugin.integrationTarget==="theme"?"This plugin is theme-level. Blogger does not expose safe post-body installation for it, so WyBlog will not pretend a post integration is equivalent.":plugin.integrationTarget==="editor"?"This plugin changes editor/analysis data rather than adding a code block to the post.":"This plugin is handled by WyBlog/server features rather than post HTML."}</p><h4>Copyable code / integration note</h4><pre className="plugin-code"><code>{locked?"Upgrade to Pro to reveal the integration code.":plugin.snippet}</code></pre><div className="plugin-detail-actions"><button className="secondary" onClick={close}>Close</button>{!locked&&<button className="secondary" onClick={copy}><Copy size={16}/> Copy</button>}<button className="primary" onClick={integrate} disabled={installed&&!locked}>{locked?"Unlock with Pro":installed?"Installed":canArticleIntegrate?"Integrate into article":"Integration instructions"}</button></div></div></div>
}

function DiagnosisView({diagnosis,busy,onRun,onUpgrade,onNotice}:{diagnosis:import("./types").DiagnosisSummary|null;busy:boolean;onRun:()=>void;onUpgrade:()=>void;onNotice:(s:string)=>void}) {
 if (!diagnosis) return <div><section className="section-heading"><div><p className="eyebrow">AI SITE DIAGNOSIS</p><h1>Find what needs fixing.</h1><p className="section-sub">No diagnosis has been run yet. Connect Blogger and start a scan to generate real metrics.</p></div></section><div className="empty-state"><strong>No site scan yet.</strong><p>WyBlog does not show placeholder scores or fake findings.</p><button className="primary" onClick={onRun} disabled={busy}>{busy?"Scanning…":"Run today’s diagnosis"}</button></div><div className="pro-banner"><div><Sparkles/><div><strong>Need more diagnoses?</strong><span>Every connected account gets one real AI diagnosis per day.</span></div></div><button className="primary small" onClick={onUpgrade}>Get Pro · $1 / ₦1,000</button></div></div>;
 return <div><section className="section-heading"><div><p className="eyebrow">AI SITE DIAGNOSIS</p><h1>Find what needs fixing.</h1><p className="section-sub">Latest connected-site scan.</p></div></section><div className="diagnosis-top"><div className="big-score"><span>SEO SCORE</span><strong>{diagnosis.seoScore}<small>/100</small></strong></div><Metric label="Broken links" value={diagnosis.brokenLinks}/><Metric label="SEO issues" value={diagnosis.seoIssues}/><Metric label="Pages checked" value={diagnosis.pagesChecked}/><Metric label="Posts checked" value={diagnosis.postsChecked}/></div><div className="diagnosis-actions"><button className="primary" onClick={onRun} disabled={busy}>{busy?"Scanning…":"Refresh today’s diagnosis"}</button><span>One AI diagnosis per day · Pro users included</span></div><div className="finding-grid"><Finding title="Critical" icon="!" items={diagnosis.critical}/><Finding title="SEO" icon="S" items={diagnosis.seo}/><Finding title="Good" icon="✓" items={diagnosis.good}/></div><div className="pro-banner"><div><Sparkles/><div><strong>Need more diagnoses?</strong><span>Every connected account gets one real AI diagnosis per day.</span></div></div><button className="primary small" onClick={onUpgrade}>Get Pro · $1 / ₦1,000</button></div></div>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
function Finding({title,icon,items}:{title:string;icon:string;items:string[]}){return <div className="finding"><div className="finding-head"><b>{icon}</b><h3>{title}</h3></div>{items.map(x=><p key={x}>{x}</p>)}</div>}

function MenuDrawer({close,openBlog,openBlogger,setTab,onEdit,onNotice,onEnableNotifications,onUpgrade}:{close:()=>void;openBlog:()=>void;openBlogger:()=>void;setTab:(t:Tab)=>void;onEdit:()=>void;onNotice:(s:string)=>void;onEnableNotifications:()=>void;onUpgrade:()=>void}) {
 const action=(fn:()=>void)=>{close();fn()};
 return <div className="menu-backdrop" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><strong>WyBlog</strong><span>Control panel & Blogger tools</span></div><button className="icon-btn" onClick={close}><X/></button></div>
 <MenuGroup title="CREATE" items={[["New article",<FileText/>,()=>action(onEdit)],["Article drafts",<Save/>,()=>action(()=>onNotice("Drafts will sync through the Blogger posts API."))]]}/>
 <MenuGroup title="MY BLOG" items={[["Open blog",<ExternalLink/>,()=>action(openBlog)],["Blogger editor",<ExternalLink/>,()=>action(openBlogger)]]}/>
 <MenuGroup title="BLOGGER CONTENT" items={[["Posts",<FileText/>,()=>action(()=>setTab("posts"))],["Pages · About / Privacy / Contact",<FileText/>,()=>action(()=>setTab("pages"))]]}/>
 <MenuGroup title="THEME & LAYOUT" items={[["Open Blogger theme editor",<ExternalLink/>,()=>action(openBlogger)]]}/>
 <MenuGroup title="TOOLS" items={[
 ["Enable notifications",<Activity/>,()=>action(onEnableNotifications)],["SEO & plugins",<Zap/>,()=>action(()=>setTab("plugins"))],["AI diagnosis",<Bot/>,()=>action(()=>setTab("diagnosis"))]]}/>
 <MenuGroup title="ACCOUNT" items={[["Upgrade to Pro",<Sparkles/>,()=>action(onUpgrade)]]}/>
 <div className="drawer-footer">WyBlog · Blogger remains your publishing backend</div></aside></div>
}
function MenuGroup({title,items}:{title:string;items:Array<[string,ReactNode,()=>void]>}){return <div className="menu-group"><p>{title}</p>{items.map(([label,icon,fn])=><button key={label} onClick={fn}>{icon}<span>{label}</span><ChevronRight/></button>)}</div>}

function EditorPage({onClose,onNotice,blogConnected}:{onClose:()=>void;onNotice:(s:string)=>void;blogConnected:boolean}) {
 const editorRef=useRef<HTMLDivElement>(null);

 const savedSelection=useRef<Range|null>(null);
 const [mode,setMode]=useState<EditorMode>("visual");
 const [html,setHtml]=useState(()=>{const saved=localStorage.getItem("wyblog:draft:html")||""; return saved.includes("Welcome to WyBlog") ? "" : saved;});
 const [title,setTitle]=useState(()=>{const saved=localStorage.getItem("wyblog:draft:title")||""; return saved==="My New Blogger Article" ? "" : saved;});
 const [meta,setMeta]=useState(()=>localStorage.getItem("wyblog:draft:meta")||"");
 const [seoTitle,setSeoTitle]=useState(()=>localStorage.getItem("wyblog:draft:seoTitle")||"");
 const [labels,setLabels]=useState(()=>localStorage.getItem("wyblog:draft:labels")||"");
 const [featureUrl,setFeatureUrl]=useState(()=>localStorage.getItem("wyblog:draft:feature")||"");
 const [savedAt,setSavedAt]=useState<string>("Saved locally");
 const [cloudSaving,setCloudSaving]=useState(false);
 const [publishing,setPublishing]=useState(false);
 const [savingBlogger,setSavingBlogger]=useState(false);
 const [seoOpen,setSeoOpen]=useState(true);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [bloggerOpen,setBloggerOpen]=useState(false);
 const [backupOpen,setBackupOpen]=useState(false);
 const [dangerOpen,setDangerOpen]=useState(false);
 const [preview,setPreview]=useState(false);
 const [publishSuccess,setPublishSuccess]=useState(false);

 const [showDelete,setShowDelete]=useState(false);
 const [linkDialog,setLinkDialog]=useState(false);
 const [linkUrl,setLinkUrl]=useState("");
 const [linkTitle,setLinkTitle]=useState("");
 const [mediaKind,setMediaKind]=useState<"image"|"video"|null>(null);
 const [mediaUrl,setMediaUrl]=useState("");


 useEffect(()=>{ if(editorRef.current && mode==="visual" && editorRef.current.innerHTML!==html) editorRef.current.innerHTML=html; },[mode]);
useEffect(()=>{
   const raw=localStorage.getItem("wyblog:pending-plugin");
   if(!raw) return;
   try {
     const plugin=JSON.parse(raw) as {id:string;name:string;snippet:string;target?:string};
     localStorage.removeItem("wyblog:pending-plugin");
     const target=plugin.target||"article-end";
     const marker=`<!-- wyblog-plugin:${plugin.id} -->`;
     if(html.includes(marker)){ onNotice(`${plugin.name} is already integrated in this article.`); return; }
     const block=`${marker}\n${plugin.snippet}`;
     const next=target==="article-start"?block+(html?`\n${html}`:""):(html?`${html}\n${block}`:block);
     setHtml(next);
     if(editorRef.current && mode==="visual") editorRef.current.innerHTML=next;
     localStorage.setItem(`wyblog:plugin-installed:${plugin.id}`,"1"); onNotice(`${plugin.name} integrated into this article.`);
   } catch { localStorage.removeItem("wyblog:pending-plugin"); onNotice("The plugin integration request was invalid."); }
 },[]);

 useEffect(()=>{localStorage.setItem("wyblog:draft:title",title);localStorage.setItem("wyblog:draft:seoTitle",seoTitle);localStorage.setItem("wyblog:draft:meta",meta);localStorage.setItem("wyblog:draft:labels",labels);localStorage.setItem("wyblog:draft:feature",featureUrl);},[title,seoTitle,meta,labels,featureUrl]);
 useEffect(()=>{const t=window.setTimeout(()=>{localStorage.setItem("wyblog:draft:html",html);setSavedAt("Saved locally · "+new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));},150);return()=>window.clearTimeout(t)},[html]);
 const cloudRevision=useRef(0);
 useEffect(()=>{
   let active=true;
   void loadDraftCloud().then((draft)=>{
     if(!active||!draft) return;
     if(!localStorage.getItem("wyblog:draft:html") && draft.html!==undefined){ const next=draft.html||""; setHtml(next); if(editorRef.current && mode==="visual") editorRef.current.innerHTML=next; }
     if(!localStorage.getItem("wyblog:draft:title") && draft.title!==undefined) setTitle(draft.title||"");
     if(!localStorage.getItem("wyblog:draft:seoTitle") && draft.seoTitle!==undefined) setSeoTitle(draft.seoTitle||"");
     if(!localStorage.getItem("wyblog:draft:meta") && draft.meta!==undefined) setMeta(draft.meta||"");
     if(!localStorage.getItem("wyblog:draft:labels") && draft.labels!==undefined) setLabels(draft.labels||"");
     if(!localStorage.getItem("wyblog:draft:feature") && draft.featureUrl!==undefined) setFeatureUrl(draft.featureUrl||"");
   }).catch(()=>{});
   return()=>{active=false};
 },[]);
 useEffect(()=>{const revision=++cloudRevision.current;const t=window.setTimeout(()=>{if(!title.trim()&&!html.trim()&&!meta.trim()&&!labels.trim()&&!featureUrl.trim()){setCloudSaving(false);return;} setCloudSaving(true);void saveDraftCloud({title,html,seoTitle,meta,labels,featureUrl}).then(()=>{if(revision===cloudRevision.current)setSavedAt("Saved to Firestore · "+new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));}).catch(()=>{if(revision===cloudRevision.current)setSavedAt("Saved locally · cloud sync unavailable");}).finally(()=>{if(revision===cloudRevision.current)setCloudSaving(false)});},700);return()=>window.clearTimeout(t)},[title,html,seoTitle,meta,labels,featureUrl]);

 const syncFromEditor=()=>{if(editorRef.current)setHtml(editorRef.current.innerHTML)};
 const plainText=()=>{const doc=new DOMParser().parseFromString(html,"text/html");return (doc.body?.innerText||"").replace(/\s+/g," ").trim()};
 const wordCount=plainText()?plainText().split(" ").length:0;

 const saveSelection=()=>{const sel=window.getSelection();if(sel&&sel.rangeCount)savedSelection.current=sel.getRangeAt(0).cloneRange()};
 const restoreSelection=()=>{const sel=window.getSelection();if(sel&&savedSelection.current){sel.removeAllRanges();sel.addRange(savedSelection.current)}};
 const command=(cmd:string,value?:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand(cmd,false,value);syncFromEditor();saveSelection();};
 const insertHtml=(fragment:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand("insertHTML",false,fragment);syncFromEditor();saveSelection()};
 const insertText=(text:string)=>{restoreSelection();editorRef.current?.focus();document.execCommand("insertText",false,text);syncFromEditor();saveSelection()};
 const openGoogle=()=>{const text=window.getSelection()?.toString().trim();window.open("https://www.google.com/search?q="+encodeURIComponent(text||title),"_blank","noopener,noreferrer")};
 const openLinkDialog=()=>{saveSelection();setLinkUrl("");setLinkTitle("");setLinkDialog(true)};
 const applyLink=()=>{const url=linkUrl.trim();if(!url){onNotice("Enter a link URL.");return}if(!/^https?:\/\//i.test(url)){onNotice("Use a full http:// or https:// URL.");return}restoreSelection();editorRef.current?.focus();document.execCommand("createLink",false,url);const range=savedSelection.current;const root=editorRef.current;if(linkTitle.trim()&&range&&root){let node:Element|null=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;const anchor=node?.closest("a")||root.querySelector(`a[href="${CSS.escape(url)}"]`);anchor?.setAttribute("title",linkTitle.trim())}syncFromEditor();setLinkDialog(false)};

 const openMedia=(kind:"image"|"video")=>{setMediaKind(kind);setMediaUrl("");};
 const applyMedia=()=>{const url=mediaUrl.trim();if(!/^https:\/\//i.test(url)){onNotice("Use a public HTTPS media URL.");return;}if(mediaKind==="image")insertHtml(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto" />`);else if(mediaKind==="video")insertHtml(`<video controls style="max-width:100%"><source src="${escapeHtml(url)}"></video>`);setMediaKind(null);setMediaUrl("");};
 const deleteAll=()=>{setShowDelete(false);setTitle("");setHtml("");setSeoTitle("");setMeta("");setLabels("");setFeatureUrl("");void clearDraftCloud().catch(()=>{});Object.keys(localStorage).filter(k=>k.startsWith("wyblog:draft:")||k.startsWith("wyblog:plugin-installed:")).forEach(k=>localStorage.removeItem(k));if(editorRef.current)editorRef.current.innerHTML="";void clearDraftCloud().catch(()=>{});onNotice("Draft cleared locally and from Firestore when cloud access is available. Nothing was deleted from Blogger.");};
 const publishArticle=async()=>{if(publishing||savingBlogger)return;if(!blogConnected){onNotice("Connect Blogger before publishing.");return}if(!title.trim()||!html.trim()){onNotice("Add an article title and body before publishing.");return}setPublishing(true);try{const result=await saveBloggerPost({title:title.trim(),content:html,labels:labels.split(",").map(x=>x.trim()).filter(Boolean),published:true});setPublishSuccess(true);onNotice("Published to Blogger successfully.");}catch(error){onNotice(error instanceof Error?error.message:"Blogger publish failed. Nothing was published.");}finally{setPublishing(false);}};
 const saveBloggerDraft=async()=>{if(publishing||savingBlogger)return;if(!blogConnected){onNotice("Connect Blogger before saving to Blogger.");return}setSavingBlogger(true);try{await saveBloggerPost({title:title.trim()||"Untitled",content:html,labels:labels.split(",").map(x=>x.trim()).filter(Boolean),published:false});onNotice("Draft saved to Blogger successfully.");}catch(error){onNotice(error instanceof Error?error.message:"Blogger draft save failed. Nothing was saved remotely.");}finally{setSavingBlogger(false);}};

 return <div className="editor-shell">
   <header className="editor-head"><button className="icon-btn" onClick={onClose}><X/></button><div><strong>Article Editor</strong><span>{savedAt}</span></div><div className="editor-head-actions"><button className="secondary small" onClick={()=>setPreview(true)}><Eye/> Preview</button><button className="secondary small" onClick={()=>void saveBloggerDraft()} disabled={cloudSaving||savingBlogger||publishing}><Save/> {savingBlogger?"Saving…":"Save draft"}</button><button className="primary small" onClick={()=>void publishArticle()} disabled={publishing||savingBlogger}><Zap/> {publishing?"Publishing…":"Publish"}</button></div></header>
   <main className="editor-main">
     <input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Article title" aria-label="Article title"/>
     <div className="editor-grid">
       <section>
         <div className="floating-toolbar" onPointerDown={e=>{if((e.target as HTMLElement).closest("button"))e.preventDefault()}}>
           <ToolbarButton icon={<Undo2/>} label="Undo" onClick={()=>command("undo")}/><ToolbarButton icon={<Redo2/>} label="Redo" onClick={()=>command("redo")}/>
           <ToolbarButton icon={<Bold/>} label="Bold" onClick={()=>command("bold")}/><ToolbarButton icon={<Italic/>} label="Italic" onClick={()=>command("italic")}/>
           <select aria-label="Font" onChange={e=>command("fontName",e.target.value)} defaultValue="Arial"><option value="Arial">Font</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Times New Roman">Times</option></select>
           <select aria-label="Heading size" onChange={e=>command("formatBlock",e.target.value)} defaultValue="p"><option value="p">Body</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option><option value="h5">H5</option><option value="h6">H6</option></select>
           <ToolbarButton icon={<AlignLeft/>} label="Left" onClick={()=>command("justifyLeft")}/><ToolbarButton icon={<AlignCenter/>} label="Center" onClick={()=>command("justifyCenter")}/><ToolbarButton icon={<AlignRight/>} label="Right" onClick={()=>command("justifyRight")}/><ToolbarButton icon={<List/>} label="Bulleted list" onClick={()=>command("insertUnorderedList")}/><ToolbarButton icon={<ListOrdered/>} label="Numbered list" onClick={()=>command("insertOrderedList")}/><ToolbarButton icon={<Quote/>} label="Quote" onClick={()=>command("formatBlock","blockquote")}/><ToolbarButton icon={<Strikethrough/>} label="Strikethrough" onClick={()=>command("strikeThrough")}/><ToolbarButton icon={<Minus/>} label="Divider" onClick={()=>insertHtml("<hr />")}/>
           <label className="color-tool" title="Text color"><Type/><input type="color" defaultValue="#111111" onChange={e=>command("foreColor",e.target.value)}/></label>
           <label className="color-tool" title="Highlight"><Highlighter/><input type="color" defaultValue="#fff2a8" onChange={e=>command("hiliteColor",e.target.value)}/></label>
           <ToolbarButton icon={<Link2/>} label="Link" onClick={openLinkDialog}/>
           <ToolbarButton icon={<Search/>} label="Google search" onClick={openGoogle}/><ToolbarButton icon={<Copy/>} label="Copy" onClick={()=>{const text=window.getSelection()?.toString()||"";if(!text){onNotice("Select text to copy.");return}if(!navigator.clipboard){onNotice("Clipboard access is unavailable. Select and copy manually.");return;} void navigator.clipboard.writeText(text).then(()=>onNotice("Selected text copied."),()=>onNotice("Clipboard access was blocked by the browser."))}}/>
           <ToolbarButton icon={<ImagePlus/>} label="Image URL" onClick={()=>openMedia("image")}/><ToolbarButton icon={<Video/>} label="Video URL" onClick={()=>openMedia("video")}/>
           <ToolbarButton icon={<span className="asterisk">＊</span>} label="Asterisk" onClick={()=>insertText("＊")}/>
           <ToolbarButton icon={<RotateCcw/>} label="Clear formatting" onClick={()=>command("removeFormat")}/>
           <ToolbarButton icon={<Code2/>} label="HTML" onClick={()=>setMode(mode==="visual"?"html":"visual")}/>
         </div>
         {mode==="visual"
           ? <div ref={editorRef} className="rich-editor" contentEditable suppressContentEditableWarning onInput={syncFromEditor} onMouseUp={saveSelection} onKeyUp={saveSelection} onTouchEnd={saveSelection} data-placeholder="Start writing…"/>
           : <textarea className="html-editor" value={html} onChange={e=>setHtml(e.target.value)} spellCheck={false} aria-label="HTML source"/>}
         <div className="editor-foot"><span>{wordCount.toLocaleString()} words · Unlimited article body</span><span>{mode==="html"?"HTML source mode":"Visual mode"}</span></div>
       </section>
       <aside className="editor-side">
         <Collapsible title="SEO details" open={seoOpen} onToggle={()=>setSeoOpen(v=>!v)}><label>SEO title<input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} placeholder="Search result title"/></label><label>Meta description<textarea value={meta} onChange={e=>setMeta(e.target.value)} placeholder="Write a search-friendly description…"/></label><div className="seo-counter">{meta.length}/160 recommended</div><label>Labels<input value={labels} onChange={e=>setLabels(e.target.value)} placeholder="news, tech, tutorial"/></label><label>Feature image URL<input value={featureUrl} onChange={e=>setFeatureUrl(e.target.value)} placeholder="Recommended 1200 × 675 px"/></label><small>Recommended feature image: <b>1200 × 675 px</b> (16:9). The URL can later be replaced with a Blogger-hosted image.</small></Collapsible>
         <Collapsible title="Theme & layers" open={settingsOpen} onToggle={()=>setSettingsOpen(v=>!v)}><p className="side-note">Blogger API v3 exposes posts, pages, comments, blog metadata and pageviews, but not theme/template or layout-layer editing. WyBlog therefore won't pretend these controls are available.</p><button className="secondary small" onClick={()=>window.open("https://www.blogger.com/","_blank","noopener,noreferrer")}><ExternalLink/> Open Blogger theme editor</button></Collapsible>
         <Collapsible title="Blogger setup" open={bloggerOpen} onToggle={()=>setBloggerOpen(v=>!v)}><div className="setting-list"><p className="side-note">Labels are supported directly in the editor. Comments, page views and blog metadata are not exposed as editor actions yet, so WyBlog does not present them as working buttons.</p></div></Collapsible>
         <Collapsible title="Backup" open={backupOpen} onToggle={()=>setBackupOpen(v=>!v)}><button className="secondary small" onClick={()=>downloadBackup({title,html,meta,labels,featureUrl})}><FolderOpen/> Download local backup</button><small>Local export is available on this device. No remote backup is claimed unless a future Drive integration is enabled.</small></Collapsible>
         <Collapsible title="Danger zone" open={dangerOpen} onToggle={()=>setDangerOpen(v=>!v)}><button className="danger" onClick={()=>setShowDelete(true)}><Trash2/> Delete all article content</button></Collapsible>
       </aside>
     </div>
   </main>
   <div className="editor-upload-row"><button className="secondary small" onClick={()=>setMode(mode==="visual"?"html":"visual")}><Code2/> {mode==="visual"?"Switch to HTML":"Switch to visual"}</button></div>
   {preview&&<Preview title={title} html={html} close={()=>setPreview(false)}/>}
   {publishSuccess&&<Confirm title="Published successfully 🎉" text="Your article was accepted by Blogger. The editor stays open so you can continue writing or close it." cancel={()=>setPublishSuccess(false)} confirm={()=>{setPublishSuccess(false);onClose();}} cancelLabel="Continue writing" confirmLabel="Close editor"/>}
   {showDelete&&<Confirm title="Clear this article?" text="This clears the local draft only. It does not delete anything from Blogger." cancel={()=>setShowDelete(false)} confirm={deleteAll}/>}
   {mediaKind&&<MediaDialog kind={mediaKind} url={mediaUrl} setUrl={setMediaUrl} cancel={()=>setMediaKind(null)} apply={applyMedia}/>}
   {linkDialog&&<LinkDialog url={linkUrl} title={linkTitle} setUrl={setLinkUrl} setTitle={setLinkTitle} cancel={()=>setLinkDialog(false)} apply={applyLink}/>}
 </div>
}

function NotificationsView({plan,notifications,suggestions,onRefresh,onGenerate,onRead,onUpgrade,onNotice}:{plan:"free"|"pro";notifications:import("./types").NotificationItem[];suggestions:import("./types").SEOSuggestion[];onRefresh:()=>Promise<void>;onGenerate:()=>Promise<void>;onRead:(id:string)=>Promise<void>;onUpgrade:()=>void;onNotice:(s:string)=>void}){
 return <div><section className="section-heading"><div><p className="eyebrow">NOTIFICATIONS & SEO IDEAS</p><h1>Your publishing alerts.</h1><p className="section-sub">Daily site diagnosis updates and, for Pro, five focused low-competition article ideas every three days.</p></div><button className="secondary small" onClick={()=>void onRefresh()}><Bell/> Refresh</button></section><section className="notification-hero"><div><WandSparkles/><div><b>{plan==="pro"?"Pro SEO suggestions are active":"Unlock 3-day SEO suggestions"}</b><span>{plan==="pro"?"Five ideas with suggested Africa/Lagos posting times arrive every three days.":"Get five focused topic ideas every three days, tailored to your connected Blogger site's actual content."}</span></div></div>{plan!=="pro"&&<button className="primary small" onClick={onUpgrade}>Get Pro</button>}{plan==="pro"&&<button className="secondary small" onClick={()=>void onGenerate()}>Generate if due</button>}</section>{suggestions.length>0&&<section><div className="section-heading"><div><p className="eyebrow">LATEST TOPIC SET</p><h2>Five low-competition ideas</h2></div></div><div className="suggestion-grid">{suggestions.slice(0,5).map(s=><article className="suggestion-card" key={s.id}><span className="low-tag">LOW COMPETITION</span><h3>{s.topic}</h3><p>{s.reason}</p><div className="keyword-row">{s.keywords.map(k=><span key={k}>{k}</span>)}</div><small><Clock size={13}/> Best time: {s.suggestedTime}</small></article>)}</div></section>}<section><div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent notifications</h2></div></div><div className="notification-list">{notifications.length?notifications.map(n=><button className={`notification-row ${n.read?"read":"unread"}`} key={n.id} onClick={()=>void onRead(n.id)}><span className="notification-icon"><Bell/></span><span><b>{n.title}</b><small>{n.body}</small></span><ChevronRight/></button>):<div className="empty-state"><strong>No notifications yet.</strong><p>Enable push notifications from the menu to receive important alerts.</p></div>}</div></section></div>
}
function WelcomeOnboarding({onDone}:{onDone:()=>void}){const[step,setStep]=useState(0);const slides=[{k:"WRITE",title:"Blogger, but built for your phone.",text:"Write, format and publish articles with a focused mobile editor.",icon:<PenIcon/>},{k:"IMPROVE",title:"Turn every post into an SEO workflow.",text:"Use plugins, daily site health checks and practical topic ideas without leaving your workspace.",icon:<Sparkles/>},{k:"PUBLISH",title:"Plan, publish and keep moving.",text:"Your Blogger account remains the publishing backend while WyBlog keeps the work simple.",icon:<Zap/>}];const s=slides[step];return <div className="onboarding"><div className="roller-track" style={{transform:`translateX(-${step*100}%)`}}>{slides.map((x,i)=><section className="onboard-slide" key={x.k}><div className="ride-orb orb-one"/><div className="ride-orb orb-two"/><div className="onboard-art"><div className="roller-line"/><div className="roller-car">{x.icon}</div></div><span className="eyebrow">{x.k} · {i+1}/3</span><h1>{x.title}</h1><p>{x.text}</p></section>)}</div><div className="onboard-controls"><button className="secondary" onClick={onDone}>Skip</button><div className="dots">{slides.map((_,i)=><span key={i} className={i===step?"active":""}/>)}</div>{step<2?<button className="primary" onClick={()=>setStep(v=>v+1)}>Next <ChevronRight/></button>:<button className="primary" onClick={onDone}>Start blogging <Zap/></button>}</div></div>}

function ProCheckout({accountEmail,accountName,close,onSuccess,onNotice}:{accountEmail:string;accountName:string;close:()=>void;onSuccess:()=>void;onNotice:(s:string)=>void}){
 const [currency,setCurrency]=useState<"USD"|"NGN">("NGN"); const [name,setName]=useState(accountName||""); const [email]=useState(accountEmail||""); const [number,setNumber]=useState(""); const [expiry,setExpiry]=useState(""); const [cvv,setCvv]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [reference,setReference]=useState(""); const [chargeId,setChargeId]=useState(""); const [auth,setAuth]=useState<any>(null); const [authValue,setAuthValue]=useState("");
 const pay=async()=>{if(busy)return;setError("");try{if(!email)throw new Error("Reconnect Blogger first so WyBlog can use the connected Google account email.");if(!name.trim())throw new Error("Enter the full name exactly as it appears on the card.");if(!number.replace(/\D/g,"")||number.replace(/\D/g,"").length<12)throw new Error("Enter a valid card number.");if(!/^\d{2}\/\d{2}$/.test(expiry))throw new Error("Enter card expiry as MM/YY.");if(!/^\d{3,4}$/.test(cvv))throw new Error("Enter a valid CVV.");setBusy(true);const cfg=await getBillingConfig();if(!cfg.encryptionKey)throw new Error("Flutterwave v4 encryption is not configured on the server.");const raw=Uint8Array.from(atob(cfg.encryptionKey),c=>c.charCodeAt(0));if(raw.length!==32)throw new Error("Flutterwave encryption key is invalid.");const ns=Array.from(crypto.getRandomValues(new Uint8Array(12))).map(x=>String.fromCharCode(65+(x%26))).join("");const key=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt"]);const enc=async(v:string)=>{const out=await crypto.subtle.encrypt({name:"AES-GCM",iv:new TextEncoder().encode(ns)},key,new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(out)))};const [mo,yr]=expiry.split("/");const result=await startProCheckout({currency,name:name.trim(),email,payment_method:{type:"card",card:{nonce:ns,encrypted_card_number:await enc(number.replace(/\D/g,"")),encrypted_expiry_month:await enc(mo),encrypted_expiry_year:await enc(yr),encrypted_cvv:await enc(cvv)}}});setReference(result.reference);setChargeId(result.chargeId||"");const redirect=result.nextAction?.redirect_url?.url||result.nextAction?.redirect_url||result.nextAction?.authorization?.redirect_url;if(redirect){window.location.assign(redirect);return;}if(result.authorization){setAuth(result.authorization);return;}if(result.status==="succeeded"){const v=await verifyProPayment(result.reference);if(v.plan==="pro")onSuccess();}else onNotice("Payment started. Complete the authorization step if Flutterwave requests one.");}catch(e){setError(e instanceof Error?e.message:"Payment could not be started.");}finally{setBusy(false)}};
 const submitAuth=async()=>{if(!auth||!authValue||!reference||!chargeId)return;setBusy(true);try{const mode=String(auth.mode||auth.type||"").toLowerCase();const payload=mode.includes("otp")?{type:"otp",otp:{code:authValue}}:mode.includes("pin")?{type:"pin",pin:{code:authValue}}:{type:mode||"otp",value:authValue};const r=await authorizeProPayment(reference,chargeId,payload);const redirect=r.nextAction?.redirect_url?.url||r.nextAction?.redirect_url||r.nextAction?.authorization?.redirect_url;if(redirect){window.location.assign(redirect);return;}const v=await verifyProPayment(reference);if(v.plan==="pro")onSuccess();else setError("Flutterwave has not marked the payment successful yet. Please wait a moment and verify again.");}catch(e){setError(e instanceof Error?e.message:"Authorization failed.");}finally{setBusy(false)}};
 return <div className="confirm-backdrop"><div className="confirm-card payment-card"><div className="plugin-detail-head"><div><h3>Unlock WyBlog Pro</h3><p>All Pro plugins unlock together · $1/month or ₦1,000/month.</p></div><button className="icon-btn" onClick={close} disabled={busy}><X/></button></div><label>Full name — must match the card name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="cc-name" placeholder="Full name on card"/></label><label>Connected Blogger email<input value={email} readOnly autoComplete="email"/></label><div className="pro-price-grid"><button className={currency==="USD"?"primary":"secondary"} onClick={()=>setCurrency("USD")}>USD $1</button><button className={currency==="NGN"?"primary":"secondary"} onClick={()=>setCurrency("NGN")}>NGN ₦1,000</button></div><label>Card number<input inputMode="numeric" autoComplete="cc-number" value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,"").slice(0,19).replace(/(.{4})/g,"$1 ").trim())} placeholder="1234 5678 9012 3456"/></label><div className="card-fields"><label>Expiry<input inputMode="numeric" autoComplete="cc-exp" value={expiry} onChange={e=>{let v=e.target.value.replace(/\D/g,"").slice(0,4);if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);setExpiry(v)}} placeholder="MM/YY"/></label><label>CVV<input inputMode="numeric" autoComplete="cc-csc" type="password" value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="CVV"/></label></div>{error&&<div className="payment-error">{error}</div>}{auth&&<div className="payment-auth"><b>{auth.mode||auth.type||"Authorization"} required</b><input inputMode="numeric" value={authValue} onChange={e=>setAuthValue(e.target.value.replace(/\D/g,""))} placeholder="Enter the requested code"/><button className="primary" onClick={()=>void submitAuth()} disabled={busy}>Authorize payment</button></div>} {!auth&&<button className="primary payment-submit" onClick={()=>void pay()} disabled={busy}>{busy?"Processing…":currency==="USD"?"Pay $1/month":"Pay ₦1,000/month"}<CreditCard size={16}/></button>}<small>Card data is encrypted for Flutterwave v4 before the payment request. WyBlog does not store CVV. Payment is not considered successful until Flutterwave confirms it.</small></div></div>
}

function ToolbarButton({icon,label,onClick}:{icon:ReactNode;label:string;onClick:()=>void}){const [hint,setHint]=useState(false);const timer=useRef<number|null>(null);const long=useRef(false);const help:Record<string,string>={Undo:"Undo the last edit",Redo:"Redo the last edit",Bold:"Make selected text bold",Italic:"Italicize selected text",Left:"Align text left",Center:"Center text",Right:"Align text right","Bulleted list":"Create a bullet list","Numbered list":"Create a numbered list",Quote:"Format text as a quote",Strikethrough:"Cross out selected text",Divider:"Insert a horizontal divider",Link:"Add a clickable link","Google search":"Search the selected topic on Google",Copy:"Copy selected text", "Image URL":"Insert an image from a public URL", "Video URL":"Insert a video from a public URL",Asterisk:"Insert an asterisk symbol","Clear formatting":"Remove direct text formatting",HTML:"Switch between visual and HTML source"};const down=()=>{long.current=false;timer.current=window.setTimeout(()=>{long.current=true;setHint(true)},350)};const up=()=>{if(timer.current)window.clearTimeout(timer.current);setHint(false)};const click=()=>{if(long.current){long.current=false;return}onClick()};return <button className="toolbar-btn" aria-label={label} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onClick={click}>{icon}{hint&&<span className="press-hint">{label} — {help[label]||"Toolbar action"}</span>}</button>}
function Collapsible({title,open,onToggle,children}:{title:string;open:boolean;onToggle:()=>void;children:ReactNode}){return <div className="side-card"><button className="side-title" onClick={onToggle}><b>{title}</b>{open?<ChevronDown/>:<ChevronRight/>}</button>{open&&<div className="side-body">{children}</div>}</div>}
function Preview({title,html,close}:{title:string;html:string;close:()=>void}){return <div className="preview-backdrop"><div className="preview-panel"><header><strong>Preview</strong><button className="icon-btn" onClick={close}><X/></button></header><article className="preview-article"><h1>{title}</h1><div dangerouslySetInnerHTML={{__html:sanitizeHtml(html)}}/></article></div></div>}
function Confirm({title,text,cancel,confirm,cancelLabel="Cancel",confirmLabel="Clear"}:{title:string;text:string;cancel:()=>void;confirm:()=>void;cancelLabel?:string;confirmLabel?:string}){return <div className="confirm-backdrop"><div className="confirm-card"><h3>{title}</h3><p>{text}</p><div><button className="secondary" onClick={cancel}>{cancelLabel}</button><button className={confirmLabel==="Clear"?"danger filled":"primary"} onClick={confirm}>{confirmLabel}</button></div></div></div>}
function MediaDialog({kind,url,setUrl,cancel,apply}:{kind:"image"|"video";url:string;setUrl:(v:string)=>void;cancel:()=>void;apply:()=>void}){return <div className="confirm-backdrop"><div className="confirm-card link-dialog"><h3>Insert {kind}</h3><p className="side-note">Use a public HTTPS {kind} URL that Blogger readers can access.</p><label>HTTPS URL<input autoFocus inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder={kind==="image"?"https://example.com/image.jpg":"https://example.com/video.mp4"}/></label><div><button className="secondary" onClick={cancel}>Cancel</button><button className="primary" onClick={apply}>Insert {kind}</button></div></div></div>}
function LinkDialog({url,title,setUrl,setTitle,cancel,apply}:{url:string;title:string;setUrl:(v:string)=>void;setTitle:(v:string)=>void;cancel:()=>void;apply:()=>void}){return <div className="confirm-backdrop"><div className="confirm-card link-dialog"><h3>Add link</h3><label>URL<input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com"/></label><label>Link title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Describe this link"/></label><div><button className="secondary" onClick={cancel}>Cancel</button><button className="primary" onClick={apply}>Add link</button></div></div></div>}
function PenIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.5 6.5 4 4"/></svg>}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!))}
function sanitizeHtml(value:string){
 const doc=new DOMParser().parseFromString(value,"text/html");
 doc.querySelectorAll("script,iframe,object,embed,form,style").forEach((el)=>el.remove());
 doc.querySelectorAll("*").forEach((el)=>{
   [...el.attributes].forEach((attr)=>{
     if(attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
     if((attr.name==="href"||attr.name==="src") && /^(javascript:|data:text\/html)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
   });
 });
 return doc.body.innerHTML;
}
function downloadBackup(data:Record<string,string>){const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="wyblog-article-backup.json";a.click();URL.revokeObjectURL(url)}

export default App;
