import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FilePlus2, Image as ImageIcon, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<{ created?: string }> };

export default async function PostsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [posts, params] = await Promise.all([
    prisma.post.findMany({
      where: { workspaceId: membership.workspaceId },
      include: { mediaAsset: true, targets: { include: { socialAccount: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100
    }),
    searchParams
  ]);

  return <main className="workspace-page">
    <header className="workspace-page-top"><Link href="/"><ArrowLeft size={16}/> Workspace</Link><span>CLIPFLOW / CONTENT</span></header>
    <section className="workspace-page-content">
      <div className="workspace-page-heading"><div><div className="eyebrow">CONTENT WORKSPACE</div><h1>Your posts</h1><p>Create drafts and prepare content for your connected channels.</p></div><Link className="primary-button" href="/posts/new"><Plus size={16}/> New post</Link></div>
      {params.created === "1" && <div className="content-alert success">Your draft has been saved.</div>}
      <div className="library-heading"><div><h2>Drafts and content</h2><p>{posts.length} posts in this workspace</p></div></div>
      {posts.length === 0 ? <div className="library-empty"><FilePlus2 size={28}/><b>No posts yet.</b><span>Create your first draft and choose which channels it is intended for.</span><Link className="secondary-button" href="/posts/new"><Plus size={15}/> Create your first post</Link></div> : <div className="post-list">{posts.map((post) => <article className="content-post-row" key={post.id}>
        <div className="content-post-icon">{post.mediaAsset ? <ImageIcon size={19}/> : <FilePlus2 size={19}/>}</div>
        <div className="content-post-main"><b>{post.caption.trim().slice(0, 110) || "Untitled draft"}</b><span>{post.targets.length ? post.targets.map((target) => target.socialAccount.platform).join(" · ") : "No channel selected"}{post.mediaAsset ? ` · ${post.mediaAsset.fileName}` : ""}</span></div>
        <span className="content-post-status">{post.status.toLowerCase()}</span>
      </article>)}</div>}
      <p className="storage-note">Drafts are saved privately in this workspace. Scheduling and publishing are added in the next workflow milestone.</p>
    </section>
  </main>;
}
