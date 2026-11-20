"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Instagram, Youtube } from "lucide-react";

export default function ChannelsPage() {
  return <main className="channels-shell">
    <div className="channels-top"><Link href="/"><ArrowLeft size={16}/> Back to workspace</Link><span>CLIPFLOW / CHANNELS</span></div>
    <section className="channels-content">
      <div className="channels-eyebrow">PUBLISHING DESTINATIONS</div>
      <h1>Connect your channels.</h1>
      <p className="channels-lead">Bring your creator accounts into one secure workspace. You stay in control and can revoke access from the platform at any time.</p>
      <article className="provider-card provider-ready">
        <div className="provider-icon youtube"><Youtube size={23}/></div>
        <div className="provider-copy"><h2>YouTube</h2><p>Connect a YouTube channel to prepare video publishing and channel management.</p><span className="provider-status"><CheckCircle2 size={13}/> OAuth connection available</span></div>
        <a className="provider-button" href="/api/oauth/google/start">Connect YouTube <ExternalLink size={14}/></a>
      </article>
      <article className="provider-card">
        <div className="provider-icon instagram"><Instagram size={23}/></div>
        <div className="provider-copy"><h2>Instagram</h2><p>Connect eligible professional Instagram accounts through Meta's official authorization flow.</p><span className="provider-status pending">Meta app credentials and permissions required</span></div>
        <span className="provider-coming">Coming next</span>
      </article>
      <article className="provider-card">
        <div className="provider-icon tiktok">♪</div>
        <div className="provider-copy"><h2>TikTok</h2><p>Connect your TikTok account when the app has the required Login Kit and Content Posting API permissions.</p><span className="provider-status pending">Public Direct Post requires TikTok approval</span></div>
        <span className="provider-coming">Coming next</span>
      </article>
      <p className="channels-footnote">ClipFlow never asks for your social passwords. Connections use official OAuth authorization and encrypted tokens.</p>
    </section>
  </main>;
}
