import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Film, Instagram, LayoutDashboard, Plus, Settings2, ShieldCheck, Sparkles, Users, Video } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(date).toUpperCase();
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = user.memberships[0];
  if (!membership) redirect("/register");
  const workspace = membership.workspace;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [channels, scheduledPosts, publishedThisMonth, mediaCount, upcoming] = await Promise.all([
    prisma.socialAccount.count({ where: { workspaceId: workspace.id } }),
    prisma.post.count({ where: { workspaceId: workspace.id, status: { in: ["SCHEDULED", "QUEUED"] } } }),
    prisma.post.count({ where: { workspaceId: workspace.id, status: "PUBLISHED", publishedAt: { gte: monthStart } } }),
    prisma.mediaAsset.count({ where: { workspaceId: workspace.id } }),
    prisma.post.findMany({
      where: { workspaceId: workspace.id, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "QUEUED"] } },
      include: { socialAccount: true },
      orderBy: { scheduledAt: "asc" },
      take: 5
    })
  ]);

  const firstName = user.name?.split(" ")[0] || "creator";

  return <main className="shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Video size={20}/></span><span>clipflow</span></Link>
      <div className="workspace"><div className="workspace-avatar">{workspace.name.charAt(0).toUpperCase()}</div><div><b>{workspace.name}</b><small>{membership.role.toLowerCase()} workspace</small></div><span className="chevron">⌄</span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <Link className="nav-item active" href="/"><LayoutDashboard size={18}/> Overview</Link>
        <Link className="nav-item" href="/posts"><CalendarDays size={18}/> Content planner</Link>
        <Link className="nav-item" href="/media"><Film size={18}/> Media library</Link>
        <Link className="nav-item" href="/posts"><Clock3 size={18}/> Drafts & posts</Link>
        <Link className="nav-item" href="/channels"><Users size={18}/> Social accounts</Link>
      </nav>
      <div className="nav-label second">MANAGE</div>
      <nav><Link className="nav-item" href="/assistant"><Sparkles size={18}/> AI assistant <span className="soon">Soon</span></Link><Link className="nav-item" href="/settings"><Settings2 size={18}/> Settings</Link></nav>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-icon"><ShieldCheck size={17}/></div><b>Your creator space</b><p>Your workspace is private to you and the people you invite.</p><Link href="/settings">Workspace settings <ArrowUpRight size={13}/></Link></div>
        <div className="profile"><div className="profile-avatar">{firstName.charAt(0).toUpperCase()}</div><div><b>{user.name || user.email}</b><small>{user.email}</small></div><form action={logout}><button className="logout-button" type="submit">Sign out</button></form></div>
      </div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="crumb">{workspace.name} <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="status-dot"></span><span className="top-status">Workspace ready</span><div className="avatar-small">{firstName.charAt(0).toUpperCase()}</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()}</div><h1>Good to have you here, {firstName}.</h1><p className="subhead">Your content workspace is ready. Create drafts and prepare your next posts.</p></div><Link className="primary-button" href="/posts/new"><Plus size={17}/> Create a post</Link></div>
        <div className="notice"><Sparkles size={17}/><div><b>{channels === 0 ? "Your workspace is ready for its first channel." : "Your channels are connected."}</b><span>{channels === 0 ? "Connect a social account to start organising your publishing workflow." : "Your connected channels and content are managed from this workspace."}</span></div><Link href="/channels">Manage channels <ArrowUpRight size={14}/></Link></div>
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-top"><span>Connected channels</span><span className="stat-icon"><Instagram size={17}/></span></div><div className="stat-value">{channels} <small>/ 3</small></div><div className="stat-foot">Your social accounts</div></article>
          <article className="stat-card"><div className="stat-top"><span>Scheduled posts</span><span className="stat-icon violet"><CalendarDays size={17}/></span></div><div className="stat-value">{scheduledPosts}</div><div className="stat-foot">Ready in your queue</div></article>
          <article className="stat-card"><div className="stat-top"><span>Published this month</span><span className="stat-icon green"><CheckCircle2 size={17}/></span></div><div className="stat-value">{publishedThisMonth}</div><div className="stat-foot">Across all channels</div></article>
          <article className="stat-card"><div className="stat-top"><span>Media library</span><span className="stat-icon orange"><Film size={17}/></span></div><div className="stat-value">{mediaCount} <small>files</small></div><div className="stat-foot">Videos and creative assets</div></article>
        </div>
        <div className="section-heading"><div><h2>Upcoming content</h2><p>Your next scheduled posts and drafts.</p></div><Link href="/posts">View all posts <ArrowUpRight size={14}/></Link></div>
        <div className="posts-card">
          {upcoming.length === 0 ? <div className="empty-state"><CalendarDays size={24}/><b>Your schedule is clear.</b><span>When you schedule content, it will appear here.</span><Link href="/posts/new">Create your first post <ArrowUpRight size={14}/></Link></div> : upcoming.map((post) => <div className="post-row" key={post.id}><div className="date-tile"><b>{formatDate(post.scheduledAt!).split(" ")[0]}</b><span>{formatDate(post.scheduledAt!).split(" ")[1]}</span></div><div className="post-info"><b>{post.caption.trim() || "Untitled post"}</b><span>{post.socialAccount?.platform ?? "No channel"} · {formatTime(post.scheduledAt!)}</span></div><span className="post-state">{post.status.toLowerCase()}</span></div>)}
        </div>
        <div className="footer-note">ClipFlow uses official platform integrations. Publishing capabilities are enabled only when the required platform permissions are approved.</div>
      </div>
    </section>
  </main>;
}
