import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Instagram, Youtube } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<{ error?: string; connected?: string }> };

export default async function ChannelsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const [accounts, params] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, platform: true, displayName: true, username: true, connectedAt: true }
    }),
    searchParams
  ]);

  const youtubeAccounts = accounts.filter((account) => account.platform === "YOUTUBE");
  const instagramAccounts = accounts.filter((account) => account.platform === "INSTAGRAM");
  const tiktokAccounts = accounts.filter((account) => account.platform === "TIKTOK");

  return <main className="channels-shell">
    <div className="channels-top"><Link href="/"><ArrowLeft size={16}/> Back to workspace</Link><span>CLIPFLOW / CHANNELS</span></div>
    <section className="channels-content">
      <div className="channels-eyebrow">PUBLISHING DESTINATIONS</div>
      <h1>Connect your channels.</h1>
      <p className="channels-lead">Bring your creator accounts into one secure workspace. You stay in control and can revoke access from the platform at any time.</p>
      {params.connected === "youtube" && <div className="channel-alert success">YouTube channel connected successfully.</div>}
      {params.connected === "instagram" && <div className="channel-alert success">Instagram professional account connected successfully.</div>}
      {params.error === "configuration" && <div className="channel-alert">YouTube connection is not configured yet. Add the Google OAuth credentials and token encryption key to the server environment.</div>}
      {params.error === "authorization" && <div className="channel-alert">Google authorization was canceled or did not return the required information.</div>}
      {params.error === "connection" && <div className="channel-alert">We could not connect that YouTube channel. Please try again.</div>}
      {params.error === "instagram_configuration" && <div className="channel-alert">Instagram connection is not configured yet. Add the Meta app credentials and token encryption key to the server environment.</div>}
      {params.error === "instagram_authorization" && <div className="channel-alert">Instagram authorization was canceled or did not return the required information.</div>}
      {params.error === "instagram_connection" && <div className="channel-alert">We could not connect that Instagram account. Confirm it is a Professional account and try again.</div>}
      <article className="provider-card provider-ready">
        <div className="provider-icon youtube"><Youtube size={23}/></div>
        <div className="provider-copy"><h2>YouTube</h2><p>Connect a YouTube channel to prepare video publishing and channel management.</p><span className="provider-status"><CheckCircle2 size={13}/> OAuth connection available</span>
          {youtubeAccounts.map((account) => <div className="connected-account" key={account.id}><CheckCircle2 size={13}/><span>{account.displayName || account.username || "YouTube channel"}</span><small>Connected</small></div>)}
        </div>
        <a className="provider-button" href="/api/oauth/google/start">{youtubeAccounts.length ? "Connect another" : "Connect YouTube"} <ExternalLink size={14}/></a>
      </article>
      <article className="provider-card provider-ready">
        <div className="provider-icon instagram"><Instagram size={23}/></div>
        <div className="provider-copy"><h2>Instagram</h2><p>Connect an Instagram Business or Creator account through Meta Instagram Login.</p><span className="provider-status"><CheckCircle2 size={13}/> OAuth connection available</span>
          {instagramAccounts.map((account) => <div className="connected-account" key={account.id}><CheckCircle2 size={13}/><span>{account.displayName || account.username || "Instagram account"}</span><small>Connected</small></div>)}
        </div>
        <a className="provider-button" href="/api/oauth/instagram/start">{instagramAccounts.length ? "Connect another" : "Connect Instagram"} <ExternalLink size={14}/></a>
      </article>
      <article className="provider-card">
        <div className="provider-icon tiktok">♪</div>
        <div className="provider-copy"><h2>TikTok</h2><p>Connect your TikTok account when the app has the required Login Kit and Content Posting API permissions.</p><span className="provider-status pending">Public Direct Post requires TikTok approval</span>
          {tiktokAccounts.map((account) => <div className="connected-account" key={account.id}><CheckCircle2 size={13}/><span>{account.displayName || account.username || "TikTok account"}</span><small>Connected</small></div>)}
        </div>
        <span className="provider-coming">Next integration</span>
      </article>
      <p className="channels-footnote">ClipFlow never asks for your social passwords. Connections use official OAuth authorization and encrypted tokens.</p>
    </section>
  </main>;
}
