import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Instagram, Plus, Youtube } from "lucide-react";
import { createDraft } from "@/app/actions/content";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewPostPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [accounts, assets, params] = await Promise.all([
    prisma.socialAccount.findMany({ where: { workspaceId: membership.workspaceId }, orderBy: { connectedAt: "desc" } }),
    prisma.mediaAsset.findMany({ where: { workspaceId: membership.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
    searchParams
  ]);

  return <main className="workspace-page">
    <header className="workspace-page-top"><Link href="/posts"><ArrowLeft size={16}/> Back to posts</Link><span>CLIPFLOW / NEW POST</span></header>
    <section className="workspace-page-content editor-content">
      <div className="eyebrow">CONTENT EDITOR</div><h1>Create a post</h1><p className="editor-lead">Write your caption, attach a media file and choose one or more connected channels.</p>
      {params.error === "caption" && <div className="content-alert">Your caption is too long. Keep it under 2,200 characters for this first editor.</div>}
      {params.error === "channels" && <div className="content-alert">One or more selected channels could not be verified in this workspace.</div>}
      {params.error === "media" && <div className="content-alert">That media file is not available in this workspace.</div>}
      <form className="post-editor-form" action={createDraft}>
        <label className="editor-label" htmlFor="caption">Caption</label>
        <textarea id="caption" name="caption" maxLength={2200} rows={8} placeholder="Write something worth sharing..." />
        <div className="editor-hint">Up to 2,200 characters. Add hashtags directly to your caption.</div>
        <label className="editor-label" htmlFor="mediaAssetId">Attach media</label>
        <select id="mediaAssetId" name="mediaAssetId"><option value="">No media attached</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}</select>
        {assets.length === 0 && <p className="editor-hint">Your library is empty. <Link href="/media">Upload media first</Link>.</p>}
        <div className="editor-label">Publish to channels</div>
        {accounts.length === 0 ? <div className="no-channels">No channels connected yet. <Link href="/channels">Connect YouTube or Instagram</Link> to assign this draft.</div> : <div className="channel-select-list">{accounts.map((account) => <label className="channel-select-option" key={account.id}>
          <input type="checkbox" name="socialAccountIds" value={account.id}/>
          <span className="channel-select-icon">{account.platform === "YOUTUBE" ? <Youtube size={17}/> : account.platform === "INSTAGRAM" ? <Instagram size={17}/> : "♪"}</span>
          <span className="channel-select-name"><b>{account.displayName || account.username || account.platform}</b><small>{account.platform} · {account.username || account.platformAccountId}</small></span>
        </label>)}</div>}
        <div className="editor-actions"><Link className="secondary-button" href="/posts">Cancel</Link><button className="primary-button" type="submit"><Plus size={16}/> Save draft</button></div>
      </form>
    </section>
  </main>;
}
