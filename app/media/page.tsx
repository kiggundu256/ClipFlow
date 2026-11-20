import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Film, ImagePlus, Plus, Video } from "lucide-react";
import { uploadMedia } from "@/app/actions/content";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<{ error?: string; uploaded?: string }> };

function formatBytes(bytes: bigint) {
  const value = Number(bytes);
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [assets, params] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    searchParams
  ]);

  return <main className="workspace-page">
    <header className="workspace-page-top"><Link href="/"><ArrowLeft size={16}/> Workspace</Link><span>CLIPFLOW / MEDIA LIBRARY</span></header>
    <section className="workspace-page-content">
      <div className="workspace-page-heading"><div><div className="eyebrow">YOUR CREATIVE ASSETS</div><h1>Media library</h1><p>Keep your videos and images together, ready to use in your posts.</p></div><Link className="secondary-button" href="/posts/new"><Plus size={16}/> Create a post</Link></div>
      {params.uploaded === "1" && <div className="content-alert success">Your file was added to the media library.</div>}
      {params.error === "missing" && <div className="content-alert">Choose a file before uploading.</div>}
      {params.error === "type" && <div className="content-alert">Use MP4, MOV, WebM, JPEG, PNG or WebP files.</div>}
      {params.error === "size" && <div className="content-alert">The maximum upload size is 100 MB.</div>}
      <form className="upload-panel" action={uploadMedia}>
        <div className="upload-icon"><ImagePlus size={22}/></div>
        <div className="upload-copy"><b>Add media to your workspace</b><span>Video and image files up to 100 MB. Files are private to this workspace.</span></div>
        <input type="file" name="file" accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" required />
        <button className="primary-button" type="submit">Upload file</button>
      </form>
      <div className="library-heading"><div><h2>Your files</h2><p>{assets.length} {assets.length === 1 ? "asset" : "assets"} stored</p></div></div>
      {assets.length === 0 ? <div className="library-empty"><Film size={28}/><b>Your media library is empty.</b><span>Upload your first video or image to start creating content.</span></div> : <div className="media-grid">{assets.map((asset) => <article className="media-card" key={asset.id}>
        <a className="media-preview" href={`/api/media/${asset.id}`} target="_blank" rel="noreferrer">{asset.mimeType.startsWith("video/") ? <Video size={30}/> : <ImagePlus size={30}/>}<span>Open preview</span></a>
        <div className="media-card-info"><b title={asset.fileName}>{asset.fileName}</b><span>{formatBytes(asset.sizeBytes)} · {asset.mimeType.split("/")[1].toUpperCase()}</span></div>
      </article>)}</div>}
      <p className="storage-note">Storage is private to your workspace. Keep a backup of original media; this first release stores files on the ClipFlow server.</p>
    </section>
  </main>;
}
