import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import "./staff.css";
import "./workflows.css";
import "./member-enhancements.css";
import "./task-workspace.css";
import TaskCard, { type Quest } from "./TaskCard";
import AuthScreen from "./AuthScreen";
import LandingPage from "./LandingPage";
import VerificationGate from "./VerificationGate";
import { supabase } from "./lib/supabase";

type Page = "home" | "tasks" | "post" | "chat" | "account" | "settings" | "staff";
type StaffRole = "moderator" | "admin";
type MemberProfile = { id: string; full_name: string; avatar_url: string; bio: string | null; city: string | null; skills: string[]; trust_factor: number; completed_tasks_count: number; student_verified_at: string | null; professional_verified_at: string | null; verification_status: "unverified" | "pending" | "verified" | "rejected"; terms_accepted_at: string | null; average_rating: number; rating_count: number };
type MarketplaceTask = { id: number; title: string; description: string; commission_amount: number | null; currency: string; is_service_swap: boolean; swap_details: string | null; requires_student_verification: boolean; location_label: string; latitude: number | null; longitude: number | null; published_at: string | null; created_at: string; category: { name: string } | null; poster: { full_name: string; trust_factor: number } | null };

function MemberProgress({ profile }: { profile: MemberProfile }) {
  const trust = Math.min(100, Math.max(0, Number(profile.trust_factor || 0)));
  return <section className="member-progress panel"><div><span className="eyebrow">Your progress</span><h3>Build a reliable member record</h3></div><div className="member-progress-track"><span style={{ width: `${trust}%` }} /></div><div className="member-progress-stats"><span><b>{trust}</b> Trust Factor</span><span><b>{profile.completed_tasks_count || 0}</b> completed</span><span><b>{profile.rating_count || 0}</b> reviews</span></div></section>;
}

const quests: Quest[] = [
  { id: 1, category: "General", title: "Deep clean 2-bedroom apartment", description: "Looking for someone to do a thorough deep clean before guests arrive. Cleaning supplies provided.", commission: "Trade: Web design", location: "Lahug · 1.8 km", schedule: "Sat, 1:00 PM", posterName: "Robert B.", trust: "TF 77 · Gold Client", matchPercent: 94, kind: "swap", initials: "RB", tone: "rare" },
  { id: 2, category: "Academic", title: "Statistics tutor for finals review", description: "Need help reviewing hypothesis testing and regression before finals week. Two-hour sessions preferred.", commission: "₱450 / session", location: "IT Park · 0.9 km", schedule: "Video pitch requested", posterName: "Mika J.", trust: "Verified Student", matchPercent: 84, kind: "student", initials: "MJ", tone: "uncommon" },
  { id: 3, category: "General", title: "Grocery run + delivery, Ayala Center", description: "Pick up a grocery list and deliver it to Banilad by the evening. Budget covers items and fee.", commission: "₱300", location: "Banilad · 3.2 km", schedule: "Today, 6:00 PM", posterName: "Cara D.", trust: "TF 54", matchPercent: 69, initials: "CD", tone: "urgent" },
];

const questImages: Record<string, string> = {
  1: "/task-cleaning.png",
  2: "/task-tutoring.png",
  3: "/task-grocery.png",
};

const nav: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" }, { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "chat", label: "Chat", icon: "◌" }, { id: "account", label: "Account", icon: "◉" },
];

const taskCategories = [
  "Cleaning", "Home repairs", "Moving help", "Delivery", "Errands", "Grocery & shopping", "Tutoring", "Academic support", "Design", "Photography", "Video & editing", "Writing & translation", "Technology help", "Web & app help", "Social media", "Events", "Beauty & wellness", "Pet care", "Child care", "Elderly support", "Gardening", "Vehicle help", "Food & catering", "Fitness & coaching", "Music & lessons", "Other",
];

const staffNav = [
  { label: "Overview", icon: "◈" }, { label: "Review queue", icon: "✓" },
  { label: "Reports", icon: "⚑" }, { label: "Audit log", icon: "◫" },
];

void staffNav;

function LegacyAppShell({ session, onExit, staffRole, profile }: { session: Session | null; onExit: () => void; staffRole: StaffRole | null; profile: MemberProfile | null }) {
  const displayName = profile?.full_name || (session && typeof session.user.user_metadata.full_name === "string" ? session.user.user_metadata.full_name : "Demo Member");
  const accountInitial = displayName[0]?.toUpperCase() || "M";
  const [page, setPage] = useState<Page>(staffRole ? "staff" : "home");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Recommended");
  const [saved, setSaved] = useState<Array<number | string>>([]);
  const [applied, setApplied] = useState<Array<number | string>>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState(["Hi Susan! I can do the grocery run this afternoon.", "Great, can you be at Ayala by 4 PM?"]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [staffTab, setStaffTab] = useState<StaffTab>(staffRole === "admin" ? "overview" : "task_review");
  const roleNav: { id: StaffTab; label: string; icon: string }[] = staffRole === "admin"
    ? [{ id: "overview", label: "Overview", icon: "◈" }, { id: "task_review", label: "Task review", icon: "✓" }, { id: "members", label: "Members", icon: "◉" }, { id: "moderators", label: "Moderators", icon: "♜" }, { id: "categories", label: "Categories", icon: "◇" }, { id: "audit", label: "Audit log", icon: "◫" }]
    : [{ id: "task_review", label: "Task review", icon: "✓" }, { id: "verification", label: "Verification", icon: "◇" }, { id: "reports", label: "Reports", icon: "⚑" }, { id: "disputes", label: "Disputes", icon: "◉" }];

  useEffect(() => { setStaffTab(staffRole === "admin" ? "overview" : "task_review"); }, [staffRole]);

  const filteredQuests = useMemo(() => quests.filter((quest) =>
    `${quest.title} ${quest.category} ${quest.location}`.toLowerCase().includes(query.toLowerCase())), [query]);

  const announce = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const apply = (id: number | string) => {
    if (applied.includes(id)) return;
    setApplied([...applied, id]);
    announce("Application sent — the client has been notified.");
  };
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages([...messages, draft.trim()]); setDraft("");
  };

  return (
    <div className="app-shell">
      <div className="aurora" /><div className="stars" />
      <aside className="icon-rail" aria-label={staffRole ? "Staff navigation" : "Primary navigation"}>
        <button className="rail-brand" onClick={() => setPage(staffRole ? "staff" : "home")} aria-label="Go to QuestKarte dashboard"><Brand markOnly /><span><strong>QuestKarte</strong><small>{staffRole ? "Staff workspace" : "Task marketplace"}</small></span></button>
        {staffRole ? <><div className="staff-rail-label">{staffRole}</div>{roleNav.map((item) => <button className={`rail-item ${page === "staff" && staffTab === item.id ? "active" : ""}`} key={item.id} onClick={() => { setPage("staff"); setStaffTab(item.id); }}><span>{item.icon}</span><small>{item.label}</small></button>)}</> : <>{nav.slice(0, 2).map((item) => <RailItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}<button className="rail-post" onClick={() => setPage("post")} aria-label="Post a task">+</button>{nav.slice(2).map((item) => <RailItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}</>}
        <div className="rail-spacer" /><button className="rail-item" onClick={() => setPage("settings")}><span>⚙</span><small>Settings</small></button>
      </aside>
      <main className="shell-main">
        <header className="topbar">
          <Brand />
          <label className="search-wrap"><span className="search-icon">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks, skills, or locations" aria-label="Search tasks" /></label>
          {session && <NotificationBell userId={session.user.id} />}<button className="account-btn lvl-ring" onClick={() => setPage("account")} aria-label="Open account"><span className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : accountInitial}</span><span className="lvl-badge-tag"><span className="in">{session ? "1" : "12"}</span></span></button>
        </header>
        <section className="page-title-row"><div className="eyebrow">QuestKarte marketplace</div><h1>{titleFor(page)}</h1><p className="sub">{subtitleFor(page)}</p></section>
        <section className="main-row">
          {page === "home" && (session ? <FreshHome profile={profile} onPost={() => setPage("post")} onAccount={() => setPage("account")} query={query} /> : <Home tab={tab} setTab={setTab} quests={filteredQuests} saved={saved} applied={applied} onSave={(id) => setSaved(saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [...saved, id])} onApply={apply} onPost={() => setPage("post")} />)}
          {page === "tasks" && (session ? <><TaskWorkspace session={session} onGoPost={() => setPage("post")} /><TaskApplicationInbox session={session} /><TaskDeliveryAndSafety session={session} /><CompletedTaskReviews session={session} /></> : <Tasks onGoPost={() => setPage("post")} applied={applied} />)}
          {page === "post" && <PostTaskReal session={session} profile={profile} onPosted={() => { announce("Your task was submitted for moderator review."); setPage("tasks"); }} />}
          {page === "chat" && (session ? <FreshChatReal session={session} /> : <Chat open={chatOpen} setOpen={setChatOpen} messages={messages} draft={draft} setDraft={setDraft} onSend={sendMessage} />)}
          {page === "account" && (session ? <FreshAccount profile={profile} email={session.user.email || ""} session={session} onExit={onExit} /> : <Account displayName={displayName} isDemo={!session} onExit={onExit} onEdit={() => announce("Profile editing will save to Supabase once it is connected.")} />)}
          {page === "settings" && <SettingsPage email={session?.user.email || "Demo account"} onAccount={() => setPage("account")} onExit={onExit} isDemo={!session} />}
          {page === "staff" && <StaffDashboard role={staffRole || "moderator"} session={session} onExit={onExit} activeTab={staffTab} onTabChange={setStaffTab} />}
        </section>
        <div className="scroll-spacer" />
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.slice(0, 2).map((item) => <NavButton key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}
        <button className="nav-post" onClick={() => setPage("post")} aria-label="Post a task">+</button>
        {nav.slice(2).map((item) => <NavButton key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}
      </nav>
      {!staffRole && <MemberGuide onNavigate={(destination) => setPage(destination)} />}
      {toast && <div className="toast" role="status">✦ {toast}</div>}
    </div>
  );
}

function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera capture.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => setError("Unable to start the camera preview."));
        }
      })
      .catch(() => setError("Camera permission was not granted. Allow camera access or choose a saved file."));
    return () => { mounted = false; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) { setError("Camera is still starting. Please wait a moment and try again."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Unable to capture the photo."); return; }
      onCapture(new File([blob], `questkarte-camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.9);
  };

  return <div className="camera-capture-backdrop" role="dialog" aria-modal="true" aria-label="Take profile photo"><section className="camera-capture-modal"><header><div><span className="eyebrow">Camera capture</span><h2>Take a profile photo</h2></div><button type="button" className="member-profile-close" onClick={onClose} aria-label="Close camera">×</button></header>{error ? <p className="setup-notice">{error}</p> : <video ref={videoRef} className="camera-capture-video" autoPlay muted playsInline />}<div className="camera-capture-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={Boolean(error)} onClick={capture}>Take photo</button></div></section></div>;
}

function CameraInputBridge() {
  const [targetInput, setTargetInput] = useState<HTMLInputElement | null>(null);
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const directInput = target?.closest?.('input[type="file"][capture="user"]') as HTMLInputElement | null;
      const labelInput = target?.closest?.("label")?.querySelector('input[type="file"][capture="user"]') as HTMLInputElement | null;
      const input = directInput || labelInput;
      if (!input) return;
      event.preventDefault(); event.stopPropagation(); setTargetInput(input);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, []);
  const complete = (file: File) => {
    if (!targetInput) return;
    const transfer = new DataTransfer(); transfer.items.add(file);
    targetInput.files = transfer.files;
    targetInput.dispatchEvent(new Event("change", { bubbles: true }));
    setTargetInput(null);
  };
  return targetInput ? <CameraCapture onCapture={complete} onClose={() => setTargetInput(null)} /> : null;
}

function AppShell({ session, onExit, staffRole, profile }: { session: Session | null; onExit: () => void; staffRole: StaffRole | null; profile: MemberProfile | null }) {
  const isGuest = !session && !staffRole;
  const displayName = profile?.full_name || (session && typeof session.user.user_metadata.full_name === "string" ? session.user.user_metadata.full_name : "Member");
  const [page, setPage] = useState<Page>(staffRole ? "staff" : "home");
  const [staffTab, setStaffTab] = useState<StaffTab>(staffRole === "admin" ? "overview" : "task_review");
  const [query, setQuery] = useState("");
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);
  const accountInitial = displayName[0]?.toUpperCase() || "M";

  const memberNav = <>{nav.slice(0, 2).map((item) => <RailItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}<button className="rail-post" onClick={() => setPage("post")} aria-label="Post a task">+</button>{nav.slice(2).map((item) => <RailItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}</>;
  return <div className={`app-shell ${isGuest ? "guest-shell" : ""}`}><div className="aurora" /><div className="stars" />
    <aside className="icon-rail" aria-label={staffRole ? "Staff navigation" : isGuest ? "Guest navigation" : "Primary navigation"}>
      <button className="rail-brand" onClick={() => setPage(staffRole ? "staff" : "home")} aria-label="Go to QuestKarte dashboard"><Brand markOnly /><span><strong>QuestKarte</strong><small>{staffRole ? "Staff workspace" : "Task marketplace"}</small></span></button>
      {staffRole ? <><div className="staff-rail-label">{staffRole}</div><button className="rail-item active" onClick={() => setPage("staff")}><span>◈</span><small>Workspace</small></button></> : isGuest ? <><div className="guest-rail-label">Guest view</div><RailItem item={nav[0]} active onClick={() => setPage("home")} /><p className="guest-rail-note">Browse published tasks and the map. Sign in to post, apply, chat, or manage an account.</p></> : memberNav}
      <div className="rail-spacer" />{!isGuest && !staffRole && <button className="rail-item" onClick={() => setPage("settings")}><span>⚙</span><small>Settings</small></button>}
    </aside>
    <main className="shell-main"><header className="topbar"><Brand /><label className="search-wrap"><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, skills, or locations" aria-label="Search tasks" /></label>{session && <NotificationBell userId={session.user.id} />}{isGuest ? <button type="button" className="btn primary guest-join-button" onClick={onExit}>Sign in to join</button> : !staffRole && <button className="account-btn lvl-ring" onClick={() => setPage("account")} aria-label="Open account"><span className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : accountInitial}</span></button>}</header>
      <section className="page-title-row"><div className="eyebrow">{isGuest ? "Guest marketplace" : "QuestKarte marketplace"}</div><h1>{isGuest ? "Explore available tasks" : titleFor(page)}</h1><p className="sub">{isGuest ? "Browse approved opportunities before creating a QuestKarte account." : subtitleFor(page)}</p></section>
      <section className="main-row">{staffRole ? <StaffDashboard role={staffRole} session={session} onExit={onExit} activeTab={staffTab} onTabChange={setStaffTab} /> : isGuest ? <GuestHome onJoin={onExit} /> : page === "home" ? <FreshHome profile={profile} onPost={() => setPage("post")} onAccount={() => setPage("account")} query={query} /> : page === "tasks" && session ? <><TaskWorkspace session={session} onGoPost={() => setPage("post")} onOpenChat={(taskId) => { setChatTaskId(taskId); setPage("chat"); }} /><TaskApplicationInbox session={session} /><TaskDeliveryAndSafety session={session} /><CompletedTaskReviews session={session} /></> : page === "post" ? <PostTaskReal session={session} profile={profile} onPosted={() => setPage("tasks")} /> : page === "chat" && session ? <FreshChatReal session={session} initialTaskId={chatTaskId} /> : page === "account" && session ? <FreshAccount profile={profile} email={session.user.email || ""} session={session} onExit={onExit} /> : page === "settings" ? <SettingsPage email={session?.user.email || ""} onAccount={() => setPage("account")} onExit={onExit} isDemo={false} /> : null}</section>
    </main>{!isGuest && !staffRole && <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0, 2).map((item) => <NavButton key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}<button className="nav-post" onClick={() => setPage("post")} aria-label="Post a task">+</button>{nav.slice(2).map((item) => <NavButton key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />)}</nav>}{session && !staffRole && <MemberGuide onNavigate={(destination) => setPage(destination)} />}{!staffRole && <CameraInputBridge />}</div>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [staffPreview, setStaffPreview] = useState<StaffRole | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showVerificationWelcome, setShowVerificationWelcome] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => { setSession(nextSession); setPasswordRecovery(event === "PASSWORD_RECOVERY"); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    supabase.from("profiles").select("id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, terms_accepted_at, average_rating, rating_count").eq("id", session.user.id).maybeSingle().then(({ data }) => { setProfile(data as MemberProfile | null); setProfileLoading(false); });
  }, [session]);

  useEffect(() => {
    if (!session) { setStaffRole(null); setRoleLoading(false); return; }
    setRoleLoading(true);
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).in("role", ["admin", "moderator"]).then(({ data }) => {
      const roles = (data || []).map((row) => row.role);
      setStaffRole(roles.includes("admin") ? "admin" : roles.includes("moderator") ? "moderator" : null);
      setRoleLoading(false);
    });
  }, [session]);

  useEffect(() => {
    if (!session || !profile || staffPreview || staffRole || profile.verification_status !== "verified") return;
    const key = `questkarte:verification-welcome:${session.user.id}`;
    if (localStorage.getItem(key) !== "seen") setShowVerificationWelcome(true);
  }, [session, profile, staffPreview, staffRole]);

  if (loading) return <div className="app-boot"><img src="/questkarte-logo.png" alt="" /><span>Preparing your quest board…</span></div>;
  if (!session && showLanding) return <LandingPage onStart={() => setShowLanding(false)} onBrowse={() => { setShowLanding(false); setDemoMode(true); }} />;
  if (!session && !demoMode) return <AuthScreen onExplore={() => setDemoMode(true)} onStaffPreview={(role) => { setStaffPreview(role); setDemoMode(true); }} />;
  if (session && passwordRecovery) return <PasswordRecovery onDone={() => setPasswordRecovery(false)} />;
  if (session && profileLoading) return <div className="app-boot"><img src="/questkarte-logo.png" alt="" /><span>Loading your member profile…</span></div>;
  if (session && roleLoading) return <div className="app-boot"><span>Loading your workspace...</span></div>;
  if (session && !staffPreview && !staffRole && profile?.verification_status !== "verified") return <VerificationGate session={session} status={profile?.verification_status || "unverified"} termsAcceptedAt={profile?.terms_accepted_at || null} onSignOut={() => void supabase.auth.signOut()} />;
  if (session && showVerificationWelcome && !staffPreview && !staffRole) return <VerificationApprovedScreen name={profile?.full_name || "Member"} onEnter={() => { localStorage.setItem(`questkarte:verification-welcome:${session.user.id}`, "seen"); setShowVerificationWelcome(false); }} onLanding={() => { localStorage.setItem(`questkarte:verification-welcome:${session.user.id}`, "seen"); void supabase.auth.signOut(); setShowLanding(true); }} />;
  if (session && !profile?.bio && !staffPreview && !staffRole) return <ProfileSetup session={session} initialName={typeof session.user.user_metadata.full_name === "string" ? session.user.user_metadata.full_name : ""} onComplete={setProfile} />;
  return <AppShell session={session} profile={profile} staffRole={staffPreview || staffRole} onExit={() => { if (session) void supabase.auth.signOut(); setStaffPreview(null); setDemoMode(false); setShowLanding(true); }} />;
}

function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setNotice("Use at least 8 characters for your new password."); return; }
    if (password !== confirm) { setNotice("Your password confirmation does not match."); return; }
    setSaving(true); setNotice("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setNotice(error.message); return; }
    setNotice("Password updated. You can continue securely.");
  };
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><img src="/questkarte-logo.png" alt="QuestKarte emblem" /><div><span>QuestKarte</span><small>Secure account recovery</small></div></div><div className="auth-heading"><p className="eyebrow">Password reset</p><h1>Choose a new password</h1><p>This secure screen is available only from your recovery link.</p></div><form className="auth-form" onSubmit={submit}><label><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" /></label><label><span>Confirm new password</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required autoComplete="new-password" /></label>{notice && <p className="auth-notice" role="status">{notice}</p>}<button className="auth-submit" disabled={saving}>{saving ? "Saving..." : "Update password"}</button></form><button className="auth-link-button" type="button" onClick={onDone}>Return to QuestKarte</button></section></main>;
}

function VerificationApprovedScreen({ name, onEnter, onLanding }: { name: string; onEnter: () => void; onLanding: () => void }) {
  return <main className="verification-approved-page"><section className="verification-approved-card"><img src="/questkarte-logo.png" alt="QuestKarte" /><span className="eyebrow">Verification complete</span><h1>You are verified, {name}.</h1><p>Your account is ready for the QuestKarte marketplace. You can now complete your profile, post a task, apply to approved work, and build your member record.</p><div className="verification-approved-actions"><button type="button" className="btn primary" onClick={onEnter}>Continue to my workspace</button><button type="button" className="btn" onClick={onLanding}>Return to website landing page</button></div></section></main>;
}

function LegacyProfileSetup({ session, initialName, onComplete }: { session: Session; initialName: string; onComplete: (profile: MemberProfile) => void }) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Cebu City");
  const [skills, setSkills] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const skillOptions = ["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Pet care", "Tech help", "Writing"];
  const choosePhoto = (file?: File) => { if (!file) return; if (file.size > 900000) { setNotice("Please use a photo smaller than 900 KB for now."); return; } const reader = new FileReader(); reader.onload = () => setAvatar(String(reader.result)); reader.readAsDataURL(file); };
  const addCustomSkill = () => { const skill = customSkill.trim().replace(/\s+/g, " "); if (!skill) return; if (skills.some((item) => item.toLowerCase() === skill.toLowerCase())) { setCustomSkill(""); return; } setSkills([...skills, skill].slice(0, 12)); setCustomSkill(""); };
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setNotice(""); const { data, error } = await supabase.from("profiles").update({ full_name: name.trim(), bio: bio.trim(), city: city.trim(), skills, avatar_url: avatar }).eq("id", session.user.id).select("id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count").single(); setSaving(false); if (error || !data) { setNotice(error?.message || "Your profile could not be saved. Please try again."); return; } onComplete(data as MemberProfile); };
  return <main className="profile-setup-page"><section className="profile-setup-card"><div className="setup-brand"><img src="/questkarte-logo.png" alt="QuestKarte" /><div><strong>QuestKarte</strong><span>Member profile setup</span></div></div><div className="setup-heading"><span className="eyebrow">Step 1 of 1</span><h1>Make your profile easy to trust.</h1><p>Members can see your photo, your short introduction, and the services you are confident offering.</p></div><form className="profile-setup-form" onSubmit={submit}><div className="avatar-picker"><label className="avatar-upload">{avatar ? <img src={avatar} alt="Profile preview" /> : <span>{name[0]?.toUpperCase() || "?"}</span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><div><strong>Profile photo</strong><p>Optional, but it helps members recognize you.</p><label className="upload-photo-link">Choose photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label></div></div><label><span>Display name</span><input value={name} required minLength={2} onChange={(event) => setName(event.target.value)} placeholder="How should members know you?" /></label><label><span>About you</span><textarea value={bio} required minLength={10} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="Example: Reliable student helper available for tutoring, errands, and basic design work." /></label><label><span>City / service area</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cebu City" /></label><div><span className="setup-label">Services and strengths</span><div className="skill-choices">{skillOptions.map((skill) => <button type="button" key={skill} className={skills.includes(skill) ? "selected" : ""} onClick={() => setSkills(skills.includes(skill) ? skills.filter((item) => item !== skill) : [...skills, skill])}>{skill}</button>)}</div><div className="custom-skill"><input value={customSkill} maxLength={40} onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomSkill(); } }} placeholder="Add another strength, e.g. Video editing" /><button type="button" onClick={addCustomSkill}>Add</button></div></div>{notice && <p className="setup-notice">{notice}</p>}<button className="setup-submit" disabled={saving}>{saving ? "Saving profile…" : "Finish profile setup →"}</button></form></section></main>;
}

function ProfileSetup({ session, initialName, onComplete }: { session: Session; initialName: string; onComplete: (profile: MemberProfile) => void }) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Cebu City");
  const [skills, setSkills] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const skillOptions = ["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Pet care", "Tech help", "Writing"];
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 900000) { setNotice("Please use a photo smaller than 900 KB for now."); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addSkill = () => {
    const value = customSkill.trim().replace(/\s+/g, " ");
    if (!value || skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) return setCustomSkill("");
    setSkills((current) => [...current, value].slice(0, 12));
    setCustomSkill("");
  };
  const toggleSkill = (skill: string) => setSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    const { data, error } = await supabase.from("profiles").update({ full_name: name.trim(), bio: bio.trim(), city: city.trim(), skills, avatar_url: avatar }).eq("id", session.user.id).select("id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count").single();
    setSaving(false);
    if (error || !data) return setNotice(error?.message || "Your profile could not be saved. Please try again.");
    onComplete(data as MemberProfile);
  };
  return <main className="profile-setup-page"><section className="profile-setup-card"><div className="setup-brand"><img src="/questkarte-logo.png" alt="QuestKarte" /><div><strong>QuestKarte</strong><span>Member profile setup</span></div></div><div className="setup-heading"><span className="eyebrow">Step 1 of 1</span><h1>Make your profile easy to trust.</h1><p>Choose a photo, introduce yourself, and add the services you can confidently offer.</p></div><form className="profile-setup-form" onSubmit={submit}><div className="avatar-picker"><div className="avatar-upload" aria-label="Profile photo">{avatar ? <img src={avatar} alt="Profile preview" /> : <span>{name[0]?.toUpperCase() || "?"}</span>}</div><div><strong>Profile photo</strong><p>Use your camera now or select a saved image.</p><div className="profile-photo-actions"><label className="upload-photo-link">Use camera<input type="file" accept="image/png,image/jpeg,image/webp" capture="user" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><label className="upload-photo-link">Choose file<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label></div></div></div><label><span>Display name</span><input value={name} required minLength={2} onChange={(event) => setName(event.target.value)} /></label><label><span>About you</span><textarea value={bio} required minLength={10} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="Tell members what you do well and how you work." /></label><label><span>City / service area</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label><div><span className="setup-label">Services and strengths</span><div className="skill-choices">{skillOptions.map((skill) => <button type="button" key={skill} className={skills.includes(skill) ? "selected" : ""} onClick={() => toggleSkill(skill)}>{skill}</button>)}</div><div className="custom-skill"><input value={customSkill} maxLength={40} onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }} placeholder="Add another strength" /><button type="button" onClick={addSkill}>Add</button></div></div>{notice && <p className="setup-notice">{notice}</p>}<button className="setup-submit" disabled={saving}>{saving ? "Saving profile…" : "Finish profile setup →"}</button></form></section></main>;
}

void LegacyProfileSetup;
void MarketplaceFeed;

function FreshHome({ profile: providedProfile, onPost, onAccount, query }: { profile: MemberProfile | null; onPost: () => void; onAccount: () => void; query: string }) {
  const profile = providedProfile ?? {} as MemberProfile;
  const name = profile.full_name || "Member";
  const initial = name[0]?.toUpperCase() || "M";

  return <div className="fresh-home view home-dashboard">
    <section className="member-welcome"><div><span className="eyebrow">Your QuestKarte workspace</span><h2>Welcome, {name}.</h2><p>Browse live tasks from other members, publish your own request, and build a trusted record through completed work.</p><div className="welcome-actions"><button type="button" className="btn primary" onClick={onPost}>+ Post a task</button><button type="button" className="btn" onClick={onAccount}>View your profile</button></div></div><div className="welcome-member"><span className="avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}</span><div><strong>Member workspace</strong><small>Trust Factor {profile.trust_factor || 0} · Level 1</small></div></div></section>
    <div className="home-dashboard-grid">
      <section className="marketplace-column"><MarketplaceFeedLive onPost={onPost} query={query} /></section>
      <aside className="home-side-column"><MemberProgress profile={profile} /><FreshDiscovery profile={profile} /></aside>
    </div>
  </div>;
}

function MarketplaceFeed({ onPost }: { onPost: () => void }) { const [tasks, setTasks] = useState<MarketplaceTask[]>([]); const [loading, setLoading] = useState(true); const [errorMessage, setErrorMessage] = useState(""); const load = async () => { setLoading(true); const { data, error } = await supabase.from("tasks").select("id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at,created_at,category:categories(name),poster:profiles!tasks_posted_by_fkey(full_name,trust_factor)").eq("status", "open").order("published_at", { ascending: false }); if (error) setErrorMessage(error.message); else { setErrorMessage(""); setTasks((data || []) as unknown as MarketplaceTask[]); } setLoading(false); }; useEffect(() => { load(); }, []); return <section className="real-task-feed"><div className="section-head"><div><span className="eyebrow">Live marketplace</span><h2>Open tasks from members</h2></div><button type="button" className="btn primary" onClick={onPost}>Post a task</button></div>{loading ? <div className="panel feed-message">Loading published tasks…</div> : errorMessage ? <div className="panel feed-message feed-error">Could not load tasks: {errorMessage}</div> : tasks.length ? <div className="real-task-list">{tasks.map((task) => <TaskCard key={task.id} quest={{ id: task.id, category: task.category?.name || "General", title: task.title, description: task.description, commission: task.is_service_swap ? task.swap_details || "Service swap" : `${task.currency === "PHP" ? "₱" : ""}${Number(task.commission_amount || 0).toLocaleString()}`, location: task.location_label, schedule: task.published_at ? `Posted ${new Date(task.published_at).toLocaleDateString()}` : "Posted recently", posterName: task.poster?.full_name || "QuestKarte member", trust: `Trust Factor ${task.poster?.trust_factor || 0}`, kind: task.is_service_swap ? "swap" : task.requires_student_verification ? "student" : undefined, initials: (task.poster?.full_name || "M").slice(0, 2).toUpperCase() }} />)}</div> : <div className="panel feed-message"><strong>No published tasks yet.</strong><span>Be the first member to post a task for the marketplace.</span></div>}</section>; }

function GuestHome({ onJoin }: { onJoin: () => void }) {
  return <div className="fresh-home guest-home view"><section className="member-welcome guest-welcome"><div><span className="eyebrow">Guest marketplace preview</span><h2>Explore work around Cebu City.</h2><p>You can browse approved tasks, task details, photos, and the map. Create an account when you are ready to post, apply, chat, and build your member record.</p><div className="welcome-actions"><button type="button" className="btn primary" onClick={onJoin}>Create or sign in</button></div></div><div className="welcome-member guest-member"><span aria-hidden="true">◎</span><div><strong>Viewing as guest</strong><small>Read-only marketplace access</small></div></div></section><MarketplaceFeedGuest onJoin={onJoin} /><FreshDiscovery profile={null} guest /></div>;
}

type SharedMarketplaceTask = { id: string; posted_by: string; category_id: string | null; title: string; description: string; commission_amount: number | null; currency: string; is_service_swap: boolean; swap_details: string | null; requires_student_verification: boolean; location_label: string; published_at: string | null; created_at: string; images: string[]; categoryName: string; posterName: string; posterTrust: number };
type RawSharedTask = Omit<SharedMarketplaceTask, "images" | "categoryName" | "posterName" | "posterTrust">;

function MarketplaceFeedLive({ onPost, query }: { onPost: () => void; query: string }) {
  const [tasks, setTasks] = useState<SharedMarketplaceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applicationNotice, setApplicationNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [applicationTask, setApplicationTask] = useState<SharedMarketplaceTask | null>(null);
  const [profilePreviewId, setProfilePreviewId] = useState<string | null>(null);

  const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const { data: taskData, error: taskError } = await supabase.from("tasks").select("id,posted_by,category_id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at,created_at").eq("status", "open").order("published_at", { ascending: false });
    if (taskError) { setErrorMessage(taskError.message); setLoading(false); return; }
    const rows = (taskData || []) as RawSharedTask[];
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      setCurrentUserId(authData.user.id);
      const { data: applications } = await supabase.from("applications").select("task_id").eq("applicant_id", authData.user.id);
      setAppliedIds((applications || []).map((application) => application.task_id));
    }
    const memberIds = [...new Set(rows.map((task) => task.posted_by))];
    const categoryIds = [...new Set(rows.map((task) => task.category_id).filter((id): id is string => Boolean(id)))];
    const [{ data: memberData, error: memberError }, { data: categoryData, error: categoryError }, { data: attachmentData, error: attachmentError }] = await Promise.all([
      memberIds.length ? supabase.from("profiles").select("id,full_name,trust_factor").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
      categoryIds.length ? supabase.from("categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
      rows.length ? supabase.from("task_attachments").select("task_id,storage_path").in("task_id", rows.map((task) => task.id)).order("created_at") : Promise.resolve({ data: [], error: null }),
    ]);
    if (memberError || categoryError || attachmentError) { setErrorMessage(memberError?.message || categoryError?.message || attachmentError?.message || "The task details could not be loaded."); setLoading(false); return; }
    const members = new Map((memberData || []).map((member) => [member.id, member]));
    const categories = new Map((categoryData || []).map((category) => [category.id, category]));
    const attachmentsByTask = new Map<string, string[]>();
    await Promise.all((attachmentData || []).map(async (attachment) => { const { data } = await supabase.storage.from("task-attachments").createSignedUrl(attachment.storage_path, 3600); if (data?.signedUrl) attachmentsByTask.set(attachment.task_id, [...(attachmentsByTask.get(attachment.task_id) || []), data.signedUrl]); }));
    setTasks(rows.map((task) => ({ ...task, images: attachmentsByTask.get(task.id) || [], categoryName: categories.get(task.category_id || "")?.name || "General", posterName: members.get(task.posted_by)?.full_name || "QuestKarte member", posterTrust: members.get(task.posted_by)?.trust_factor || 0 })));
    setErrorMessage(""); setLoading(false);
  };

  useEffect(() => {
    void load(true);
    const refreshTimer = window.setInterval(() => void load(false), 12000);
    const channel = supabase.channel("questkarte-open-tasks").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void load(false)).subscribe();
    return () => { window.clearInterval(refreshTimer); void supabase.removeChannel(channel); };
  }, []);

  const toQuest = (task: SharedMarketplaceTask) => ({ id: task.id, category: task.categoryName, title: task.title, description: task.description, commission: task.is_service_swap ? task.swap_details || "Service swap" : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`, location: task.location_label, schedule: task.published_at ? `Posted ${new Date(task.published_at).toLocaleDateString()}` : "Posted recently", posterName: task.posterName, trust: `Trust Factor ${task.posterTrust}`, kind: task.is_service_swap ? "swap" as const : task.requires_student_verification ? "student" as const : undefined, initials: task.posterName.slice(0, 2).toUpperCase(), images: task.images });
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = normalizedQuery ? tasks.filter((task) => `${task.title} ${task.description} ${task.categoryName} ${task.location_label} ${task.posterName}`.toLowerCase().includes(normalizedQuery)) : tasks;
  if (applicationTask) return <ApplicationWorkspace task={applicationTask} onBack={() => setApplicationTask(null)} onSent={() => { setAppliedIds((current) => [...current, applicationTask.id]); setApplicationNotice("Application sent. The task poster can now review your message and optional work samples."); setApplicationTask(null); }} />;
  return <><section className="real-task-feed"><div className="section-head"><div><span className="eyebrow">Live marketplace</span><h2>{normalizedQuery ? `Results for “${query.trim()}”` : "Open tasks from members"}</h2></div><div className="feed-actions"><button type="button" className="btn" onClick={() => void load(true)}>Refresh</button><button type="button" className="btn primary" onClick={onPost}>Post a task</button></div></div>{applicationNotice && <p className="staff-notice">{applicationNotice}</p>}{loading ? <div className="panel feed-message">Loading published tasks...</div> : errorMessage ? <div className="panel feed-message feed-error"><strong>We could not load the marketplace.</strong><span>{errorMessage}</span><button type="button" className="btn" onClick={() => void load(true)}>Try again</button></div> : visibleTasks.length ? <div className="real-task-list">{visibleTasks.map((task) => <TaskCard key={task.id} quest={toQuest(task)} isOwner={task.posted_by === currentUserId} applied={appliedIds.includes(task.id)} onProfileClick={() => setProfilePreviewId(task.posted_by)} onApply={task.posted_by === currentUserId ? undefined : () => setApplicationTask(task)} />)}</div> : <div className="panel feed-message"><strong>{normalizedQuery ? "No matching tasks found." : "No published tasks yet."}</strong><span>{normalizedQuery ? "Try a task title, category, skill, or location such as Cleaning, tutoring, or Lahug." : "When any QuestKarte member publishes a task, it will appear here for everyone."}</span>{!normalizedQuery && <button type="button" className="btn primary" onClick={onPost}>Post the first task</button>}</div>}</section>{profilePreviewId && <MemberProfileModal memberId={profilePreviewId} onClose={() => setProfilePreviewId(null)} />}</>;
}

function MemberProfileModal({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  type PublicProfile = Pick<MemberProfile, "id" | "full_name" | "avatar_url" | "bio" | "city" | "skills" | "trust_factor" | "completed_tasks_count" | "verification_status" | "average_rating" | "rating_count">;
  const [member, setMember] = useState<PublicProfile | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { void (async () => { const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url,bio,city,skills,trust_factor,completed_tasks_count,verification_status,average_rating,rating_count").eq("id", memberId).maybeSingle(); if (error || !data) setNotice(error?.message || "This member profile is unavailable."); else setMember(data as PublicProfile); })(); }, [memberId]);
  const name = member?.full_name || "QuestKarte member";
  return <div className="member-profile-backdrop" role="presentation" onMouseDown={onClose}><section className="member-profile-modal" role="dialog" aria-modal="true" aria-label={`${name} profile`} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="task-modal-close" onClick={onClose} aria-label="Close profile">×</button>{notice ? <p className="setup-notice">{notice}</p> : !member ? <p className="feed-message">Loading member profile...</p> : <><header className="member-profile-heading"><span className="avatar profile-large-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" /> : name.slice(0, 2).toUpperCase()}</span><div><span className="eyebrow">QuestKarte member</span><h2>{name}</h2><p>{member.verification_status === "verified" ? "Verified member" : "Member profile"}{member.city ? ` · ${member.city}` : ""}</p></div></header>{member.bio && <p className="member-profile-bio">{member.bio}</p>}<div className="member-profile-stats"><div><span>Trust Factor</span><strong>{member.trust_factor || 0}</strong></div><div><span>Completed</span><strong>{member.completed_tasks_count || 0}</strong></div><div><span>Rating</span><strong>{Number(member.average_rating || 0).toFixed(1)}</strong><small>{member.rating_count || 0} reviews</small></div></div><div className="member-profile-skills"><strong>Services and strengths</strong><div>{member.skills?.length ? member.skills.map((skill) => <span key={skill}>{skill}</span>) : <small>No services listed yet.</small>}</div></div></>}</section></div>;
}

function ApplicationWorkspace({ task, onBack, onSent }: { task: SharedMarketplaceTask; onBack: () => void; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || []).filter((file) => file.size <= 8 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)).slice(0, 3);
    setFiles(next);
    if (next.length !== (list?.length || 0)) setNotice("Choose up to 3 JPG, PNG, WEBP, or PDF files, each no larger than 8 MB.");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 10) { setNotice("Write a short message of at least 10 characters so the task poster understands your application."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotice("Your session has ended. Please sign in again."); return; }
    setSaving(true); setNotice("");
    const { data: application, error } = await supabase.from("applications").insert({ task_id: task.id, applicant_id: auth.user.id, cover_note: message.trim() }).select("id").single();
    if (error || !application) { setSaving(false); setNotice(error?.message || "Your application could not be sent."); return; }
    try {
      const attachmentRows = await Promise.all(files.map(async (file) => {
        const path = `${auth.user.id}/${application.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const upload = await supabase.storage.from("application-attachments").upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        return { application_id: application.id, uploaded_by: auth.user.id, storage_path: path, file_name: file.name, mime_type: file.type };
      }));
      if (attachmentRows.length) { const { error: attachmentError } = await supabase.from("application_attachments").insert(attachmentRows); if (attachmentError) throw attachmentError; }
    } catch (uploadError) { setSaving(false); setNotice(`Your application was sent, but its optional attachments could not be saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`); return; }
    setSaving(false); onSent();
  };
  return <section className="application-workspace"><header className="application-workspace-head"><button type="button" className="btn" onClick={onBack}>← Back to marketplace</button><div><span className="eyebrow">Application workspace</span><h2>Apply with clarity</h2><p>Your application is shared only with the member who posted this task.</p></div></header><div className="application-workspace-grid"><form className="application-form panel" onSubmit={submit}><div className="application-task-summary"><span className="badge cat-general">{task.categoryName}</span><h3>{task.title}</h3><p>{task.location_label} · {task.is_service_swap ? task.swap_details || "Service swap" : `PHP ${Number(task.commission_amount || 0).toLocaleString()}`}</p></div><label><span>Message to the task poster</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} required placeholder="Briefly explain why you are a good fit, your availability, and how you will handle the task." /></label><label className="application-upload"><strong>Attach a file or image <em>optional</em></strong><small>Share a work sample, portfolio image, or supporting document. Up to 3 files.</small><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectFiles(event.target.files)} />{files.length > 0 && <ul>{files.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}</ul>}</label>{notice && <p className="setup-notice">{notice}</p>}<button className="post-submit" disabled={saving}>{saving ? "Sending application..." : "Send application"}</button></form><aside className="application-expectations panel"><span className="eyebrow">Before you send</span><h3>Make a strong first impression</h3><ul><li>State when you are available.</li><li>Describe the skill or experience most relevant to this task.</li><li>Only share files that help the task poster decide.</li></ul><p>Sending an application does not create a chat yet. The task poster must accept one applicant first.</p></aside></div></section>;
}

function MarketplaceFeedGuest({ onJoin }: { onJoin: () => void }) {
  type GuestTask = { id: string; posted_by: string; category_id: string | null; title: string; description: string; commission_amount: number | null; currency: string; is_service_swap: boolean; swap_details: string | null; requires_student_verification: boolean; location_label: string; published_at: string | null };
  const [tasks, setTasks] = useState<GuestTask[]>([]);
  const [categories, setCategories] = useState(new Map<string, string>());
  const [members, setMembers] = useState(new Map<string, { full_name: string; trust_factor: number }>());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tasks").select("id,posted_by,category_id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at").eq("status", "open").eq("moderation_state", "approved").order("published_at", { ascending: false });
    if (error) { setNotice(error.message); setLoading(false); return; }
    const rows = (data || []) as GuestTask[];
    const memberIds = [...new Set(rows.map((task) => task.posted_by))];
    const categoryIds = [...new Set(rows.map((task) => task.category_id).filter((id): id is string => Boolean(id)))];
    const [{ data: memberRows }, { data: categoryRows }] = await Promise.all([
      memberIds.length ? supabase.from("profiles").select("id,full_name,trust_factor").in("id", memberIds) : Promise.resolve({ data: [] }),
      categoryIds.length ? supabase.from("categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    ]);
    setMembers(new Map((memberRows || []).map((member) => [member.id, member])));
    setCategories(new Map((categoryRows || []).map((category) => [category.id, category.name])));
    setTasks(rows); setNotice(""); setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <section className="real-task-feed guest-feed"><div className="section-head"><div><span className="eyebrow">Guest marketplace</span><h2>Open tasks from members</h2></div><div className="feed-actions"><button type="button" className="btn" onClick={() => void load()}>Refresh</button><button type="button" className="btn primary" onClick={onJoin}>Sign in to participate</button></div></div>{notice && <p className="staff-notice">{notice}</p>}{loading ? <div className="panel feed-message">Loading approved tasks...</div> : tasks.length ? <div className="real-task-list">{tasks.map((task) => { const member = members.get(task.posted_by); return <TaskCard key={task.id} quest={{ id: task.id, category: categories.get(task.category_id || "") || "General", title: task.title, description: task.description, commission: task.is_service_swap ? task.swap_details || "Service swap" : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`, location: task.location_label, schedule: task.published_at ? `Posted ${new Date(task.published_at).toLocaleDateString()}` : "Posted recently", posterName: member?.full_name || "QuestKarte member", trust: `Trust Factor ${member?.trust_factor || 0}`, kind: task.is_service_swap ? "swap" : task.requires_student_verification ? "student" : undefined, initials: (member?.full_name || "M").slice(0, 2).toUpperCase() }} />; })}</div> : <div className="panel feed-message"><strong>No approved tasks yet.</strong><span>New approved tasks will appear here when members publish them.</span></div>}<p className="guest-feed-note">Guests can browse only. Sign in to save, apply, post, chat, or access an account.</p></section>;
}

function FreshDiscovery({ profile, guest = false }: { profile: MemberProfile | null; guest?: boolean }) {
  type MapTask = TaskMapPin;
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [mapTasks, setMapTasks] = useState<MapTask[]>([]);
  const [radius, setRadius] = useState(5000);
  const [radiusInput, setRadiusInput] = useState("5");
  const [locationQuery, setLocationQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const locationEnabled = guest || Object.keys(localStorage).some((key) => key.startsWith("questkarte:map-location:") && localStorage.getItem(key) === "true");
  const [status, setStatus] = useState(locationEnabled ? "Select Locate me to centre the map around you." : "Turn on Map location in Settings to use your location.");
  const loadPins = async () => {
    const { data } = await supabase.from("tasks").select("id,posted_by,category_id,title,description,location_label,latitude,longitude,commission_amount,currency,is_service_swap,swap_details").eq("status", "open").eq("moderation_state", "approved").not("latitude", "is", null).not("longitude", "is", null);
    const rows = (data || []).filter((task) => task.latitude !== null && task.longitude !== null) as Array<TaskMapPin & { posted_by: string; category_id: string | null }>;
    const profileIds = [...new Set(rows.map((task) => task.posted_by))];
    const categoryIds = [...new Set(rows.map((task) => task.category_id).filter((id): id is string => Boolean(id)))];
    const [{ data: profiles }, { data: categories }, { data: attachments }] = await Promise.all([
      profileIds.length ? supabase.from("profiles").select("id,full_name,trust_factor").in("id", profileIds) : Promise.resolve({ data: [] }),
      categoryIds.length ? supabase.from("categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [] }),
      rows.length ? supabase.from("task_attachments").select("task_id,storage_path").in("task_id", rows.map((task) => task.id)).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    const profilesById = new Map((profiles || []).map((item) => [item.id, item]));
    const categoriesById = new Map((categories || []).map((item) => [item.id, item]));
    const imagesByTask = new Map<string, string[]>();
    await Promise.all((attachments || []).map(async (attachment) => { const { data: signed } = await supabase.storage.from("task-attachments").createSignedUrl(attachment.storage_path, 3600); if (signed?.signedUrl) imagesByTask.set(attachment.task_id, [...(imagesByTask.get(attachment.task_id) || []), signed.signedUrl]); }));
    setMapTasks(rows.map((task) => ({ ...task, categoryName: categoriesById.get(task.category_id || "")?.name || "General", posterName: profilesById.get(task.posted_by)?.full_name || "QuestKarte member", posterTrust: profilesById.get(task.posted_by)?.trust_factor || 0, images: imagesByTask.get(task.id) || [] })));
  };
  useEffect(() => { void loadPins(); const channel = supabase.channel("questkarte-map-pins").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void loadPins()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, []);
  const locate = () => {
    if (!locationEnabled) { setStatus("Map location is off. Turn it on in Settings first."); return; }
    if (!navigator.geolocation) { setStatus("Location is not supported by this browser."); return; }
    setStatus("Requesting browser location permission...");
    navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition([coords.latitude, coords.longitude]); setStatus(`Showing approved task pins within ${radius / 1000} km of your approximate location.`); }, () => setStatus("Location was not shared. You can still browse all available task pins."), { enableHighAccuracy: false, timeout: 10000 });
  };
  const chooseLocation = () => {
    const value = locationQuery.trim().toLowerCase();
    const areas: Record<string, [number, number]> = { lahug: [10.3250, 123.9050], "it park": [10.3292, 123.9066], banilad: [10.3507, 123.9145], "sm city": [10.3128, 123.9186], "cebu city": [10.3157, 123.8854], "ayala center": [10.3170, 123.9056] };
    const matchingTasks = mapTasks.filter((task) => `${task.title} ${task.description || ""} ${task.categoryName || ""} ${task.location_label}`.toLowerCase().includes(value));
    if (value && matchingTasks.length) {
      setTaskFilter(value);
      setPosition([matchingTasks[0].latitude, matchingTasks[0].longitude]);
      setStatus(`Showing ${matchingTasks.length} approved task${matchingTasks.length === 1 ? "" : "s"} matching “${locationQuery.trim()}”.`);
      return;
    }
    const coordinateMatch = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinateMatch) { setTaskFilter(""); setPosition([Number(coordinateMatch[1]), Number(coordinateMatch[2])]); setStatus("Showing approved tasks around the coordinates you entered."); return; }
    const matchedArea = Object.entries(areas).find(([area]) => value.includes(area));
    if (matchedArea) { setTaskFilter(""); setPosition(matchedArea[1]); setStatus(`Showing approved tasks around ${matchedArea[0]}.`); return; }
    setTaskFilter("");
    setStatus("Try a task type such as Cleaning, or enter Lahug, IT Park, Banilad, Cebu City, or latitude, longitude.");
  };
  const applyRadius = () => {
    const parsed = Number(radiusInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStatus("Enter a radius between 1 and 50 km, then select Set radius.");
      return;
    }
    const kilometres = Math.min(50, Math.max(1, Math.round(parsed * 10) / 10));
    setRadius(kilometres * 1000);
    setRadiusInput(String(kilometres));
    setStatus(`Showing approved task pins within ${kilometres} km of the selected area.`);
  };
  const chooseRadiusPreset = (kilometres: number) => {
    setRadius(kilometres * 1000);
    setRadiusInput(String(kilometres));
    setStatus(`Showing approved task pins within ${kilometres} km of the selected area.`);
  };
  const visibleTasks = mapTasks.filter((task) => {
    const inRadius = !position || (() => { const dx = (task.latitude - position[0]) * 111000; const dy = (task.longitude - position[1]) * 111000 * Math.cos(position[0] * Math.PI / 180); return Math.hypot(dx, dy) <= radius; })();
    const matchesTask = !taskFilter || `${task.title} ${task.description || ""} ${task.categoryName || ""} ${task.location_label}`.toLowerCase().includes(taskFilter);
    return inRadius && matchesTask;
  });
  const name = profile?.full_name || "Member";
  const radiusControl = (compact = false) => <div className={compact ? "map-radius map-radius-compact" : "map-radius"}><label>{compact ? "Within" : "Radius"}<input type="number" min="1" max="50" step="0.5" inputMode="decimal" value={radiusInput} onChange={(event) => setRadiusInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyRadius(); }} aria-label="Search radius in kilometres" /> km</label><button type="button" className="map-radius-set" onClick={applyRadius}>Set radius</button>{!compact && [2, 5, 10].map((value) => <button type="button" className={radius === value * 1000 ? "active" : ""} onClick={() => chooseRadiusPreset(value)} key={value}>{value} km</button>)}</div>;
  return <><section className="fresh-discovery"><section className="panel map-panel"><div className="panel-title-row"><div><h3>Nearby opportunities</h3><p>{status}</p></div><div className="map-header-actions"><button type="button" className="map-expand" onClick={() => setFullMapOpen(true)} aria-label="Open full map">⛶</button><button type="button" className="map-locate" onClick={locate} disabled={!locationEnabled}>⌖ Locate me</button></div></div><div className="map-search-row"><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") chooseLocation(); }} placeholder="Search Cebu area or enter latitude, longitude" aria-label="Map location" /><button type="button" onClick={chooseLocation}>Show area</button></div>{radiusControl()}<TaskMap position={position} radius={radius} tasks={visibleTasks} /></section><section className="panel fresh-trust"><div className="snapshot-heading"><div><h3>Member trust snapshot</h3><p>Your reliability as a task poster and service provider.</p></div><span className="snapshot-level">{profile?.verification_status === "verified" ? "Verified" : "New member"}</span></div><div className="profile-mini"><span className="avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name[0]?.toUpperCase()}</span><div><div className="profile-name">{name}</div><div className="profile-role">{profile?.verification_status === "verified" ? "Verified member" : "Complete verification to build trust"}</div></div></div><div className="snapshot-stats"><div className="snapshot-stat"><span>Trust Factor</span><strong>{profile?.trust_factor || 0}</strong><small>out of 100</small></div><div className="snapshot-stat"><span>Rating</span><strong>{profile?.average_rating?.toFixed(1) || "0.0"}</strong><small>{profile?.rating_count || 0} reviews</small></div><div className="snapshot-stat"><span>Completed</span><strong>{profile?.completed_tasks_count || 0}</strong><small>tasks</small></div></div></section></section>{fullMapOpen && <section className="map-modal" role="dialog" aria-modal="true" aria-label="Full marketplace map"><div className="map-modal-card"><header><div><span className="eyebrow">QuestKarte map</span><h2>Explore approved tasks</h2></div><button type="button" onClick={() => setFullMapOpen(false)} aria-label="Close full map">×</button></header><div className="map-modal-controls"><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") chooseLocation(); }} placeholder="Lahug, IT Park, Banilad, or latitude, longitude" /><button type="button" onClick={chooseLocation}>Search</button>{radiusControl(true)}</div><TaskMap position={position} radius={radius} tasks={visibleTasks} full /><p className="map-caption">Category markers: tutoring 📚 · cleaning 🧹 · delivery 🛵 · design ✦ · other ⚑. {visibleTasks.length} approved task pin{visibleTasks.length === 1 ? "" : "s"} in this area.</p></div></section>}</>;
}

type TaskMapPin = { id: string; title: string; description?: string; location_label: string; latitude: number; longitude: number; commission_amount: number | null; currency: string; is_service_swap: boolean; swap_details: string | null; categoryName?: string; posterName?: string; posterTrust?: number; images?: string[] };
function taskMarker(task: TaskMapPin) { const label = task.title.toLowerCase(); const [symbol, category] = label.includes("tutor") || label.includes("academic") ? ["📚", "study"] : label.includes("clean") ? ["🧹", "clean"] : label.includes("deliver") || label.includes("grocery") ? ["🛵", "delivery"] : label.includes("design") || label.includes("tech") ? ["✦", "design"] : ["⚑", "general"]; return divIcon({ className: "", html: `<span class="task-map-marker ${category}" title="${task.title.replace(/\"/g, "&quot;")}">${symbol}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }); }
function MapTaskPreview({ task }: { task: TaskMapPin }) { const reward = task.is_service_swap ? task.swap_details || "Service swap" : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`; return <article className="map-task-preview"><div className="map-task-preview-media">{task.images?.[0] ? <img src={task.images[0]} alt="" /> : <span>{task.categoryName || "General"}</span>}</div><div className="map-task-preview-body"><span className="badge cat-general">{task.categoryName || "General"}</span><h3>{task.title}</h3><p>{task.description || "Open task available through QuestKarte."}</p><div className="map-task-preview-meta"><span>⌖ {task.location_label}</span><strong>{reward}</strong></div><small>Posted by {task.posterName || "QuestKarte member"} · Trust Factor {task.posterTrust || 0}</small></div></article>; }
function TaskMap({ position, radius, tasks, full = false }: { position: [number, number] | null; radius: number; tasks: TaskMapPin[]; full?: boolean }) { return <div className={full ? "quest-map full" : "quest-map"}><MapContainer center={position || [10.3157, 123.8854]} zoom={position ? 13 : 12} scrollWheelZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapPanTo position={position} />{position && <><Circle center={position} radius={radius} pathOptions={{ color: "#47A2F5", fillColor: "#47A2F5", fillOpacity: 0.08 }} /><CircleMarker center={position} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#213BA3", fillOpacity: 1 }}><Popup>Your selected area</Popup></CircleMarker></>}{tasks.map((task) => <Marker key={task.id} position={[task.latitude, task.longitude]} icon={taskMarker(task)}><Popup className="quest-map-task-popup"><MapTaskPreview task={task} /></Popup></Marker>)}</MapContainer></div>; }

function FreshTasks({ session, onGoPost }: { session: Session; onGoPost: () => void }) { const [tab, setTab] = useState<"posted" | "applied">("posted"); const [posted, setPosted] = useState<{ id: string; title: string; status: string; moderation_state: string; assigned_to: string | null; created_at: string }[]>([]); const [applied, setApplied] = useState<{ id: string; status: string; created_at: string; task: { id: string; title: string; status: string; location_label: string } | null }[]>([]); const [loading, setLoading] = useState(true); const load = async () => { setLoading(true); const [own, mine] = await Promise.all([supabase.from("tasks").select("id,title,status,moderation_state,assigned_to,created_at").eq("posted_by", session.user.id).order("created_at", { ascending: false }), supabase.from("applications").select("id,status,created_at,task:tasks(id,title,status,location_label)").eq("applicant_id", session.user.id).order("created_at", { ascending: false })]); setPosted((own.data || []) as typeof posted); setApplied((mine.data || []) as unknown as typeof applied); setLoading(false); }; useEffect(() => { void load(); }, [session.user.id]); const entries = tab === "posted" ? posted : applied; return <div className="fresh-tasks view"><section className="panel task-workspace-head"><div><span className="eyebrow">Your task workspace</span><h2>Manage work from one place.</h2><p>Track requests you posted and services you applied for separately.</p></div><button className="btn primary" onClick={onGoPost}>+ Post a task</button></section><div className="staff-tabs task-tabs"><button className={tab === "posted" ? "active" : ""} onClick={() => setTab("posted")}>My posted tasks <span>{posted.length}</span></button><button className={tab === "applied" ? "active" : ""} onClick={() => setTab("applied")}>My applications <span>{applied.length}</span></button></div>{loading ? <section className="panel feed-message">Loading your task workspace...</section> : entries.length ? <section className="task-work-list">{tab === "posted" ? posted.map((task) => <article className="panel staff-case" key={task.id}><div><strong>{task.title}</strong><span>{task.moderation_state === "pending_review" ? "Awaiting moderator review" : task.moderation_state === "rejected" ? "Needs revision - check the moderation note" : task.status === "completed" ? "Completed" : task.assigned_to ? "Applicant assigned - work in progress" : "Published and accepting applications"}</span><small>Posted {new Date(task.created_at).toLocaleDateString()}</small></div><span className="role-chip">{task.status.replace("_", " ")}</span></article>) : applied.map((application) => <article className="panel staff-case" key={application.id}><div><strong>{application.task?.title || "Task unavailable"}</strong><span>{application.task?.location_label || "Task details unavailable"}</span><small>Application {application.status} · {new Date(application.created_at).toLocaleDateString()}</small></div><span className="role-chip">{application.status}</span></article>)}</section> : <div className="fresh-empty-view"><div className="empty-icon">□</div><h2>{tab === "posted" ? "No posted tasks yet" : "No applications yet"}</h2><p>{tab === "posted" ? "Create a clear request and submit it for review." : "Browse approved tasks and apply when your skills are a good fit."}</p>{tab === "posted" && <button className="btn primary" onClick={onGoPost}>Post your first task</button>}</div>}</div>; }
function FreshChat() { return <div className="fresh-empty-view view"><div className="empty-icon">◌</div><h2>No messages yet</h2><p>Messages start when you apply to a task or someone applies to yours. Keep all task details inside QuestKarte.</p></div>; }

function FreshChatReal({ session, initialTaskId = null }: { session: Session; initialTaskId?: string | null }) {
  type ChatConversation = { id: string; task_id: string | null; title: string; otherName: string };
  type ChatMessage = { id: string; sender_id: string; body: string; created_at: string };
  const [conversations, setConversations] = useState<ChatConversation[]>([]); const [selected, setSelected] = useState<string | null>(null); const [messages, setMessages] = useState<ChatMessage[]>([]); const [draft, setDraft] = useState(""); const [notice, setNotice] = useState("");
  const load = async () => { const { data: membershipRows } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", session.user.id); const ids = (membershipRows || []).map((row) => row.conversation_id); if (!ids.length) { setConversations([]); return; } const [{ data: convRows }, { data: allMembers }] = await Promise.all([supabase.from("conversations").select("id,task_id,updated_at").in("id", ids).order("updated_at", { ascending: false }), supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", ids)]); const participantIds = [...new Set((allMembers || []).map((row) => row.user_id).filter((id) => id !== session.user.id))]; const taskIds = [...new Set((convRows || []).map((row) => row.task_id).filter((id): id is string => Boolean(id)))]; const [{ data: profiles }, { data: tasks }] = await Promise.all([participantIds.length ? supabase.from("profiles").select("id,full_name").in("id", participantIds) : Promise.resolve({ data: [] }), taskIds.length ? supabase.from("tasks").select("id,title").in("id", taskIds) : Promise.resolve({ data: [] })]); const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name])); const taskNames = new Map((tasks || []).map((task) => [task.id, task.title])); setConversations((convRows || []).map((conversation) => ({ id: conversation.id, task_id: conversation.task_id, title: conversation.task_id ? taskNames.get(conversation.task_id) || "Task conversation" : "QuestKarte conversation", otherName: names.get((allMembers || []).find((member) => member.conversation_id === conversation.id && member.user_id !== session.user.id)?.user_id || "") || "QuestKarte member" }))); };
  const loadMessages = async (conversationId: string) => { const { data, error } = await supabase.from("messages").select("id,sender_id,body,created_at").eq("conversation_id", conversationId).eq("hidden_by_moderation", false).order("created_at"); if (error) setNotice(error.message); else setMessages((data || []) as ChatMessage[]); };
  useEffect(() => { void load(); const channel = supabase.channel(`questkarte-chat-${session.user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => { if (selected) void loadMessages(selected); void load(); }).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [session.user.id, selected]);
  const choose = (conversationId: string) => { setSelected(conversationId); void loadMessages(conversationId); };
  useEffect(() => { const target = initialTaskId ? conversations.find((conversation) => conversation.task_id === initialTaskId) : null; if (target && target.id !== selected) choose(target.id); }, [initialTaskId, conversations, selected]);
  const send = async (event: FormEvent) => { event.preventDefault(); if (!selected || !draft.trim()) return; const { error } = await supabase.from("messages").insert({ conversation_id: selected, sender_id: session.user.id, body: draft.trim() }); if (error) { setNotice(error.message); return; } setDraft(""); void loadMessages(selected); };
  if (!conversations.length) return <div className="fresh-empty-view view"><div className="empty-icon">◌</div><h2>No task conversations yet</h2><p>When a task poster accepts an applicant, QuestKarte automatically opens a private conversation for both members.</p></div>;
  const current = conversations.find((conversation) => conversation.id === selected);
  return <div className="chat-layout view"><div className="convo-list">{conversations.map((conversation) => <button className={`convo ${selected === conversation.id ? "active" : ""}`} key={conversation.id} onClick={() => choose(conversation.id)}><span className="avatar">{conversation.otherName.slice(0, 2).toUpperCase()}</span><span><strong>{conversation.otherName}</strong><small>{conversation.title}</small></span></button>)}</div><section className="thread-panel open">{current ? <><div className="thread-head"><span className="avatar">{current.otherName.slice(0, 2).toUpperCase()}</span><div><div className="thread-name">{current.otherName}</div><div className="thread-quest">{current.title}</div></div></div><div className="thread-body">{messages.map((message) => <div className={`msg ${message.sender_id === session.user.id ? "out" : "in"}`} key={message.id}>{message.body}</div>)}</div><form className="thread-input" onSubmit={send}><input value={draft} maxLength={3000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." /><button className="thread-send" aria-label="Send message">Send</button></form></> : <div className="fresh-empty-view"><h2>Select a conversation</h2><p>Choose a task conversation from the list.</p></div>}{notice && <p className="setup-notice">{notice}</p>}</section></div>;
}
function SettingsPage({ email, onAccount, onExit, isDemo }: { email: string; onAccount: () => void; onExit: () => void; isDemo: boolean }) { const notificationKey = `questkarte:task-notifications:${email}`; const locationKey = `questkarte:map-location:${email}`; const [notifications, setNotifications] = useState(() => localStorage.getItem(notificationKey) !== "false"); const [location, setLocation] = useState(() => localStorage.getItem(locationKey) === "true"); const [locationCopy, setLocationCopy] = useState(() => localStorage.getItem(locationKey) === "true" ? "Enabled for this account. Use Locate me on the map whenever you want to share your approximate area." : "Turn this on to allow the map to request your approximate location when needed."); const toggleNotifications = () => { const next = !notifications; setNotifications(next); localStorage.setItem(notificationKey, String(next)); }; const toggleLocation = () => { const next = !location; setLocation(next); localStorage.setItem(locationKey, String(next)); if (!next) { setLocationCopy("Off. QuestKarte will not request your location from the map."); return; } setLocationCopy("Enabled. The map may now ask for browser permission when you select Locate me."); }; return <div className="settings-page view"><section className="settings-hero"><span className="eyebrow">Account controls</span><h2>Settings</h2><p>Manage the basics of your QuestKarte experience.</p></section><div className="settings-grid"><section className="panel"><h3>Profile and account</h3><div className="settings-control"><div><strong>Public member profile</strong><small>Your photo, introduction, skills, and service area.</small></div><button type="button" className="btn" onClick={onAccount}>View profile</button></div><div className="settings-control"><div><strong>Sign-in email</strong><small>{email}</small></div></div></section><section className="panel"><h3>Preferences</h3><div className="settings-control"><div><strong>Task notifications</strong><small>Keep your notification preference on this browser. Actual task alerts will begin once real tasks and applications are connected.</small></div><button type="button" role="switch" aria-checked={notifications} className={`switch ${notifications ? "on" : ""}`} onClick={toggleNotifications} aria-label="Toggle task notifications" /></div><div className="settings-control"><div><strong>Map location</strong><small>{locationCopy}</small></div><button type="button" role="switch" aria-checked={location} className={`switch ${location ? "on" : ""}`} onClick={toggleLocation} aria-label="Toggle map location" /></div></section><section className="panel settings-danger"><h3>Session</h3><p>{isDemo ? "Leave the demo and return to sign in." : "Sign out from this browser. Your account and profile stay safe in Supabase."}</p><button type="button" className="btn" onClick={onExit}>{isDemo ? "Exit demo" : "Sign out"}</button></section></div></div>; }
function LegacyFreshAccount({ profile, email, session, onExit }: { profile: MemberProfile | null; email: string; session: Session; onExit: () => void }) {
  const name = profile?.full_name || "Member";
  const verified = profile?.verification_status === "verified";
  return <div className="fresh-account view"><section className="panel fresh-profile-hero"><div className="fresh-profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name[0]?.toUpperCase()}</div><div><span className="eyebrow">Member profile</span><h2>{name}</h2><p>{profile?.bio || "Add a short introduction so other members understand what you can offer."}</p><div className="profile-pills">{(profile?.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div></div></section><div className="fresh-grid"><section className="panel"><h3>Trust and service record</h3><div className="fresh-stats"><div><strong>{profile?.trust_factor || 0}<small>/100</small></strong><span>Trust Factor</span></div><div><strong>{profile?.average_rating?.toFixed(1) || "0.0"}<small> ★</small></strong><span>{profile?.rating_count || 0} ratings</span></div><div><strong>{profile?.completed_tasks_count || 0}</strong><span>Finished jobs</span></div></div><p className="form-intro">{(profile?.trust_factor || 0) < 50 ? "Your Trust Factor is below 50. Improve it through reliable service and positive reviews before applying again." : "Your Trust Factor is in good standing for marketplace participation."}</p></section><section className="panel"><h3>Account details</h3><div className="account-details"><span>Email <b>{email}</b></span><span>Area <b>{profile?.city || "Not added"}</b></span><span>Verification <b>{verified ? "Verified member" : profile?.verification_status === "pending" ? "Under review" : "Verification required"}</b></span></div><button className="btn signout-button" onClick={onExit}>Sign out</button></section></div>{!verified && <VerificationRequestPanel session={session} status={profile?.verification_status || "unverified"} />}</div>;
}

function FreshAccount({ profile, email, session, onExit }: { profile: MemberProfile | null; email: string; session: Session; onExit: () => void }) {
  const [member, setMember] = useState<MemberProfile | null>(profile);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [city, setCity] = useState(profile?.city || "Cebu City");
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url || null);
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const standardSkills = ["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Pet care", "Tech help", "Writing"];
  useEffect(() => { setMember(profile); setName(profile?.full_name || ""); setBio(profile?.bio || ""); setCity(profile?.city || "Cebu City"); setSkills(profile?.skills || []); setAvatar(profile?.avatar_url || null); }, [profile]);
  const choosePhoto = (file?: File) => { if (!file) return; if (file.size > 900000) return setNotice("Please use a photo smaller than 900 KB for now."); const reader = new FileReader(); reader.onload = () => setAvatar(String(reader.result)); reader.readAsDataURL(file); };
  const addSkill = () => { const value = customSkill.trim().replace(/\s+/g, " "); if (!value || skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) return setCustomSkill(""); setSkills((current) => [...current, value].slice(0, 12)); setCustomSkill(""); };
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setNotice(""); const { data, error } = await supabase.from("profiles").update({ full_name: name.trim(), bio: bio.trim(), city: city.trim(), skills, avatar_url: avatar }).eq("id", session.user.id).select("id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count").single(); setSaving(false); if (error || !data) return setNotice(error?.message || "Your changes could not be saved."); setMember(data as MemberProfile); setEditing(false); setNotice("Profile updated."); };
  const visible = member || profile;
  const verified = visible?.verification_status === "verified";
  const displayName = visible?.full_name || "Member";
  return <div className="fresh-account view"><section className="panel fresh-profile-hero"><div className="fresh-profile-avatar">{visible?.avatar_url ? <img src={visible.avatar_url} alt="" /> : displayName[0]?.toUpperCase()}</div><div><span className="eyebrow">Member profile</span><h2>{displayName}</h2><p>{visible?.bio || "Add a short introduction so other members understand what you can offer."}</p><div className="profile-pills">{(visible?.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div></div><button className="btn" type="button" onClick={() => { setNotice(""); setEditing(true); }}>Edit profile</button></section>{editing && <section className="panel profile-editor"><div className="profile-editor-head"><div><span className="eyebrow">Edit your public member profile</span><h3>Keep your profile current</h3></div><button type="button" className="link-button" onClick={() => setEditing(false)}>Cancel</button></div><form className="profile-setup-form" onSubmit={save}><div className="avatar-picker"><div className="avatar-upload">{avatar ? <img src={avatar} alt="Profile preview" /> : <span>{name[0]?.toUpperCase() || "?"}</span>}</div><div><strong>Profile photo</strong><p>Take a current photo or select one from your device.</p><div className="profile-photo-actions"><label className="upload-photo-link">Use camera<input type="file" accept="image/png,image/jpeg,image/webp" capture="user" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><label className="upload-photo-link">Choose file<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label></div></div></div><label><span>Display name</span><input value={name} required minLength={2} onChange={(event) => setName(event.target.value)} /></label><label><span>About you</span><textarea value={bio} required minLength={10} maxLength={500} onChange={(event) => setBio(event.target.value)} /></label><label><span>City / service area</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label><div><span className="setup-label">Services and strengths</span><div className="skill-choices">{standardSkills.map((skill) => <button type="button" key={skill} className={skills.includes(skill) ? "selected" : ""} onClick={() => setSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])}>{skill}</button>)}</div><div className="custom-skill"><input value={customSkill} maxLength={40} onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }} placeholder="Add another strength" /><button type="button" onClick={addSkill}>Add</button></div></div>{notice && <p className="setup-notice">{notice}</p>}<button className="setup-submit" disabled={saving}>{saving ? "Saving changes…" : "Save profile changes"}</button></form></section>}<div className="fresh-grid"><section className="panel"><h3>Trust and service record</h3><div className="fresh-stats"><div><strong>{visible?.trust_factor || 0}<small>/100</small></strong><span>Trust Factor</span></div><div><strong>{visible?.average_rating?.toFixed(1) || "0.0"}<small> ★</small></strong><span>{visible?.rating_count || 0} ratings</span></div><div><strong>{visible?.completed_tasks_count || 0}</strong><span>Finished jobs</span></div></div></section><section className="panel"><h3>Account details</h3><div className="account-details"><span>Email <b>{email}</b></span><span>Area <b>{visible?.city || "Not added"}</b></span><span>Verification <b>{verified ? "Verified member" : visible?.verification_status === "pending" ? "Under review" : "Verification required"}</b></span></div><button className="btn signout-button" onClick={onExit}>Sign out</button></section></div>{!verified && <VerificationRequestPanel session={session} status={visible?.verification_status || "unverified"} />}</div>;
}

function Home({ tab, setTab, quests: taskList, saved, applied, onSave, onApply, onPost }: { tab: string; setTab: (tab: string) => void; quests: Quest[]; saved: Array<number | string>; applied: Array<number | string>; onSave: (id: number | string) => void; onApply: (id: number | string) => void; onPost: () => void }) {
  return <div className="home-grid view"><div className="home-feed">
    <div className="quest-hero"><div className="ring"><span>65%</span></div><div><strong>One quest in progress</strong><p>Car wash — Lahug residence · Due today, 5:00 PM</p></div><button className="hero-arrow">→</button></div><section className="quick-actions"><div><span className="eyebrow">Your workspace</span><h2>What would you like to do?</h2></div><div className="quick-action-buttons"><button onClick={onPost}><b>＋</b><span>Post a task</span></button><button onClick={() => setTab("Nearby")}><b>⌖</b><span>Explore nearby</span></button><button onClick={() => setTab("Recommended")}><b>✦</b><span>Best matches</span></button></div></section>
    <div className="segmented">{["Recommended", "Nearby", "Newest"].map((name) => <button key={name} className={`seg ${tab === name ? "active" : ""}`} onClick={() => setTab(name)}>{name}</button>)}</div>
    <div className="section-head"><h2>{tab === "Recommended" ? "For you today" : `${tab} quests`}</h2><button className="link-button">Sort: Best match ↓</button></div>
    {taskList.length ? taskList.map((quest) => <TaskCard key={quest.id} quest={{ ...quest, image: questImages[quest.id] }} saved={saved.includes(quest.id)} applied={applied.includes(quest.id)} onSave={() => onSave(quest.id)} onApply={() => onApply(quest.id)} />) : <Empty />}
  </div><aside className="home-side"><DiscoverySide /></aside></div>;
}

function MapPanTo({ position }: { position: [number, number] | null }) { const map = useMap(); useEffect(() => { if (position) map.flyTo(position, 14); }, [map, position]); return null; }

function DiscoverySide() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState("Lahug, Cebu City");
  const locate = () => {
    if (!navigator.geolocation) { setLocationStatus("Location is not supported by this browser"); return; }
    setLocationStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition([coords.latitude, coords.longitude]); setLocationStatus("Showing opportunities near you"); }, () => setLocationStatus("Location permission was not granted"), { enableHighAccuracy: false, timeout: 9000 });
  };
  const pins: { position: [number, number]; title: string; reward: string }[] = [
    { position: [10.3298, 123.9067], title: "Deep clean apartment", reward: "Service swap" },
    { position: [10.3251, 123.9042], title: "Statistics tutor", reward: "₱450 / session" },
    { position: [10.3358, 123.9031], title: "Grocery run + delivery", reward: "₱300" },
  ];
  return <><section className="panel map-panel"><div className="panel-title-row"><div><h3>Nearby opportunities</h3><p>{locationStatus}</p></div><button className="map-locate" onClick={locate}>⌖ Locate me</button></div><div className="quest-map"><MapContainer center={[10.3298, 123.9067]} zoom={13} scrollWheelZoom={false}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapPanTo position={position} />{position && <><Circle center={position} radius={5000} pathOptions={{ color: "#47A2F5", fillColor: "#47A2F5", fillOpacity: 0.08 }} /><CircleMarker center={position} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#213BA3", fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker></>}{pins.map((pin) => <CircleMarker key={pin.title} center={pin.position} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#D6AE29", fillOpacity: 1 }}><Popup><strong>{pin.title}</strong><br />{pin.reward}<br /><button type="button">View quest</button></Popup></CircleMarker>)}</MapContainer></div><p className="map-caption">Demo pins within 5 km · task locations will come from Supabase.</p></section><section className="panel member-snapshot"><div className="snapshot-heading"><div><h3>Member trust snapshot</h3><p>Your activity and standing in QuestKarte</p></div><span className="snapshot-level">Level 12</span></div><div className="profile-mini"><span className="avatar">S</span><div><div className="profile-name">Susan Lim</div><div className="profile-role">Verified Student · Silver standing</div></div></div><div className="snapshot-stats"><div className="snapshot-stat"><span>Trust Factor</span><strong>62</strong><small>Silver</small></div><div className="snapshot-stat"><span>Completed</span><strong>14</strong><small>tasks</small></div><div className="snapshot-stat"><span>Applications</span><strong>3</strong><small>active</small></div></div></section></>;
}

function Tasks({ onGoPost, applied }: { onGoPost: () => void; applied: Array<number | string> }) { return <div className="view tasks-wrap"><div className="section-head"><h2>Your quest log</h2><button className="btn primary" onClick={onGoPost}>+ Post a task</button></div><div className="task-mgmt-card"><div className="tm-top"><div><div className="tm-title">Grocery run + delivery, Ayala Center</div><div className="tm-sub">Accepted by Cara D. · Due today, 6:00 PM</div></div><span className="badge accepted">Ongoing</span></div><Progress percent={65} /><div className="tm-actions"><span className="tm-applicants">65% complete</span><button className="btn">View task</button></div></div><div className="task-mgmt-card"><div className="tm-top"><div><div className="tm-title">Applications sent</div><div className="tm-sub">{applied.length ? `${applied.length} application${applied.length > 1 ? "s" : ""} awaiting a response` : "Explore the feed and apply to a quest."}</div></div><span className="badge pending">Pending</span></div><Progress percent={32} /></div></div>; }

function VerificationRequestPanel({ session, status }: { session: Session; status: "unverified" | "pending" | "verified" | "rejected" }) {
  const [type, setType] = useState<"student" | "professional">("student");
  const [institution, setInstitution] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [course, setCourse] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!document) { setNotice("Attach a clear student ID, professional ID, or supporting document."); return; }
    if (!institution.trim()) { setNotice(type === "student" ? "Enter your school or institution." : "Enter your company or professional institution."); return; }
    if (document.size > 10 * 1024 * 1024) { setNotice("Use a document smaller than 10 MB."); return; }
    setSaving(true); setNotice("");
    const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.user.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from("verification-documents").upload(path, document, { contentType: document.type, upsert: false });
    if (upload.error) { setSaving(false); setNotice(upload.error.message); return; }
    const { error } = await supabase.from("verification_requests").insert({ user_id: session.user.id, type, status: "pending", school_name: type === "student" ? institution.trim() : null, school_email: type === "student" ? schoolEmail.trim() || null : null, course: type === "student" ? course.trim() || null : null, institution_or_company: type === "professional" ? institution.trim() : null, document_path: path, document_name: document.name });
    setSaving(false);
    if (error) { await supabase.storage.from("verification-documents").remove([path]); setNotice(error.message); return; }
    setSubmitted(true); setNotice("Verification request submitted. A moderator will review your document privately.");
  };
  if (status === "pending" || submitted) return <section className="panel verification-panel"><span className="eyebrow">Verification</span><h3>Your evidence is under review</h3><p>QuestKarte staff will review your private document. You will be notified of the decision.</p></section>;
  return <section className="panel verification-panel"><span className="eyebrow">Verification</span><h3>{status === "rejected" ? "Update and resubmit your verification" : "Verify your member account"}</h3><p>Verified members may publish tasks. A Trust Factor of 50 or more is also required before applying to tasks.</p><form className="profile-setup-form" onSubmit={submit}><div className="segmented"><button type="button" className={type === "student" ? "seg active" : "seg"} onClick={() => setType("student")}>Student</button><button type="button" className={type === "professional" ? "seg active" : "seg"} onClick={() => setType("professional")}>Professional</button></div><label><span>{type === "student" ? "School / institution" : "Company / professional institution"}</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} required /></label>{type === "student" && <><label><span>Institutional email (optional)</span><input value={schoolEmail} type="email" onChange={(event) => setSchoolEmail(event.target.value)} /></label><label><span>Course or program (optional)</span><input value={course} onChange={(event) => setCourse(event.target.value)} /></label></>}<label className="upload-box"><strong>Attach verification document</strong><small>Student ID, school record, professional ID, or supporting proof. PDF, JPG, PNG, or WEBP; maximum 10 MB.</small><input type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setDocument(event.target.files?.[0] || null)} />{document && <b>{document.name}</b>}</label>{notice && <p className="setup-notice">{notice}</p>}<button className="btn primary" disabled={saving}>{saving ? "Submitting..." : "Submit for verification"}</button></form></section>;
}

function PostTask({ session, profile, onPosted }: { session: Session | null; profile: MemberProfile | null; onPosted: () => void }) {
  const [category, setCategory] = useState("Cleaning"); const [swap, setSwap] = useState(false); const [studentOnly, setStudentOnly] = useState(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [commission, setCommission] = useState(""); const [location, setLocation] = useState(""); const [photos, setPhotos] = useState<string[]>([]); const [photoError, setPhotoError] = useState("");
  const [savingTask, setSavingTask] = useState(false); const [submitError, setSubmitError] = useState("");
  const getTaskCoordinates = () => new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => { if (!navigator.geolocation) { resolve({ latitude: null, longitude: null }); return; } navigator.geolocation.getCurrentPosition(({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }), () => resolve({ latitude: null, longitude: null }), { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }); });
  const publishTask = async (event: FormEvent) => { event.preventDefault(); if (!session) { setSubmitError("Sign in before submitting a task."); return; } const amount = Number(commission.replace(/[^0-9.]/g, "")); if (!swap && (!Number.isFinite(amount) || amount <= 0)) { setSubmitError("Enter a valid commission amount."); return; } setSavingTask(true); setSubmitError(""); const coordinates = await getTaskCoordinates(); const { data: categoryRow } = await supabase.from("categories").select("id").ilike("name", category).limit(1).maybeSingle(); const { error } = await supabase.from("tasks").insert({ posted_by: session.user.id, category_id: categoryRow?.id || null, title: title.trim(), description: description.trim(), commission_amount: swap ? null : amount, currency: "PHP", is_service_swap: swap, swap_details: swap ? "Service swap offered" : null, requires_student_verification: studentOnly, location_label: location.trim(), latitude: coordinates.latitude, longitude: coordinates.longitude, status: "draft", moderation_state: "pending_review" }); setSavingTask(false); if (error) { setSubmitError(error.message); return; } onPosted(); };
  return <div className="post-grid view"><form className="forge-card post-form-col" onSubmit={publishTask}><div className="forge-ribbon"><span>✦ Publish to the marketplace</span></div><h2>Post a task people can discover.</h2><p className="form-intro">This task will be saved in Supabase and become visible to other QuestKarte members.</p><label className="field-group"><span className="field-label">Task title</span><input required minLength={6} maxLength={140} className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Deep clean a 2-bedroom apartment" /></label><label className="field-group"><span className="field-label">Describe the task</span><textarea required minLength={20} maxLength={5000} className="field-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what needs to be done, preferred time, and anything the provider should bring." /></label><div className="field-group"><span className="field-label">Category</span><div className="cat-picker">{["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Other"].map((name) => <button type="button" key={name} className={`cat-pick-item ${category === name ? "active" : ""}`} onClick={() => setCategory(name)}><span>{categoryIcon(name)}</span>{name}</button>)}</div></div><div className="form-two"><label className="field-group"><span className="field-label">Commission</span><input required={!swap} disabled={swap} className="field-input" value={swap ? "Service swap" : commission} onChange={(event) => setCommission(event.target.value)} placeholder="₱ Amount" /></label><label className="field-group"><span className="field-label">General area</span><input required className="field-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Lahug, Cebu City" /></label></div><Toggle title="Offer a service swap" detail="Offer a skill or service instead of cash." checked={swap} onChange={() => setSwap(!swap)} /><Toggle title="Verified students only" detail="Limit applications to student-verified members." checked={studentOnly} onChange={() => setStudentOnly(!studentOnly)} /><section className="photo-upload-section"><strong>Photos are ready for the next connection.</strong><small>Task details publish now. Permanent shared photo uploads need Supabase Storage, which we will connect next.</small></section>{submitError && <p className="setup-notice">{submitError}</p>}<button className="post-submit" type="submit" disabled={savingTask}>{savingTask ? "Publishing…" : "Publish task →"}</button></form><aside className="post-preview-col"><div className="post-preview-label">Shared-task preview</div><TaskCard quest={{ id: "preview", category, title: title || "Your task title", description: description || "Your task details will appear here while you write.", commission: swap ? "Service swap" : commission || "Commission", location: location || "Your general area", schedule: "Will be published now", posterName: profile?.full_name || "You", initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(), kind: swap ? "swap" : studentOnly ? "student" : undefined }} /></aside></div>;
  const readPhotos = (files: FileList | null) => { if (!files?.length) return; const accepted = Array.from(files).filter((file) => file.type.startsWith("image/") && file.size <= 4 * 1024 * 1024).slice(0, Math.max(0, 6 - photos.length)); if (accepted.length !== files.length) setPhotoError("Use image files up to 4 MB each. A task can contain up to 6 photos."); else setPhotoError(""); Promise.all(accepted.map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then((images) => setPhotos((current) => [...current, ...images].slice(0, 6))); };
  return <div className="post-grid view"><form className="forge-card post-form-col" onSubmit={(event) => { event.preventDefault(); onPosted(); }}><div className="forge-ribbon"><span>✦ Forge a new quest</span></div><h2>Post a task people want to accept.</h2><p className="form-intro">Clear details and photos help members understand the task before they apply.</p><label className="field-group"><span className="field-label">Task title</span><input required className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Deep clean a 2-bedroom apartment" /></label><label className="field-group"><span className="field-label">Describe the quest</span><textarea required className="field-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What needs to be done? Add useful details, preferred time, and anything to bring." /></label><div className="field-group"><span className="field-label">Category</span><div className="cat-picker">{["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Other"].map((name) => <button type="button" key={name} className={`cat-pick-item ${category === name ? "active" : ""}`} onClick={() => setCategory(name)}><span>{categoryIcon(name)}</span>{name}</button>)}</div></div><div className="form-two"><label className="field-group"><span className="field-label">Commission</span><input required className="field-input" value={commission} onChange={(event) => setCommission(event.target.value)} placeholder="₱ Amount" /></label><label className="field-group"><span className="field-label">Location</span><input required className="field-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Lahug, Cebu City" /></label></div><Toggle title="Offer a service swap" detail="Trade a skill or service instead of cash." checked={swap} onChange={() => setSwap(!swap)} /><Toggle title="Verified students only" detail="Limit applications to student accounts." checked={studentOnly} onChange={() => setStudentOnly(!studentOnly)} /><section className="photo-upload-section"><div className="photo-upload-heading"><div><strong>Reference photos</strong><small>Optional · up to 6 images · JPG, PNG, or WEBP · 4 MB each</small></div><label className="photo-add-button">+ Add photos<input type="file" accept="image/*" multiple onChange={(event) => { readPhotos(event.target.files); event.currentTarget.value = ""; }} /></label></div>{photos.length ? <div className={`photo-selection-grid count-${Math.min(photos.length, 4)}`}>{photos.slice(0, 4).map((photo, index) => <div className="photo-selection" key={`${photo}-${index}`}><img src={photo} alt={`Selected reference ${index + 1}`} /><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove photo ${index + 1}`}>×</button>{index === 3 && photos.length > 4 && <span>+{photos.length - 4}</span>}</div>)}</div> : <label className="upload-box photo-dropzone">⇧<strong>Add reference photos</strong><small>Show the space, item, condition, or documents needed for the task.</small><input type="file" accept="image/*" multiple onChange={(event) => { readPhotos(event.target.files); event.currentTarget.value = ""; }} /></label>}{photoError && <p className="photo-upload-error">{photoError}</p>}</section><button className="post-submit" type="submit">Post this task →</button></form><aside className="post-preview-col"><div className="post-preview-label">Live preview</div><TaskCard quest={{ ...quests[0], title: title || "Your task title", category, description: description || "Your task details will appear here while you write.", commission: swap ? "Service swap" : commission || "Commission", location: location || "Your service area", kind: swap ? "swap" : undefined, initials: "YK", images: photos, matchPercent: undefined }} /></aside></div>;
}

function Chat({ open, setOpen, messages, draft, setDraft, onSend }: { open: boolean; setOpen: (value: boolean) => void; messages: string[]; draft: string; setDraft: (value: string) => void; onSend: (event: FormEvent) => void }) { return <div className="chat-layout view"><div className="convo-list"><Conversation name="Cara D." quest="Grocery run + delivery" snippet="Great, can you be at Ayala by 4 PM?" active onClick={() => setOpen(true)} /><Conversation name="Mika J." quest="Statistics tutor" snippet="Thanks for your application!" onClick={() => setOpen(true)} /><Conversation name="Robert B." quest="Deep clean apartment" snippet="I can share photos of the space." onClick={() => setOpen(true)} /></div><section className={`thread-panel ${open ? "open" : ""}`}><div className="thread-head"><button className="thread-back" onClick={() => setOpen(false)}>←</button><span className="avatar">CD</span><div><div className="thread-name">Cara D.</div><div className="thread-quest">Grocery run + delivery</div></div></div><div className="thread-body">{messages.map((message, index) => <div key={`${message}-${index}`} className={`msg ${index % 2 ? "in" : "out"}`}>{message}</div>)}<div className="ward-card"><div className="ward-ft">⚠ QuestKarte safety shield</div><div className="ward-blur">Send payment through my personal account instead.</div><p className="ward-note">Potentially unsafe payment request hidden.</p></div></div><form className="thread-input" onSubmit={onSend}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" /><button className="thread-send" aria-label="Send message">↑</button></form></section></div>; }

function Account({ displayName, isDemo, onEdit, onExit }: { displayName: string; isDemo: boolean; onEdit: () => void; onExit: () => void }) { return <div className="acct-grid view"><div className="acct-main"><section className="panel sheet-hero"><div className="sheet-avatar-wrap"><div className="lvl-ring sheet-ring"><span className="avatar">{displayName[0]?.toUpperCase() || "A"}</span><span className="sheet-lvl">Level 1</span></div></div><h2>{displayName}</h2><p className="role">QuestKarte member · Your profile is ready to customize</p><span className="tier-chip">✦ Bronze Explorer</span></section><section className="panel"><h3>Quest progression</h3><div className="stat-bars"><Stat label="Trust Factor" value="0 / 100" percent={0} /><Stat label="Level progress" value="0 / 1,000 XP" percent={0} gold /></div></section><section className="panel"><h3>Recent badges</h3><div className="medal-grid"><Medal icon="✦" label="First quest" tone="bronze" /><Medal icon="⌁" label="Trusted helper" tone="silver" /><Medal icon="★" label="Quick responder" tone="gold" /></div></section></div><aside className="acct-side"><section className="panel"><h3>Account</h3><div className="settings-list"><Setting icon="◉" name="Edit profile" onClick={onEdit} /><Setting icon="♢" name="Verification status" onClick={onEdit} /><Setting icon="♧" name="Notifications" onClick={onEdit} /><Setting icon="⚙" name="Settings" onClick={onEdit} /><Setting icon="↩" name={isDemo ? "Exit demo" : "Sign out"} onClick={onExit} /></div></section><section className="scroll-card"><div className="scroll-seal">⌘</div><div><div className="scroll-ct">Service certificates</div><div className="scroll-cd">Your verified records will appear here.</div></div></section></aside></div>; }

type ReviewTask = { id: string; title: string; description: string; location_label: string; created_at: string; posted_by: string };

function StaffDashboard({ role, session, onExit, activeTab, onTabChange }: { role: StaffRole; session: Session | null; onExit: () => void; activeTab: StaffTab; onTabChange: (tab: StaffTab) => void }) {
  void StaffDashboardLegacy;
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [notice, setNotice] = useState("");
  const isAdmin = role === "admin";
  return <StaffWorkspace role={role} session={session} onExit={onExit} activeTab={activeTab} onTabChange={onTabChange} />;

  const loadQueue = async () => {
    if (!session) { setLoadingQueue(false); return; }
    setLoadingQueue(true);
    const { data, error } = await supabase.from("tasks").select("id,title,description,location_label,created_at,posted_by").eq("status", "draft").eq("moderation_state", "pending_review").order("created_at", { ascending: true });
    setTasks((data || []) as ReviewTask[]);
    setNotice(error ? error.message : "");
    setLoadingQueue(false);
  };

  useEffect(() => { void loadQueue(); }, [session?.user.id]);

  const decide = async (task: ReviewTask, decision: "approved" | "rejected") => {
    if (!session) { setNotice("This is a staff UI preview. Sign in with a staff account to make decisions."); return; }
    const note = decision === "rejected" ? window.prompt("Explain why this task cannot be published. This note is visible only to the task poster.")?.trim() : "";
    if (decision === "rejected" && !note) return;
    const update = decision === "approved"
      ? { status: "open", moderation_state: "approved", moderation_note: null, moderated_by: session.user.id, moderated_at: new Date().toISOString(), published_at: new Date().toISOString() }
      : { status: "draft", moderation_state: "rejected", moderation_note: note, moderated_by: session.user.id, moderated_at: new Date().toISOString() };
    const { error } = await supabase.from("tasks").update(update).eq("id", task.id);
    if (error) { setNotice(error.message); return; }
    await supabase.from("task_status_history").insert({ task_id: task.id, previous_status: "draft", new_status: decision === "approved" ? "open" : "draft", changed_by: session.user.id, note: decision === "approved" ? "Approved for the marketplace" : note });
    setNotice(decision === "approved" ? "Task approved. It is now visible in the Marketplace." : "Task rejected. The poster can see your reason privately.");
    await loadQueue();
  };

  return <div className="staff-view view"><section className="staff-banner"><div><span className="eyebrow">Live staff workspace</span><h2>{isAdmin ? "Admin command center" : "Moderator console"}</h2><p>{isAdmin ? "Oversee the review queue, staff access, and platform operations." : "Review submitted tasks before they become visible in the QuestKarte Marketplace."}</p></div><button className="btn" onClick={onExit}>{session ? "Sign out" : "Exit preview"}</button></section><div className="staff-metrics"><div className="staff-metric"><span>Pending task reviews</span><strong>{tasks.length}</strong><small>Needs a decision</small></div><div className="staff-metric"><span>Publishing rule</span><strong>Safe</strong><small>Only approved tasks go public</small></div><div className="staff-metric"><span>Role</span><strong>{isAdmin ? "Admin" : "Moderator"}</strong><small>{isAdmin ? "Platform owner" : "Content reviewer"}</small></div><div className="staff-metric"><span>Audit history</span><strong>On</strong><small>Decisions are recorded</small></div></div><div className="staff-grid"><section className="panel staff-queue"><div className="panel-title-row"><div><h3>Pending task review queue</h3><p>Review the details, then approve or reject with a clear reason.</p></div><button className="btn" onClick={() => void loadQueue()}>Refresh</button></div>{loadingQueue ? <p className="feed-message">Loading pending tasks...</p> : tasks.length ? tasks.map((task) => <article className="staff-row" key={task.id}><div><strong>{task.title}</strong><span>{task.location_label} · Submitted {new Date(task.created_at).toLocaleDateString()}</span><p>{task.description}</p></div><div className="staff-row-actions"><button className="btn primary" onClick={() => void decide(task, "approved")}>Approve</button><button className="btn" onClick={() => void decide(task, "rejected")}>Reject</button></div></article>) : <p className="feed-message">No tasks are waiting for review.</p>}{notice && <p className="setup-notice">{notice}</p>}</section><aside className="panel staff-policy"><h3>{isAdmin ? "Admin controls" : "Moderator tools"}</h3>{isAdmin ? <><button type="button">Moderator management · next secure step</button><button type="button">Platform policies · coming next</button><button type="button">Audit log · coming next</button><p>Only the one Admin will be allowed to invite or remove Moderators through a secure server action.</p></> : <><button type="button">Task approval and rejection</button><button type="button">Verification review · next</button><button type="button">Reports and disputes · next</button><p>Moderators cannot create staff accounts or change platform-wide settings.</p></>}</aside></div></div>;
}

type StaffTab = "overview" | "members" | "moderators" | "categories" | "audit" | "task_review" | "verification" | "reports" | "disputes";
type StaffTaskRecord = { id: string; title: string; description: string; location_label: string; created_at: string; posted_by: string };
type VerificationRecord = { id: string; type: string; status: string; school_name: string | null; institution_or_company: string | null; document_name: string; document_path: string; created_at: string };
type VerificationEvidencePreview = { label: string; fileName: string; mimeType: string | null; url: string };
type ReportRecord = { id: string; reason: string; status: string; created_at: string };
type DisputeRecord = { id: string; reason: string; status: string; created_at: string };
type StaffMember = { id: string; full_name: string; city: string | null; trust_factor: number; completed_tasks_count: number };
type StaffCategory = { id: string; name: string; slug: string; icon: string; is_active: boolean };

function StaffWorkspace({ role, session, onExit, activeTab, onTabChange }: { role: StaffRole; session: Session | null; onExit: () => void; activeTab: StaffTab; onTabChange: (tab: StaffTab) => void }) {
  const isAdmin = role === "admin";
  const tabs: { id: StaffTab; label: string }[] = isAdmin
    ? [{ id: "overview", label: "Overview" }, { id: "task_review", label: "Task review" }, { id: "members", label: "Members" }, { id: "moderators", label: "Moderators" }, { id: "categories", label: "Categories" }, { id: "audit", label: "Audit log" }]
    : [{ id: "task_review", label: "Task review" }, { id: "verification", label: "Verification" }, { id: "reports", label: "Reports" }, { id: "disputes", label: "Disputes" }];
  const [tab, setTab] = useState<StaffTab>(activeTab);
  const [tasks, setTasks] = useState<StaffTaskRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [categories, setCategories] = useState<StaffCategory[]>([]);
  const [audit, setAudit] = useState<{ id: string; action: string; entity_type: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [evidencePreview, setEvidencePreview] = useState<{ title: string; items: VerificationEvidencePreview[] } | null>(null);

  useEffect(() => { setTab(activeTab); }, [activeTab]);
  const selectTab = (nextTab: StaffTab) => { setTab(nextTab); onTabChange(nextTab); };

  const load = async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    const [taskResult, verificationResult, reportResult, disputeResult, memberResult, roleResult, categoryResult, auditResult] = await Promise.all([
      supabase.from("tasks").select("id,title,description,location_label,created_at,posted_by").eq("status", "draft").eq("moderation_state", "pending_review").order("created_at", { ascending: true }),
      supabase.from("verification_requests").select("id,type,status,school_name,institution_or_company,document_name,document_path,created_at").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("reports").select("id,reason,status,created_at").in("status", ["open", "under_review"]).order("created_at", { ascending: true }),
      supabase.from("disputes").select("id,reason,status,created_at").in("status", ["open", "under_review"]).order("created_at", { ascending: true }),
      supabase.from("profiles").select("id,full_name,city,trust_factor,completed_tasks_count").order("full_name"),
      supabase.from("user_roles").select("user_id,role").in("role", ["admin", "moderator"]),
      supabase.from("categories").select("id,name,slug,icon,is_active").order("name"),
      supabase.from("admin_audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    setTasks((taskResult.data || []) as StaffTaskRecord[]);
    setVerifications((verificationResult.data || []) as VerificationRecord[]);
    setReports((reportResult.data || []) as ReportRecord[]);
    setDisputes((disputeResult.data || []) as DisputeRecord[]);
    setMembers((memberResult.data || []) as StaffMember[]);
    setRoles((roleResult.data || []) as { user_id: string; role: string }[]);
    setCategories((categoryResult.data || []) as StaffCategory[]);
    setAudit((auditResult.data || []) as { id: string; action: string; entity_type: string; created_at: string }[]);
    const firstError = [taskResult.error, verificationResult.error, reportResult.error, disputeResult.error, memberResult.error, roleResult.error, categoryResult.error, auditResult.error].find(Boolean);
    setNotice(firstError ? firstError.message : "");
    setLoading(false);
  };

  useEffect(() => { void load(); }, [session?.user.id]);

  const approveTask = async (task: StaffTaskRecord, approved: boolean) => {
    if (!session) { setNotice("Sign in with a real staff account to make decisions."); return; }
    const reason = approved ? "" : window.prompt("Explain the rejection. The task poster will see this privately.")?.trim();
    if (!approved && !reason) return;
    const result = await supabase.from("tasks").update(approved
      ? { status: "open", moderation_state: "approved", moderation_note: null, moderated_by: session.user.id, moderated_at: new Date().toISOString(), published_at: new Date().toISOString() }
      : { status: "draft", moderation_state: "rejected", moderation_note: reason, moderated_by: session.user.id, moderated_at: new Date().toISOString() }
    ).eq("id", task.id);
    if (result.error) { setNotice(result.error.message); return; }
    await supabase.from("task_status_history").insert({ task_id: task.id, previous_status: "draft", new_status: approved ? "open" : "draft", changed_by: session.user.id, note: approved ? "Approved for Marketplace" : reason });
    setNotice(approved ? "Task approved and now visible to all members." : "Task rejected with a private reason for the poster.");
    await load();
  };

  const decideVerification = async (record: VerificationRecord, approved: boolean) => {
    if (!session) return;
    const reason = approved ? null : window.prompt("Explain the verification rejection.")?.trim();
    if (!approved && !reason) return;
    const { error } = await supabase.from("verification_requests").update({ status: approved ? "approved" : "rejected", reviewed_by: session.user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason }).eq("id", record.id);
    setNotice(error ? error.message : approved ? "Verification approved." : "Verification rejected with a reason.");
    if (!error) await load();
  };

  const openVerificationEvidence = async (record: VerificationRecord) => {
    const { data, error } = await supabase.from("verification_evidence").select("evidence_kind,storage_path,file_name,mime_type").eq("request_id", record.id);
    const documents = error ? [{ evidence_kind: "primary_document", storage_path: record.document_path, file_name: record.document_name, mime_type: null }] : data || [];
    const results = await Promise.all(documents.map(async (document) => ({ document, signed: await supabase.storage.from("verification-documents").createSignedUrl(document.storage_path, 300) })));
    const items = results.flatMap(({ document, signed }) => signed.data?.signedUrl ? [{ label: document.evidence_kind.replaceAll("_", " "), fileName: document.file_name, mimeType: document.mime_type, url: signed.data.signedUrl }] : []);
    if (!items.length) { setNotice(error?.message || "Private documents could not be opened. Run the latest verification database query first."); return; }
    setEvidencePreview({ title: record.type === "student" ? "Student verification evidence" : "Professional verification evidence", items });
  };

  const resolveCase = async (table: "reports" | "disputes", id: string, outcome: "resolved" | "dismissed") => {
    if (!session) return;
    const note = window.prompt(outcome === "resolved" ? "Resolution note for staff history:" : "Reason for dismissing this case:")?.trim();
    if (!note) return;
    const { error } = await supabase.from(table).update({ status: outcome, handled_by: session.user.id, resolution_note: note, resolved_at: new Date().toISOString() }).eq("id", id);
    setNotice(error ? error.message : `Case marked ${outcome}.`);
    if (!error) await load();
  };

  const promote = async (member: StaffMember) => {
    const ok = window.confirm(`Make ${member.full_name} a QuestKarte Moderator? They will gain review permissions.`);
    if (!ok) return;
    const { error } = await supabase.rpc("promote_to_moderator", { target_user_id: member.id });
    setNotice(error ? `${error.message} Run the latest staff migration first.` : `${member.full_name} is now a Moderator.`);
    if (!error) await load();
  };

  const addCategory = async () => {
    const name = window.prompt("New category name:")?.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("categories").insert({ name, slug, icon: "circle" });
    setNotice(error ? error.message : `${name} category added.`);
    if (!error) await load();
  };

  const moderatorIds = new Set(roles.filter((item) => item.role === "moderator").map((item) => item.user_id));
  const visibleMembers = members.filter((member) => !roles.some((item) => item.user_id === member.id && item.role === "admin"));
  const title = isAdmin ? "Admin command center" : "Moderator console";

  const content = () => {
    if (tab === "overview") return <div className="staff-overview"><section className="staff-metrics"><div className="staff-metric"><span>Members</span><strong>{members.length}</strong><small>Registered accounts</small></div><div className="staff-metric"><span>Pending tasks</span><strong>{tasks.length}</strong><small>Awaiting safety review</small></div><div className="staff-metric"><span>Open reports</span><strong>{reports.length}</strong><small>Needs moderation</small></div><div className="staff-metric"><span>Open disputes</span><strong>{disputes.length}</strong><small>Requires a decision</small></div></section><section className="panel staff-queue"><div className="panel-title-row"><div><h3>Platform review queue</h3><p>Monitor the most important operational work across QuestKarte.</p></div><button className="btn" onClick={() => selectTab("task_review")}>Review tasks</button></div><div className="staff-summary-list"><span>{tasks.length} task submissions awaiting review</span><span>{verifications.length} verification requests awaiting review</span><span>{reports.length + disputes.length} active safety cases</span></div></section></div>;
    if (tab === "task_review") return <section className="panel staff-queue"><div className="panel-title-row"><div><h3>Task review queue</h3><p>Only approved tasks are released to the public Marketplace.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>{tasks.length ? tasks.map((task) => <article className="staff-case" key={task.id}><div><strong>{task.title}</strong><span>{task.location_label} · submitted {new Date(task.created_at).toLocaleDateString()}</span><p>{task.description}</p></div><div className="staff-actions"><button className="btn primary" onClick={() => void approveTask(task, true)}>Approve</button><button className="btn danger" onClick={() => void approveTask(task, false)}>Reject</button></div></article>) : <p className="feed-message">No pending task submissions.</p>}</section>;
    if (tab === "verification") return <section className="panel staff-queue"><h3>Verification queue</h3>{verifications.length ? verifications.map((record) => <article className="staff-case" key={record.id}><div><strong>{record.type === "student" ? "Student verification" : "Professional verification"}</strong><span>{record.school_name || record.institution_or_company || "Institution not provided"} · {record.document_name}</span></div><div className="staff-actions"><button className="btn secondary" onClick={() => void openVerificationEvidence(record)}>View private documents</button><button className="btn primary" onClick={() => void decideVerification(record, true)}>Approve</button><button className="btn danger" onClick={() => void decideVerification(record, false)}>Reject</button></div></article>) : <p className="feed-message">No verification requests are waiting.</p>}</section>;
    if (tab === "reports") return <section className="panel staff-queue"><h3>Reports</h3>{reports.length ? reports.map((report) => <article className="staff-case" key={report.id}><div><strong>{report.reason}</strong><span>{report.status} · filed {new Date(report.created_at).toLocaleDateString()}</span></div><div className="staff-actions"><button className="btn primary" onClick={() => void resolveCase("reports", report.id, "resolved")}>Resolve</button><button className="btn" onClick={() => void resolveCase("reports", report.id, "dismissed")}>Dismiss</button></div></article>) : <p className="feed-message">No open reports.</p>}</section>;
    if (tab === "disputes") return <section className="panel staff-queue"><h3>Disputes</h3>{disputes.length ? disputes.map((dispute) => <article className="staff-case" key={dispute.id}><div><strong>{dispute.reason}</strong><span>{dispute.status} · filed {new Date(dispute.created_at).toLocaleDateString()}</span></div><div className="staff-actions"><button className="btn primary" onClick={() => void resolveCase("disputes", dispute.id, "resolved")}>Resolve</button><button className="btn" onClick={() => void resolveCase("disputes", dispute.id, "dismissed")}>Dismiss</button></div></article>) : <p className="feed-message">No open disputes.</p>}</section>;
    if (tab === "members") return <section className="panel staff-queue"><h3>Member management</h3>{visibleMembers.map((member) => <article className="staff-case" key={member.id}><div><strong>{member.full_name}</strong><span>{member.city || "Area not set"} · Trust Factor {member.trust_factor} · {member.completed_tasks_count} completed</span></div><button className="btn" onClick={() => void promote(member)} disabled={moderatorIds.has(member.id)}>{moderatorIds.has(member.id) ? "Moderator" : "Make moderator"}</button></article>)}</section>;
    if (tab === "moderators") return <section className="panel staff-queue"><h3>Moderator management</h3><p className="form-intro">The Admin promotes existing member accounts. Moderators cannot create staff accounts.</p>{members.filter((member) => moderatorIds.has(member.id)).map((member) => <article className="staff-case" key={member.id}><div><strong>{member.full_name}</strong><span>Moderator · Trust Factor {member.trust_factor}</span></div><span className="role-chip">Active</span></article>)}</section>;
    if (tab === "categories") return <section className="panel staff-queue"><div className="panel-title-row"><div><h3>Marketplace categories</h3><p>Only the Admin can add or manage category availability.</p></div><button className="btn primary" onClick={() => void addCategory()}>Add category</button></div><div className="category-admin-grid">{categories.map((category) => <article key={category.id}><strong>{category.name}</strong><span>{category.is_active ? "Active" : "Hidden"}</span><button className="btn" onClick={async () => { const { error } = await supabase.from("categories").update({ is_active: !category.is_active }).eq("id", category.id); setNotice(error ? error.message : `${category.name} updated.`); if (!error) await load(); }}>{category.is_active ? "Hide" : "Activate"}</button></article>)}</div></section>;
    return <section className="panel staff-queue"><div className="panel-title-row"><div><h3>Audit log</h3><p>Recorded actions taken by authorised staff.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>{audit.length ? audit.map((entry) => <article className="staff-case" key={entry.id}><div><strong>{entry.action}</strong><span>{entry.entity_type} · {new Date(entry.created_at).toLocaleString()}</span></div></article>) : <p className="feed-message">No staff actions have been recorded yet.</p>}</section>;
  };

  return <div className="staff-workspace view"><section className="staff-workspace-hero"><div><span className="eyebrow">QuestKarte staff access</span><h2>{title}</h2><p>{isAdmin ? "Platform governance, member access, categories, and activity oversight." : "Safety decisions, task review, verification, reports, and disputes."}</p></div><div className="staff-identity"><span>{isAdmin ? "A" : "M"}</span><div><strong>{isAdmin ? "Administrator" : "Moderator"}</strong><small>{session?.user.email || "Preview account"}</small></div><button className="btn" onClick={onExit}>Sign out</button></div></section><nav className="staff-tabs" aria-label="Staff tools">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => selectTab(item.id)}>{item.label}</button>)}</nav>{loading ? <section className="panel feed-message">Loading staff workspace...</section> : content()}{notice && <p className="staff-notice">{notice}</p>}{evidencePreview && <VerificationEvidenceModal preview={evidencePreview} onClose={() => setEvidencePreview(null)} />}</div>;
}

function VerificationEvidenceModal({ preview, onClose }: { preview: { title: string; items: VerificationEvidencePreview[] }; onClose: () => void }) {
  return <div className="evidence-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="evidence-modal" role="dialog" aria-modal="true" aria-label={preview.title} onMouseDown={(event) => event.stopPropagation()}><div className="evidence-modal-head"><div><span className="eyebrow">Private staff review</span><h3>{preview.title}</h3><p>All files submitted by this member. Links expire after five minutes.</p></div><button type="button" className="btn" onClick={onClose}>Close</button></div><div className="evidence-preview-grid">{preview.items.map((item) => <article key={item.url} className="evidence-preview-item"><div className="evidence-preview-media">{item.mimeType?.startsWith("image/") ? <img src={item.url} alt={item.label} /> : <span>PDF</span>}</div><div><strong>{item.label}</strong><span>{item.fileName}</span><a href={item.url} target="_blank" rel="noreferrer">Open full file</a></div></article>)}</div></section></div>;
}

function StaffDashboardLegacy({ role, onExit }: { role: StaffRole; onExit: () => void }) {
  const isAdmin = role === "admin";
  const cards = isAdmin ? [["Pending verifications", "18", "Review evidence"], ["Open reports", "7", "Assign moderation"], ["Member health", "98.4%", "View analytics"], ["Staff actions today", "42", "Open audit log"]] : [["Verification queue", "18", "Review evidence"], ["Reported content", "7", "Review reports"], ["Open disputes", "3", "Resolve cases"], ["Restricted accounts", "5", "Review restrictions"]];
  return <div className="staff-view view"><section className="staff-banner"><div><span className="eyebrow">Preview only · staff workspace</span><h2>{isAdmin ? "Admin command center" : "Moderator console"}</h2><p>{isAdmin ? "Oversee safety, performance, permissions, and platform decisions." : "Protect the community by reviewing evidence, reports, and disputes."}</p></div><button className="btn" onClick={onExit}>Exit preview</button></section><div className="staff-metrics">{cards.map(([label, value, action]) => <button className="staff-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{action} →</small></button>)}</div><div className="staff-grid"><section className="panel staff-queue"><h3>{isAdmin ? "Priority operations" : "Priority review queue"}</h3>{["Student verification · Janelle R.", "Reported task · Cash transfer request", "Dispute · Task completion pending"].map((item, index) => <div className="staff-row" key={item}><div><strong>{item}</strong><span>{index === 0 ? "Submitted 14 min ago" : "Needs attention today"}</span></div><button className="btn">Review</button></div>)}</section><aside className="panel staff-policy"><h3>{isAdmin ? "Platform control" : "Moderator tools"}</h3><button>{isAdmin ? "Manage staff roles" : "Verification decisions"}</button><button>{isAdmin ? "View audit log" : "Content restrictions"}</button><button>{isAdmin ? "Review analytics" : "Dispute notes"}</button><p>Every action is recorded in the audit log.</p></aside></div></div>;
}

const Brand = ({ markOnly = false }: { markOnly?: boolean }) => <div className="brand"><div className="brand-mark"><img src="/questkarte-logo.png" alt="QuestKarte emblem" /></div>{!markOnly && <span className="brand-word">QuestKarte</span>}</div>;
const RailItem = ({ item, active, onClick }: { item: typeof nav[number]; active: boolean; onClick: () => void }) => <button className={`rail-item ${active ? "active" : ""}`} onClick={onClick}><span>{item.icon}</span><small>{item.label}</small></button>;
const NavButton = ({ item, active, onClick }: { item: typeof nav[number]; active: boolean; onClick: () => void }) => <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span>{item.icon}</span><small>{item.label}</small></button>;
const Toggle = ({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: () => void }) => <div className="toggle-row"><div><div className="tt">{title}</div><div className="td">{detail}</div></div><button type="button" className={`switch ${checked ? "on" : ""}`} onClick={onChange} aria-pressed={checked} /></div>;
const Progress = ({ percent }: { percent: number }) => <div className="xp-path"><div className="xp-path-fill" style={{ width: `${percent}%` }} /><i className="xp-node done" style={{ left: "0%" }} /><i className="xp-node done" style={{ left: "33%" }} /><i className="xp-node current" style={{ left: `${percent}%` }} /><i className="xp-node" style={{ left: "100%" }} /><span className="xp-label done" style={{ left: "0%" }}>Open</span><span className="xp-label current" style={{ left: `${percent}%` }}>Ongoing</span><span className="xp-label" style={{ left: "100%" }}>Done</span></div>;
const Conversation = ({ name, quest, snippet, active, onClick }: { name: string; quest: string; snippet: string; active?: boolean; onClick: () => void }) => <button className={`convo-item ${active ? "active" : ""}`} onClick={onClick}><span className="avatar">{name.split(" ").map((word) => word[0]).join("")}</span><span className="convo-info"><span className="convo-name">{name}<small className="time">2m</small></span><span className="convo-quest">{quest}</span><span className="convo-snip">{snippet}</span></span>{active && <i className="unread-dot" />}</button>;
const Stat = ({ label, value, percent, gold }: { label: string; value: string; percent: number; gold?: boolean }) => <div className="stat-bar-row"><div className="sb-top"><span className="lb">{label}</span><span className="val">{value}</span></div><div className="sb-track"><div className={`sb-fill ${gold ? "gold-fill" : ""}`} style={{ width: `${percent}%` }} /></div></div>;
const Medal = ({ icon, label, tone }: { icon: string; label: string; tone: string }) => <div className="medal"><div className={`medal-ic ${tone}`}><span className="in">{icon}</span></div><span className="lb">{label}</span></div>;
const Setting = ({ icon, name, onClick }: { icon: string; name: string; onClick: () => void }) => <button className="settings-item" onClick={onClick}><span className="left"><span className="settings-ic">{icon}</span>{name}</span><span>›</span></button>;
const Empty = () => <div className="empty-state"><div>⌕</div><h3>No quests match that filter</h3><p>Try broadening your search or explore another category.</p><button>Reset search</button></div>;
const titleFor = (page: Page) => ({ home: "Find your next quest", tasks: "Your quest log", post: "Forge a new quest", chat: "Messages", account: "Your member profile", settings: "Settings", staff: "Staff workspace" })[page];
const subtitleFor = (page: Page) => ({ home: "Smart matches based on your skills and location.", tasks: "Stay on top of every task, application, and milestone.", post: "Share a clear task and find the right person faster.", chat: "Coordinate safely without leaving QuestKarte.", account: "Your reputation grows with every completed quest.", settings: "Manage your profile, preferences, and session.", staff: "Role-based tools for a safe, trusted marketplace." })[page];
const categoryIcon = (category: string) => ({ Cleaning: "⌁", Delivery: "→", Tutoring: "⌘", Design: "✦", Errands: "◌", Other: "◇" })[category] || "◇";

function TaskWorkspace({ session, onGoPost, onOpenChat = () => {} }: { session: Session; onGoPost: () => void; onOpenChat?: (taskId: string) => void }) {
  type OwnedTask = { id: string; title: string; status: "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed"; moderation_state: string; assigned_to: string | null; created_at: string };
  type AppliedTask = { id: string; status: string; task: { id: string; title: string; status: "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed"; assigned_to: string | null; location_label: string } | null };
  const [tab, setTab] = useState<"posted" | "applied">("posted"); const [posted, setPosted] = useState<OwnedTask[]>([]); const [applied, setApplied] = useState<AppliedTask[]>([]); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const [own, mine] = await Promise.all([supabase.from("tasks").select("id,title,status,moderation_state,assigned_to,created_at").eq("posted_by", session.user.id).order("created_at", { ascending: false }), supabase.from("applications").select("id,status,task:tasks(id,title,status,assigned_to,location_label)").eq("applicant_id", session.user.id).order("created_at", { ascending: false })]); setPosted((own.data || []) as OwnedTask[]); setApplied((mine.data || []) as unknown as AppliedTask[]); setLoading(false); };
  useEffect(() => { void load(); }, [session.user.id]);
  const progress = async (taskId: string, status: "in_progress" | "completed") => { const note = status === "completed" ? window.prompt("Add a completion note for the other member (optional):") || null : "Work started"; const { error } = await supabase.rpc("update_task_progress", { target_task_id: taskId, next_status: status, progress_note: note }); setNotice(error ? error.message : status === "completed" ? "Task marked complete. Both members can now leave a rating." : "Task is now in progress."); if (!error) void load(); };
  const taskState = (task: OwnedTask) => task.moderation_state === "pending_review" ? "Awaiting moderator review" : task.moderation_state === "rejected" ? "Rejected - revise the task details" : task.status === "open" ? "Published - accepting applications" : task.status === "assigned" ? "Provider accepted - ready to begin" : task.status === "in_progress" ? "Work in progress" : task.status === "completed" ? "Completed - leave a rating" : task.status.replace("_", " ");
  return <div className="fresh-tasks view">
    <section className="panel task-workspace-head"><div><span className="eyebrow">Your task workspace</span><h2>Manage every task from one place.</h2><p>Keep your posted requests, applications, progress, and completion record separate and clear.</p></div><button className="btn primary" onClick={onGoPost}>+ Post a task</button></section>
    <nav className="staff-tabs task-tabs"><button className={tab === "posted" ? "active" : ""} onClick={() => setTab("posted")}>My posted tasks <span>{posted.length}</span></button><button className={tab === "applied" ? "active" : ""} onClick={() => setTab("applied")}>My applications <span>{applied.length}</span></button></nav>
    {notice && <p className="staff-notice">{notice}</p>}
    {loading ? <section className="panel feed-message">Loading your task workspace...</section> : tab === "posted" ? <section className="task-work-list">{posted.length ? posted.map((task) => <article className="panel staff-case task-work-card" key={task.id}><div className="task-work-card-main"><strong>{task.title}</strong><span>{taskState(task)}</span><small>Posted {new Date(task.created_at).toLocaleDateString()}</small></div><div className="staff-actions task-work-actions">{task.assigned_to && <button className="btn" onClick={() => onOpenChat(task.id)}>Message provider</button>}{task.status === "assigned" && <button className="btn primary" onClick={() => void progress(task.id, "in_progress")}>Start progress</button>}{task.status === "in_progress" && <button className="btn primary" onClick={() => void progress(task.id, "completed")}>Mark complete</button>}<span className="role-chip">{task.status.replace("_", " ")}</span></div></article>) : <div className="fresh-empty-view"><div className="empty-icon">□</div><h2>No posted tasks yet</h2><p>Post a clear request to begin receiving applications.</p><button className="btn primary" onClick={onGoPost}>Post your first task</button></div>}</section> : <section className="task-work-list">{applied.length ? applied.map((application) => { const task = application.task; const accepted = application.status === "accepted" && task?.assigned_to === session.user.id; return <article className="panel staff-case task-work-card" key={application.id}><div className="task-work-card-main"><strong>{task?.title || "Task unavailable"}</strong><span>{accepted ? `Accepted · ${task?.status === "assigned" ? "Ready to start" : task?.status === "in_progress" ? "Work in progress" : task?.status}` : `Application ${application.status}`}</span><small>{task?.location_label || "Task details unavailable"}</small></div><div className="staff-actions task-work-actions">{accepted && task && <button className="btn" onClick={() => onOpenChat(task.id)}>Message task poster</button>}{accepted && task?.status === "assigned" && <button className="btn primary" onClick={() => void progress(task.id, "in_progress")}>Start task</button>}{accepted && task?.status === "in_progress" && <button className="btn primary" onClick={() => void progress(task.id, "completed")}>Submit completion</button>}<span className="role-chip">{application.status}</span></div></article>; }) : <div className="fresh-empty-view"><div className="empty-icon">□</div><h2>No applications yet</h2><p>Browse approved tasks and apply where your skills fit.</p></div>}</section>}
  </div>;
  return <div className="fresh-tasks view"><section className="panel task-workspace-head"><div><span className="eyebrow">Your task workspace</span><h2>Manage every task from one place.</h2><p>Keep your posted requests, applications, progress, and completion record separate and clear.</p></div><button className="btn primary" onClick={onGoPost}>+ Post a task</button></section><nav className="staff-tabs task-tabs"><button className={tab === "posted" ? "active" : ""} onClick={() => setTab("posted")}>My posted tasks <span>{posted.length}</span></button><button className={tab === "applied" ? "active" : ""} onClick={() => setTab("applied")}>My applications <span>{applied.length}</span></button></nav>{notice && <p className="staff-notice">{notice}</p>}{loading ? <section className="panel feed-message">Loading your task workspace...</section> : tab === "posted" ? <section className="task-work-list">{posted.length ? posted.map((task) => <article className="panel staff-case" key={task.id}><div><strong>{task.title}</strong><span>{taskState(task)}</span><small>Posted {new Date(task.created_at).toLocaleDateString()}</small></div><div className="staff-actions">{task.status === "assigned" && <button className="btn primary" onClick={() => void progress(task.id, "in_progress")}>Start progress</button>}{task.status === "in_progress" && <button className="btn primary" onClick={() => void progress(task.id, "completed")}>Mark complete</button>}<span className="role-chip">{task.status.replace("_", " ")}</span></div></article>) : <div className="fresh-empty-view"><div className="empty-icon">□</div><h2>No posted tasks yet</h2><p>Post a clear request to begin receiving applications.</p><button className="btn primary" onClick={onGoPost}>Post your first task</button></div>}</section> : <section className="task-work-list">{applied.length ? applied.map((application) => { const task = application.task; const accepted = application.status === "accepted" && task?.assigned_to === session.user.id; return <article className="panel staff-case" key={application.id}><div><strong>{task?.title || "Task unavailable"}</strong><span>{accepted ? `Accepted · ${task?.status === "assigned" ? "Ready to start" : task?.status === "in_progress" ? "Work in progress" : task?.status}` : `Application ${application.status}`}</span><small>{task?.location_label || "Task details unavailable"}</small></div><div className="staff-actions">{accepted && task?.status === "assigned" && <button className="btn primary" onClick={() => void progress(task.id, "in_progress")}>Start task</button>}{accepted && task?.status === "in_progress" && <button className="btn primary" onClick={() => void progress(task.id, "completed")}>Submit completion</button>}<span className="role-chip">{application.status}</span></div></article>; }) : <div className="fresh-empty-view"><div className="empty-icon">□</div><h2>No applications yet</h2><p>Browse approved tasks and apply where your skills fit.</p></div>}</section>}</div>;
}

function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; body: string; is_read: boolean; created_at: string }[]>([]);
  const load = async () => { const { data } = await supabase.from("notifications").select("id,title,body,is_read,created_at").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(8); setItems((data || []) as typeof items); };
  useEffect(() => {
    void load();
    // Re-check periodically so staff decisions appear without requiring a browser refresh.
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [userId]);
  const unread = items.filter((item) => !item.is_read).length;
  const toggle = async () => { const next = !open; setOpen(next); if (next) { await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", userId).eq("is_read", false); await load(); } };
  return <div className="notification-wrap"><button type="button" className={`notification-bell ${unread ? "has-unread" : ""}`} onClick={() => void toggle()} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}><svg className="bell-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}</button>{open && <section className="notification-menu"><div><strong>Notifications</strong><button type="button" onClick={() => setOpen(false)}>Close</button></div>{items.length ? items.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>) : <p className="feed-message">You are all caught up.</p>}</section>}</div>;
}

function MemberGuide({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const tips: [string, string, Page][] = [
    ["Start with your profile", "Add a clear photo, short introduction, service area, and skills so other members understand what you offer.", "account" as Page],
    ["Find work nearby", "Use the map search to choose an area, set any radius from 1 to 50 km, and open the full map for a wider view.", "home" as Page],
    ["Post safely", "Describe the task clearly. New tasks are reviewed before they appear in the marketplace.", "post" as Page],
    ["Keep task work in QuestKarte", "Use Tasks for updates and Chat for messages once an application is accepted.", "tasks" as Page],
  ];
  const current = tips[tip];
  return <div className={`member-guide ${open ? "open" : ""}`}><button type="button" className="guide-orb" onClick={() => setOpen(!open)} aria-label="Open QuestKarte guide" aria-expanded={open}><span>Q</span><i>?</i></button>{open && <section className="guide-panel" aria-label="QuestKarte guide"><header><div><span className="eyebrow">QUESTKARTE GUIDE</span><strong>Need a hand?</strong></div><button onClick={() => setOpen(false)} aria-label="Close guide">×</button></header><div className="guide-tip"><span className="guide-step">{tip + 1} / {tips.length}</span><h3>{current[0]}</h3><p>{current[1]}</p><button className="btn primary" onClick={() => { onNavigate(current[2]); setOpen(false); }}>Take me there →</button></div><footer><button onClick={() => setTip((tip + tips.length - 1) % tips.length)} aria-label="Previous guide tip">←</button><span>{tips.map((_, index) => <i key={index} className={index === tip ? "active" : ""} />)}</span><button onClick={() => setTip((tip + 1) % tips.length)} aria-label="Next guide tip">→</button></footer></section>}</div>;
}

function TaskApplicationInbox({ session }: { session: Session }) {
  return <TaskApplicationInboxV2 session={session} />;
  /*
  type ApplicationRow = { id: string; task_id: string; applicant_id: string; cover_note: string | null; status: string; created_at: string };
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, { full_name: string; trust_factor: number; avatar_url: string | null }>>({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [profilePreviewId, setProfilePreviewId] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const { data: ownTasks } = await supabase.from("tasks").select("id,title").eq("posted_by", session.user.id).eq("status", "open");
    const taskRows = ownTasks || [];
    const taskIds = taskRows.map((task) => task.id);
    setTasks(Object.fromEntries(taskRows.map((task) => [task.id, task.title])));
    if (!taskIds.length) { setApplications([]); setMembers({}); setLoading(false); return; }
    const { data: appRows, error } = await supabase.from("applications").select("id,task_id,applicant_id,cover_note,status,created_at").in("task_id", taskIds).in("status", ["pending", "shortlisted"]).order("created_at", { ascending: false });
    if (error) { setNotice(error.message); setLoading(false); return; }
    const rows = (appRows || []) as ApplicationRow[];
    const applicantIds = [...new Set(rows.map((application) => application.applicant_id))];
    if (applicantIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,trust_factor,avatar_url").in("id", applicantIds);
      setMembers(Object.fromEntries((profiles || []).map((profile) => [profile.id, profile])) as Record<string, { full_name: string; trust_factor: number; avatar_url: string | null }>);
    } else setMembers({});
    setApplications(rows); setLoading(false);
  };
  useEffect(() => { void load(); }, [session.user.id]);
  const accept = async (application: ApplicationRow) => {
    const { error } = await supabase.rpc("accept_application", { target_application_id: application.id });
    setNotice(error ? error.message : `Accepted ${members[application.applicant_id]?.full_name || "the applicant"}. The task is ready to begin.`);
    if (!error) void load();
  };
  if (loading || !applications.length) return loading ? <section className="panel feed-message">Checking your application inbox...</section> : null;
  return <><section className="panel application-inbox"><div className="section-head"><div><span className="eyebrow">Application inbox</span><h2>Choose the right provider</h2><p>Accepting one application assigns the task and closes the others automatically.</p></div></div>{notice && <p className="staff-notice">{notice}</p>}<div className="task-work-list">{applications.map((application) => { const member = members[application.applicant_id]; const name = member?.full_name || "QuestKarte member"; return <article className="staff-case" key={application.id}><button type="button" className="qc-poster qc-poster-button" onClick={() => setProfilePreviewId(application.applicant_id)} aria-label={`View ${name}'s profile`}><span className="avatar">{member?.avatar_url ? <img src={member.avatar_url} alt="" /> : name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>Trust Factor {member?.trust_factor || 0} · applied for {tasks[application.task_id] || "your task"}</small></span></button><div className="application-note"><strong>Application note</strong><p>{application.cover_note || "No message was added."}</p></div><div className="staff-actions"><button type="button" className="btn primary" onClick={() => void accept(application)}>Accept applicant</button><span className="role-chip">{application.status}</span></div></article>; })}</div></section>{profilePreviewId && <MemberProfileModal memberId={profilePreviewId} onClose={() => setProfilePreviewId(null)} />}</>;
}

  */
}

type InboxApplication = { id: string; task_id: string; applicant_id: string; cover_note: string | null; status: string; created_at: string };
type InboxMember = { full_name: string; trust_factor: number; avatar_url: string | null };
type InboxAttachment = { id: string; application_id: string; storage_path: string; file_name: string; mime_type: string | null; url?: string };

function ApplicationDetailModal({ application, member, attachments, onClose, onProfile }: { application: InboxApplication; member: InboxMember | undefined; attachments: InboxAttachment[]; onClose: () => void; onProfile: () => void }) {
  const name = member?.full_name || "QuestKarte member";
  return <div className="application-detail-backdrop" role="presentation" onMouseDown={onClose}><section className="application-detail-modal" role="dialog" aria-modal="true" aria-label={`${name}'s application`} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Application details</span><h2>{name}'s application</h2></div><button type="button" className="member-profile-close" onClick={onClose} aria-label="Close application details">×</button></header><button type="button" className="application-detail-heading qc-poster qc-poster-button" onClick={onProfile}><span className="avatar">{member?.avatar_url ? <img src={member.avatar_url} alt="" /> : name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>Trust Factor {member?.trust_factor || 0}</small></span></button><div className="application-detail-note"><span>Applicant message</span><p>{application.cover_note || "No message was added."}</p></div><div><span className="eyebrow">Supporting files</span>{attachments.length ? <div className="application-file-grid">{attachments.map((file) => <a key={file.id} className="application-file-tile" href={file.url || undefined} target="_blank" rel="noreferrer">{file.mime_type?.startsWith("image/") && file.url ? <img src={file.url} alt={file.file_name} /> : <div className="application-file-document">FILE</div>}<span>{file.file_name}</span></a>)}</div> : <p className="feed-message">No optional files were attached.</p>}</div></section></div>;
}

function TaskApplicationInboxV2({ session }: { session: Session }) {
  const [applications, setApplications] = useState<InboxApplication[]>([]);
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, InboxMember>>({});
  const [attachments, setAttachments] = useState<Record<string, InboxAttachment[]>>({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [profilePreviewId, setProfilePreviewId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<InboxApplication | null>(null);
  const load = async () => {
    setLoading(true);
    const { data: ownTasks } = await supabase.from("tasks").select("id,title").eq("posted_by", session.user.id).eq("status", "open");
    const taskRows = ownTasks || [];
    const taskIds = taskRows.map((task) => task.id);
    setTasks(Object.fromEntries(taskRows.map((task) => [task.id, task.title])));
    if (!taskIds.length) { setApplications([]); setMembers({}); setAttachments({}); setLoading(false); return; }
    const { data: appRows, error } = await supabase.from("applications").select("id,task_id,applicant_id,cover_note,status,created_at").in("task_id", taskIds).in("status", ["pending", "shortlisted"]).order("created_at", { ascending: false });
    if (error) { setNotice(error.message); setLoading(false); return; }
    const rows = (appRows || []) as InboxApplication[];
    const applicantIds = [...new Set(rows.map((application) => application.applicant_id))];
    const [{ data: profiles }, { data: fileRows }] = await Promise.all([
      applicantIds.length ? supabase.from("profiles").select("id,full_name,trust_factor,avatar_url").in("id", applicantIds) : Promise.resolve({ data: [] }),
      rows.length ? supabase.from("application_attachments").select("id,application_id,storage_path,file_name,mime_type").in("application_id", rows.map((application) => application.id)) : Promise.resolve({ data: [] }),
    ]);
    setMembers(Object.fromEntries((profiles || []).map((profile) => [profile.id, profile])) as Record<string, InboxMember>);
    const nextAttachments: Record<string, InboxAttachment[]> = {};
    await Promise.all((fileRows || []).map(async (file) => {
      const { data: signed } = await supabase.storage.from("application-attachments").createSignedUrl(file.storage_path, 3600);
      (nextAttachments[file.application_id] ||= []).push({ ...file, url: signed?.signedUrl });
    }));
    setAttachments(nextAttachments); setApplications(rows); setLoading(false);
  };
  useEffect(() => { void load(); }, [session.user.id]);
  const accept = async (application: InboxApplication) => {
    const { error } = await supabase.rpc("accept_application", { target_application_id: application.id });
    setNotice(error ? error.message : `Accepted ${members[application.applicant_id]?.full_name || "the applicant"}. The task is now private to you and the selected applicant.`);
    if (!error) { setSelectedApplication(null); void load(); }
  };
  const decline = async (application: InboxApplication) => {
    const name = members[application.applicant_id]?.full_name || "this applicant";
    if (!window.confirm(`Decline ${name}'s application? They will be notified.`)) return;
    const { error } = await supabase.rpc("decline_application", { target_application_id: application.id });
    setNotice(error ? error.message : `Declined ${name}'s application.`);
    if (!error) { if (selectedApplication?.id === application.id) setSelectedApplication(null); void load(); }
  };
  if (loading || !applications.length) return loading ? <section className="panel feed-message">Checking your application inbox...</section> : null;
  return <><section className="panel application-inbox"><div className="section-head"><div><span className="eyebrow">Application inbox</span><h2>Review applicants for your posted task</h2><p>You are the task poster. Choose an applicant when you are ready; the selected applicant becomes the service provider and all other pending applications close automatically.</p></div></div>{notice && <p className="staff-notice">{notice}</p>}<div className="task-work-list">{applications.map((application) => { const member = members[application.applicant_id]; const name = member?.full_name || "QuestKarte member"; return <article className="staff-case" key={application.id}><button type="button" className="qc-poster qc-poster-button" onClick={() => setProfilePreviewId(application.applicant_id)} aria-label={`View ${name}'s profile`}><span className="avatar">{member?.avatar_url ? <img src={member.avatar_url} alt="" /> : name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>Trust Factor {member?.trust_factor || 0} · applied for {tasks[application.task_id] || "your task"}</small></span></button><div className="application-note"><strong>Application note</strong><p>{application.cover_note || "No message was added."}</p></div><div className="application-card-actions"><button type="button" className="btn" onClick={() => setSelectedApplication(application)}>View details</button><button type="button" className="btn application-decline" onClick={() => void decline(application)}>Decline</button><button type="button" className="btn primary" onClick={() => void accept(application)}>Accept applicant</button><span className="role-chip">{application.status}</span></div></article>; })}</div></section>{selectedApplication && <ApplicationDetailModal application={selectedApplication} member={members[selectedApplication.applicant_id]} attachments={attachments[selectedApplication.id] || []} onClose={() => setSelectedApplication(null)} onProfile={() => { setProfilePreviewId(selectedApplication.applicant_id); setSelectedApplication(null); }} />}{profilePreviewId && <MemberProfileModal memberId={profilePreviewId} onClose={() => setProfilePreviewId(null)} />}</>;
}

function CompletedTaskReviews({ session }: { session: Session }) {
  type CompletedTask = { id: string; title: string; posted_by: string; assigned_to: string | null };
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const load = async () => {
    const { data: taskRows } = await supabase.from("tasks").select("id,title,posted_by,assigned_to").eq("status", "completed").or(`posted_by.eq.${session.user.id},assigned_to.eq.${session.user.id}`);
    const rows = (taskRows || []) as CompletedTask[];
    const { data: reviewRows } = await supabase.from("reviews").select("task_id").eq("reviewer_id", session.user.id);
    setTasks(rows); setReviewedIds((reviewRows || []).map((review) => review.task_id));
  };
  useEffect(() => { void load(); }, [session.user.id]);
  const submit = async (task: CompletedTask) => {
    const rating = ratings[task.id] || 0;
    if (!rating) { setNotice("Choose a star rating first."); return; }
    const revieweeId = task.posted_by === session.user.id ? task.assigned_to : task.posted_by;
    if (!revieweeId) { setNotice("This completed task has no assigned provider."); return; }
    const { error } = await supabase.from("reviews").insert({ task_id: task.id, reviewer_id: session.user.id, reviewee_id: revieweeId, rating, comment: comments[task.id]?.trim() || null });
    setNotice(error ? error.message : "Review submitted. The member's rating and Trust Factor have been updated.");
    if (!error) void load();
  };
  const pending = tasks.filter((task) => !reviewedIds.includes(task.id));
  if (!pending.length) return null;
  return <section className="panel application-inbox"><div className="section-head"><div><span className="eyebrow">Completed work</span><h2>Leave a fair review</h2><p>Both task posters and providers can rate one another after a task is completed.</p></div></div>{notice && <p className="staff-notice">{notice}</p>}<div className="task-work-list">{pending.map((task) => <article className="staff-case review-case" key={task.id}><div><strong>{task.title}</strong><span>Rate the other task participant</span></div><div className="review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={(ratings[task.id] || 0) >= star ? "selected" : ""} onClick={() => setRatings({ ...ratings, [task.id]: star })} aria-label={`${star} star${star === 1 ? "" : "s"}`}>★</button>)}</div><textarea value={comments[task.id] || ""} maxLength={1500} onChange={(event) => setComments({ ...comments, [task.id]: event.target.value })} placeholder="Optional feedback that will help other members." /><button type="button" className="btn primary" onClick={() => void submit(task)}>Submit review</button></article>)}</div></section>;
}

function TaskDeliveryAndSafety({ session }: { session: Session }) {
  type ActiveTask = { id: string; title: string; status: string; posted_by: string; assigned_to: string | null };
  const [tasks, setTasks] = useState<ActiveTask[]>([]); const [selectedFile, setSelectedFile] = useState<Record<string, File | null>>({}); const [notice, setNotice] = useState("");
  const load = async () => { const { data } = await supabase.from("tasks").select("id,title,status,posted_by,assigned_to").in("status", ["assigned", "in_progress"]).or(`posted_by.eq.${session.user.id},assigned_to.eq.${session.user.id}`); setTasks((data || []) as ActiveTask[]); };
  useEffect(() => { void load(); }, [session.user.id]);
  const upload = async (task: ActiveTask) => { const file = selectedFile[task.id]; if (!file) { setNotice("Choose a JPG, PNG, WEBP, or PDF deliverable first."); return; } if (task.assigned_to !== session.user.id) { setNotice("Only the assigned provider can submit a deliverable."); return; } const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const result = await supabase.storage.from("task-deliverables").upload(path, file, { contentType: file.type, upsert: false }); if (result.error) { setNotice(result.error.message); return; } const { error } = await supabase.from("task_deliverables").insert({ task_id: task.id, submitted_by: session.user.id, storage_path: path, file_name: file.name, mime_type: file.type, caption: "Submitted from task workspace" }); setNotice(error ? error.message : "Deliverable uploaded. The task poster can now review it in this protected workspace."); };
  const dispute = async (task: ActiveTask) => { const reason = window.prompt("Describe the issue clearly for QuestKarte staff:"); if (!reason?.trim()) return; const { error } = await supabase.from("disputes").insert({ task_id: task.id, opened_by: session.user.id, reason: reason.trim(), status: "open" }); if (!error) await supabase.rpc("update_task_progress", { target_task_id: task.id, next_status: "disputed", progress_note: "A participant opened a dispute." }); setNotice(error ? error.message : "Dispute submitted. A moderator will review the case and both members will be notified."); if (!error) void load(); };
  if (!tasks.length) return null;
  return <section className="panel application-inbox"><div className="section-head"><div><span className="eyebrow">Protected work area</span><h2>Deliverables and support</h2><p>Submit proof of completed work securely, or open a dispute if the task cannot be resolved directly.</p></div></div>{notice && <p className="staff-notice">{notice}</p>}<div className="task-work-list">{tasks.map((task) => <article className="staff-case" key={task.id}><div><strong>{task.title}</strong><span>{task.status.replace("_", " ")}</span></div><div className="application-note">{task.assigned_to === session.user.id && <label className="photo-add-button">Choose deliverable<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setSelectedFile({ ...selectedFile, [task.id]: event.target.files?.[0] || null })} /></label>}<small>{selectedFile[task.id]?.name || "JPG, PNG, WEBP, or PDF; maximum 10 MB."}</small></div><div className="staff-actions">{task.assigned_to === session.user.id && <button type="button" className="btn primary" onClick={() => void upload(task)}>Submit deliverable</button>}<button type="button" className="btn danger" onClick={() => void dispute(task)}>Open dispute</button></div></article>)}</div></section>;
}

function LegacyPostTaskReal({ session, profile, onPosted }: { session: Session | null; profile: MemberProfile | null; onPosted: () => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [location, setLocation] = useState(""); const [commission, setCommission] = useState(""); const [category, setCategory] = useState("Cleaning"); const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  const selectFiles = (list: FileList | null) => { const next = Array.from(list || []).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 4 * 1024 * 1024).slice(0, 6); setFiles(next); setNotice(next.length !== (list?.length || 0) ? "Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB." : ""); };
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!session) return; const amount = Number(commission.replace(/[^0-9.]/g, "")); if (!Number.isFinite(amount) || amount <= 0) { setNotice("Enter a valid commission amount."); return; } setSaving(true); setNotice(""); const coords = await new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => { if (!navigator.geolocation) return resolve({ latitude: null, longitude: null }); navigator.geolocation.getCurrentPosition(({ coords: current }) => resolve({ latitude: current.latitude, longitude: current.longitude }), () => resolve({ latitude: null, longitude: null }), { timeout: 7000, maximumAge: 60000 }); }); const { data: categoryRow } = await supabase.from("categories").select("id").ilike("name", category).limit(1).maybeSingle(); const { data: task, error } = await supabase.from("tasks").insert({ posted_by: session.user.id, category_id: categoryRow?.id || null, title: title.trim(), description: description.trim(), commission_amount: amount, currency: "PHP", is_service_swap: false, location_label: location.trim(), latitude: coords.latitude, longitude: coords.longitude, status: "draft", moderation_state: "pending_review" }).select("id").single(); if (error || !task) { setSaving(false); setNotice(error?.message || "Unable to submit the task."); return; } try { const attachmentRows = await Promise.all(files.map(async (file) => { const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const upload = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error; return { task_id: task.id, uploaded_by: session.user.id, storage_path: path, file_name: file.name, mime_type: file.type }; })); if (attachmentRows.length) { const { error: attachmentError } = await supabase.from("task_attachments").insert(attachmentRows); if (attachmentError) throw attachmentError; } } catch (uploadError) { setSaving(false); setNotice(`Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`); return; } setSaving(false); onPosted(); };
  const previews = files.map((file) => URL.createObjectURL(file));
  return <div className="post-grid view"><form className="forge-card post-form-col" onSubmit={submit}><div className="forge-ribbon"><span>Submit to moderation</span></div><h2>Post a task people can discover.</h2><p className="form-intro">Posts are reviewed before they appear in the marketplace and on the map.</p><label className="field-group"><span className="field-label">Task title</span><input className="field-input" minLength={6} maxLength={140} required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-group"><span className="field-label">Description</span><textarea className="field-textarea" minLength={20} maxLength={5000} required value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="form-two"><label className="field-group"><span className="field-label">Category</span><select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>{["Cleaning", "Delivery", "Tutoring", "Design", "Errands", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-group"><span className="field-label">Commission (PHP)</span><input className="field-input" required value={commission} onChange={(event) => setCommission(event.target.value)} /></label></div><label className="field-group"><span className="field-label">General area</span><input className="field-input" required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Lahug, Cebu City" /></label><label className="upload-box photo-dropzone"><strong>Add reference photos</strong><small>Optional; up to 6 JPG, PNG, or WEBP images. Help applicants understand the work.</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} />{files.length > 0 && <b>{files.length} image{files.length === 1 ? "" : "s"} selected</b>}</label>{notice && <p className="setup-notice">{notice}</p>}<button className="post-submit" disabled={saving}>{saving ? "Submitting..." : "Submit for review"}</button></form><aside className="post-preview-col"><div className="post-preview-label">Task preview</div><TaskCard quest={{ id: "preview", category, title: title || "Your task title", description: description || "Your task details will appear here.", commission: commission ? `PHP ${commission}` : "Commission", location: location || "Your general area", schedule: "After moderation review", posterName: profile?.full_name || "You", initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(), images: previews }} /></aside></div>;
}

function LegacyPostTaskRealV2({ session, profile, onPosted }: { session: Session | null; profile: MemberProfile | null; onPosted: () => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [location, setLocation] = useState(""); const [commission, setCommission] = useState(""); const [category, setCategory] = useState("Cleaning"); const [customCategory, setCustomCategory] = useState(""); const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  const previewImages = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => { previewImages.forEach((url) => URL.revokeObjectURL(url)); }, [previewImages]);
  const selectFiles = (list: FileList | null) => { const next = Array.from(list || []).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 4 * 1024 * 1024).slice(0, 6); setFiles(next); if (next.length !== (list?.length || 0)) setNotice("Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB."); };
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!session) return; const amount = Number(commission.replace(/[^0-9.]/g, "")); const custom = customCategory.trim().replace(/\s+/g, " "); if (!Number.isFinite(amount) || amount <= 0) { setNotice("Enter a valid commission amount."); return; } if (category === "Other" && custom.length < 2) { setNotice("Describe the type of task for Other (at least 2 characters)."); return; } setSaving(true); setNotice(""); const coords = await new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => { if (!navigator.geolocation) return resolve({ latitude: null, longitude: null }); navigator.geolocation.getCurrentPosition(({ coords: current }) => resolve({ latitude: current.latitude, longitude: current.longitude }), () => resolve({ latitude: null, longitude: null }), { timeout: 7000, maximumAge: 60000 }); }); const { data: categoryRow } = await supabase.from("categories").select("id").ilike("name", category).limit(1).maybeSingle(); const fullDescription = category === "Other" ? `Task type: ${custom}\n\n${description.trim()}` : description.trim(); const { data: task, error } = await supabase.from("tasks").insert({ posted_by: session.user.id, category_id: categoryRow?.id || null, title: title.trim(), description: fullDescription, commission_amount: amount, currency: "PHP", is_service_swap: false, location_label: location.trim(), latitude: coords.latitude, longitude: coords.longitude, status: "draft", moderation_state: "pending_review" }).select("id").single(); if (error || !task) { setSaving(false); setNotice(error?.message || "Unable to submit the task."); return; } try { const attachmentRows = await Promise.all(files.map(async (file) => { const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const upload = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error; return { task_id: task.id, uploaded_by: session.user.id, storage_path: path, file_name: file.name, mime_type: file.type }; })); if (attachmentRows.length) { const { error: attachmentError } = await supabase.from("task_attachments").insert(attachmentRows); if (attachmentError) throw attachmentError; } } catch (uploadError) { setSaving(false); setNotice(`Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`); return; } setSaving(false); onPosted(); };
  const previewCategory = category === "Other" && customCategory.trim() ? customCategory.trim() : category;
  return <div className="post-grid view"><form className="forge-card post-form-col" onSubmit={submit}><div className="forge-ribbon"><span>Submit to moderation</span></div><h2>Post a task people can discover.</h2><p className="form-intro">Choose the closest category. Posts are reviewed before they appear in the marketplace and map.</p><label className="field-group"><span className="field-label">Task title</span><input className="field-input" minLength={6} maxLength={140} required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-group"><span className="field-label">Description</span><textarea className="field-textarea" minLength={20} maxLength={5000} required value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="form-two"><label className="field-group"><span className="field-label">Category</span><select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>{taskCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-group"><span className="field-label">Commission (PHP)</span><input className="field-input" required value={commission} onChange={(event) => setCommission(event.target.value)} /></label></div>{category === "Other" && <label className="field-group"><span className="field-label">What kind of task is this?</span><input className="field-input" required minLength={2} maxLength={60} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Example: Furniture assembly or language interpretation" /></label>}<label className="field-group"><span className="field-label">General area</span><input className="field-input" required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Lahug, Cebu City" /></label><label className="upload-box photo-dropzone"><strong>Add reference photos</strong><small>Optional; up to 6 JPG, PNG, or WEBP images. Help applicants understand the work.</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} />{files.length > 0 && <b>{files.length} image{files.length === 1 ? "" : "s"} selected</b>}</label>{notice && <p className="setup-notice">{notice}</p>}<button className="post-submit" disabled={saving}>{saving ? "Submitting..." : "Submit for review"}</button></form><aside className="post-preview-col"><div className="post-preview-label">Task preview</div><TaskCard quest={{ id: "preview", category: previewCategory, title: title || "Your task title", description: description || "Your task details will appear here.", commission: commission ? `PHP ${commission}` : "Commission", location: location || "Your general area", schedule: "After moderation review", posterName: profile?.full_name || "You", initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(), images: previewImages }} /></aside></div>;
}

function PostTaskReal({ session, profile, onPosted }: { session: Session | null; profile: MemberProfile | null; onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [commission, setCommission] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [customCategory, setCustomCategory] = useState("");
  const [serviceSwap, setServiceSwap] = useState(false);
  const [swapDetails, setSwapDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const previewImages = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previewImages.forEach((url) => URL.revokeObjectURL(url)), [previewImages]);

  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || []).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 4 * 1024 * 1024).slice(0, 6);
    setFiles(next);
    setNotice(next.length !== (list?.length || 0) ? "Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB." : "");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const amount = Number(commission.replace(/[^0-9.]/g, ""));
    const custom = customCategory.trim().replace(/\s+/g, " ");
    const swapText = swapDetails.trim();
    if (!serviceSwap && (!Number.isFinite(amount) || amount <= 0)) return setNotice("Enter a valid commission amount.");
    if (serviceSwap && (!Number.isFinite(amount) || amount <= 0)) return setNotice("Enter the estimated PHP value of the service swap.");
    if (serviceSwap && swapText.length < 5) return setNotice("Briefly describe the service you are offering in exchange.");
    if (category === "Other" && custom.length < 2) return setNotice("Describe the type of task for Other (at least 2 characters).");
    setSaving(true); setNotice("");
    const coords = await new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
      if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
      navigator.geolocation.getCurrentPosition(({ coords: current }) => resolve({ latitude: current.latitude, longitude: current.longitude }), () => resolve({ latitude: null, longitude: null }), { timeout: 7000, maximumAge: 60000 });
    });
    const { data: categoryRow } = await supabase.from("categories").select("id").ilike("name", category).limit(1).maybeSingle();
    const fullDescription = category === "Other" ? `Task type: ${custom}\n\n${description.trim()}` : description.trim();
    const { data: task, error } = await supabase.from("tasks").insert({
      posted_by: session.user.id, category_id: categoryRow?.id || null, title: title.trim(), description: fullDescription,
      commission_amount: amount, currency: "PHP", is_service_swap: serviceSwap,
      swap_details: serviceSwap ? `Service Swap Offer · PHP ${amount.toLocaleString()} — ${swapText}` : null,
      location_label: location.trim(), latitude: coords.latitude, longitude: coords.longitude, status: "draft", moderation_state: "pending_review",
    }).select("id").single();
    if (error || !task) { setSaving(false); setNotice(error?.message || "Unable to submit the task."); return; }
    try {
      const attachmentRows = await Promise.all(files.map(async (file) => {
        const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const upload = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        return { task_id: task.id, uploaded_by: session.user.id, storage_path: path, file_name: file.name, mime_type: file.type };
      }));
      if (attachmentRows.length) { const { error: attachmentError } = await supabase.from("task_attachments").insert(attachmentRows); if (attachmentError) throw attachmentError; }
    } catch (uploadError) {
      setSaving(false); setNotice(`Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`); return;
    }
    setSaving(false); onPosted();
  };

  const previewCategory = category === "Other" && customCategory.trim() ? customCategory.trim() : category;
  const previewCommission = serviceSwap ? `Service Swap Offer · PHP ${commission || "0"}` : commission ? `PHP ${commission}` : "Commission";
  return <div className="post-grid view"><form className="forge-card post-form-col" onSubmit={submit}>
    <div className="forge-ribbon"><span>Submit to moderation</span></div><h2>Post a task people can discover.</h2><p className="form-intro">Posts are reviewed before they appear in the marketplace and map.</p>
    <label className="field-group"><span className="field-label">Task title</span><input className="field-input" minLength={6} maxLength={140} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label className="field-group"><span className="field-label">Description</span><textarea className="field-textarea" minLength={20} maxLength={5000} required value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <div className="form-two"><label className="field-group"><span className="field-label">Category</span><select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>{taskCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-group"><span className="field-label">Estimated value (PHP)</span><input className="field-input" required value={commission} onChange={(event) => setCommission(event.target.value)} /></label></div>
    {category === "Other" && <label className="field-group"><span className="field-label">What kind of task is this?</span><input className="field-input" required minLength={2} maxLength={60} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Example: Furniture assembly or language interpretation" /></label>}
    <label className="service-swap-control"><input type="checkbox" checked={serviceSwap} onChange={(event) => setServiceSwap(event.target.checked)} /><span><strong>Offer a service swap</strong><small>Offer a service instead of cash. Add its estimated PHP value and description.</small></span></label>
    {serviceSwap && <label className="field-group"><span className="field-label">Service swap offer</span><input className="field-input" minLength={5} maxLength={300} value={swapDetails} onChange={(event) => setSwapDetails(event.target.value)} placeholder="Example: I can provide a two-hour website consultation." /></label>}
    <label className="field-group"><span className="field-label">General area</span><input className="field-input" required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Lahug, Cebu City" /></label>
    <label className="upload-box photo-dropzone"><strong>Add reference photos</strong><small>Optional; up to 6 JPG, PNG, or WEBP images. Help applicants understand the work.</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} />{files.length > 0 && <b>{files.length} image{files.length === 1 ? "" : "s"} selected</b>}</label>
    {notice && <p className="setup-notice">{notice}</p>}<button className="post-submit" disabled={saving}>{saving ? "Submitting..." : "Submit for review"}</button>
  </form><aside className="post-preview-col"><div className="post-preview-label">Task preview</div><TaskCard quest={{ id: "preview", category: previewCategory, title: title || "Your task title", description: description || "Your task details will appear here.", commission: previewCommission, location: location || "Your general area", schedule: "After moderation review", posterName: profile?.full_name || "You", initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(), kind: serviceSwap ? "swap" : undefined, images: previewImages }} /></aside></div>;
}

void PostTask;
void LegacyPostTaskRealV2;
void LegacyAppShell;
void LegacyPostTaskReal;
void LegacyFreshAccount;
void FreshChat;
void FreshTasks;

export default App;
