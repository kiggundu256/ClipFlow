"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Instagram, MonitorPlay, Plus, Video, Youtube } from "lucide-react";
import { createDraft } from "@/app/actions/content";

type Account = {
  id: string;
  platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
  username: string | null;
  displayName: string | null;
  platformAccountId: string;
};
type Asset = { id: string; fileName: string; mimeType: string };

export function PostEditor({ accounts, assets }: { accounts: Account[]; assets: Asset[] }) {
  const [caption, setCaption] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedAccounts = useMemo(() => accounts.filter((account) => selectedIds.includes(account.id)), [accounts, selectedIds]);
  const asset = assets.find((item) => item.id === mediaId);
  const isVideo = Boolean(asset?.mimeType.startsWith("video/"));
  const isImage = Boolean(asset?.mimeType.startsWith("image/"));
  const youtubeSelected = selectedAccounts.some((account) => account.platform === "YOUTUBE");
  const instagramSelected = selectedAccounts.some((account) => account.platform === "INSTAGRAM");
  const warnings = [
    selectedAccounts.length === 0 ? "Choose at least one channel. You can still save an unassigned draft." : null,
    youtubeSelected && !isVideo ? "YouTube requires a video file. Choose an MP4, MOV or WebM video before preparing a YouTube upload." : null,
    instagramSelected && !asset ? "Instagram publishing requires photo or video media. Attach an image or video before preparing an Instagram post." : null,
    caption.length === 2200 ? "You have reached this editor's 2,200-character caption limit." : null
  ].filter(Boolean) as string[];

  function toggleAccount(id: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  return <div className="editor-layout">
    <form className="post-editor-form" action={createDraft}>
      <label className="editor-label" htmlFor="caption">Caption</label>
      <textarea id="caption" name="caption" maxLength={2200} rows={8} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write something worth sharing..." />
      <div className="caption-counter"><span>Caption and hashtags</span><b className={caption.length > 2100 ? "counter-near-limit" : ""}>{caption.length.toLocaleString()} / 2,200</b></div>
      <label className="editor-label" htmlFor="mediaAssetId">Attach media</label>
      <select id="mediaAssetId" name="mediaAssetId" value={mediaId} onChange={(event) => setMediaId(event.target.value)}>
        <option value="">No media attached</option>
        {assets.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
      </select>
      {assets.length === 0 && <p className="editor-hint">Your library is empty. <Link href="/media">Upload media first</Link>.</p>}
      <div className="editor-label">Choose channels</div>
      {accounts.length === 0 ? <div className="no-channels">No channels connected yet. <Link href="/channels">Connect YouTube or Instagram</Link> to assign this draft.</div> : <div className="channel-select-list">{accounts.map((account) => <label className="channel-select-option" key={account.id}>
        <input type="checkbox" name="socialAccountIds" value={account.id} checked={selectedIds.includes(account.id)} onChange={(event) => toggleAccount(account.id, event.target.checked)}/>
        <span className="channel-select-icon">{account.platform === "YOUTUBE" ? <Youtube size={17}/> : account.platform === "INSTAGRAM" ? <Instagram size={17}/> : "♪"}</span>
        <span className="channel-select-name"><b>{account.displayName || account.username || account.platform}</b><small>{account.platform} · {account.username || account.platformAccountId}</small></span>
      </label>)}</div>}
      <div className="editor-actions"><Link className="secondary-button" href="/posts">Cancel</Link><button className="primary-button" type="submit"><Plus size={16}/> Save draft</button></div>
      <p className="draft-disclaimer">Saving creates a draft only. Nothing is published or scheduled.</p>
    </form>
    <aside className="post-preview-panel">
      <div className="preview-heading"><div><div className="eyebrow">LIVE PREVIEW</div><h2>Post preview</h2></div><MonitorPlay size={19}/></div>
      <div className="preview-targets">
        <span className="preview-section-label">DESTINATIONS</span>
        {selectedAccounts.length ? selectedAccounts.map((account) => <div className="preview-target" key={account.id}>
          <span className="preview-target-icon">{account.platform === "YOUTUBE" ? <Youtube size={15}/> : account.platform === "INSTAGRAM" ? <Instagram size={15}/> : "♪"}</span>
          <span><b>{account.displayName || account.username || account.platform}</b><small>{account.platform}</small></span>
          <span className="preview-ready">Selected</span>
        </div>) : <p className="preview-empty">Select channels to see where this draft is intended to go.</p>}
      </div>
      <div className="preview-post-card">
        <div className="preview-brand"><span className="preview-brand-mark">C</span><span><b>ClipFlow preview</b><small>Not a live platform rendering</small></span></div>
        {asset ? <div className="preview-media">
          {isVideo ? <video src={`/api/media/${asset.id}`} controls preload="metadata"/> : isImage ? <img src={`/api/media/${asset.id}`} alt={asset.fileName}/> : <div className="preview-no-media"><Video size={22}/></div>}
        </div> : <div className="preview-no-media"><Video size={22}/><span>Media preview appears here</span></div>}
        <div className="preview-caption">{caption ? caption : <span className="preview-placeholder">Your caption will appear here...</span>}</div>
        {asset && <div className="preview-file-name">{asset.fileName}</div>}
      </div>
      <div className="preview-validation">
        <span className="preview-section-label">CONTENT CHECKS</span>
        {warnings.length ? warnings.map((warning) => <p className="preview-warning" key={warning}>{warning}</p>) : <p className="preview-ok">The selected channels and attached media pass these basic checks.</p>}
        <p className="preview-disclaimer">These are preliminary checks, not a guarantee of platform acceptance. Final media and account requirements are checked again when publishing is implemented.</p>
      </div>
    </aside>
  </div>;
}
