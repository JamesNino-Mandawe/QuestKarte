import { useState, type CSSProperties } from "react";

export type Quest = {
  id: number | string; category: string; title: string; description: string; commission: string; paymentType?: "gcash" | "cash" | string; location: string; schedule: string; posterName: string;
  trust?: string; matchPercent?: number; kind?: "swap" | "student"; initials?: string; avatarUrl?: string | null; tone?: "rare" | "uncommon" | "urgent"; image?: string; images?: string[];
};

type Props = { quest: Quest; saved?: boolean; applied?: boolean; isOwner?: boolean; onSave?: () => void; onApply?: () => void; onProfileClick?: () => void };

const requirementsFor = (quest: Quest) => {
  if (quest.title.toLowerCase().includes("clean")) return ["Cleaning supplies are provided", "Complete the bedroom, living room, and kitchen", "Message the poster before arriving"];
  if (quest.category === "Academic") return ["Bring your own notes or reviewer", "Two-hour session preferred", "Agree on a meeting time with the poster"];
  return ["Confirm the details with the poster", "Keep task updates inside QuestKarte", "Complete the task within the agreed time window"];
};

function ProfileLink({ quest, onProfileClick, prefix = "" }: { quest: Quest; onProfileClick?: () => void; prefix?: string }) {
  const member = <>{quest.avatarUrl ? <img src={quest.avatarUrl} alt="Avatar" className="avatar" style={{ objectFit: 'cover' }} /> : <span className="avatar">{quest.initials || quest.posterName.slice(0, 2)}</span>}<span><span className="qc-pname">{prefix}{quest.posterName}</span><span className="qc-ptf">{quest.trust || "Trusted member"}</span></span></>;
  return onProfileClick ? <button type="button" className="qc-poster qc-poster-button" onClick={onProfileClick} aria-label={`View ${quest.posterName}'s profile`}>{member}</button> : <div className="qc-poster">{member}</div>;
}

export default function TaskCard({ quest, saved, applied, isOwner, onSave, onApply, onProfileClick }: Props) {
  const allImages = quest.images?.length ? quest.images : quest.image ? [quest.image] : [];
  const [showDetails, setShowDetails] = useState(false);
  const openGallery = () => { setShowDetails(true); };
  const visibleImages = allImages.slice(0, 4);
  const remainingImages = allImages.length - visibleImages.length;
  const action = isOwner ? <span className="my-task-chip">My task</span> : onApply && <button type="button" className="apply-btn" onClick={onApply} disabled={applied}>{applied ? "Applied" : "Apply"}</button>;
  const isGcash = quest.paymentType === "gcash";

  return <>
    <article className={`quest-card ${quest.tone || "rare"}`}>
      <div className="qc-thumb">
        {allImages.length > 0 && <div className={`qc-gallery qc-gallery-${Math.min(allImages.length, 4)}`}>{visibleImages.map((src, index) => <button type="button" className="qc-gallery-photo" key={`${src}-${index}`} onClick={() => openGallery()} aria-label={`View photo ${index + 1} for ${quest.title}`}><img src={src} alt={`Task reference ${index + 1} for ${quest.title}`} />{index === visibleImages.length - 1 && remainingImages > 0 && <span className="qc-more-photos">+{remainingImages}</span>}</button>)}</div>}
        <div className="qc-badges">
          <div className="qc-badge-row">
            <span className={`badge ${quest.category === "Academic" ? "cat-academic" : "cat-general"}`}>{quest.category}</span>
            {quest.kind === "swap" ? (
              <span className="badge swap">Service swap</span>
            ) : (
              <span className="badge" style={{ background: isGcash ? '#e0f2fe' : '#ecfdf5', color: isGcash ? '#0369a1' : '#047857', border: `1px solid ${isGcash ? '#7dd3fc' : '#a7f3d0'}`, fontWeight: 800 }}>
                {isGcash ? "📱 GCash" : "💵 Cash"}
              </span>
            )}
            {quest.kind === "student" && <span className="badge student-only">Students only</span>}
          </div>
          <button type="button" className={`qc-bookmark ${saved ? "saved" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: saved ? '#fffbeb' : '#fff', border: saved ? '1.5px solid #FFC107' : '1px solid #e1e4e8', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} onClick={onSave} aria-label="Save task">{saved ? <svg viewBox="0 0 24 24" fill="#FFC107" stroke="#FFC107" strokeWidth="2" style={{width: 20, height: 20}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2" style={{width: 20, height: 20}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}</button>
        </div>
        {quest.matchPercent && <div className="qc-rarity-tag"><span className="r" style={{ "--m": `${quest.matchPercent}%` } as CSSProperties} /><span className="t">{quest.matchPercent}% match</span></div>}
      </div>
      <div className="qc-body">
        <div className="qc-time">Posted recently</div>
        <h3 className="qc-title">{quest.title}</h3>
        <p className="qc-desc">{quest.description}</p>
        <div className="task-details">
          <span>⌖ {quest.location}</span>
          <span>◷ {quest.schedule}</span>
        </div>
        <div className="qc-foot">
          <ProfileLink quest={quest} onProfileClick={onProfileClick} />
          <div className="card-action">
            <div className="qc-reward-wrapper" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {quest.kind === "swap" ? (
                <span className="qc-reward" style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>{quest.commission}</span>
              ) : (
                <>
                  <span className="qc-reward" style={{ fontSize: 16, fontWeight: 900, color: '#0b1466' }}>{quest.commission}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: isGcash ? '#0284c7' : '#059669', display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                    {isGcash ? "📱 via GCash" : "💵 Cash Payment"}
                  </span>
                </>
              )}
            </div>
            {action}
          </div>
        </div>
      </div>
    </article>
    {showDetails && <TaskDetailModal quest={quest} applied={applied} isOwner={isOwner} onApply={onApply} onProfileClick={onProfileClick} onClose={() => setShowDetails(false)} />}
  </>;
}

export function TaskDetailModal({ quest, applied, isOwner, onApply, onProfileClick, onClose }: Props & { onClose: () => void }) {
  const allImages = quest.images?.length ? quest.images : quest.image ? [quest.image] : [];
  const [activeImage, setActiveImage] = useState(0);
  const requirements = requirementsFor(quest);
  const isGcash = quest.paymentType === "gcash";

  return (
    <div className="task-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-label={`Task details: ${quest.title}`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="task-modal-close" onClick={onClose} aria-label="Close task details">×</button>
        <div className="task-modal-photo">
          {allImages.length > 0 && <>
            <img src={allImages[activeImage]} alt={`Reference photo ${activeImage + 1} for ${quest.title}`} />
            {allImages.length > 1 && <>
              <button type="button" className="gallery-arrow gallery-prev" onClick={() => setActiveImage((activeImage - 1 + allImages.length) % allImages.length)} aria-label="Previous photo">‹</button>
              <button type="button" className="gallery-arrow gallery-next" onClick={() => setActiveImage((activeImage + 1) % allImages.length)} aria-label="Next photo">›</button>
              <div className="gallery-count">{activeImage + 1} / {allImages.length}</div>
            </>}
          </>}
        </div>
        <div className="task-modal-content">
          <div className="modal-kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge cat-general">{quest.category}</span>
            {quest.kind === "swap" ? (
              <span className="badge swap">🔄 Service Swap</span>
            ) : (
              <span className="badge" style={{ background: isGcash ? '#e0f2fe' : '#ecfdf5', color: isGcash ? '#0369a1' : '#047857', border: `1px solid ${isGcash ? '#7dd3fc' : '#a7f3d0'}`, fontWeight: 800 }}>
                {isGcash ? "📱 Paid via GCash" : "💵 Cash Payment"}
              </span>
            )}
            {quest.matchPercent && <span>{quest.matchPercent}% match</span>}
          </div>
          <h2>{quest.title}</h2>
          <p className="modal-description">{quest.description}</p>
          {allImages.length > 1 && <div className="gallery-thumbs">
            {allImages.map((src, index) => <button type="button" key={`${src}-${index}`} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)}><img src={src} alt={`Open photo ${index + 1}`} /></button>)}
          </div>}
          <div className="modal-meta" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>⌖ {quest.location}</span>
            <span>◷ {quest.schedule}</span>
            <strong style={{ fontSize: 16, color: quest.kind === "swap" ? '#d97706' : '#0f172a' }}>
              {quest.kind === "swap" ? quest.commission : `${quest.commission} (${isGcash ? "GCash Transfer" : "Cash Meetup"})`}
            </strong>
          </div>
          <div className="requirements">
            <h3>What needs to be done</h3>
            <ul>
              {requirements.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
          </div>
          <div className="modal-footer">
            <ProfileLink quest={quest} onProfileClick={onProfileClick} prefix="Posted by " />
            {isOwner ? <span className="my-task-chip">My task</span> : onApply && <button type="button" className="apply-btn modal-apply" onClick={() => { onApply(); onClose(); }} disabled={applied}>{applied ? "Applied" : "Apply to this task"}</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
