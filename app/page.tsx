import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Film, Instagram, LayoutDashboard, Plus, Settings2, ShieldCheck, Sparkles, Users, Video } from "lucide-react";

const upcoming = [
  { day: "20", month: "NOV", time: "09:30", title: "Behind the scenes — studio setup", channel: "TikTok", state: "Scheduled", color: "pink" },
  { day: "20", month: "NOV", time: "14:00", title: "3 editing tips in 30 seconds", channel: "YouTube Shorts", state: "Ready", color: "red" },
  { day: "21", month: "NOV", time: "11:15", title: "New project reveal", channel: "Instagram", state: "Draft", color: "purple" }
];

export default function Home() {
  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark"><Video size={20}/></span><span>clipflow</span></a>
      <div className="workspace"><div className="workspace-avatar">M</div><div><b>My workspace</b><small>Personal workspace</small></div><span className="chevron">⌄</span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <a className="nav-item active" href="#"><LayoutDashboard size={18}/> Overview</a>
        <a className="nav-item" href="#"><CalendarDays size={18}/> Content calendar</a>
        <a className="nav-item" href="#"><Film size={18}/> Media library</a>
        <a className="nav-item" href="#"><Clock3 size={18}/> Publishing queue</a>
        <a className="nav-item" href="#"><Users size={18}/> Social accounts</a>
      </nav>
      <div className="nav-label second">MANAGE</div>
      <nav><a className="nav-item" href="#"><Sparkles size={18}/> AI assistant <span className="soon">Soon</span></a><a className="nav-item" href="#"><Settings2 size={18}/> Settings</a></nav>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><ShieldCheck size={17}/></div><b>Your creator space</b><p>Connect your channels and get your content organised.</p><a href="#">Explore setup <ArrowUpRight size={13}/></a></div><div className="profile"><div className="profile-avatar">K</div><div><b>Your profile</b><small>Free workspace</small></div><span className="chevron">•••</span></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="status-dot"></span><span className="top-status">All systems normal</span><button className="avatar-small">K</button></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">THURSDAY, NOVEMBER 19, 2026</div><h1>Your content, in motion.</h1><p className="subhead">A clear view of what you're creating and what's coming next.</p></div><button className="primary-button"><Plus size={17}/> Create post</button></div>
        <div className="notice"><Sparkles size={17}/><div><b>Your workspace is ready for its first channel.</b><span>Connect a social account to start organising your publishing workflow.</span></div><button>Connect account <ArrowUpRight size={14}/></button></div>
        <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Connected channels</span><span className="stat-icon"><Instagram size={17}/></span></div><div className="stat-value">0 <small>/ 3</small></div><div className="stat-foot">Your social accounts</div></article><article className="stat-card"><div className="stat-top"><span>Scheduled posts</span><span className="stat-icon violet"><CalendarDays size={17}/></span></div><div className="stat-value">0</div><div className="stat-foot">Ready in your queue</div></article><article className="stat-card"><div className="stat-top"><span>Published this month</span><span className="stat-icon green"><CheckCircle2 size={17}/></span></div><div className="stat-value">0</div><div className="stat-foot">Across all channels</div></article><article className="stat-card"><div className="stat-top"><span>Media library</span><span className="stat-icon orange"><Film size={17}/></span></div><div className="stat-value">0 <small>files</small></div><div className="stat-foot">Videos and creative assets</div></article></div>
        <div className="section-heading"><div><h2>Upcoming content</h2><p>Your next scheduled posts and drafts.</p></div><a href="#">View calendar <ArrowUpRight size={14}/></a></div>
        <div className="posts-card">{upcoming.map((post) => <div className="post-row" key={post.title}><div className="date-tile"><b>{post.day}</b><span>{post.month}</span></div><div className="post-info"><b>{post.title}</b><span>{post.channel} · {post.time}</span></div><span className={`channel-dot ${post.color}`}></span><span className={`post-state ${post.state.toLowerCase()}`}>{post.state}</span></div>)}</div>
        <div className="footer-note">ClipFlow is getting ready. Publishing integrations will be enabled as their official platform permissions are approved.</div>
      </div>
    </section>
  </main>;
}
