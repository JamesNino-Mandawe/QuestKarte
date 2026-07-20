import { useState, type CSSProperties } from "react";

export type Quest = {
  id: number | string; category: string; title: string; description: string; commission: string; location: string; schedule: string; posterName: string;
  trust?: string; matchPercent?: number; kind?: "swap" | "student"; initials?: string; tone?: "rare" | "uncommon" | "urgent"; image?: string; images?: string[];
};

type Props = { quest: Quest; saved?: boolean; applied?: boolean; isOwner?: boolean; onSave?: () => void; onApply?: () => void; onProfileClick?: () => void };

const requirementsFor = (quest: Quest) => {
  if (quest.title.toLowerCase().includes("clean")) return ["Cleaning supplies are provided", "Complete the bedroom, living room, and kitchen", "Message the poster before arriving"];
  if (quest.category === "Academic") return ["Bring your own notes or reviewer", "Two-hour session preferred", "Agree on a meeting time with the poster"];
  return ["Confirm the details with the poster", "Keep task updates inside QuestKarte", "Complete the task within the agreed time window"];
};

function ProfileLink({ quest, onProfileClick, prefix = "" }: { quest: Quest; onProfileClick?: () => void; prefix?: string }) {
  const member = <><span className="avatar">{quest.initials || quest.posterName.slice(0, 2)}</span><span><span className="qc-pname">{prefix}{quest.posterName}</span><span className="qc-ptf">{quest.trust || "Trusted member"}</span></span></>;
  return onProfileClick ? <button type="button" className="qc-poster qc-poster-button" onClick={onProfileClick} aria-label={`View ${quest.posterName}'s profile`}>{member}</button> : <div className="qc-poster">{member}</div>;
}

export default function TaskCard({ quest, saved, applied, isOwner, onSave, onApply, onProfileClick }: Props) {
  const allImages = quest.images?.length ? quest.images : quest.image ? [quest.image] : [];
  const [showDetails, setShowDetails] = useState(false);
  const openGallery = () => { setShowDetails(true); };
  const visibleImages = allImages.slice(0, 4);
  const remainingImages = allImages.length - visibleImages.length;
  const action = isOwner ? <span className="my-task-chip">My task</span> : onApply && <button type="button" className="apply-btn" onClick={onApply} disabled={applied}>{applied ? "Applied" : "Apply"}</button>;

  return <>
    <article className={`quest-card ${quest.tone || "rare"}`}>
      <div className="qc-thumb">
        {allImages.length > 0 && <div className={`qc-gallery qc-gallery-${Math.min(allImages.length, 4)}`}>{visibleImages.map((src, index) => <button type="button" className="qc-gallery-photo" key={`${src}-${index}`} onClick={() => openGallery()} aria-label={`View photo ${index + 1} for ${quest.title}`}><img src={src} alt={`Task reference ${index + 1} for ${quest.title}`} />{index === visibleImages.length - 1 && remainingImages > 0 && <span className="qc-more-photos">+{remainingImages}</span>}</button>)}</div>}
        <div className="qc-badges"><div className="qc-badge-row"><span className={`badge ${quest.category === "Academic" ? "cat-academic" : "cat-general"}`}>{quest.category}</span>{quest.kind === "swap" && <span className="badge swap">Service swap</span>}{quest.kind === "student" && <span className="badge student-only">Students only</span>}</div><button type="button" className={`qc-bookmark ${saved ? "saved" : ""}`} onClick={onSave} aria-label="Save task">{saved ? "★" : "☆"}</button></div>
        {quest.matchPercent && <div className="qc-rarity-tag"><span className="r" style={{ "--m": `${quest.matchPercent}%` } as CSSProperties} /><span className="t">{quest.matchPercent}% match</span></div>}
      </div>
      <div className="qc-body"><div className="qc-time">Posted recently</div><h3 className="qc-title">{quest.title}</h3><p className="qc-desc">{quest.description}</p><div className="task-details"><span>⌖ {quest.location}</span><span>◷ {quest.schedule}</span></div><div className="qc-foot"><ProfileLink quest={quest} onProfileClick={onProfileClick} /><div className="card-action"><span className="qc-reward">{quest.commission}</span>{action}</div></div></div>
    </article>
    {showDetails && <TaskDetailModal quest={quest} applied={applied} isOwner={isOwner} onApply={onApply} onProfileClick={onProfileClick} onClose={() => setShowDetails(false)} />}
  </>;
}

export function TaskDetailModal({ quest, applied, isOwner, onApply, onProfileClick, onClose }: Props & { onClose: () => void }) {
  const allImages = quest.images?.length ? quest.images : quest.image ? [quest.image] : [];
  const [activeImage, setActiveImage] = useState(0);
  const requirements = requirementsFor(quest);
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
          <div className="modal-kicker">
            <span className="badge cat-general">{quest.category}</span>
            {quest.matchPercent && <span>{quest.matchPercent}% match</span>}
          </div>
          <h2>{quest.title}</h2>
          <p className="modal-description">{quest.description}</p>
          {allImages.length > 1 && <div className="gallery-thumbs">
            {allImages.map((src, index) => <button type="button" key={`${src}-${index}`} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)}><img src={src} alt={`Open photo ${index + 1}`} /></button>)}
          </div>}
          <div className="modal-meta">
            <span>⌖ {quest.location}</span>
            <span>◷ {quest.schedule}</span>
            <strong>{quest.commission}</strong>
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
