import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, FilePlus2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SchedulePostForm } from "@/app/calendar/schedule-post-form";

type PageProps = { searchParams: Promise<{ error?: string; scheduled?: string }> };

function formatUtc(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short"
  }).format(date);
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [scheduled, drafts, params] = await Promise.all([
    prisma.post.findMany({
      where: { workspaceId: membership.workspaceId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      include: { mediaAsset: true, targets: { include: { socialAccount: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 100
    }),
    prisma.post.findMany({
      where: { workspaceId: membership.workspaceId, status: "DRAFT" },
      include: { mediaAsset: true, targets: { include: { socialAccount: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100
    }),
    searchParams
  ]);

  return <main className="workspace-page">
    <header className="workspace-page-top"><Link href="/"><ArrowLeft size={16}/> Workspace</Link><span>CLIPFLOW / CALENDAR</span></header>
    <section className="workspace-page-content">
      <div className="workspace-page-heading"><div><div className="eyebrow">PUBLISHING PLANNER</div><h1>Content calendar</h1><p>Plan dates for your drafts and keep upcoming content organised.</p></div><Link className="primary-button" href="/posts/new"><FilePlus2 size={16}/> Create a post</Link></div>
      {params.scheduled === "1" && <div className="content-alert success">Your post has been added to the schedule. Automatic publishing is not active yet.</div>}
      {params.error === "time" && <div className="content-alert">Choose a valid future date and time at least one minute from now.</div>}
      {params.error === "post" && <div className="content-alert">That draft is no longer available to schedule. Refresh and try again.</div>}
      <div className="calendar-notice"><Clock3 size={16}/><span>Times are converted from your browser&apos;s local time and stored as UTC. Scheduled posts are planning records only; no background publishing worker is active yet.</span></div>
      <div className="calendar-section-heading"><div><h2>Upcoming schedule</h2><p>{scheduled.length} scheduled {scheduled.length === 1 ? "post" : "posts"}</p></div></div>
      {scheduled.length === 0 ? <div className="library-empty compact"><CalendarDays size={26}/><b>Nothing scheduled yet.</b><span>Choose a date for one of your drafts below.</span></div> : <div className="calendar-agenda">{scheduled.map((post) => <article className="calendar-agenda-row" key={post.id}>
        <div className="calendar-date-tile"><CalendarDays size={17}/><b>{post.scheduledAt ? formatUtc(post.scheduledAt) : "Date pending"}</b></div>
        <div className="calendar-post-details"><b>{post.caption.trim().slice(0, 120) || "Untitled post"}</b><span>{post.targets.length ? post.targets.map((target) => target.socialAccount.platform).join(" · ") : "No channel assigned"}{post.mediaAsset ? ` · ${post.mediaAsset.fileName}` : ""}</span></div>
        <span className="content-post-status scheduled-status">scheduled</span>
      </article>)}</div>}
      <div className="calendar-section-heading drafts-heading"><div><h2>Ready to schedule</h2><p>{drafts.length} drafts waiting for a date</p></div></div>
      {drafts.length === 0 ? <div className="library-empty compact"><b>No drafts waiting.</b><span>Create a post first, then schedule it here.</span></div> : <div className="calendar-draft-list">{drafts.map((post) => <article className="calendar-draft-row" key={post.id}>
        <div className="calendar-post-details"><b>{post.caption.trim().slice(0, 120) || "Untitled draft"}</b><span>{post.targets.length ? post.targets.map((target) => target.socialAccount.platform).join(" · ") : "No channel assigned"}{post.mediaAsset ? ` · ${post.mediaAsset.fileName}` : ""}</span></div>
        <SchedulePostForm postId={post.id}/>
      </article>)}</div>}
      <p className="storage-note">Scheduling records the intended publication time. ClipFlow will add queue processing, retries and platform publishing adapters in a later milestone.</p>
    </section>
  </main>;
}
