import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PostEditor } from "@/app/posts/new/post-editor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewPostPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [accounts, assets, params] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, platform: true, username: true, displayName: true, platformAccountId: true }
    }),
    prisma.mediaAsset.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true }
    }),
    searchParams
  ]);

  return <main className="workspace-page">
    <header className="workspace-page-top"><Link href="/posts"><ArrowLeft size={16}/> Back to posts</Link><span>CLIPFLOW / NEW POST</span></header>
    <section className="workspace-page-content editor-content">
      <div className="eyebrow">CONTENT EDITOR</div><h1>Create a post</h1><p className="editor-lead">Write your caption, attach media and preview the destinations for your content.</p>
      {params.error === "caption" && <div className="content-alert">Your caption is too long. Keep it under 2,200 characters.</div>}
      {params.error === "channels" && <div className="content-alert">One or more selected channels could not be verified in this workspace.</div>}
      {params.error === "media" && <div className="content-alert">That media file is not available in this workspace.</div>}
      <PostEditor accounts={accounts} assets={assets}/>
    </section>
  </main>;
}
