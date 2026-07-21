import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import "./staff.css";
import "./workflows.css";
import "./member-enhancements.css";
import "./task-workspace.css";
import "./chat.css";
import "./notifications.css";
import TaskCard, { TaskDetailModal, type Quest } from "./TaskCard";
import AuthScreen from "./AuthScreen";
import LandingPage from "./LandingPage";
import VerificationGate from "./VerificationGate";
import { supabase } from "./lib/supabase";

type Page =
  "home" | "tasks" | "post" | "chat" | "account" | "settings" | "staff";
type StaffRole = "moderator" | "admin";
type MemberProfile = {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string | null;
  city: string | null;
  skills: string[];
  trust_factor: number;
  completed_tasks_count: number;
  student_verified_at: string | null;
  professional_verified_at: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  terms_accepted_at: string | null;
  average_rating: number;
  rating_count: number;
};
type MarketplaceTask = {
  id: number;
  title: string;
  description: string;
  commission_amount: number | null;
  currency: string;
  is_service_swap: boolean;
  swap_details: string | null;
  requires_student_verification: boolean;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
  published_at: string | null;
  created_at: string;
  category: { name: string } | null;
  poster: any;
};

function MemberProgress({ profile }: { profile: MemberProfile }) {
  const trust = Math.min(100, Math.max(0, Number(profile.trust_factor || 0)));
  return (
    <section className="member-progress panel">
      <div>
        <span className="eyebrow">Your progress</span>
        <h3>Build a reliable member record</h3>
      </div>
      <div className="member-progress-track">
        <span style={{ width: `${trust}%` }} />
      </div>
      <div className="member-progress-stats">
        <span>
          <b>{trust}</b> Trust Factor
        </span>
        <span>
          <b>{profile.completed_tasks_count || 0}</b> completed
        </span>
        <span>
          <b>{profile.rating_count || 0}</b> reviews
        </span>
      </div>
    </section>
  );
}

const quests: Quest[] = [
  {
    id: 1,
    category: "General",
    title: "Deep clean 2-bedroom apartment",
    description:
      "Looking for someone to do a thorough deep clean before guests arrive. Cleaning supplies provided.",
    commission: "Trade: Web design",
    location: "Lahug · 1.8 km",
    schedule: "Sat, 1:00 PM",
    posterName: "Robert B.",
    trust: "TF 77 · Gold Client",
    matchPercent: 94,
    kind: "swap",
    initials: "RB",
    tone: "rare",
  },
  {
    id: 2,
    category: "Academic",
    title: "Statistics tutor for finals review",
    description:
      "Need help reviewing hypothesis testing and regression before finals week. Two-hour sessions preferred.",
    commission: "₱450 / session",
    location: "IT Park · 0.9 km",
    schedule: "Video pitch requested",
    posterName: "Mika J.",
    trust: "Verified Student",
    matchPercent: 84,
    kind: "student",
    initials: "MJ",
    tone: "uncommon",
  },
  {
    id: 3,
    category: "General",
    title: "Grocery run + delivery, Ayala Center",
    description:
      "Pick up a grocery list and deliver it to Banilad by the evening. Budget covers items and fee.",
    commission: "₱300",
    location: "Banilad · 3.2 km",
    schedule: "Today, 6:00 PM",
    posterName: "Cara D.",
    trust: "TF 54",
    matchPercent: 69,
    initials: "CD",
    tone: "urgent",
  },
];

const questImages: Record<string, string> = {
  1: "/task-cleaning.png",
  2: "/task-tutoring.png",
  3: "/task-grocery.png",
};

const nav: { id: Page; label: string; icon: any }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "chat", label: "Chat", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
  { id: "account", label: "Account", icon: "◉" },
];

const taskCategories = [
  "Cleaning",
  "Home repairs",
  "Moving help",
  "Delivery",
  "Errands",
  "Grocery & shopping",
  "Tutoring",
  "Academic support",
  "Design",
  "Photography",
  "Video & editing",
  "Writing & translation",
  "Technology help",
  "Web & app help",
  "Social media",
  "Events",
  "Beauty & wellness",
  "Pet care",
  "Child care",
  "Elderly support",
  "Gardening",
  "Vehicle help",
  "Food & catering",
  "Fitness & coaching",
  "Music & lessons",
  "Other",
];

const staffNav = [
  { label: "Overview", icon: "◈" },
  { label: "Review queue", icon: "✓" },
  { label: "Reports", icon: "⚑" },
  { label: "Audit log", icon: "◫" },
];

void staffNav;

function LegacyAppShell({
  session,
  onExit,
  staffRole,
  profile,
}: {
  session: Session | null;
  onExit: () => void;
  staffRole: StaffRole | null;
  profile: MemberProfile | null;
}) {
  const displayName =
    profile?.full_name ||
    (session && typeof session.user.user_metadata.full_name === "string"
      ? session.user.user_metadata.full_name
      : "Demo Member");
  const accountInitial = displayName[0]?.toUpperCase() || "M";
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem('questkarte-active-page');
    return (saved as Page) || (staffRole ? "staff" : "home");
  });
  useEffect(() => {
    if (page) localStorage.setItem('questkarte-active-page', page);
  }, [page]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Recommended");
  const [saved, setSaved] = useState<Array<number | string>>([]);
  const [applied, setApplied] = useState<Array<number | string>>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    "Hi Susan! I can do the grocery run this afternoon.",
    "Great, can you be at Ayala by 4 PM?",
  ]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [staffTab, setStaffTab] = useState<StaffTab>(
    staffRole === "admin" ? "overview" : "task_review",
  );
  const roleNav: { id: StaffTab; label: string; icon: string }[] =
    staffRole === "admin"
      ? [
          { id: "overview", label: "Overview", icon: "◈" },
          { id: "members", label: "Members", icon: "◉" },
          { id: "moderators", label: "Moderators", icon: "♜" },
          { id: "categories", label: "Categories", icon: "◇" },
          { id: "audit", label: "Audit log", icon: "◫" },
        ]
      : [
          { id: "task_review", label: "Task review", icon: "✓" },
          { id: "verification", label: "Verification", icon: "◇" },
          { id: "reports", label: "Reports", icon: "⚑" },
          { id: "disputes", label: "Disputes", icon: "◉" },
        ];

  useEffect(() => {
    setStaffTab(staffRole === "admin" ? "overview" : "task_review");
  }, [staffRole]);

  const filteredQuests = useMemo(
    () =>
      quests.filter((quest) =>
        `${quest.title} ${quest.category} ${quest.location}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const apply = (id: number | string) => {
    if (applied.includes(id)) return;
    setApplied([...applied, id]);
    announce("Application sent — the client has been notified.");
  };
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages([...messages, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="app-shell">
      <div className="aurora" />
      <div className="stars" />
      <aside
        className="icon-rail"
        aria-label={staffRole ? "Staff navigation" : "Primary navigation"}
      >
        <button
          className="rail-brand"
          onClick={() => setPage(staffRole ? "staff" : "home")}
          aria-label="Go to QuestKarte dashboard"
        >
          <Brand markOnly />
          <span>
            <strong>QuestKarte</strong>
            <small>{staffRole ? "Staff workspace" : "Task marketplace"}</small>
          </span>
        </button>
        {staffRole ? (
          <>
            <div className="staff-rail-label">{staffRole}</div>
            {roleNav.map((item) => (
              <button
                className={`rail-item ${page === "staff" && staffTab === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => {
                  setPage("staff");
                  setStaffTab(item.id);
                }}
              >
                <span>{item.icon}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </>
        ) : (
          <>
            {nav.slice(0, 2).map((item) => (
              <RailItem
                key={item.id}
                item={item}
                active={page === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
            <button
              className="rail-post"
              onClick={() => setPage("post")}
              aria-label="Post a task"
            >
              +
            </button>
            {nav.slice(2).map((item) => (
              <RailItem
                key={item.id}
                item={item}
                active={page === item.id}
                onClick={() => setPage(item.id)}
              />
            ))}
          </>
        )}
        <div className="rail-spacer" />
        <button className="rail-item" onClick={() => setPage("settings")}>
          <span>⚙</span>
          <small>Settings</small>
        </button>
      </aside>
      <main className="shell-main">
        <header className="topbar">
          <Brand />
          <label className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks or skills..."
              aria-label="Search tasks"
            />
          </label>
          {session && <NotificationBell userId={session.user.id} />}
          <button
            className="account-btn lvl-ring"
            onClick={() => setPage("account")}
            aria-label="Open account"
          >
            <span className="avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                accountInitial
              )}
            </span>
            <span className="lvl-badge-tag">
              <span className="in">{session ? "1" : "12"}</span>
            </span>
          </button>
        </header>
        <section className="page-title-row">
          <div className="eyebrow">QuestKarte marketplace</div>
          <h1>{titleFor(page)}</h1>
          <p className="sub">{subtitleFor(page)}</p>
        </section>
        <section className="main-row">
          {page === "home" &&
            (session ? (
              <FreshHome
                profile={profile}
                onPost={() => setPage("post")}
                onAccount={() => setPage("account")}
                query={query}
              />
            ) : (
              <Home
                tab={tab}
                setTab={setTab}
                quests={filteredQuests}
                saved={saved}
                applied={applied}
                onSave={(id) =>
                  setSaved(
                    saved.includes(id)
                      ? saved.filter((savedId) => savedId !== id)
                      : [...saved, id],
                  )
                }
                onApply={apply}
                onPost={() => setPage("post")}
              />
            ))}
          {page === "tasks" &&
            (session ? (
              <>
                <TaskWorkspace
                  session={session}
                  onGoPost={() => setPage("post")}
                />
                <TaskApplicationInbox session={session} />
                <TaskDeliveryAndSafety session={session} />
                <CompletedTaskReviews session={session} />
              </>
            ) : (
              <Tasks onGoPost={() => setPage("post")} applied={applied} />
            ))}
          {page === "post" && (
            <PostTaskReal
              session={session}
              profile={profile}
              onPosted={() => {
                announce("Your task was submitted for moderator review.");
                setPage("tasks");
              }}
            />
          )}
          {page === "chat" &&
            (session ? (
              <FreshChatReal session={session} />
            ) : (
              <Chat
                open={chatOpen}
                setOpen={setChatOpen}
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                onSend={sendMessage}
              />
            ))}
          {page === "account" &&
            (session ? (
              <FreshAccount
                profile={profile}
                email={session.user.email || ""}
                session={session}
                onExit={onExit}
              />
            ) : (
              <Account
                displayName={displayName}
                isDemo={!session}
                onExit={onExit}
                onEdit={() =>
                  announce(
                    "Profile editing will save to Supabase once it is connected.",
                  )
                }
              />
            ))}
          {page === "settings" && (
            <SettingsPage
              email={session?.user.email || "Demo account"}
              onAccount={() => setPage("account")}
              onExit={onExit}
              isDemo={!session}
            />
          )}
          {page === "staff" && (
            <StaffDashboard
              role={staffRole || "moderator"}
              session={session}
              onExit={onExit}
              activeTab={staffTab}
              onTabChange={setStaffTab}
            />
          )}
        </section>
        <div className="scroll-spacer" />
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.slice(0, 2).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={page === item.id}
            onClick={() => setPage(item.id)}
          />
        ))}
        <button
          className="nav-post"
          onClick={() => setPage("post")}
          aria-label="Post a task"
        >
          +
        </button>
        {nav.slice(2).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={page === item.id}
            onClick={() => setPage(item.id)}
          />
        ))}
      </nav>
      {!staffRole && (
        <MemberGuide onNavigate={(destination) => setPage(destination)} />
      )}
      {toast && (
        <div className="toast" role="status">
          ✦ {toast}
        </div>
      )}
    </div>
  );
}

function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera capture.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current
            .play()
            .catch(() => setError("Unable to start the camera preview."));
        }
      })
      .catch(() =>
        setError(
          "Camera permission was not granted. Allow camera access or choose a saved file.",
        ),
      );
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is still starting. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Unable to capture the photo.");
          return;
        }
        onCapture(
          new File([blob], `questkarte-camera-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div
      className="camera-capture-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Take profile photo"
    >
      <section className="camera-capture-modal">
        <header>
          <div>
            <span className="eyebrow">Camera capture</span>
            <h2>Take a profile photo</h2>
          </div>
          <button
            type="button"
            className="member-profile-close"
            onClick={onClose}
            aria-label="Close camera"
          >
            ×
          </button>
        </header>
        {error ? (
          <p className="setup-notice">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className="camera-capture-video"
            autoPlay
            muted
            playsInline
          />
        )}
        <div className="camera-capture-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={Boolean(error)}
              onClick={capture}
            >
              Take photo
            </button>
          </div>
        </section>
      </div>
    );
  }

function CameraInputBridge() {
  const [targetInput, setTargetInput] = useState<HTMLInputElement | null>(null);
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const directInput = target?.closest?.(
        'input[type="file"][capture="user"]',
      ) as HTMLInputElement | null;
      const labelInput = target
        ?.closest?.("label")
        ?.querySelector(
          'input[type="file"][capture="user"]',
        ) as HTMLInputElement | null;
      const input = directInput || labelInput;
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      setTargetInput(input);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, []);
  const complete = (file: File) => {
    if (!targetInput) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    targetInput.files = transfer.files;
    targetInput.dispatchEvent(new Event("change", { bubbles: true }));
    setTargetInput(null);
  };
  return targetInput ? (
    <CameraCapture onCapture={complete} onClose={() => setTargetInput(null)} />
  ) : null;
}

function AppShell({
  session,
  onExit,
  staffRole,
  profile,
}: {
  session: Session | null;
  onExit: () => void;
  staffRole: StaffRole | null;
  profile: MemberProfile | null;
}) {
  const isGuest = !session && !staffRole;
  const displayName =
    profile?.full_name ||
    (session && typeof session.user.user_metadata.full_name === "string"
      ? session.user.user_metadata.full_name
      : "Member");
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem('questkarte-active-page');
    return (saved as Page) || (staffRole ? "staff" : "home");
  });
  useEffect(() => {
    if (page) localStorage.setItem('questkarte-active-page', page);
  }, [page]);
  const [staffTab, setStaffTab] = useState<StaffTab>(
    staffRole === "admin" ? "overview" : "task_review",
  );
  const [query, setQuery] = useState("");
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('last_read_at, conversations:conversations!inner(updated_at)')
        .eq('user_id', session.user.id);
      if (!data) return;
      let count = 0;
      for (const row of data) {
        const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations as any;
        if (conv?.updated_at && (!row.last_read_at || new Date(conv.updated_at) > new Date(row.last_read_at))) count++;
      }
      setUnreadChatCount(count);
    };
    void fetchUnread();
    const t = window.setInterval(() => void fetchUnread(), 15000);
    return () => window.clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);


  
  useEffect(() => {
    const handleNav = () => setPage("tasks");
    window.addEventListener('navigate-tasks', handleNav);
    return () => window.removeEventListener('navigate-tasks', handleNav);
  }, []);
  const accountInitial = displayName[0]?.toUpperCase() || "M";

  const memberNav = (
    <>
      {nav.slice(0, 2).map((item) => (
        <RailItem
          key={item.id}
          item={item}
          active={page === item.id}
          onClick={() => setPage(item.id)}
        />
      ))}
      <button
        className="rail-post"
        onClick={() => setPage("post")}
        aria-label="Post a task"
      >
        +
      </button>
      {nav.slice(2).map((item) => (
        <RailItem
          key={item.id}
          item={item}
          active={page === item.id}
          onClick={() => { setPage(item.id); }}
          badge={item.id === 'chat' ? unreadChatCount : 0}
        />
      ))}
    </>
  );
  return (
    <div className={`app-shell ${isGuest ? "guest-shell" : ""}`}>
      <div className="aurora" />
      <div className="stars" />
      <aside
        className="icon-rail"
        aria-label={
          staffRole
            ? "Staff navigation"
            : isGuest
              ? "Guest navigation"
              : "Primary navigation"
        }
      >
        <button
          className="rail-brand"
          onClick={() => setPage(staffRole ? "staff" : "home")}
          aria-label="Go to QuestKarte dashboard"
        >
          <Brand markOnly />
          <span>
            <strong>QuestKarte</strong>
            <small>{staffRole ? "Staff workspace" : "Task marketplace"}</small>
          </span>
        </button>
        {staffRole ? (
          <>
            <div className="staff-rail-label">{staffRole}</div>
            <button
              className="rail-item active"
              onClick={() => setPage("staff")}
            >
              <span>◈</span>
              <small>Workspace</small>
            </button>
          </>
        ) : isGuest ? (
          <>
            <div className="guest-rail-label">Guest view</div>
            <RailItem item={nav[0]} active onClick={() => setPage("home")} />
            <p className="guest-rail-note">
              Browse published tasks and the map. Sign in to post, apply, chat,
              or manage an account.
            </p>
          </>
        ) : (
          memberNav
        )}
        <div className="rail-spacer" />
        {!isGuest && !staffRole && (
          <button className="rail-item" onClick={() => setPage("settings")}>
            <span>⚙</span>
            <small>Settings</small>
          </button>
        )}
      </aside>
      <main className="shell-main">
        <header className="topbar">
          <Brand />
          <label className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks or skills..."
              aria-label="Search tasks"
            />
          </label>
          {session && <NotificationBell userId={session.user.id} />}
          {isGuest ? (
            <button
              type="button"
              className="btn primary guest-join-button"
              onClick={onExit}
            >
              Sign in to join
            </button>
          ) : (
            !staffRole && (
              <button
                className="account-btn lvl-ring"
                onClick={() => setPage("account")}
                aria-label="Open account"
              >
                <span className="avatar">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    accountInitial
                  )}
                </span>
              </button>
            )
          )}
        </header>
        <section className="page-title-row">
          <div className="eyebrow">
            {isGuest ? "Guest marketplace" : "QuestKarte marketplace"}
          </div>
          <h1>{isGuest ? "Explore available tasks" : titleFor(page)}</h1>
          <p className="sub">
            {isGuest
              ? "Browse approved opportunities before creating a QuestKarte account."
              : subtitleFor(page)}
          </p>
        </section>
        <section className="main-row">
          {staffRole ? (
            <StaffDashboard
              role={staffRole}
              session={session}
              onExit={onExit}
              activeTab={staffTab}
              onTabChange={setStaffTab}
            />
          ) : isGuest ? (
            <GuestHome onJoin={onExit} />
          ) : page === "home" ? (
            <FreshHome
              profile={profile}
              onPost={() => setPage("post")}
              onAccount={() => setPage("account")}
              query={query}
            />
          ) : page === "tasks" && session ? (
            <>
              <TaskWorkspace
                session={session}
                onGoPost={() => setPage("post")}
                onOpenChat={(taskId) => {
                  setChatTaskId(taskId);
                  setPage("chat");
                }}
              />
              <TaskApplicationInbox session={session} />
              <TaskDeliveryAndSafety session={session} />
              <CompletedTaskReviews session={session} />
            </>
          ) : page === "post" ? (
            <PostTaskReal
              session={session}
              profile={profile}
              onPosted={() => setPage("tasks")}
            />
          ) : page === "chat" && session ? (
            <FreshChatReal session={session} initialTaskId={chatTaskId} />
          ) : page === "account" && session ? (
            <FreshAccount
              profile={profile}
              email={session.user.email || ""}
              session={session}
              onExit={onExit}
            />
          ) : page === "settings" ? (
            <SettingsPage
              email={session?.user.email || ""}
              onAccount={() => setPage("account")}
              onExit={onExit}
              isDemo={false}
            />
          ) : null}
        </section>
      </main>
      {!isGuest && !staffRole && (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {nav.slice(0, 2).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
          <button
            className="nav-post"
            onClick={() => setPage("post")}
            aria-label="Post a task"
          >
            +
          </button>
          {nav.slice(2).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>
      )}
      {session && !staffRole && (
        <MemberGuide onNavigate={(destination) => setPage(destination)} />
      )}
      {!staffRole && <CameraInputBridge />}
        <HelpSafetyWidget isGuest={!session} />
    </div>
  );
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        setPasswordRecovery(event === "PASSWORD_RECOVERY");
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, terms_accepted_at, average_rating, rating_count",
      )
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as MemberProfile | null);
        setProfileLoading(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      setStaffRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "moderator"])
      .then(({ data }) => {
        const roles = (data || []).map((row) => row.role);
        setStaffRole(
          roles.includes("admin")
            ? "admin"
            : roles.includes("moderator")
              ? "moderator"
              : null,
        );
        setRoleLoading(false);
      });
  }, [session]);

  useEffect(() => {
    if (
      !session ||
      !profile ||
      staffPreview ||
      staffRole ||
      profile.verification_status !== "verified"
    )
      return;
    const key = `questkarte:verification-welcome:${session.user.id}`;
    if (localStorage.getItem(key) !== "seen") setShowVerificationWelcome(true);
  }, [session, profile, staffPreview, staffRole]);

  if (loading)
    return (
      <div className="app-boot">
        <img src="/questkarte-logo.svg" alt="" />
        <span>Preparing your quest board…</span>
      </div>
    );
  if (!session && showLanding)
    return (
      <LandingPage
        onStart={() => setShowLanding(false)}
        onBrowse={() => {
          setShowLanding(false);
          setDemoMode(true);
        }}
      />
    );
  if (!session && !demoMode)
    return (
      <AuthScreen onExplore={() => setDemoMode(true)} onBack={() => setShowLanding(true)} />
    );
  if (session && passwordRecovery)
    return <PasswordRecovery onDone={() => setPasswordRecovery(false)} />;
  if (session && profileLoading)
    return (
      <div className="app-boot">
        <img src="/questkarte-logo.svg" alt="" />
        <span>Loading your member profile…</span>
      </div>
    );
  if (session && roleLoading)
    return (
      <div className="app-boot">
        <span>Loading your workspace...</span>
      </div>
    );
  if (
    session &&
    !staffPreview &&
    !staffRole &&
    profile?.verification_status !== "verified"
  )
    return (
      <VerificationGate
        session={session}
        status={profile?.verification_status || "unverified"}
        termsAcceptedAt={profile?.terms_accepted_at || null}
        onSignOut={() => { setDemoMode(true); void supabase.auth.signOut(); }}
      />
    );
  if (session && showVerificationWelcome && !staffPreview && !staffRole)
    return (
      <VerificationApprovedScreen
        name={profile?.full_name || "Member"}
        onEnter={() => {
          localStorage.setItem(
            `questkarte:verification-welcome:${session.user.id}`,
            "seen",
          );
          setShowVerificationWelcome(false);
        }}
        onLanding={() => {
          localStorage.setItem(
            `questkarte:verification-welcome:${session.user.id}`,
            "seen",
          );
          void supabase.auth.signOut();
          setShowLanding(true);
        }}
      />
    );
  if (session && !profile?.bio && !staffPreview && !staffRole)
    return (
      <ProfileSetup
        session={session}
        initialName={
          typeof session.user.user_metadata.full_name === "string"
            ? session.user.user_metadata.full_name
            : ""
        }
        onComplete={setProfile}
      />
    );
  return (
    <AppShell
      session={session}
      profile={profile}
      staffRole={staffPreview || staffRole}
      onExit={() => {
        if (session) void supabase.auth.signOut();
        setStaffPreview(null);
        setDemoMode(false);
        setShowLanding(true);
      }}
    />
  );
}

function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setNotice("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setNotice("Your password confirmation does not match.");
      return;
    }
    setSaving(true);
    setNotice("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Password updated. You can continue securely.");
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <img src="/questkarte-logo.svg" alt="QuestKarte emblem" />
          <div>
            <span>QuestKarte</span>
            <small>Secure account recovery</small>
          </div>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">Password reset</p>
          <h1>Choose a new password</h1>
          <p>This secure screen is available only from your recovery link.</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
          <button className="auth-submit" disabled={saving}>
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
        <button className="auth-link-button" type="button" onClick={onDone}>
          Return to QuestKarte
        </button>
      </section>
    </main>
  );
}

function VerificationApprovedScreen({
  name,
  onEnter,
  onLanding,
}: {
  name: string;
  onEnter: () => void;
  onLanding: () => void;
}) {
  return (
    <main className="verification-approved-page">
      <section className="verification-approved-card">
        <img src="/questkarte-logo.svg" alt="QuestKarte" />
        <span className="eyebrow">Verification complete</span>
        <h1>You are verified, {name}.</h1>
        <p>
          Your account is ready for the QuestKarte marketplace. You can now
          complete your profile, post a task, apply to approved work, and build
          your member record.
        </p>
        <div className="verification-approved-actions">
          <button type="button" className="btn primary" onClick={onEnter}>
            Continue to my workspace
          </button>
          <button type="button" className="btn" onClick={onLanding}>
            Return to website landing page
          </button>
        </div>
      </section>
    </main>
  );
}

function LegacyProfileSetup({
  session,
  initialName,
  onComplete,
}: {
  session: Session;
  initialName: string;
  onComplete: (profile: MemberProfile) => void;
}) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Cebu City");
  const [skills, setSkills] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const skillOptions = [
    "Cleaning",
    "Delivery",
    "Tutoring",
    "Design",
    "Errands",
    "Pet care",
    "Tech help",
    "Writing",
  ];
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 900000) {
      setNotice("Please use a photo smaller than 900 KB for now.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addCustomSkill = () => {
    const skill = customSkill.trim().replace(/\s+/g, " ");
    if (!skill) return;
    if (skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setCustomSkill("");
      return;
    }
    setSkills([...skills, skill].slice(0, 12));
    setCustomSkill("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        skills,
        avatar_url: avatar,
      })
      .eq("id", session.user.id)
      .select(
        "id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count",
      )
      .single();
    setSaving(false);
    if (error || !data) {
      setNotice(
        error?.message || "Your profile could not be saved. Please try again.",
      );
      return;
    }
    onComplete(data as MemberProfile);
  };
  return (
    <main className="profile-setup-page">
      <section className="profile-setup-card">
        <div className="setup-brand">
          <img src="/questkarte-logo.svg" alt="QuestKarte" />
          <div>
            <strong>QuestKarte</strong>
            <span>Member profile setup</span>
          </div>
        </div>
        <div className="setup-heading">
          <span className="eyebrow">Step 1 of 1</span>
          <h1>Make your profile easy to trust.</h1>
          <p>
            Members can see your photo, your short introduction, and the
            services you are confident offering.
          </p>
        </div>
        <form className="profile-setup-form" onSubmit={submit}>
          <div className="avatar-picker">
            <label className="avatar-upload">
              {avatar ? (
                <img src={avatar} alt="Profile preview" />
              ) : (
                <span>{name[0]?.toUpperCase() || "?"}</span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => choosePhoto(event.target.files?.[0])}
              />
            </label>
            <div>
              <strong>Profile photo</strong>
              <p>Optional, but it helps members recognize you.</p>
              <label className="upload-photo-link">
                Choose photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => choosePhoto(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>
          <label>
            <span>Display name</span>
            <input
              value={name}
              required
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              placeholder="How should members know you?"
            />
          </label>
          <label>
            <span>About you</span>
            <textarea
              value={bio}
              required
              minLength={10}
              maxLength={500}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Example: Reliable student helper available for tutoring, errands, and basic design work."
            />
          </label>
          <label>
            <span>City / service area</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cebu City"
            />
          </label>
          <div>
            <span className="setup-label">Services and strengths</span>
            <div className="skill-choices">
              {Array.from(new Set([...skillOptions, ...skills])).map((skill) => (
                <button
                  type="button"
                  key={skill}
                  className={skills.includes(skill) ? "selected" : ""}
                  onClick={() =>
                    setSkills(
                      skills.includes(skill)
                        ? skills.filter((item) => item !== skill)
                        : [...skills, skill],
                    )
                  }
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="custom-skill">
              <input
                value={customSkill}
                maxLength={40}
                onChange={(event) => setCustomSkill(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomSkill();
                  }
                }}
                placeholder="Add another strength, e.g. Video editing"
              />
              <button type="button" onClick={addCustomSkill}>
                Add
              </button>
            </div>
          </div>
          {notice && <p className="setup-notice">{notice}</p>}
          <button className="setup-submit" disabled={saving}>
            {saving ? "Saving profile…" : "Finish profile setup →"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProfileSetup({
  session,
  initialName,
  onComplete,
}: {
  session: Session;
  initialName: string;
  onComplete: (profile: MemberProfile) => void;
}) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Cebu City");
  const [skills, setSkills] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [notice, setNotice] = useState("");
  const skillOptions = [
    "Cleaning",
    "Delivery",
    "Tutoring",
    "Design",
    "Errands",
    "Pet care",
    "Tech help",
    "Writing",
  ];
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 900000) {
      setNotice("Please use a photo smaller than 900 KB for now.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addSkill = () => {
    const value = customSkill.trim().replace(/\s+/g, " ");
    if (
      !value ||
      skills.some((skill) => skill.toLowerCase() === value.toLowerCase())
    )
      return setCustomSkill("");
    setSkills((current) => [...current, value].slice(0, 12));
    setCustomSkill("");
  };
  const toggleSkill = (skill: string) =>
    setSkills((current) =>
      current.includes(skill)
        ? current.filter((item) => item !== skill)
        : [...current, skill],
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        skills,
        avatar_url: avatar,
      })
      .eq("id", session.user.id)
      .select(
        "id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count",
      )
      .single();
    setSaving(false);
    if (error || !data)
      return setNotice(
        error?.message || "Your profile could not be saved. Please try again.",
      );
    onComplete(data as MemberProfile);
  };
  return (
    <main className="profile-setup-page">
      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            choosePhoto(file);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      <section className="profile-setup-card">
        <div className="setup-brand">
          <img src="/questkarte-logo.svg" alt="QuestKarte" />
          <div>
            <strong>QuestKarte</strong>
            <span>Member profile setup</span>
          </div>
        </div>
        <div className="setup-heading">
          <span className="eyebrow">Step 1 of 1</span>
          <h1>Make your profile easy to trust.</h1>
          <p>
            Choose a photo, introduce yourself, and add the services you can
            confidently offer.
          </p>
        </div>
        <form className="profile-setup-form" onSubmit={submit}>
          <div className="avatar-picker">
            <div className="avatar-upload" aria-label="Profile photo">
              {avatar ? (
                <img src={avatar} alt="Profile preview" />
              ) : (
                <span>{name[0]?.toUpperCase() || "?"}</span>
              )}
            </div>
            <div>
              <strong>Profile photo</strong>
              <p>Use your camera now or select a saved image.</p>
              <div className="profile-photo-actions">
                <button
                  type="button"
                  className="upload-photo-link"
                  onClick={() => setShowCamera(true)}
                >
                  Use camera
                </button>
                <label className="upload-photo-link">
                  Choose file
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => choosePhoto(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </div>
          <label>
            <span>Display name</span>
            <input
              value={name}
              required
              minLength={2}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>About you</span>
            <textarea
              value={bio}
              required
              minLength={10}
              maxLength={500}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell members what you do well and how you work."
            />
          </label>
          <label>
            <span>City / service area</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <div>
            <span className="setup-label">Services and strengths</span>
            <div className="skill-choices">
              {Array.from(new Set([...skillOptions, ...skills])).map((skill) => (
                <button
                  type="button"
                  key={skill}
                  className={skills.includes(skill) ? "selected" : ""}
                  onClick={() => toggleSkill(skill)}
                  style={skills.includes(skill) ? { display: 'flex', alignItems: 'center', gap: '6px' } : {}}
                >
                  {skill}
                  {skills.includes(skill) && <span style={{ fontSize: '14px', lineHeight: 1, marginTop: '-2px', opacity: 0.7 }}>&times;</span>}
                </button>
              ))}
            </div>
            <div className="custom-skill" style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                value={customSkill}
                maxLength={40}
                onChange={(event) => setCustomSkill(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add another strength"
                style={{ paddingRight: "30px", flex: 1 }}
              />
              {customSkill && (
                <button
                  type="button"
                  onClick={() => setCustomSkill("")}
                  style={{
                    position: "absolute",
                    right: "80px",
                    background: "transparent",
                    border: "none",
                    fontSize: "18px",
                    color: "#999",
                    cursor: "pointer",
                    padding: "0 8px",
                    height: "100%",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title="Clear"
                >
                  &times;
                </button>
              )}
              <button type="button" onClick={addSkill} style={{ marginLeft: "8px" }}>
                Add
              </button>
            </div>
          </div>
          {notice && <p className="setup-notice">{notice}</p>}
          <button className="setup-submit" disabled={saving}>
            {saving ? "Saving profile…" : "Finish profile setup →"}
          </button>
        </form>
      </section>
    </main>
  );
}

void LegacyProfileSetup;
void MarketplaceFeed;

function FreshHome({
  profile: providedProfile,
  onPost,
  onAccount,
  query,
}: {
  profile: MemberProfile | null;
  onPost: () => void;
  onAccount: () => void;
  query: string;
}) {
  const profile = providedProfile ?? ({} as MemberProfile);
  const name = profile.full_name || "Member";
  const initial = name[0]?.toUpperCase() || "M";

  return (
    <div className="fresh-home view home-dashboard">
      <section className="member-welcome">
        <div>
          <span className="eyebrow">Your QuestKarte workspace</span>
          <h2>Welcome, {name}.</h2>
          <p>
            Browse live tasks from other members, publish your own request, and
            build a trusted record through completed work.
          </p>
          <div className="welcome-actions">
            <button type="button" className="btn primary" onClick={onPost}>
              + Post a task
            </button>
            <button type="button" className="btn" onClick={onAccount}>
              View your profile
            </button>
          </div>
        </div>
        <div className="welcome-member">
          <span className="avatar">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              initial
            )}
          </span>
          <div>
            <strong>Member workspace</strong>
            <small>Trust Factor {profile.trust_factor || 0} · Level 1</small>
          </div>
        </div>
      </section>
      <div className="home-dashboard-grid">
        <section className="marketplace-column">
          <MarketplaceFeedLive onPost={onPost} query={query} />
        </section>
        <aside className="home-side-column">
          <MemberProgress profile={profile} />
          <FreshDiscovery profile={profile} />
        </aside>
      </div>
    </div>
  );
}

function MarketplaceFeed({ onPost }: { onPost: () => void }) {
  const [tasks, setTasks] = useState<MarketplaceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at,created_at,category:categories(name),poster:profiles!tasks_posted_by_fkey(full_name,trust_factor,avatar_url)",
      )
      .eq("status", "open")
      .order("published_at", { ascending: false });
    if (error) setErrorMessage(error.message);
    else {
      setErrorMessage("");
      setTasks((data || []) as unknown as MarketplaceTask[]);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="real-task-feed">
      <div className="section-head">
        <div>
          <span className="eyebrow">Live marketplace</span>
          <h2>Open tasks from members</h2>
        </div>
        <button type="button" className="btn primary" onClick={onPost}>
          Post a task
        </button>
      </div>
      {loading ? (
        <div className="panel feed-message">Loading published tasks…</div>
      ) : errorMessage ? (
        <div className="panel feed-message feed-error">
          Could not load tasks: {errorMessage}
        </div>
      ) : tasks.length ? (
        <div className="real-task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              quest={{
                id: task.id,
                category: task.category?.name || "General",
                title: task.title,
                description: task.description,
                commission: task.is_service_swap
                  ? task.swap_details || "Service swap"
                  : `${task.currency === "PHP" ? "₱" : ""}${Number(task.commission_amount || 0).toLocaleString()}`,
                location: task.location_label,
                schedule: task.published_at
                  ? `Posted ${new Date(task.published_at).toLocaleDateString()}`
                  : "Posted recently",
                posterName: (Array.isArray(task.poster) ? task.poster[0] : task.poster)?.full_name || "QuestKarte member",
                trust: `Trust Factor ${(Array.isArray(task.poster) ? task.poster[0] : task.poster)?.trust_factor || 0}`,
                kind: task.is_service_swap
                  ? "swap"
                  : task.requires_student_verification
                    ? "student"
                    : undefined,
                avatarUrl: (Array.isArray(task.poster) ? task.poster[0] : task.poster)?.avatar_url,
                initials: ((Array.isArray(task.poster) ? task.poster[0] : task.poster)?.full_name || "M")
                  .slice(0, 2)
                  .toUpperCase(),
              }}
            />
          ))}
        </div>
      ) : (
        <div className="panel feed-message">
          <strong>No published tasks yet.</strong>
          <span>Be the first member to post a task for the marketplace.</span>
        </div>
      )}
    </section>
  );
}

function GuestHome({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="fresh-home guest-home view">
      <section className="member-welcome guest-welcome">
        <div>
          <span className="eyebrow">Guest marketplace preview</span>
          <h2>Explore work around Cebu City.</h2>
          <p>
            You can browse approved tasks, task details, photos, and the map.
            Create an account when you are ready to post, apply, chat, and build
            your member record.
          </p>
          <div className="welcome-actions">
            <button type="button" className="btn primary" onClick={onJoin}>
              Create or sign in
            </button>
          </div>
        </div>
        <div className="welcome-member guest-member">
          <span aria-hidden="true">◎</span>
          <div>
            <strong>Viewing as guest</strong>
            <small>Read-only marketplace access</small>
          </div>
        </div>
      </section>
      <MarketplaceFeedGuest onJoin={onJoin} />
      <FreshDiscovery profile={null} guest />
    </div>
  );
}

type SharedMarketplaceTask = {
  id: string;
  posted_by: string;
  category_id: string | null;
  title: string;
  description: string;
  commission_amount: number | null;
  currency: string;
  is_service_swap: boolean;
  swap_details: string | null;
  requires_student_verification: boolean;
  location_label: string;
  published_at: string | null;
  created_at: string;
  images: string[];
  categoryName: string;
  posterName: string;
  posterTrust: number;
  posterAvatar?: string;
};
type RawSharedTask = Omit<
  SharedMarketplaceTask,
  "images" | "categoryName" | "posterName" | "posterTrust"
>;

function MarketplaceFeedLive({
  onPost,
  query,
}: {
  onPost: () => void;
  query: string;
}) {
  const [tasks, setTasks] = useState<SharedMarketplaceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
    const [savedIds, setSavedIds] = useState<string[]>([]);
  const [applicationNotice, setApplicationNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [applicationTask, setApplicationTask] =
    useState<SharedMarketplaceTask | null>(null);
  const [profilePreviewId, setProfilePreviewId] = useState<string | null>(null);

  const toggleSave = async (taskId: string) => {
      if (!currentUserId) { setErrorMessage("Please sign in to save tasks"); return; }
      const isSaved = savedIds.includes(taskId);
      if (isSaved) {
        setSavedIds(prev => prev.filter(id => id !== taskId));
        await supabase.from('saved_tasks').delete().eq('user_id', currentUserId).eq('task_id', taskId);
      } else {
        setSavedIds(prev => [...prev, taskId]);
        await supabase.from('saved_tasks').insert({ user_id: currentUserId, task_id: taskId });
      }
    };
    const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select(
        "id,posted_by,category_id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at,created_at",
      )
      .eq("status", "open")
      .order("published_at", { ascending: false });
    if (taskError) {
      setErrorMessage(taskError.message);
      setLoading(false);
      return;
    }
    const rows = (taskData || []) as RawSharedTask[];
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      setCurrentUserId(authData.user.id);
      const { data: applications } = await supabase
        .from("applications")
        .select("task_id")
        .eq("applicant_id", authData.user.id);
      setAppliedIds(
          (applications || []).map((application) => application.task_id),
        );
        const { data: savedTasks } = await supabase.from('saved_tasks').select('task_id').eq('user_id', authData.user.id);
        setSavedIds((savedTasks || []).map(s => s.task_id));
      }
    const memberIds = [...new Set(rows.map((task) => task.posted_by))];
      const autoId = localStorage.getItem('questkarte-auto-apply');
      if (autoId) {
        const target = rows.find(x => x.id === autoId);
        if (target) {
          setApplicationTask(target as any);
          localStorage.removeItem('questkarte-auto-apply');
        }
      }
    const categoryIds = [
      ...new Set(
        rows
          .map((task) => task.category_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [
      { data: memberData, error: memberError },
      { data: categoryData, error: categoryError },
      { data: attachmentData, error: attachmentError },
    ] = await Promise.all([
      memberIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,trust_factor,avatar_url,skills")
            .in("id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      categoryIds.length
        ? supabase.from("categories").select("id,name").in("id", categoryIds)
        : Promise.resolve({ data: [], error: null }),
      rows.length
        ? supabase
            .from("task_attachments")
            .select("task_id,storage_path")
            .in(
              "task_id",
              rows.map((task) => task.id),
            )
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (memberError || categoryError || attachmentError) {
      setErrorMessage(
        memberError?.message ||
          categoryError?.message ||
          attachmentError?.message ||
          "The task details could not be loaded.",
      );
      setLoading(false);
      return;
    }
    const members = new Map(
      (memberData || []).map((member) => [member.id, member]),
    );
    const categories = new Map(
      (categoryData || []).map((category) => [category.id, category]),
    );
    const attachmentsByTask = new Map<string, string[]>();
    await Promise.all(
      (attachmentData || []).map(async (attachment) => {
        const { data } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl(attachment.storage_path, 3600);
        if (data?.signedUrl)
          attachmentsByTask.set(attachment.task_id, [
            ...(attachmentsByTask.get(attachment.task_id) || []),
            data.signedUrl,
          ]);
      }),
    );
    setTasks(
      rows.map((task) => ({
        ...task,
        images: attachmentsByTask.get(task.id) || [],
        categoryName: categories.get(task.category_id || "")?.name || "General",
        posterName:
          members.get(task.posted_by)?.full_name || "QuestKarte member",
        posterTrust: members.get(task.posted_by)?.trust_factor || 0,
        posterAvatar: members.get(task.posted_by)?.avatar_url,
      })),
    );
    setErrorMessage("");
    setLoading(false);
  };

  useEffect(() => {
    void load(true);
    const refreshTimer = window.setInterval(() => void load(false), 12000);
    const channel = supabase
      .channel("questkarte-open-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => void load(false),
      )
      .subscribe();
    return () => {
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const toQuest = (task: SharedMarketplaceTask) => ({
    id: task.id,
    category: task.categoryName,
    title: task.title,
    description: task.description,
    commission: task.is_service_swap
      ? task.swap_details || "Service swap"
      : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`,
    location: task.location_label,
    schedule: task.published_at
      ? `Posted ${new Date(task.published_at).toLocaleDateString()}`
      : "Posted recently",
    posterName: task.posterName,
    trust: `Trust Factor ${task.posterTrust}`,
    kind: task.is_service_swap
      ? ("swap" as const)
      : task.requires_student_verification
        ? ("student" as const)
        : undefined,
    avatarUrl: task.posterAvatar,
    initials: task.posterName.slice(0, 2).toUpperCase(),
    images: task.images,
  });
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = normalizedQuery
    ? tasks.filter((task) =>
        `${task.title} ${task.description} ${task.categoryName} ${task.posterName}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : tasks;
  if (applicationTask)
    return (
      <ApplicationWorkspace
        task={applicationTask}
        onBack={() => setApplicationTask(null)}
        onSent={() => {
          setAppliedIds((current) => [...current, applicationTask.id]);
          setApplicationNotice(
            "Application sent. The task poster can now review your message and optional work samples.",
          );
          setApplicationTask(null);
        }}
      />
    );
  return (
    <>
      <section className="real-task-feed">
        <div className="section-head">
          <div>
            <span className="eyebrow">Live marketplace</span>
            <h2>
              {normalizedQuery
                ? `Results for “${query.trim()}”`
                : "Open tasks from members"}
            </h2>
          </div>
          <div className="feed-actions">
            <button
              type="button"
              className="btn"
              onClick={() => void load(true)}
            >
              Refresh
            </button>
            <button type="button" className="btn primary" onClick={onPost}>
              Post a task
            </button>
          </div>
        </div>
        {applicationNotice && (
          <p className="staff-notice">{applicationNotice}</p>
        )}
        {loading ? (
          <div className="panel feed-message">Loading published tasks...</div>
        ) : errorMessage ? (
          <div className="panel feed-message feed-error">
            <strong>We could not load the marketplace.</strong>
            <span>{errorMessage}</span>
            <button
              type="button"
              className="btn"
              onClick={() => void load(true)}
            >
              Try again
            </button>
          </div>
        ) : visibleTasks.length ? (
          <div className="real-task-list">
            {[...visibleTasks].sort((a, b) => {
              const aSaved = savedIds.includes(a.id);
              const bSaved = savedIds.includes(b.id);
              if (aSaved && !bSaved) return -1;
              if (!aSaved && bSaved) return 1;
              return 0;
            }).map((task) => (
              <TaskCard
                key={task.id}
                quest={toQuest(task)}
                isOwner={task.posted_by === currentUserId}
                applied={appliedIds.includes(task.id)} saved={savedIds.includes(task.id)} onSave={() => toggleSave(task.id)}
                onProfileClick={() => setProfilePreviewId(task.posted_by)}
                onApply={
                  task.posted_by === currentUserId
                    ? undefined
                    : () => setApplicationTask(task)
                }
              />
            ))}
          </div>
        ) : (
          <div className="panel feed-message">
            <strong>
              {normalizedQuery ? `Tasks related to "${query}" are not available.` : "No published tasks yet."}
            </strong>
            <span>
              {normalizedQuery ? "Try a different task title, category, or skill." : "When any QuestKarte member publishes a task, it will appear here for everyone."}
            </span>
            {!normalizedQuery && (
              <button type="button" className="btn primary" onClick={onPost}>
                Post the first task
              </button>
            )}
          </div>
        )}
      </section>
      {profilePreviewId && (
        <MemberProfileModal
          memberId={profilePreviewId}
          onClose={() => setProfilePreviewId(null)}
        />
      )}
    </>
  );
}

function MemberProfileModal({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  type PublicProfile = Pick<
    MemberProfile,
    | "id"
    | "full_name"
    | "avatar_url"
    | "bio"
    | "city"
    | "skills"
    | "trust_factor"
    | "completed_tasks_count"
    | "verification_status"
    | "average_rating"
    | "rating_count"
  >;
  const [member, setMember] = useState<PublicProfile | null>(null);
  const [notice, setNotice] = useState("");
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const [isReporting, setIsReporting] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportSuccess, setReportSuccess] = useState(false);
    const submitReport = async () => {
      if (reportReason.length < 5) return setNotice("Reason must be at least 5 characters.");
      setNotice("");
      const { error } = await supabase.from("reports").insert({ reported_user_id: memberId, reason: reportReason });
      if (error) setNotice(error.message);
      else { setReportSuccess(true); setIsReporting(false); setReportReason(""); }
    };
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,avatar_url,bio,city,skills,trust_factor,completed_tasks_count,verification_status,average_rating,rating_count",
        )
        .eq("id", memberId)
        .maybeSingle();
      if (error || !data)
        setNotice(error?.message || "This member profile is unavailable.");
      else setMember(data as PublicProfile);
    })();
  }, [memberId]);
  const name = member?.full_name || "QuestKarte member";
  return (
    <div
      className="member-profile-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="member-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${name} profile`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="task-modal-close"
          onClick={onClose}
          aria-label="Close profile"
        >
          ×
        </button>
        {notice ? (
          <p className="setup-notice">{notice}</p>
        ) : !member ? (
          <p className="feed-message">Loading member profile...</p>
        ) : (
          <>
            <header className="member-profile-heading">
              <span className="avatar profile-large-avatar">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" onClick={() => setEnlargedImage(member.avatar_url)} style={{ cursor: "zoom-in" }} />
                ) : (
                  name.slice(0, 2).toUpperCase()
                )}
              </span>
              <div>
                <span className="eyebrow">QuestKarte member</span>
                <h2>{name}</h2>
                <p>
                  {member.verification_status === "verified"
                    ? "Verified member"
                    : "Member profile"}
                  {member.city ? ` · ${member.city}` : ""}
                </p>
              </div>
            </header>
            {member.bio && <p className="member-profile-bio">{member.bio}</p>}
            <div className="member-profile-stats">
              <div>
                <span>Trust Factor</span>
                <strong>{member.trust_factor || 0}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>{member.completed_tasks_count || 0}</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong>{Number(member.average_rating || 0).toFixed(1)}</strong>
                <small>{member.rating_count || 0} reviews</small>
              </div>
            </div>
            <div className="member-profile-skills">
              <strong>Services and strengths</strong>
              <div>
                {member.skills?.length ? (
                  member.skills.map((skill) => <span key={skill}>{skill}</span>)
                ) : (
                  <small>No services listed yet.</small>
                  )}
                </div>
              </div>
              {reportSuccess ? (
                <div style={{ marginTop: 20, padding: 15, background: "rgba(70,214,163,0.1)", color: "#159b78", borderRadius: 10, fontSize: 13 }}>Report submitted successfully. Our safety team will review it.</div>
              ) : isReporting ? (
                <div style={{ marginTop: 20, padding: 15, background: "#f7f9fe", border: "1px solid #dce4f1", borderRadius: 10 }}>
                  <h3 style={{ fontSize: 13, marginBottom: 8, color: "#a43f3f" }}>Report {name}</h3>
                  <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Please explain why you are reporting this member..." style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #cdd8ea", marginBottom: 10, fontSize: 13 }} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn" onClick={() => setIsReporting(false)}>Cancel</button>
                    <button className="btn primary" style={{ background: "#a43f3f", color: "#fff" }} onClick={submitReport}>Submit Report</button>
                  </div>
                </div>
              ) : (
                <button className="btn" onClick={() => setIsReporting(true)} style={{ marginTop: 20, color: "#a43f3f", border: "1px solid #e5bbbb", background: "#fff7f7", width: "100%" }}>Report Member</button>
              )}
            </>
          )}
        </section>
        {enlargedImage && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "grid", placeItems: "center", padding: "20px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)" }} onClick={() => setEnlargedImage(null)}>
            <img src={enlargedImage} alt="Enlarged view" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} />
          </div>
        )}
      </div>
    );
  }

function ApplicationWorkspace({
  task,
  onBack,
  onSent,
}: {
  task: SharedMarketplaceTask;
  onBack: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || [])
      .filter(
        (file) =>
          file.size <= 8 * 1024 * 1024 &&
          ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
            file.type,
          ),
      )
      .slice(0, 3);
    setFiles(next);
    if (next.length !== (list?.length || 0))
      setNotice(
        "Choose up to 3 JPG, PNG, WEBP, or PDF files, each no larger than 8 MB.",
      );
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 10) {
      setNotice(
        "Write a short message of at least 10 characters so the task poster understands your application.",
      );
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setNotice("Your session has ended. Please sign in again.");
      return;
    }
    setSaving(true);
    setNotice("");
    
    // Check if applicant already has an active task
    const { data: activeTasks } = await supabase.from('tasks').select('id').eq('assigned_to', auth.user.id).in('status', ['assigned', 'in_progress', 'pending_client_review', 'swap_in_progress', 'pending_swap_review']);
    if (activeTasks && activeTasks.length > 0) {
       setNotice("You must complete your current ongoing task before you can apply to another one.");
       setSaving(false);
       return;
    }
    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        task_id: task.id,
        applicant_id: auth.user.id,
        cover_note: message.trim(),
      })
      .select("id")
      .single();
    if (error || !application) {
      setSaving(false);
      setNotice(error?.message || "Your application could not be sent.");
      return;
    }
    try {
      const attachmentRows = await Promise.all(
        files.map(async (file) => {
          const path = `${auth.user.id}/${application.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const upload = await supabase.storage
            .from("application-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          return {
            application_id: application.id,
            uploaded_by: auth.user.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
          };
        }),
      );
      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase
          .from("application_attachments")
          .insert(attachmentRows);
        if (attachmentError) throw attachmentError;
      }
    } catch (uploadError) {
      setSaving(false);
      setNotice(
        `Your application was sent, but its optional attachments could not be saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`,
      );
      return;
    }
    setSaving(false);
    onSent();
  };
  return (
    <section className="application-workspace">
      <header className="application-workspace-head">
        <button type="button" className="btn" onClick={onBack}>
          ← Back to marketplace
        </button>
        <div>
          <span className="eyebrow">Application workspace</span>
          <h2>Apply with clarity</h2>
          <p>
            Your application is shared only with the member who posted this
            task.
          </p>
        </div>
      </header>
      <div className="application-workspace-grid">
        <form className="application-form panel" onSubmit={submit}>
          <div className="application-task-summary">
            <span className="badge cat-general">{task.categoryName}</span>
            <h3>{task.title}</h3>
            <p>
              {task.location_label} ·{" "}
              {task.is_service_swap
                ? task.swap_details || "Service swap"
                : `PHP ${Number(task.commission_amount || 0).toLocaleString()}`}
            </p>
          </div>
          <label>
            <span>Message to the task poster</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              placeholder="Briefly explain why you are a good fit, your availability, and how you will handle the task."
            />
          </label>
          <label className="application-upload">
            <strong>
              Attach a file or image <em>optional</em>
            </strong>
            <small>
              Share a work sample, portfolio image, or supporting document. Up
              to 3 files.
            </small>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => selectFiles(event.target.files)}
            />
            {files.length > 0 && (
              <ul>
                {files.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </label>
          {notice && <p className="setup-notice">{notice}</p>}
          <button className="post-submit" disabled={saving}>
            {saving ? "Sending application..." : "Send application"}
          </button>
        </form>
        <aside className="application-expectations panel">
          <span className="eyebrow">Before you send</span>
          <h3>Make a strong first impression</h3>
          <ul>
            <li>State when you are available.</li>
            <li>
              Describe the skill or experience most relevant to this task.
            </li>
            <li>Only share files that help the task poster decide.</li>
          </ul>
          <p>
            Sending an application does not create a chat yet. The task poster
            must accept one applicant first.
          </p>
        </aside>
      </div>
    </section>
  );
}

function MarketplaceFeedGuest({ onJoin }: { onJoin: () => void }) {
  type GuestTask = {
    id: string;
    posted_by: string;
    category_id: string | null;
    title: string;
    description: string;
    commission_amount: number | null;
    currency: string;
    is_service_swap: boolean;
    swap_details: string | null;
    requires_student_verification: boolean;
    location_label: string;
    published_at: string | null;
  };
  const [tasks, setTasks] = useState<GuestTask[]>([]);
  const [categories, setCategories] = useState(new Map<string, string>());
  const [members, setMembers] = useState(
    new Map<string, { full_name: string; trust_factor: number; avatar_url: string | null; skills?: string[] }>(),
  );
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,posted_by,category_id,title,description,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,location_label,published_at",
      )
      .eq("status", "open")
      .eq("moderation_state", "approved")
      .order("published_at", { ascending: false });
    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }
    const rows = (data || []) as GuestTask[];
    const memberIds = [...new Set(rows.map((task) => task.posted_by))];
    const categoryIds = [
      ...new Set(
        rows
          .map((task) => task.category_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [{ data: memberRows }, { data: categoryRows }] = await Promise.all([
      memberIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,trust_factor")
            .in("id", memberIds)
        : Promise.resolve({ data: [] }),
      categoryIds.length
        ? supabase.from("categories").select("id,name").in("id", categoryIds)
        : Promise.resolve({ data: [] }),
    ]);
    setMembers(
      new Map((memberRows || []).map((member) => [member.id, member as any])),
    );
    setCategories(
      new Map(
        (categoryRows || []).map((category) => [category.id, category.name]),
      ),
    );
    setTasks(rows);
    setNotice("");
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="real-task-feed guest-feed">
      <div className="section-head">
        <div>
          <span className="eyebrow">Guest marketplace</span>
          <h2>Open tasks from members</h2>
        </div>
        <div className="feed-actions">
          <button type="button" className="btn" onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" className="btn primary" onClick={onJoin}>
            Sign in to participate
          </button>
        </div>
      </div>
      {notice && <p className="staff-notice">{notice}</p>}
      {loading ? (
        <div className="panel feed-message">Loading approved tasks...</div>
      ) : tasks.length ? (
        <div className="real-task-list">
          {tasks.map((task) => {
            const member = members.get(task.posted_by);
            return (
              <TaskCard
                key={task.id}
                quest={{
                  id: task.id,
                  category: categories.get(task.category_id || "") || "General",
                  title: task.title,
                  description: task.description,
                  commission: task.is_service_swap
                    ? task.swap_details || "Service swap"
                    : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`,
                  location: task.location_label,
                  schedule: task.published_at
                    ? `Posted ${new Date(task.published_at).toLocaleDateString()}`
                    : "Posted recently",
                  posterName: member?.full_name || "QuestKarte member",
                  trust: `Trust Factor ${member?.trust_factor || 0}`,
                  kind: task.is_service_swap
                    ? "swap"
                    : task.requires_student_verification
                      ? "student"
                      : undefined,
                  avatarUrl: member?.avatar_url,
                initials: (member?.full_name || "M")
                    .slice(0, 2)
                    .toUpperCase(),
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="panel feed-message">
          <strong>No approved tasks yet.</strong>
          <span>
            New approved tasks will appear here when members publish them.
          </span>
        </div>
      )}
      <p className="guest-feed-note">
        Guests can browse only. Sign in to save, apply, post, chat, or access an
        account.
      </p>
    </section>
  );
}

function FreshDiscovery({
  profile,
  guest = false,
}: {
  profile: MemberProfile | null;
  guest?: boolean;
}) {
  type MapTask = TaskMapPin;
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [mapTasks, setMapTasks] = useState<MapTask[]>([]);
  const [radius, setRadius] = useState(5000);
  const [radiusInput, setRadiusInput] = useState("5");
  const [locationQuery, setLocationQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [previewTask, setPreviewTask] = useState<MapTask | null>(null);
    const [fullMapOpen, setFullMapOpen] = useState(false);
  const locationEnabled =
    guest ||
    Object.keys(localStorage).some(
      (key) =>
        key.startsWith("questkarte:map-location:") &&
        localStorage.getItem(key) === "true",
    );
  const [status, setStatus] = useState(
    locationEnabled
      ? "Select Locate me to centre the map around you."
      : "Turn on Map location in Settings to use your location.",
  );
  const loadPins = async () => {
    const { data } = await supabase
      .from("tasks")
      .select(
        "id,posted_by,category_id,title,description,location_label,latitude,longitude,commission_amount,currency,is_service_swap,swap_details",
      )
      .eq("status", "open")
      .eq("moderation_state", "approved")
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    const rows = (data || []).filter(
      (task) => task.latitude !== null && task.longitude !== null,
    ) as Array<TaskMapPin & { posted_by: string; category_id: string | null }>;
    const profileIds = [...new Set(rows.map((task) => task.posted_by))];
    const categoryIds = [
      ...new Set(
        rows
          .map((task) => task.category_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [{ data: profiles }, { data: categories }, { data: attachments }] =
      await Promise.all([
        profileIds.length
          ? supabase
              .from("profiles")
              .select("id,full_name,trust_factor")
              .in("id", profileIds)
          : Promise.resolve({ data: [] }),
        categoryIds.length
          ? supabase.from("categories").select("id,name").in("id", categoryIds)
          : Promise.resolve({ data: [] }),
        rows.length
          ? supabase
              .from("task_attachments")
              .select("task_id,storage_path")
              .in(
                "task_id",
                rows.map((task) => task.id),
              )
              .order("created_at")
          : Promise.resolve({ data: [] }),
      ]);
    const profilesById = new Map(
      (profiles || []).map((item) => [item.id, item]),
    );
    const categoriesById = new Map(
      (categories || []).map((item) => [item.id, item]),
    );
    const imagesByTask = new Map<string, string[]>();
    await Promise.all(
      (attachments || []).map(async (attachment) => {
        const { data: signed } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl(attachment.storage_path, 3600);
        if (signed?.signedUrl)
          imagesByTask.set(attachment.task_id, [
            ...(imagesByTask.get(attachment.task_id) || []),
            signed.signedUrl,
          ]);
      }),
    );
    setMapTasks(
      rows.map((task) => ({
        ...task,
        categoryName:
          categoriesById.get(task.category_id || "")?.name || "General",
        posterName:
          profilesById.get(task.posted_by)?.full_name || "QuestKarte member",
        posterTrust: profilesById.get(task.posted_by)?.trust_factor || 0,
        images: imagesByTask.get(task.id) || [],
      })),
    );
  };
  useEffect(() => {
    void loadPins();
    const channel = supabase
      .channel("questkarte-map-pins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => void loadPins(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
  const locate = () => {
    if (!locationEnabled) {
      setStatus("Map location is off. Turn it on in Settings first.");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("Location is not supported by this browser.");
      return;
    }
    setStatus("Requesting browser location permission...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setStatus(
          `Showing approved task pins within ${radius / 1000} km of your approximate location.`,
        );
      },
      () =>
        setStatus(
          "Location was not shared. You can still browse all available task pins.",
        ),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };
  const chooseLocation = async () => {
    const value = locationQuery.trim().toLowerCase();
    const matchingTasks = mapTasks.filter((task) =>
      `${task.title} ${task.description || ""} ${task.categoryName || ""} ${task.location_label}`
        .toLowerCase()
        .includes(value),
    );
    if (value && matchingTasks.length) {
      setTaskFilter(value);
      setPosition([matchingTasks[0].latitude, matchingTasks[0].longitude]);
      setStatus(`Showing ${matchingTasks.length} approved task${matchingTasks.length === 1 ? "" : "s"} matching “${locationQuery.trim()}”.`);
      return;
    }
    const coordinateMatch = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinateMatch) {
      setTaskFilter("");
      setPosition([Number(coordinateMatch[1]), Number(coordinateMatch[2])]);
      setStatus("Showing approved tasks around the coordinates you entered.");
      return;
    }
    
    if (!value) {
      setTaskFilter("");
      setStatus("Enter a location or task type to search.");
      return;
    }

    try {
      setStatus("Searching for location...");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'QuestKarte/1.0' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        setTaskFilter("");
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setStatus(`Showing approved tasks around ${data[0].display_name.split(',')[0]}.`);
      } else {
        setTaskFilter("");
        setStatus("Location not found. Try a different city or neighborhood.");
      }
    } catch (e) {
      setTaskFilter("");
      setStatus("Network error while searching for location.");
    }
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
    setStatus(
      `Showing approved task pins within ${kilometres} km of the selected area.`,
    );
  };
  const chooseRadiusPreset = (kilometres: number) => {
    setRadius(kilometres * 1000);
    setRadiusInput(String(kilometres));
    setStatus(
      `Showing approved task pins within ${kilometres} km of the selected area.`,
    );
  };
  const visibleTasks = mapTasks.filter((task) => {
    const inRadius =
      !position ||
      (() => {
        const dx = (task.latitude - position[0]) * 111000;
        const dy =
          (task.longitude - position[1]) *
          111000 *
          Math.cos((position[0] * Math.PI) / 180);
        return Math.hypot(dx, dy) <= radius;
      })();
    const matchesTask =
      !taskFilter ||
      `${task.title} ${task.description || ""} ${task.categoryName || ""} ${task.location_label}`
        .toLowerCase()
        .includes(taskFilter);
    return inRadius && matchesTask;
  });
  const name = profile?.full_name || "Member";
  const radiusControl = (compact = false) => (
    <div className={compact ? "map-radius map-radius-compact" : "map-radius"}>
      <label>
        {compact ? "Within" : "Radius"}
        <input
          type="number"
          min="1"
          max="50"
          step="0.5"
          inputMode="decimal"
          value={radiusInput}
          onChange={(event) => setRadiusInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyRadius();
          }}
          aria-label="Search radius in kilometres"
        />{" "}
        km
      </label>
      <button type="button" className="map-radius-set" onClick={applyRadius}>
        Set radius
      </button>
      {!compact &&
        [2, 5, 10].map((value) => (
          <button
            type="button"
            className={radius === value * 1000 ? "active" : ""}
            onClick={() => chooseRadiusPreset(value)}
            key={value}
          >
            {value} km
          </button>
        ))}
    </div>
  );
  
    return (
      <>
        {previewTask && (
          <div className="task-modal-backdrop" role="presentation" onMouseDown={() => setPreviewTask(null)} style={{ zIndex: 99999 }}>
            <section className="task-modal elite-glass" style={{ padding: '40px', maxWidth: '550px', background: '#0B132B' }} role="dialog" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" className="task-modal-close" onClick={() => setPreviewTask(null)}>✕</button>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                <span className="badge cat-general" style={{ background: 'rgba(28, 146, 134, 0.2)', color: '#46d6a3', padding: '6px 12px', borderRadius: '12px' }}>{previewTask.categoryName || 'General'}</span>
                <span style={{ color: '#879cbd', fontSize: '13px' }}>📍 {previewTask.location_label}</span>
              </div>
              
              <h2 style={{ marginBottom: '15px', fontSize: '24px', color: '#fff' }}>{previewTask.title}</h2>
              <div style={{ color: '#e4bd42', marginBottom: '24px', fontWeight: 'bold', fontSize: '20px' }}>
                {previewTask.is_service_swap ? previewTask.swap_details : `${previewTask.currency} ${previewTask.commission_amount || 0}`}
              </div>
              
              <p style={{ color: '#a5b7d6', lineHeight: 1.6, marginBottom: '40px', fontSize: '15px' }}>{previewTask.description}</p>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                {(!profile || guest) ? (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#fff' }}>Join QuestKarte to unlock this task!</h3>
                    <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#879cbd' }}>Sign in to safely apply, message the poster, and get paid.</p>
                    <button className="btn primary" style={{ width: '100%', background: 'linear-gradient(135deg, #1C9286, #159b78)', padding: '14px', border: 'none', borderRadius: '24px', color: 'white', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 10px 20px rgba(28,146,134,0.3)' }} onClick={() => { setPreviewTask(null); window.scrollTo(0,0); }}>Sign In / Create Account</button>
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#fff' }}>Apply for this task</h3>
                    <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#879cbd' }}>Click below to apply and message the poster.</p>
                    <button className="btn primary" style={{ width: '100%', background: 'linear-gradient(135deg, #1C9286, #159b78)', padding: '14px', border: 'none', borderRadius: '24px', color: 'white', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 10px 20px rgba(28,146,134,0.3)' }} onClick={() => { 
                      setPreviewTask(null);
                      // Trigger a custom event to navigate and open the task
                      localStorage.setItem('questkarte-auto-apply', previewTask.id); window.dispatchEvent(new CustomEvent('navigate-tasks'));
                    }}>Proceed to Application</button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
        <section className="fresh-discovery">
        <section className="panel map-panel">
          <div className="panel-title-row">
            <div>
              <h3>Nearby opportunities</h3>
              <p>{status}</p>
            </div>
            <div className="map-header-actions">
              <button
                type="button"
                className="map-expand"
                onClick={() => setFullMapOpen(true)}
                aria-label="Open full map"
              >
                ⛶
              </button>
              <button
                type="button"
                className="map-locate"
                onClick={locate}
                disabled={!locationEnabled}
              >
                ⌖ Locate me
              </button>
            </div>
          </div>
          <div className="map-search-row">
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") chooseLocation();
              }}
              placeholder="Search Cebu area or enter latitude, longitude"
              aria-label="Map location"
            />
            <button type="button" onClick={chooseLocation}>
              Show area
            </button>
          </div>
          {radiusControl()}
          <TaskMap position={position} radius={radius} tasks={visibleTasks as unknown as TaskMapPin[]} onApply={(id) => {
                const pt = visibleTasks.find((t: any) => t.id === id);
                if (pt) setPreviewTask(pt as any);
              }} />
        </section>
        <section className="panel fresh-trust">
          <div className="snapshot-heading">
            <div>
              <h3>Member trust snapshot</h3>
              <p>Your reliability as a task poster and service provider.</p>
            </div>
            <span className="snapshot-level">
              {profile?.verification_status === "verified"
                ? "Verified"
                : "New member"}
            </span>
          </div>
          <div className="profile-mini">
            <span className="avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                name[0]?.toUpperCase()
              )}
            </span>
            <div>
              <div className="profile-name">{name}</div>
              <div className="profile-role">
                {profile?.verification_status === "verified"
                  ? "Verified member"
                  : "Complete verification to build trust"}
              </div>
            </div>
          </div>
          <div className="snapshot-stats">
            <div className="snapshot-stat">
              <span>Trust Factor</span>
              <strong>{profile?.trust_factor || 0}</strong>
              <small>out of 100</small>
            </div>
            <div className="snapshot-stat">
              <span>Rating</span>
              <strong>{profile?.average_rating?.toFixed(1) || "0.0"}</strong>
              <small>{profile?.rating_count || 0} reviews</small>
            </div>
            <div className="snapshot-stat">
              <span>Completed</span>
              <strong>{profile?.completed_tasks_count || 0}</strong>
              <small>tasks</small>
            </div>
          </div>
        </section>
      </section>
      {fullMapOpen && (
        <section
          className="map-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Full marketplace map"
        >
          <div className="map-modal-card">
            <header>
              <div>
                <span className="eyebrow">QuestKarte map</span>
                <h2>Explore approved tasks</h2>
              </div>
              <button
                type="button"
                onClick={() => setFullMapOpen(false)}
                aria-label="Close full map"
              >
                ×
              </button>
            </header>
            <div className="map-modal-controls">
              <input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") chooseLocation();
                }}
                placeholder="Lahug, IT Park, Banilad, or latitude, longitude"
              />
              <button type="button" onClick={chooseLocation}>
                Search
              </button>
              {radiusControl(true)}
            </div>
            <TaskMap
                position={position}
                radius={radius}
                tasks={visibleTasks as unknown as TaskMapPin[]}
                full
                onApply={(id) => {
                const pt = visibleTasks.find((t: any) => t.id === id);
                if (pt) setPreviewTask(pt as any);
              }}
              />
            <p className="map-caption">
              Category markers: tutoring 📚 · cleaning 🧹 · delivery 🛵 · design
              ✦ · other ⚑. {visibleTasks.length} approved task pin
              {visibleTasks.length === 1 ? "" : "s"} in this area.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

type TaskMapPin = {
  id: string;
  title: string;
  description?: string;
  location_label: string;
  latitude: number;
  longitude: number;
  commission_amount: number | null;
  currency: string;
  is_service_swap: boolean;
  swap_details: string | null;
  categoryName?: string;
  posterName?: string;
  posterTrust?: number;
  images?: string[];
};
function groupedMarker(count: number) {
  return divIcon({
    className: "pulsing-marker-wrapper",
    html: `<span class="task-map-marker group elite-pulse" title="${count} tasks here">${count}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}
function taskMarker(task: TaskMapPin) {
  const label = task.title.toLowerCase();
  const [symbol, category] =
    label.includes("tutor") || label.includes("academic")
      ? ["📚", "study"]
      : label.includes("clean")
        ? ["🧹", "clean"]
        : label.includes("deliver") || label.includes("grocery")
          ? ["🛵", "delivery"]
          : label.includes("design") || label.includes("tech")
            ? ["✦", "design"]
            : ["⚑", "general"];
  return divIcon({
    className: "pulsing-marker-wrapper",
      html: `<span class="task-map-marker ${category} elite-pulse" title="${task.title.replace(/"/g, "&quot;")}">${symbol}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}
function GroupedTaskPopup({ group, onApply }: { group: TaskMapPin[], onApply?: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="grouped-task-popup">
      <MapTaskPreview task={group[index]} onApply={onApply ? () => onApply(group[index].id) : undefined} />
      <div className="grouped-task-nav">
        <button disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← Prev</button>
        <span>{index + 1} of {group.length}</span>
        <button disabled={index === group.length - 1} onClick={() => setIndex(i => i + 1)}>Next →</button>
      </div>
    </div>
  );
}

function MapTaskPreview({ task, onApply }: { task: TaskMapPin, onApply?: () => void }) {
  const reward = task.is_service_swap
    ? task.swap_details || "Service swap"
    : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`;
  return (
    <article className="map-task-preview elite-glass">
      <div className="map-task-preview-media">
        {task.images?.[0] ? (
          <img src={task.images[0]} alt="" />
        ) : (
          <span>{task.categoryName || "General"}</span>
        )}
      </div>
      <div className="map-task-preview-body">
        <span className="badge cat-general">
          {task.categoryName || "General"}
        </span>
        <h3>{task.title}</h3>
        <p>{task.description || "Open task available through QuestKarte."}</p>
        <div className="map-task-preview-meta">
          <span>⌖ {task.location_label}</span>
          <strong>{reward}</strong>
        </div>
        <small>
          Posted by {task.posterName || "QuestKarte member"} · Trust Factor{" "}
          {task.posterTrust || 0}
        </small>
          {onApply && (
            <button onClick={onApply} className="btn primary" style={{ width: '100%', marginTop: '12px', background: 'linear-gradient(135deg, #1C9286, #159b78)', border: 'none', boxShadow: '0 4px 15px rgba(28,146,134,0.4)', borderRadius: '12px' }}>Explore Task</button>
          )}
        </div>
      </article>
  );
}
function TaskMap({ position, radius, tasks, full = false, onApply }: { position: [number, number] | null; radius: number; tasks: TaskMapPin[]; full?: boolean; onApply?: (taskId: string) => void; }) {
  return (
    <div className={full ? "quest-map full" : "quest-map"}>
      <MapContainer
        center={position || [10.3157, 123.8854]}
        zoom={position ? 13 : 12}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapPanTo position={position} />
        {position && (
          <>
            <Circle
              center={position}
              radius={radius}
              pathOptions={{
                color: "#47A2F5",
                fillColor: "#47A2F5",
                fillOpacity: 0.08,
              }}
            />
            <CircleMarker
              center={position}
              radius={8}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#213BA3",
                fillOpacity: 1,
              }}
            >
              <Popup>Your selected area</Popup>
            </CircleMarker>
          </>
        )}
        {useMemo(() => {
          const groups: Record<string, TaskMapPin[]> = {};
          tasks.forEach((t) => {
            const key = `${t.latitude.toFixed(4)},${t.longitude.toFixed(4)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
          });
          return Object.values(groups);
        }, [tasks]).map((group) => {
          const first = group[0];
          return (
            <Marker
              key={first.id}
              position={[first.latitude, first.longitude]}
              icon={group.length > 1 ? groupedMarker(group.length) : taskMarker(first)}
            >
              <Popup className="quest-map-task-popup">
                {group.length > 1 ? (
                  <GroupedTaskPopup group={group} onApply={onApply} />
                ) : (
                  <MapTaskPreview task={first} onApply={onApply ? () => onApply(first.id) : undefined} />
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

type LifecycleTask = {
  id: string;
  title: string;
  status: string;
  moderation_state: string;
  assigned_to: string | null;
  created_at: string;
  commission_amount: number | null;
  is_service_swap: boolean;
  category: { name: string } | null;
  deadline_at: string | null;
  location_label: string;
  payment_type: string;
  payment_status: string;
  hidden_by_poster?: boolean;
  hidden_by_assignee?: boolean;
};

function TaskLifecycleCard({
  task,
  isApplicant,
  sessionUserId,
  reloadTasks,
}: {
  task: LifecycleTask;
  isApplicant: boolean;
  sessionUserId: string;
  reloadTasks: () => void;
}) {
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState(
    task.payment_type || "gcash",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (
      task.status === "in_progress" ||
      task.status === "pending_client_review" ||
      task.status === "completed"
    ) {
      void fetchDeliverables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.status]);

  const fetchDeliverables = async () => {
    const { data } = await supabase
      .from("task_deliverables")
      .select("*")
      .eq("task_id", task.id);
    if (data) setDeliverables(data);
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${task.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("task-deliverables")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("task_deliverables")
        .insert({
          task_id: task.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
        });
      if (insertError) throw insertError;

      await fetchDeliverables();
    } catch (err: any) {
      alert("Failed to upload proof: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleApplicantStart = async () => {
    setSubmitting(true);
    await supabase.rpc("update_task_progress", {
      target_task_id: task.id,
      next_status: "in_progress",
    });
    reloadTasks();
    setSubmitting(false);
  };

  const handleApplicantMarkDone = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("applicant_mark_done", {
      target_task_id: task.id,
    });
    if (error) alert("Error: " + error.message);
    else reloadTasks();
    setSubmitting(false);
  };

  const handleClientConfirm = async () => {
    if (!confirm("Are you sure you want to release the payment?")) return;
    setSubmitting(true);
    if (paymentChoice !== task.payment_type) {
      await supabase
        .from("tasks")
        .update({ payment_type: paymentChoice })
        .eq("id", task.id);
    }
    const { error } = await supabase.rpc("client_confirm_completion", {
      target_task_id: task.id,
    });
    if (error) alert("Error: " + error.message);
    else reloadTasks();
    setSubmitting(false);
  };

  const badgeClass =
    task.moderation_state === "pending_review"
      ? "pending-review"
      : task.moderation_state === "rejected"
        ? "disputed"
        : task.status === "pending_client_review"
          ? "pending-review"
          : task.status === "in_progress"
            ? "in-progress"
            : task.status;

  const badgeText =
    task.moderation_state === "pending_review"
      ? "Pending Review"
      : task.moderation_state === "rejected"
        ? "Needs Revision"
        : task.status === "pending_client_review"
          ? "Under Review"
          : task.status.replace("_", " ");

  const stage =
    task.status === "completed"
      ? 5
      : task.status === "pending_client_review"
        ? 4
        : task.status === "in_progress"
          ? 3
          : task.status === "assigned"
            ? 2
            : 1;

  return (
      <div className="task-lifecycle-card">
        {task.status === "completed" && (
          <div style={{ background: '#e1f5e8', padding: '10px 15px', color: '#159b78', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c2e6d1', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            <strong>Task successfully completed!</strong>
            <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: '#fff', border: '1px solid #159b78', color: '#159b78' }} onClick={() => {
              if(confirm('Remove this finished task from your view?')) {
                localStorage.setItem('dismissed-task-' + task.id, 'true');
                reloadTasks();
                const field = isApplicant ? 'hidden_by_assignee' : 'hidden_by_poster';
                supabase.from("tasks").update({ [field]: true }).eq("id", task.id).then(() => {
                  reloadTasks();
                });
              }
            }}>Clear from view</button>
          </div>
        )}
      <div className="tlc-header">
        <div className="tlc-header-left">
          <div className="tlc-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {task.title}
              {task.status === "completed" && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11, padding: '4px 8px', background: '#e1f5e8', color: '#159b78', border: '1px solid #c2e6d1', borderRadius: 12, display: 'inline-flex', alignItems: 'center' }}
                  onClick={() => {
                    if (window.confirm('Remove this finished task from your history?')) {
                      const field = isApplicant ? 'hidden_by_assignee' : 'hidden_by_poster';
                      supabase.from("tasks").update({ [field]: true }).eq("id", task.id).then(() => {
                        window.location.reload();
                      });
                    }
                  }}
                >
                  Clear History
                </button>
              )}
            </div>
          <div className="tlc-meta">
            <span className="tlc-category">
              {task.category?.name || "Task"}
            </span>
            <span className="tlc-reward">
              {task.is_service_swap
                ? "Service Swap"
                : `₱${task.commission_amount || 0}`}
            </span>
            <span>Posted {new Date(task.created_at).toLocaleDateString()}</span>
            {task.deadline_at && (
              <span>
                Deadline: {new Date(task.deadline_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className={`tlc-status-badge ${badgeClass}`}>{badgeText}</div>
      </div>
      <div className="tlc-body">
        <div className="task-timeline">
          <div
            className={`tl-step ${stage >= 1 ? "done" : ""} ${stage === 1 ? "current" : ""}`}
          >
            <div className="tl-dot">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="tl-label">
              <strong>Posted</strong>
              <small>Approved</small>
            </div>
          </div>
          <div
            className={`tl-step ${stage >= 2 ? "done" : ""} ${stage === 2 ? "current" : ""}`}
          >
            <div className="tl-dot">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="tl-label">
              <strong>Assigned</strong>
              <small>Selected</small>
            </div>
          </div>
          <div
            className={`tl-step ${stage >= 3 ? "done" : ""} ${stage === 3 ? "current" : ""}`}
          >
            <div className="tl-dot">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="tl-label">
              <strong>In Progress</strong>
              <small>Working</small>
            </div>
          </div>
          <div
            className={`tl-step ${stage >= 4 ? "done" : ""} ${stage === 4 ? "current" : ""}`}
          >
            <div className="tl-dot">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="tl-label">
              <strong>Under Review</strong>
              <small>Verify Proof</small>
            </div>
          </div>
          <div
            className={`tl-step ${stage >= 5 ? "done" : ""} ${stage === 5 ? "current" : ""}`}
          >
            <div className="tl-dot">
              <svg viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="tl-label">
              <strong>Completed</strong>
              <small>Paid</small>
            </div>
          </div>
        </div>

        {stage >= 3 && (
          <div className="tlc-proof-section">
            <span className="tlc-proof-label">Proof of Work</span>
            <div className="tlc-proof-grid">
              {deliverables.map((d) => (
                <div key={d.id} className="tlc-proof-thumb">
                  <img
                    src={
                      supabase.storage
                        .from("task-deliverables")
                        .getPublicUrl(d.storage_path).data.publicUrl
                    }
                    alt="Proof"
                  />
                </div>
              ))}

              {stage === 3 && isApplicant && task.assigned_to === sessionUserId && (
                <label
                  className="tlc-proof-empty"
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="file"
                    style={{ display: "none" }}
                    accept="image/*"
                    onChange={(e) => void handleUploadProof(e)}
                    disabled={uploading}
                  />
                  {uploading ? "Uploading..." : "+ Add Photo Proof"}
                </label>
              )}
              {deliverables.length === 0 &&
                stage >= 3 &&
                (!isApplicant || task.assigned_to !== sessionUserId) && (
                  <span className="tlc-proof-empty">
                    No proof uploaded yet
                  </span>
                )}
            </div>
          </div>
        )}

        {stage === 2 && isApplicant && task.assigned_to === sessionUserId && (
          <div className="tlc-actions">
            <button
              type="button"
              className="tlc-camera-btn"
              onClick={() => void handleApplicantStart()}
              disabled={submitting}
            >
              Start Task
            </button>
          </div>
        )}

        {stage === 3 && isApplicant && task.assigned_to === sessionUserId && (
          <div className="tlc-actions">
            {deliverables.length === 0 && (
              <div className="tlc-waiting">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>{" "}
                Please upload photo proof before completing
              </div>
            )}
            <button
              type="button"
              className="tlc-confirm-btn"
              onClick={() => void handleApplicantMarkDone()}
              disabled={submitting || deliverables.length === 0}
            >
              Mark as Completed
            </button>
          </div>
        )}

        {stage === 4 && !isApplicant && (
          <div
            className="tlc-actions"
            style={{ flexDirection: "column", alignItems: "stretch" }}
          >
            <h4 style={{ margin: 0, color: "#12255c" }}>
              Payment & Confirmation
            </h4>
            <div style={{ display: "flex", gap: "10px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`pay-${task.id}`}
                  value="gcash"
                  checked={paymentChoice === "gcash"}
                  onChange={() => setPaymentChoice("gcash")}
                />
                GCash (Secure Escrow)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`pay-${task.id}`}
                  value="cash"
                  checked={paymentChoice === "cash"}
                  onChange={() => setPaymentChoice("cash")}
                />
                Cash Meetup
              </label>
            </div>

            {paymentChoice === "cash" && (
              <div className="cash-meetup-card">
                <svg viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <div className="cash-meetup-body">
                  <strong>Strict Anti-Scam Warning</strong>
                  <p style={{ margin: 0, fontSize: "12px", color: "#8a6e17" }}>
                    Never send cash in advance. Meet in a safe, well-lit
                    public location. By proceeding, you agree to take full
                    responsibility for verifying the work in person before
                    paying.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              className="tlc-confirm-btn"
              onClick={() => void handleClientConfirm()}
              disabled={submitting}
            >
              Confirm & Release Payment
            </button>
          </div>
        )}

        {stage === 5 && (
          <div className="payment-receipt">
            <div className="payment-receipt-header">
              <svg
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <strong>Task Completed</strong>
                <span>
                  {task.payment_status === "released"
                    ? "Payment released"
                    : "Payment finalized"}
                </span>
              </div>
            </div>
            <div className="payment-receipt-body">
              <div className="receipt-row">
                <span>Payment Mode</span>
                <strong>{task.payment_type.toUpperCase()}</strong>
              </div>
              <div className="receipt-row receipt-amount-row">
                <span>Total</span>
                <strong>₱{task.commission_amount || 0}</strong>
              </div>
            </div>
            {task.payment_status === "released" && task.assigned_to === sessionUserId && (
              <div style={{ marginTop: 15, padding: 12, background: '#e1f5e8', borderRadius: 8, textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', color: '#159b78', fontWeight: 'bold' }}>Payment has been released by the client.</p>
                <button 
                  className="btn btn-primary" 
                  style={{ background: '#159b78', width: '100%' }}
                  onClick={() => {
                    if (window.confirm("Confirm you have received the payment?")) {
                      supabase.from("tasks").update({ status: "completed" }).eq("id", task.id).then(() => {
                         window.location.reload();
                      });
                    }
                  }}
                >
                  Confirm Payment Received
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FreshTasks({
  session,
  onGoPost,
}: {
  session: Session;
  onGoPost: () => void;
}) {
  const [tab, setTab] = useState<"posted" | "applied">(() => (localStorage.getItem('questkarte-tasks-tab') as any) || "posted");
    useEffect(() => { localStorage.setItem('questkarte-tasks-tab', tab); }, [tab]);
  const [posted, setPosted] = useState<LifecycleTask[]>([]);
  const [applied, setApplied] = useState<{ id: string; status: string; created_at: string; task: LifecycleTask | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [own, mine] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,moderation_state,assigned_to,created_at,commission_amount,is_service_swap,deadline_at,location_label,payment_type,payment_status,category:categories(name),hidden_by_poster,hidden_by_assignee")
        .eq("posted_by", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select(
          "id,status,created_at,task:tasks(id,title,status,moderation_state,assigned_to,created_at,commission_amount,is_service_swap,deadline_at,location_label,payment_type,payment_status,category:categories(name),hidden_by_poster,hidden_by_assignee)",
        )
        .eq("applicant_id", session.user.id)
          .neq("status", "rejected")
          .order("created_at", { ascending: false }),
    ]);
    setPosted((own.data || []) as unknown as typeof posted);
    setApplied((mine.data || []) as unknown as typeof applied);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  const entries = tab === "posted" ? posted : applied;

  return (
    <div className="fresh-tasks view">
      <section className="panel task-workspace-head">
        <div>
          <span className="eyebrow">Your task workspace</span>
          <h2>Manage work from one place.</h2>
          <p>
            Track requests you posted and services you applied for separately.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={onGoPost}>
          + Post a task
        </button>
      </section>
      <div className="staff-tabs task-tabs">
        <button
          type="button"
          className={tab === "posted" ? "active" : ""}
          onClick={() => setTab("posted")}
        >
          My posted tasks <span>{posted.length}</span>
        </button>
        <button
          type="button"
          className={tab === "applied" ? "active" : ""}
          onClick={() => setTab("applied")}
        >
          My applications <span>{applied.length}</span>
        </button>
      </div>
      {loading ? (
        <section className="panel feed-message">
          Loading your task workspace...
        </section>
      ) : entries.length ? (
        <section className="task-work-list">
          {tab === "posted" ? posted.filter(task => !task.hidden_by_poster && localStorage.getItem('dismissed-task-' + task.id) !== 'true').map((task) => (
                <TaskLifecycleCard
                  key={task.id}
                  task={task}
                  isApplicant={false}
                  sessionUserId={session.user.id}
                  reloadTasks={() => void load()}
                />
              ))
            : applied.filter(application => application.task && !application.task.hidden_by_assignee).map(
                  (application) =>
                    application.task && (
                    <TaskLifecycleCard
                      key={application.id}
                      task={application.task}
                      isApplicant={true}
                      sessionUserId={session.user.id}
                      reloadTasks={() => void load()}
                    />
                  ),
              )}
        </section>
      ) : (
        <div className="fresh-empty-view">
          <div className="empty-icon">□</div>
          <h2>
            {tab === "posted" ? "No posted tasks yet" : "No applications yet"}
          </h2>
          <p>
            {tab === "posted"
              ? "Create a clear request and submit it for review."
              : "Browse approved tasks and apply when your skills are a good fit."}
          </p>
          {tab === "posted" && (
            <button className="btn primary" onClick={onGoPost}>
              Post your first task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function FreshChat() {
  return (
    <div className="fresh-empty-view view">
      <div className="empty-icon">💬</div>
      <h2>No messages yet</h2>
      <p>
        Messages start when you apply to a task or someone applies to yours.
        Keep all task details inside QuestKarte.
      </p>
    </div>
  );
}

function FreshChatReal({
  session,
  initialTaskId = null,
}: {
  session: Session;
  initialTaskId?: string | null;
}) {
  type ChatTask = {
    id: string;
    title: string;
    status: string;
    commission_amount: number | null;
    deadline_at: string | null;
  };
  type ChatConversation = {
    id: string;
    task_id: string | null;
    task: ChatTask | null;
    otherId: string;
    otherName: string;
    otherAvatar: string | null;
    title: string | null;
  };
  type ChatMessage = {
    id: string;
    sender_id: string | null;
    body: string;
    attachment_url: string | null;
    attachment_type: string | null;

    created_at: string;
  };

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const load = async () => {
    const { data: membershipRows } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", session.user.id);
    const ids = (membershipRows || []).map((r) => r.conversation_id);
    if (!ids.length) {
      setConversations([]);
      return;
    }

    const [{ data: convRows }, { data: allMembers }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id,task_id,updated_at")
        .in("id", ids)
        .order("updated_at", { ascending: false }),
      supabase
        .from("conversation_members")
        .select("conversation_id,user_id")
        .in("conversation_id", ids),
    ]);

    const participantIds = [
      ...new Set(
        (allMembers || [])
          .map((r) => r.user_id)
          .filter((id) => id !== session.user.id),
      ),
    ];
    const taskIds = [
      ...new Set(
        (convRows || [])
          .map((r) => r.task_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [{ data: profiles }, { data: tasks }] = await Promise.all([
      participantIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,avatar_url")
            .in("id", participantIds)
        : Promise.resolve({ data: [] }),
      taskIds.length
        ? supabase
            .from("tasks")
            .select("id,title,status,commission_amount,deadline_at")
            .in("id", taskIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const taskMap = new Map((tasks || []).map((t) => [t.id, t]));

    setConversations(
      (convRows || []).map((c) => {
        const otherId =
          (allMembers || []).find(
            (m) => m.conversation_id === c.id && m.user_id !== session.user.id,
          )?.user_id || "";
        const otherProfile = profileMap.get(otherId);
        return {
          id: c.id,
          task_id: c.task_id,
          task: c.task_id ? taskMap.get(c.task_id) || null : null,
          otherId,
          otherName: otherProfile?.full_name || "QuestKarte member",
          otherAvatar: otherProfile?.avatar_url || null,
          title: c.task_id ? (taskMap.get(c.task_id)?.title || null) : null,
        };
      }),
    );
  };

  const loadMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id,sender_id,body,attachment_url,attachment_type,created_at")
      .eq("conversation_id", convId)
      .eq("hidden_by_moderation", false)
      .order("created_at");
    if (error) setNotice(error.message);
    else setMessages((data || []) as ChatMessage[]);

    // Mark as read
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .eq("user_id", session.user.id);
  };

  useEffect(() => {
    void load();
    // Message sync channel
    const msgChannel = supabase
      .channel(`questkarte-chat-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          if (selected) void loadMessages(selected);
          void load();
        },
      )
      .subscribe();

    // Presence channel
    const presenceChannel = supabase.channel("questkarte-presence");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlines = new Set<string>();
        for (const key in state) {
          state[key].forEach((p: any) => onlines.add(p.user_id));
        }
        setOnlineUsers(onlines);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED")
          await presenceChannel.track({ user_id: session.user.id });
      });

    return () => {
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(presenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id, selected]);

  useEffect(() => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const choose = (convId: string) => {
    setSelected(convId);
    void loadMessages(convId);
  };

  useEffect(() => {
    const target = initialTaskId
      ? conversations.find((c) => c.task_id === initialTaskId)
      : null;
    if (target && target.id !== selected) choose(target.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId, conversations, selected]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    // Use the RPC to send and trigger AI scanner
    const { error } = await supabase.rpc("send_message_safe", {
      p_conversation_id: selected,
      p_body: body,
      p_is_system: false,
    });
    if (error) setNotice(error.message);
    else void loadMessages(selected);
  };

  const uploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 20 * 1024 * 1024) { setNotice('File too large (max 20MB).'); return; }
    setNotice('Uploading...');
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type.includes('wordprocessingml') || file.type === 'application/msword';
    const attachType = isImage ? 'image' : 'document';
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${session.user.id}/${selected}/${crypto.randomUUID()}.${ext}__${safeName}`;
    const msgBody = isImage ? 'Sent a photo' : isPdf ? 'Sent a PDF' : isWord ? 'Sent a Word document' : `Sent: ${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setNotice('Upload failed: ' + uploadError.message);
      return;
    }
    const { error: dbErr } = await supabase.rpc('send_message_safe', {
      p_conversation_id: selected,
      p_body: msgBody,
      p_attachment_url: path,
      p_attachment_type: attachType,
      p_is_system: false,
    });
    setNotice(dbErr ? dbErr.message : '');
    if (!dbErr) void loadMessages(selected);
  };

  if (!conversations.length)
    return (
      <div className="fresh-empty-view view">
        <div className="empty-icon">💬</div>
        <h2>No active messages</h2>
        <p>
          When you accept an applicant or are hired for a task, a private chat
          will appear here.
        </p>
      </div>
    );

  const current = conversations.find((c) => c.id === selected);
  const isOnline = current ? onlineUsers.has(current.otherId) : false;

  return (
    <div className={`elite-chat-layout view ${selected ? 'has-open-thread' : ''}`}>
      {enlargedImage && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, display: "grid", placeItems: "center", padding: "20px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)" }} onClick={() => setEnlargedImage(null)}>
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#fff', fontSize: '30px', cursor: 'pointer' }} onClick={() => setEnlargedImage(null)}>&times;</button>
          <img src={enlargedImage} alt="Enlarged view" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", WebkitTouchCallout: "default" }} />
          <div style={{ position: 'absolute', bottom: '20px', color: '#fff', fontSize: '14px', opacity: 0.7 }}>Long press image to save</div>
        </div>
      )}
      <div className="convo-list">
        {conversations.map((c) => (
          <button
            className={`convo ${selected === c.id ? "active" : ""}`}
            key={c.id}
            onClick={() => choose(c.id)}
          >
            <div className="convo-avatar">
              {c.otherAvatar ? (
                <img src={c.otherAvatar} alt="" />
              ) : (
                <span>{c.otherName.slice(0, 2).toUpperCase()}</span>
              )}
              {onlineUsers.has(c.otherId) && (
                <div className="status-dot online"></div>
              )}
            </div>
            <div className="convo-text">
              <strong>{c.otherName}</strong>
              <small>{c.title}</small>
            </div>
          </button>
        ))}
      </div>

      <section className="thread-panel">
        {current ? (
          <>
            {/* Thread Header */}
            <div className="thread-head">
                <button type="button" className="thread-back-btn" onClick={() => setSelected(null)}><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
              <div className="thread-head-user">
                <div className="convo-avatar">
                  {current.otherAvatar ? (
                    <img src={current.otherAvatar} alt="" />
                  ) : (
                    <span>{current.otherName.slice(0, 2).toUpperCase()}</span>
                  )}
                  <div
                    className={`status-dot ${isOnline ? "online" : "offline"}`}
                  ></div>
                </div>
                <div>
                  <div className="thread-name">{current.otherName}</div>
                  <div className="thread-status-text" style={{ color: isOnline ? '#159b78' : '#a43f3f', fontWeight: 'bold' }}>
    {isOnline ? "Online" : "Offline"}
  </div>
                </div>
              </div>
            </div>

            {/* Pinned Task Context */}
            {current.task && (
              <div className="chat-pinned-task">
                <div>
                  <strong>{current.task.title}</strong>
                  <span>
                    {current.task.status.replace("_", " ").toUpperCase()} · ₱{" "}
                    {current.task.commission_amount || 0}
                  </span>
                </div>
                {current.task.deadline_at && (
                  <span className="pinned-deadline">
                    Due{" "}
                    {new Date(current.task.deadline_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="thread-body">
              {messages.map((msg) => {
                const isSystem = msg.sender_id === null;
                const isMe = msg.sender_id === session.user.id;

                if (isSystem) {
                  return (
                    <div className="msg-system" key={msg.id}>
                      <span>{msg.body}</span>
                    </div>
                  );
                }

                return (
                  <div
                    className={`msg-wrapper ${isMe ? "out" : "in"}`}
                    key={msg.id}
                  >
                    <div className="msg-bubble">
                      {msg.attachment_url && (
                        <ChatAttachment msg={msg} onImageClick={setEnlargedImage} />
                      )}
                      <div className="msg-text">{msg.body}</div>
                      <div className="msg-meta">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isMe && <span className="read-receipt">✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="thread-input-zone">
              {notice && <div className="chat-notice">{notice}</div>}
              <form className="thread-input-form" onSubmit={send}>
                <label className="chat-attach-btn" aria-label="Add attachment">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="file"
                    onChange={uploadAttachment}
                    style={{ display: "none" }}
                  />
                </label>
                <input
                  className="chat-text-input"
                  value={draft}
                  maxLength={3000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                />
                <button className="chat-send-btn" disabled={!draft.trim()}>
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="fresh-empty-view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, #0e1633, #16224d)', color: '#fff', borderRadius: '16px', boxShadow: 'inset 0 0 100px rgba(0,0,0,0.2)' }}>
            <div style={{ background: 'rgba(70,214,163,0.1)', color: '#46d6a3', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>Your Messages</h2>
            <p style={{ color: '#879cbd', maxWidth: 300, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Select a conversation from the left to start coordinating your tasks safely.</p>
          </div>
        )}
      </section>
    </div>
  );
}
function SettingsPage({
  email,
  onAccount,
  onExit,
  isDemo,
}: {
  email: string;
  onAccount: () => void;
  onExit: () => void;
  isDemo: boolean;
}) {
  const notificationKey = `questkarte:task-notifications:${email}`;
  const locationKey = `questkarte:map-location:${email}`;
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem(notificationKey) !== "false",
  );
  const [location, setLocation] = useState(
    () => localStorage.getItem(locationKey) === "true",
  );
  const [locationCopy, setLocationCopy] = useState(() =>
    localStorage.getItem(locationKey) === "true"
      ? "Enabled for this account. Use Locate me on the map whenever you want to share your approximate area."
      : "Turn this on to allow the map to request your approximate location when needed.",
  );
  const toggleNotifications = () => {
    const next = !notifications;
    setNotifications(next);
    localStorage.setItem(notificationKey, String(next));
  };
  const toggleLocation = () => {
    const next = !location;
    setLocation(next);
    localStorage.setItem(locationKey, String(next));
    if (!next) {
      setLocationCopy(
        "Off. QuestKarte will not request your location from the map.",
      );
      return;
    }
    setLocationCopy(
      "Enabled. The map may now ask for browser permission when you select Locate me.",
    );
  };
  return (
    <div className="settings-page view">
      <section className="settings-hero">
        <span className="eyebrow">Account controls</span>
        <h2>Settings</h2>
        <p>Manage the basics of your QuestKarte experience.</p>
      </section>
      <div className="settings-grid">
        <section className="panel">
          <h3>Profile and account</h3>
          <div className="settings-control">
            <div>
              <strong>Public member profile</strong>
              <small>Your photo, introduction, skills, and service area.</small>
            </div>
            <button type="button" className="btn" onClick={onAccount}>
              View profile
            </button>
          </div>
          <div className="settings-control">
            <div>
              <strong>Sign-in email</strong>
              <small>{email}</small>
            </div>
          </div>
        </section>
        <section className="panel">
          <h3>Preferences</h3>
          <div className="settings-control">
            <div>
              <strong>Task notifications</strong>
              <small>
                Keep your notification preference on this browser. Actual task
                alerts will begin once real tasks and applications are
                connected.
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              className={`switch ${notifications ? "on" : ""}`}
              onClick={toggleNotifications}
              aria-label="Toggle task notifications"
            />
          </div>
          <div className="settings-control">
            <div>
              <strong>Map location</strong>
              <small>{locationCopy}</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={location}
              className={`switch ${location ? "on" : ""}`}
              onClick={toggleLocation}
              aria-label="Toggle map location"
            />
          </div>
        </section>
        <section className="panel settings-danger">
          <h3>Session</h3>
          <p>
            {isDemo
              ? "Leave the demo and return to sign in."
              : "Sign out from this browser. Your account and profile stay safe in Supabase."}
          </p>
          <button type="button" className="btn" onClick={onExit}>
            {isDemo ? "Exit demo" : "Sign out"}
          </button>
        </section>
      </div>
    </div>
  );
}
function getTrustRank(score: number) {
  if (score < 50) return { title: "Restricted", emoji: "⛔", color: "#ef4444" };
  if (score < 70)
    return { title: "Bronze Explorer", emoji: "🥉", color: "#b45309" };
  if (score < 85)
    return { title: "Silver Pathfinder", emoji: "🥈", color: "#94a3b8" };
  if (score < 93)
    return { title: "Gold Trusted", emoji: "🥇", color: "#eab308" };
  if (score < 98)
    return { title: "Platinum Reliable", emoji: "💎", color: "#0ea5e9" };
  return { title: "Certified Trusted", emoji: "👑", color: "#8b5cf6" };
}

function LegacyFreshAccount({
  profile,
  email,
  session,
  onExit,
}: {
  profile: MemberProfile | null;
  email: string;
  session: Session;
  onExit: () => void;
}) {
  const name = profile?.full_name || "Member";
  const verified = profile?.verification_status === "verified";
  const trustScore = profile?.trust_factor || 0;
  const trustRank = getTrustRank(trustScore);
  return (
    <div className="fresh-account view">
      <section className="panel fresh-profile-hero">
        <div className="fresh-profile-avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            name[0]?.toUpperCase()
          )}
        </div>
        <div>
          <span className="eyebrow">Member profile</span>
          <h2>{name}</h2>
          <p>
            {profile?.bio ||
              "Add a short introduction so other members understand what you can offer."}
          </p>
          <div className="profile-pills">
            {(profile?.skills || []).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      </section>
      <div className="fresh-grid">
        <section className="panel">
          <h3>Trust and service record</h3>
          <div className="fresh-stats">
            <div>
              <strong style={{ color: trustRank.color }}>
                {trustScore}
                <small>/100</small>
              </strong>
              <span>
                {trustRank.emoji} {trustRank.title}
              </span>
            </div>
            <div>
              <strong>
                {profile?.average_rating?.toFixed(1) || "0.0"}
                <small> ★</small>
              </strong>
              <span>{profile?.rating_count || 0} ratings</span>
            </div>
            <div>
              <strong>{profile?.completed_tasks_count || 0}</strong>
              <span>Finished jobs</span>
            </div>
          </div>
          <p className="form-intro">
            {trustScore < 50
              ? "Your Trust Factor is below 50. Improve it through reliable service and positive reviews before applying again."
              : "Your Trust Factor is in good standing for marketplace participation."}
          </p>
        </section>
        <section className="panel">
          <h3>Account details</h3>
          <div className="account-details">
            <span>
              Email <b>{email}</b>
            </span>
            <span>
              Area <b>{profile?.city || "Not added"}</b>
            </span>
            <span>
              Verification{" "}
              <b>
                {verified
                  ? "Verified member"
                  : profile?.verification_status === "pending"
                    ? "Under review"
                    : "Verification required"}
              </b>
            </span>
          </div>
          <button className="btn signout-button" onClick={onExit}>
            Sign out
          </button>
        </section>
      </div>
      {!verified && (
        <VerificationRequestPanel
          session={session}
          status={profile?.verification_status || "unverified"}
        />
      )}
    </div>
  );
}

function FreshAccount({
  profile,
  email,
  session,
  onExit,
}: {
  profile: MemberProfile | null;
  email: string;
  session: Session;
  onExit: () => void;
}) {
  const [member, setMember] = useState<MemberProfile | null>(profile);
  const [editing, setEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [showTrustHistory, setShowTrustHistory] = useState(false);
  const [name, setName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [city, setCity] = useState(profile?.city || "Cebu City");
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [gcash, setGcash] = useState(profile?.skills?.find(s => s.startsWith("GCash:"))?.replace("GCash:", "") || "");

  const [avatar, setAvatar] = useState<string | null>(
    profile?.avatar_url || null,
  );
  const [customSkill, setCustomSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [notice, setNotice] = useState("");
  const standardSkills = [
    "Cleaning",
    "Delivery",
    "Tutoring",
    "Design",
    "Errands",
    "Pet care",
    "Tech help",
    "Writing",
  ];
  useEffect(() => {
    setMember(profile);
    setName(profile?.full_name || "");
    setBio(profile?.bio || "");
    setCity(profile?.city || "Cebu City");
    setSkills(profile?.skills || []);
    setGcash(profile?.skills?.find(s => s.startsWith("GCash:"))?.replace("GCash:", "") || "");
    setAvatar(profile?.avatar_url || null);
  }, [profile]);
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 900000)
      return setNotice("Please use a photo smaller than 900 KB for now.");
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addSkill = () => {
    const value = customSkill.trim().replace(/\s+/g, " ");
    if (
      !value ||
      skills.some((skill) => skill.toLowerCase() === value.toLowerCase())
    )
      return setCustomSkill("");
    setSkills((current) => [...current, value].slice(0, 12));
    setCustomSkill("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        skills,
        avatar_url: avatar,
      })
      .eq("id", session.user.id)
      .select(
        "id, full_name, avatar_url, bio, city, skills, trust_factor, completed_tasks_count, student_verified_at, professional_verified_at, verification_status, average_rating, rating_count",
      )
      .single();
    setSaving(false);
    if (error || !data)
      return setNotice(error?.message || "Your changes could not be saved.");
    setMember(data as MemberProfile);
    setEditing(false);
    setNotice("Profile updated.");
  };
  const visible = member || profile;
  const verified = visible?.verification_status === "verified";
  const displayName = visible?.full_name || "Member";
  const trustScore = visible?.trust_factor || 0;
  const trustRank = getTrustRank(trustScore);
  return (
    <div className="fresh-account view">
      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            choosePhoto(file);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      {avatarPreview && visible?.avatar_url && (
        <div className="task-modal-backdrop" onClick={() => setAvatarPreview(false)}>
           <div style={{ position: 'relative', width: 'min(500px, 100%)', background: '#fff', borderRadius: 24, padding: 8 }}>
              <button type="button" onClick={() => setAvatarPreview(false)} className="task-modal-close" style={{ top: 16, right: 16 }}>&times;</button>
              <img src={visible.avatar_url} alt="Profile" style={{ width: '100%', borderRadius: 18, display: 'block' }} />
           </div>
        </div>
      )}
      <section className="panel fresh-profile-hero">
        <div className="fresh-profile-avatar" onClick={() => visible?.avatar_url && setAvatarPreview(true)} style={{ cursor: visible?.avatar_url ? 'pointer' : 'default' }}>
          {visible?.avatar_url ? (
            <img src={visible.avatar_url} alt="" />
          ) : (
            displayName[0]?.toUpperCase()
          )}
        </div>
        <div>
          <span className="eyebrow">Member profile</span>
          <h2>{displayName}</h2>
          <p>
            {visible?.bio ||
              "Add a short introduction so other members understand what you can offer."}
          </p>
          <div className="profile-pills">
            {(visible?.skills || []).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setNotice("");
            setEditing(true);
          }}
        >
          Edit profile
        </button>
      </section>
      {editing && (
        <section className="panel profile-editor">
          <div className="profile-editor-head">
            <div>
              <span className="eyebrow">Edit your public member profile</span>
              <h3>Keep your profile current</h3>
            </div>
            <button
              type="button"
              className="link-button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
          <form className="profile-setup-form" onSubmit={save}>
            <div className="avatar-picker">
              <div className="avatar-upload">
                {avatar ? (
                  <img src={avatar} alt="Profile preview" />
                ) : (
                  <span>{name[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
              <div>
                <strong>Profile photo</strong>
                <p>Take a current photo or select one from your device.</p>
                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="upload-photo-link"
                    onClick={() => setShowCamera(true)}
                  >
                    Use camera
                  </button>
                  <label className="upload-photo-link">
                    Choose file
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => choosePhoto(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>
            <label>
              <span>Display name</span>
              <input
                value={name}
                required
                minLength={2}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>About you</span>
              <textarea
                value={bio}
                required
                minLength={10}
                maxLength={500}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>
            <label>
              <span>City / service area</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <label>
              <span>GCash Number (For receiving payments)</span>
              <input
                value={gcash}
                placeholder="09..."
                maxLength={11}
                onChange={(event) => setGcash(event.target.value)}
              />
            </label>
            <div>
              <span className="setup-label">Services and strengths</span>
              <div className="skill-choices">
                {Array.from(new Set([...standardSkills, ...skills.filter(s => !s.startsWith("GCash:"))])).map((skill) => (
                  <button
                    type="button"
                    key={skill}
                    className={skills.includes(skill) ? "selected" : ""}
                    onClick={() =>
                      setSkills((current) =>
                        current.includes(skill)
                          ? current.filter((item) => item !== skill)
                          : [...current, skill],
                      )
                    }
                    style={skills.includes(skill) ? { display: 'flex', alignItems: 'center', gap: '6px' } : {}}
                  >
                    {skill}
                    {skills.includes(skill) && <span style={{ fontSize: '14px', lineHeight: 1, marginTop: '-2px', opacity: 0.7 }}>&times;</span>}
                  </button>
                ))}
              </div>
              <div className="custom-skill" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  value={customSkill}
                  maxLength={40}
                  onChange={(event) => setCustomSkill(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add another strength"
                  style={{ paddingRight: "30px", flex: 1 }}
                />
                {customSkill && (
                  <button
                    type="button"
                    onClick={() => setCustomSkill("")}
                    style={{
                      position: "absolute",
                      right: "80px",
                      background: "transparent",
                      border: "none",
                      fontSize: "18px",
                      color: "#999",
                      cursor: "pointer",
                      padding: "0 8px",
                      height: "100%",
                      display: "flex",
                      alignItems: "center"
                    }}
                    title="Clear"
                  >
                    &times;
                  </button>
                )}
                <button type="button" onClick={addSkill} style={{ marginLeft: "8px" }}>
                  Add
                </button>
              </div>
            </div>
            {notice && <p className="setup-notice">{notice}</p>}
            <button className="setup-submit" disabled={saving}>
              {saving ? "Saving changes…" : "Save profile changes"}
            </button>
          </form>
        </section>
      )}
      <div className="fresh-grid">
        <section className="panel">
          <h3>Trust and service record</h3>
          <div className="fresh-stats" style={{ position: 'relative' }}>
            <button 
              className="btn" 
              type="button"
              style={{ position: 'absolute', top: '-40px', right: '0', fontSize: '11px', padding: '4px 10px', backgroundColor: '#fff', border: '1px solid #cdd8ea', color: '#12255c', borderRadius: '12px', cursor: 'pointer' }}
              onClick={() => setShowTrustHistory(true)}
            >
              View History
            </button>
            <div>
              <strong style={{ color: trustRank.color }}>
                {trustScore}
                <small>/100</small>
              </strong>
              <span>
                {trustRank.emoji} {trustRank.title}
              </span>
            </div>
            <div>
              <strong>
                {visible?.average_rating?.toFixed(1) || "0.0"}
                <small> ★</small>
              </strong>
              <span>{visible?.rating_count || 0} ratings</span>
            </div>
            <div>
              <strong>{visible?.completed_tasks_count || 0}</strong>
              <span>Finished jobs</span>
            </div>
          </div>
        </section>
        {showTrustHistory && (
          <TrustHistoryModal onClose={() => setShowTrustHistory(false)} />
        )}
        <section className="panel">
          <h3>Account details</h3>
          <div className="account-details">
            <span>
              Email <b>{email}</b>
            </span>
            <span>
              Area <b>{visible?.city || "Not added"}</b>
            </span>
            <span>
              Verification{" "}
              <b>
                {verified
                  ? "Verified member"
                  : visible?.verification_status === "pending"
                    ? "Under review"
                    : "Verification required"}
              </b>
            </span>
          </div>
          <button className="btn signout-button" onClick={onExit}>
            Sign out
          </button>
        </section>
      </div>
      {!verified && (
        <VerificationRequestPanel
          session={session}
          status={visible?.verification_status || "unverified"}
        />
      )}
    </div>
  );
}

function Home({
  tab,
  setTab,
  quests: taskList,
  saved,
  applied,
  onSave,
  onApply,
  onPost,
}: {
  tab: string;
  setTab: (tab: string) => void;
  quests: Quest[];
  saved: Array<number | string>;
  applied: Array<number | string>;
  onSave: (id: number | string) => void;
  onApply: (id: number | string) => void;
  onPost: () => void;
}) {
  return (
    <div className="home-grid view">
      <div className="home-feed">
        <div className="quest-hero">
          <div className="ring">
            <span>65%</span>
          </div>
          <div>
            <strong>One quest in progress</strong>
            <p>Car wash — Lahug residence · Due today, 5:00 PM</p>
          </div>
          <button className="hero-arrow">→</button>
        </div>
        <section className="quick-actions">
          <div>
            <span className="eyebrow">Your workspace</span>
            <h2>What would you like to do?</h2>
          </div>
          <div className="quick-action-buttons">
            <button onClick={onPost}>
              <b>＋</b>
              <span>Post a task</span>
            </button>
            <button onClick={() => setTab("Nearby")}>
              <b>⌖</b>
              <span>Explore nearby</span>
            </button>
            <button onClick={() => setTab("Recommended")}>
              <b>✦</b>
              <span>Best matches</span>
            </button>
          </div>
        </section>
        <div className="segmented">
          {["Recommended", "Nearby", "Newest"].map((name) => (
            <button
              key={name}
              className={`seg ${tab === name ? "active" : ""}`}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="section-head">
          <h2>{tab === "Recommended" ? "For you today" : `${tab} quests`}</h2>
          <button className="link-button">Sort: Best match ↓</button>
        </div>
        {taskList.length ? (
          taskList.map((quest) => (
            <TaskCard
              key={quest.id}
              quest={{ ...quest, image: questImages[quest.id] }}
              saved={saved.includes(quest.id)}
              applied={applied.includes(quest.id)}
              onSave={() => onSave(quest.id)}
              onApply={() => onApply(quest.id)}
            />
          ))
        ) : (
          <Empty />
        )}
      </div>
      <aside className="home-side">
        <DiscoverySide />
      </aside>
    </div>
  );
}

function MapPanTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14);
  }, [map, position]);
  return null;
}

function DiscoverySide() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState("Lahug, Cebu City");
  const locate = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not supported by this browser");
      return;
    }
    setLocationStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setLocationStatus("Showing opportunities near you");
      },
      () => setLocationStatus("Location permission was not granted"),
      { enableHighAccuracy: false, timeout: 9000 },
    );
  };
  const pins: { position: [number, number]; title: string; reward: string }[] =
    [
      {
        position: [10.3298, 123.9067],
        title: "Deep clean apartment",
        reward: "Service swap",
      },
      {
        position: [10.3251, 123.9042],
        title: "Statistics tutor",
        reward: "₱450 / session",
      },
      {
        position: [10.3358, 123.9031],
        title: "Grocery run + delivery",
        reward: "₱300",
      },
    ];
  return (
    <>
      <section className="panel map-panel">
        <div className="panel-title-row">
          <div>
            <h3>Nearby opportunities</h3>
            <p>{locationStatus}</p>
          </div>
          <button className="map-locate" onClick={locate}>
            ⌖ Locate me
          </button>
        </div>
        <div className="quest-map">
          <MapContainer
            center={[10.3298, 123.9067]}
            zoom={13}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapPanTo position={position} />
            {position && (
              <>
                <Circle
                  center={position}
                  radius={5000}
                  pathOptions={{
                    color: "#47A2F5",
                    fillColor: "#47A2F5",
                    fillOpacity: 0.08,
                  }}
                />
                <CircleMarker
                  center={position}
                  radius={8}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: "#213BA3",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>You are here</Popup>
                </CircleMarker>
              </>
            )}
            {pins.map((pin) => (
              <CircleMarker
                key={pin.title}
                center={pin.position}
                radius={9}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#D6AE29",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>{pin.title}</strong>
                  <br />
                  {pin.reward}
                  <br />
                  <button type="button">View quest</button>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <p className="map-caption">
          Demo pins within 5 km · task locations will come from Supabase.
        </p>
      </section>
      <section className="panel member-snapshot">
        <div className="snapshot-heading">
          <div>
            <h3>Member trust snapshot</h3>
            <p>Your activity and standing in QuestKarte</p>
          </div>
          <span className="snapshot-level">Level 12</span>
        </div>
        <div className="profile-mini">
          <span className="avatar">S</span>
          <div>
            <div className="profile-name">Susan Lim</div>
            <div className="profile-role">
              Verified Student · Silver standing
            </div>
          </div>
        </div>
        <div className="snapshot-stats">
          <div className="snapshot-stat">
            <span>Trust Factor</span>
            <strong>62</strong>
            <small>Silver</small>
          </div>
          <div className="snapshot-stat">
            <span>Completed</span>
            <strong>14</strong>
            <small>tasks</small>
          </div>
          <div className="snapshot-stat">
            <span>Applications</span>
            <strong>3</strong>
            <small>active</small>
          </div>
        </div>
      </section>
    </>
  );
}

function Tasks({
  onGoPost,
  applied,
}: {
  onGoPost: () => void;
  applied: Array<number | string>;
}) {
  return (
    <div className="view tasks-wrap">
      <div className="section-head">
        <h2>Your quest log</h2>
        <button className="btn primary" onClick={onGoPost}>
          + Post a task
        </button>
      </div>
      <div className="task-mgmt-card">
        <div className="tm-top">
          <div>
            <div className="tm-title">Grocery run + delivery, Ayala Center</div>
            <div className="tm-sub">
              Accepted by Cara D. · Due today, 6:00 PM
            </div>
          </div>
          <span className="badge accepted">Ongoing</span>
        </div>
        <Progress percent={65} />
        <div className="tm-actions">
          <span className="tm-applicants">65% complete</span>
          <button className="btn">View task</button>
        </div>
      </div>
      <div className="task-mgmt-card">
        <div className="tm-top">
          <div>
            <div className="tm-title">Applications sent</div>
            <div className="tm-sub">
              {applied.length
                ? `${applied.length} application${applied.length > 1 ? "s" : ""} awaiting a response`
                : "Explore the feed and apply to a quest."}
            </div>
          </div>
          <span className="badge pending">Pending</span>
        </div>
        <Progress percent={32} />
      </div>
    </div>
  );
}

function VerificationRequestPanel({
  session,
  status,
}: {
  session: Session;
  status: "unverified" | "pending" | "verified" | "rejected";
}) {
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
    if (!document) {
      setNotice(
        "Attach a clear student ID, professional ID, or supporting document.",
      );
      return;
    }
    if (!institution.trim()) {
      setNotice(
        type === "student"
          ? "Enter your school or institution."
          : "Enter your company or professional institution.",
      );
      return;
    }
    if (document.size > 10 * 1024 * 1024) {
      setNotice("Use a document smaller than 10 MB.");
      return;
    }
    setSaving(true);
    setNotice("");
    const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.user.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage
      .from("verification-documents")
      .upload(path, document, { contentType: document.type, upsert: false });
    if (upload.error) {
      setSaving(false);
      setNotice(upload.error.message);
      return;
    }
    const { error } = await supabase
      .from("verification_requests")
      .insert({
        user_id: session.user.id,
        type,
        status: "pending",
        school_name: type === "student" ? institution.trim() : null,
        school_email: type === "student" ? schoolEmail.trim() || null : null,
        course: type === "student" ? course.trim() || null : null,
        institution_or_company:
          type === "professional" ? institution.trim() : null,
        document_path: path,
        document_name: document.name,
      });
    setSaving(false);
    if (error) {
      await supabase.storage.from("verification-documents").remove([path]);
      setNotice(error.message);
      return;
    }
    setSubmitted(true);
    setNotice(
      "Verification request submitted. A moderator will review your document privately.",
    );
  };
  if (status === "pending" || submitted)
    return (
      <section className="panel verification-panel">
        <span className="eyebrow">Verification</span>
        <h3>Your evidence is under review</h3>
        <p>
          QuestKarte staff will review your private document. You will be
          notified of the decision.
        </p>
      </section>
    );
  return (
    <section className="panel verification-panel">
      <span className="eyebrow">Verification</span>
      <h3>
        {status === "rejected"
          ? "Update and resubmit your verification"
          : "Verify your member account"}
      </h3>
      <p>
        Verified members may publish tasks. A Trust Factor of 50 or more is also
        required before applying to tasks.
      </p>
      <form className="profile-setup-form" onSubmit={submit}>
        <div className="segmented">
          <button
            type="button"
            className={type === "student" ? "seg active" : "seg"}
            onClick={() => setType("student")}
          >
            Student
          </button>
          <button
            type="button"
            className={type === "professional" ? "seg active" : "seg"}
            onClick={() => setType("professional")}
          >
            Professional
          </button>
        </div>
        <label>
          <span>
            {type === "student"
              ? "School / institution"
              : "Company / professional institution"}
          </span>
          <input
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            required
          />
        </label>
        {type === "student" && (
          <>
            <label>
              <span>Institutional email (optional)</span>
              <input
                value={schoolEmail}
                type="email"
                onChange={(event) => setSchoolEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Course or program (optional)</span>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
              />
            </label>
          </>
        )}
        <label className="upload-box">
          <strong>Attach verification document</strong>
          <small>
            Student ID, school record, professional ID, or supporting proof.
            PDF, JPG, PNG, or WEBP; maximum 10 MB.
          </small>
          <input
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => setDocument(event.target.files?.[0] || null)}
          />
          {document && <b>{document.name}</b>}
        </label>
        {notice && <p className="setup-notice">{notice}</p>}
        <button className="btn primary" disabled={saving}>
          {saving ? "Submitting..." : "Submit for verification"}
        </button>
      </form>
    </section>
  );
}

function PostTask({
  session,
  profile,
  onPosted,
}: {
  session: Session | null;
  profile: MemberProfile | null;
  onPosted: () => void;
}) {
  const [category, setCategory] = useState("Cleaning");
  const [swap, setSwap] = useState(false);
  const [studentOnly, setStudentOnly] = useState(false);
  const [title, setTitle] = useState(localStorage.getItem('draft-title') || "");
    const [description, setDescription] = useState(localStorage.getItem('draft-desc') || "");
    useEffect(() => { localStorage.setItem('draft-title', title); }, [title]);
    useEffect(() => { localStorage.setItem('draft-desc', description); }, [description]);
  const [commission, setCommission] = useState("");
  const [location, setLocation] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const getTaskCoordinates = () =>
    new Promise<{ latitude: number | null; longitude: number | null }>(
      (resolve) => {
        if (!navigator.geolocation) {
          resolve({ latitude: null, longitude: null });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) =>
            resolve({ latitude: coords.latitude, longitude: coords.longitude }),
          () => resolve({ latitude: null, longitude: null }),
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 },
        );
      },
    );
  const publishTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) {
      setSubmitError("Sign in before submitting a task.");
      return;
    }
    const amount = Number(commission.replace(/[^0-9.]/g, ""));
    if (!swap && (!Number.isFinite(amount) || amount <= 0)) {
      setSubmitError("Enter a valid commission amount.");
      return;
    }
    setSavingTask(true);
    setSubmitError("");
    const coordinates = await getTaskCoordinates();
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", category)
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("tasks")
      .insert({
        posted_by: session.user.id,
        category_id: categoryRow?.id || null,
        title: title.trim(),
        description: description.trim(),
        commission_amount: swap ? null : amount,
        currency: "PHP",
        is_service_swap: swap,
        swap_details: swap ? "Service swap offered" : null,
        requires_student_verification: studentOnly,
        location_label: location.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        status: "draft",
        moderation_state: "pending_review",
      });
    setSavingTask(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    onPosted();
  };
  return (
    <div className="post-grid view">
      <form className="forge-card post-form-col" onSubmit={publishTask}>
        <div className="forge-ribbon">
          <span>✦ Publish to the marketplace</span>
        </div>
        <h2>Post a task people can discover.</h2>
        <p className="form-intro">
          This task will be saved in Supabase and become visible to other
          QuestKarte members.
        </p>
        <label className="field-group">
          <span className="field-label">Task title</span>
          <input
            required
            minLength={6}
            maxLength={140}
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Deep clean a 2-bedroom apartment"
          />
        </label>
        <label className="field-group">
          <span className="field-label">Describe the task</span>
          <textarea
            required
            minLength={20}
            maxLength={5000}
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what needs to be done, preferred time, and anything the provider should bring."
          />
        </label>
        <div className="field-group">
          <span className="field-label">Category</span>
          <div className="cat-picker">
            {[
              "Cleaning",
              "Delivery",
              "Tutoring",
              "Design",
              "Errands",
              "Other",
            ].map((name) => (
              <button
                type="button"
                key={name}
                className={`cat-pick-item ${category === name ? "active" : ""}`}
                onClick={() => setCategory(name)}
              >
                <span>{categoryIcon(name)}</span>
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="form-two">
          <label className="field-group">
            <span className="field-label">Commission</span>
            <input
              required={!swap}
              disabled={swap}
              className="field-input"
              value={swap ? "Service swap" : commission}
              onChange={(event) => setCommission(event.target.value)}
              placeholder="₱ Amount"
            />
          </label>
          <label className="field-group">
            <span className="field-label">General area</span>
            <input
              required
              className="field-input"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Lahug, Cebu City"
            />
          </label>
        </div>
        <Toggle
          title="Offer a service swap"
          detail="Offer a skill or service instead of cash."
          checked={swap}
          onChange={() => setSwap(!swap)}
        />
        <Toggle
          title="Verified students only"
          detail="Limit applications to student-verified members."
          checked={studentOnly}
          onChange={() => setStudentOnly(!studentOnly)}
        />
        <section className="photo-upload-section">
          <strong>Photos are ready for the next connection.</strong>
          <small>
            Task details publish now. Permanent shared photo uploads need
            Supabase Storage, which we will connect next.
          </small>
        </section>
        {submitError && <p className="setup-notice">{submitError}</p>}
        <button className="post-submit" type="submit" disabled={savingTask}>
          {savingTask ? "Publishing…" : "Publish task →"}
        </button>
      </form>
      <aside className="post-preview-col">
        <div className="post-preview-label">Shared-task preview</div>
        <TaskCard
          quest={{
            id: "preview",
            category,
            title: title || "Your task title",
            description:
              description ||
              "Your task details will appear here while you write.",
            commission: swap ? "Service swap" : commission || "Commission",
            location: location || "Your general area",
            schedule: "Will be published now",
            posterName: profile?.full_name || "You",
            avatarUrl: profile?.avatar_url,
                initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(),
            kind: swap ? "swap" : studentOnly ? "student" : undefined,
          }}
        />
      </aside>
    </div>
  );
}

function Chat({
  open,
  setOpen,
  messages,
  draft,
  setDraft,
  onSend,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  messages: string[];
  draft: string;
  setDraft: (value: string) => void;
  onSend: (event: FormEvent) => void;
}) {
  return (
    <div className="chat-layout view">
      <div className="convo-list">
        <Conversation
          name="Cara D."
          quest="Grocery run + delivery"
          snippet="Great, can you be at Ayala by 4 PM?"
          active
          onClick={() => setOpen(true)}
        />
        <Conversation
          name="Mika J."
          quest="Statistics tutor"
          snippet="Thanks for your application!"
          onClick={() => setOpen(true)}
        />
        <Conversation
          name="Robert B."
          quest="Deep clean apartment"
          snippet="I can share photos of the space."
          onClick={() => setOpen(true)}
        />
      </div>
      <section className={`thread-panel ${open ? "open" : ""}`}>
        <div className="thread-head">
          <button className="thread-back" onClick={() => setOpen(false)}>
            ←
          </button>
          <span className="avatar">CD</span>
          <div>
            <div className="thread-name">Cara D.</div>
            <div className="thread-quest">Grocery run + delivery</div>
          </div>
        </div>
        <div className="thread-body">
          {messages.map((message, index) => (
              <div key={`${message}-${index}`} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {index === 0 && (
                  <div className="msg-system">
                    🛡️ Secure Chat: Always keep communication and payments within QuestKarte.
                  </div>
                )}
                <div
                  className={`msg-wrapper ${index % 2 ? "in" : "out"}`}
                >
                  <div className="msg-bubble">{message}</div>
                </div>
              </div>
            ))}
          <div className="ward-card">
            <div className="ward-ft">⚠ QuestKarte safety shield</div>
            <div className="ward-blur">
              Send payment through my personal account instead.
            </div>
            <p className="ward-note">
              Potentially unsafe payment request hidden.
            </p>
          </div>
        </div>
        <form className="thread-input" onSubmit={onSend}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message…"
          />
          <button className="thread-send" aria-label="Send message">
            ↑
          </button>
        </form>
      </section>
    </div>
  );
}

function Account({
  displayName,
  isDemo,
  onEdit,
  onExit,
}: {
  displayName: string;
  isDemo: boolean;
  onEdit: () => void;
  onExit: () => void;
}) {
  return (
    <div className="acct-grid view">
      <div className="acct-main">
        <section className="panel sheet-hero">
          <div className="sheet-avatar-wrap">
            <div className="lvl-ring sheet-ring">
              <span className="avatar">
                {displayName[0]?.toUpperCase() || "A"}
              </span>
              <span className="sheet-lvl">Level 1</span>
            </div>
          </div>
          <h2>{displayName}</h2>
          <p className="role">
            QuestKarte member · Your profile is ready to customize
          </p>
          <span className="tier-chip">✦ Bronze Explorer</span>
        </section>
        <section className="panel">
          <h3>Quest progression</h3>
          <div className="stat-bars">
            <Stat label="Trust Factor" value="0 / 100" percent={0} />
            <Stat
              label="Level progress"
              value="0 / 1,000 XP"
              percent={0}
              gold
            />
          </div>
        </section>
        <section className="panel">
          <h3>Recent badges</h3>
          <div className="medal-grid">
            <Medal icon="✦" label="First quest" tone="bronze" />
            <Medal icon="⌁" label="Trusted helper" tone="silver" />
            <Medal icon="★" label="Quick responder" tone="gold" />
          </div>
        </section>
      </div>
      <aside className="acct-side">
        <section className="panel">
          <h3>Account</h3>
          <div className="settings-list">
            <Setting icon="◉" name="Edit profile" onClick={onEdit} />
            <Setting icon="♢" name="Verification status" onClick={onEdit} />
            <Setting icon="♧" name="Notifications" onClick={onEdit} />
            <Setting icon="⚙" name="Settings" onClick={onEdit} />
            <Setting
              icon="↩"
              name={isDemo ? "Exit demo" : "Sign out"}
              onClick={onExit}
            />
          </div>
        </section>
        <section className="scroll-card">
          <div className="scroll-seal">⌘</div>
          <div>
            <div className="scroll-ct">Service certificates</div>
            <div className="scroll-cd">
              Your verified records will appear here.
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}



function VerificationQueueItem({ record, openVerificationEvidence, decideVerification, setRejectModal }: {
  record: VerificationRecord;
  openVerificationEvidence: (r: VerificationRecord) => void;
  decideVerification: (r: VerificationRecord, a: boolean) => void;
  setRejectModal: (m: any) => void;
}) {
  const [contact, setContact] = useState<{name: string, email: string} | null>(null);
  useEffect(() => {
    supabase.rpc('get_user_contact_info', { uid: record.user_id }).then(({ data }) => setContact(data));
  }, [record.user_id]);

  return (
    <article className="staff-case" key={record.id}>
      <div>
        <strong>
          {record.type === "student"
            ? "Student verification"
            : "Professional verification"}
        </strong>
        {contact && <div style={{ fontSize: 13, color: '#159b78', margin: '4px 0 6px', fontWeight: 600 }}>{contact.name} ({contact.email})</div>}
        <span>
          {record.school_name ||
            record.institution_or_company ||
            "Institution not provided"}{" "}
          · {record.document_name}
        </span>
      </div>
      <div className="staff-actions">
        <button
          className="btn secondary"
          onClick={() => void openVerificationEvidence(record)}
        >
          View private documents
        </button>
        <button
          className="btn primary"
          onClick={() => void decideVerification(record, true)}
        >
          Approve
        </button>
        <button
          className="btn danger"
          onClick={() => {
            setRejectModal({ type: 'verification', record });
          }}
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function StaffDashboard({

  role,
  session,
  onExit,
  activeTab,
  onTabChange,
}: {
  role: StaffRole;
  session: Session | null;
  onExit: () => void;
  activeTab: StaffTab;
  onTabChange: (tab: StaffTab) => void;
}) {
  return (
    <StaffWorkspace
      role={role}
      session={session}
      onExit={onExit}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
}

type StaffTab =
    | "overview"
    | "members"
    | "moderators"
    | "categories"
    | "audit"
    | "task_review"
    | "verification"
    | "reports"
    | "disputes"
  | "disputes";
type StaffTaskRecord = {
  id: string;
  title: string;
  description: string;
  location_label: string;
  created_at: string;
  posted_by: string;
  category_id: string | null;
  commission_amount: number | null;
  currency: string;
  is_service_swap: boolean;
  swap_details: string | null;
  requires_student_verification: boolean;
  poster?: any;
};
type VerificationRecord = {
  id: string;
  type: string;
  status: string;
  school_name: string | null;
  institution_or_company: string | null;
  document_name: string;
  document_path: string;
  created_at: string;
  user_id: string;
};
type VerificationEvidencePreview = {
  label: string;
  fileName: string;
  mimeType: string | null;
  url: string;
};
type ReportRecord = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
};
type DisputeRecord = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
};
type StaffMember = {
  id: string;
  full_name: string;
  city: string | null;
  trust_factor: number;
  completed_tasks_count: number;
};
type StaffCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  is_active: boolean;
};


function AdminAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedQuests] = useState(0);
  const [categories, setCategories] = useState<{name: string; pct: number; color: string}[]>([]);
  const [trustStats, setTrustStats] = useState<{label: string; pct: number; emoji: string; color: string; h: string}[]>([]);
  const [revBars, setRevBars] = useState<{label: string; h: string; active: boolean}[]>([]);

  useEffect(() => {
    async function loadData() {
      const [{ data: tasks }, { data: profiles }] = await Promise.all([
        supabase.from("tasks").select("status, created_at, category:categories(name)"),
        supabase.from("profiles").select("trust_factor")
      ]);

      if (tasks) {
        const completed = tasks.filter(t => t.status === "completed");
        setCompletedQuests(completed.length);
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const bins = Array(12).fill(0);
        const binSizeMs = (30 * 24 * 60 * 60 * 1000) / 12;
        
        completed.forEach(t => {
          const tDate = new Date(t.created_at);
          if (tDate >= thirtyDaysAgo) {
            const diffMs = tDate.getTime() - thirtyDaysAgo.getTime();
            const binIdx = Math.min(11, Math.floor(diffMs / binSizeMs));
            bins[binIdx]++;
          }
        });
        
        const maxBin = Math.max(1, ...bins);
        const dynamicBars = bins.map((val, i) => {
          const date = new Date(thirtyDaysAgo.getTime() + (i * binSizeMs));
          return {
            label: (i === 0 || i === 5 || i === 11) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
            h: Math.max(5, Math.round((val / maxBin) * 100)) + '%',
            active: i === 11
          };
        });
        setRevBars(dynamicBars);

        const catCounts: Record<string, number> = {};
        let totalCats = 0;
        tasks.forEach(t => {
          // @ts-ignore
          const catName = t.category?.name || "Uncategorized";
          catCounts[catName] = (catCounts[catName] || 0) + 1;
          totalCats++;
        });
        
        const colors = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ef4444', '#0ea5e9', '#eab308'];
        const sortedCats = Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], i) => ({
            name,
            pct: totalCats > 0 ? Math.round((count / totalCats) * 100) : 0,
            color: colors[i % colors.length]
          }));
        setCategories(sortedCats);
      }

      if (profiles) {
        let bronze=0, silver=0, gold=0, plat=0, cert=0;
        profiles.forEach(p => {
          const score = p.trust_factor || 0;
          if (score < 70) bronze++;
          else if (score < 85) silver++;
          else if (score < 93) gold++;
          else if (score < 98) plat++;
          else cert++;
        });
        const total = profiles.length || 1;
        
        const getH = (v: number) => Math.max(5, Math.round((v/total)*100)) + '%';
        
        setTrustStats([
          { label: 'Bronze', pct: Math.round((bronze/total)*100), emoji: '🥉', color: '#b45309', h: getH(bronze) },
          { label: 'Silver', pct: Math.round((silver/total)*100), emoji: '🥈', color: '#94a3b8', h: getH(silver) },
          { label: 'Gold', pct: Math.round((gold/total)*100), emoji: '🥇', color: '#eab308', h: getH(gold) },
          { label: 'Platinum', pct: Math.round((plat/total)*100), emoji: '💎', color: '#e2e8f0', h: getH(plat) },
          { label: 'Certified', pct: Math.round((cert/total)*100), emoji: '👑', color: '#3b82f6', h: getH(cert) }
        ]);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  

  if (loading) return <div className="admin-analytics-wrapper" style={{ minHeight: 400, display: 'grid', placeItems: 'center' }}>Loading Live Analytics...</div>;

  return (
    <div className="admin-analytics-wrapper">
      <div className="analytics-card">
        <h3 className="analytics-card-title">Completed Quests (All Time)</h3>
        <h2 className="rev-amount" style={{ color: '#60a5fa' }}>{completedCount}</h2>
        <div className="rev-trend">Live Platform Data</div>
        
        <div className="rev-bars-container">
          {revBars.map((bar, i) => (
            <div key={i} className={`rev-bar ${bar.active ? 'active' : ''}`} style={{ height: bar.h }}></div>
          ))}
        </div>
        <div className="rev-labels">
          <span>{new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="analytics-card">
        <h3 className="analytics-card-title">Tasks by Category</h3>
        {categories.length > 0 ? categories.map((cat, i) => (
          <div className="category-row" key={i}>
            <div className="category-name">{cat.name}</div>
            <div className="category-track">
              <div className="category-fill" style={{ width: `${cat.pct}%`, background: cat.color }}></div>
            </div>
            <div className="category-pct" style={{ color: cat.color }}>{cat.pct}%</div>
          </div>
        )) : <div style={{ color: '#63769c', fontSize: 13, marginTop: 10 }}>No tasks found.</div>}
      </div>

      <div className="analytics-card">
        <h3 className="analytics-card-title">Trust Factor Distribution</h3>
        <div className="trust-container">
          {trustStats.map((stat, i) => (
            <div className="trust-col" key={i}>
              <div className="trust-pct" style={{ color: stat.color === '#e2e8f0' ? '#94a3b8' : stat.color }}>{stat.pct}%</div>
              <div className="trust-bar" style={{ height: stat.h, background: stat.color }}></div>
              <div className="trust-label">
                <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>{stat.emoji}</span>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StaffWorkspace({
  role,
  session,
  onExit,
  activeTab,
  onTabChange,
}: {
  role: StaffRole;
  session: Session | null;
  onExit: () => void;
  activeTab: StaffTab;
  onTabChange: (tab: StaffTab) => void;
}) {
  const isAdmin = role === "admin";
  const tabs: { id: StaffTab; label: string }[] = isAdmin
    ? [
        { id: "overview", label: "Overview" },
        { id: "members", label: "Members" },
        { id: "moderators", label: "Moderators" },
        { id: "categories", label: "Categories" },
        { id: "audit", label: "Audit log" },
      ]
    : [
        { id: "task_review", label: "Task review" },
        { id: "verification", label: "Verification" },
        { id: "reports", label: "Reports" },
        { id: "disputes", label: "Disputes" },
      ];
  const [tab, setTab] = useState<StaffTab>(activeTab);
  const [tasks, setTasks] = useState<StaffTaskRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [categories, setCategories] = useState<StaffCategory[]>([]);
  const [audit, setAudit] = useState<
      { id: string; action: string; entity_type: string; created_at: string; profiles?: { full_name: string } }[]
    >([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [evidencePreview, setEvidencePreview] = useState<{
    title: string;
    items: VerificationEvidencePreview[];
  } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ type: 'verification' | 'task'; record: VerificationRecord | StaffTaskRecord } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [taskPreview, setTaskPreview] = useState<Quest | null>(null);
  
  const logAdminAction = async (action: string, entity_type: string) => {
    if (!session) return;
    await supabase.from("admin_audit_logs").insert({
      action,
      entity_type,
      user_id: session.user.id
    });
  };

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);
  const selectTab = (nextTab: StaffTab) => {
    setTab(nextTab);
    onTabChange(nextTab);
  };

  const load = async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [
      taskResult,
      verificationResult,
      reportResult,
      disputeResult,
      memberResult,
      roleResult,
      categoryResult,
      auditResult,
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,description,location_label,created_at,posted_by,category_id,commission_amount,currency,is_service_swap,swap_details,requires_student_verification,poster:profiles!tasks_posted_by_fkey(full_name,avatar_url)")
        .eq("status", "draft")
        .eq("moderation_state", "pending_review")
        .order("created_at", { ascending: true }),
      supabase
        .from("verification_requests")
        .select(
          "id,type,status,school_name,institution_or_company,document_name,document_path,created_at,user_id",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("reports")
        .select("id,reason,status,created_at")
        .in("status", ["open", "under_review"])
        .order("created_at", { ascending: true }),
      supabase
        .from("disputes")
        .select("id,reason,status,created_at")
        .in("status", ["open", "under_review"])
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,full_name,city,trust_factor,completed_tasks_count")
        .order("full_name"),
      supabase
        .from("user_roles")
        .select("user_id,role")
        .in("role", ["admin", "moderator"]),
      supabase
        .from("categories")
        .select("id,name,slug,icon,is_active")
        .order("name"),
      supabase
        .from("admin_audit_logs")
          .select("id,action,entity_type,created_at,profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setTasks((taskResult.data || []) as StaffTaskRecord[]);
    setVerifications((verificationResult.data || []) as VerificationRecord[]);
    setReports((reportResult.data || []) as ReportRecord[]);
    setDisputes((disputeResult.data || []) as DisputeRecord[]);
    setMembers((memberResult.data || []) as StaffMember[]);
    setRoles((roleResult.data || []) as { user_id: string; role: string }[]);
    setCategories((categoryResult.data || []) as StaffCategory[]);
    setAudit(
      (auditResult.data || []) as {
        id: string;
        action: string;
        entity_type: string;
        created_at: string;
      }[],
    );
    const firstError = [
      taskResult.error,
      verificationResult.error,
      reportResult.error,
      disputeResult.error,
      memberResult.error,
      roleResult.error,
      categoryResult.error,
      auditResult.error,
    ].find(Boolean);
    setNotice(firstError ? firstError.message : "");
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const approveTask = async (task: StaffTaskRecord, approved: boolean, modalReason?: string) => {
    if (!session) {
      setNotice("Sign in with a real staff account to make decisions.");
      return;
    }
    if (!approved && !modalReason) {
      setRejectModal({ type: 'task', record: task });
      setRejectReason("");
      return;
    }
    const reason = modalReason || "";
    const result = await supabase
      .from("tasks")
      .update(
        approved
          ? {
              status: "open",
              moderation_state: "approved",
              moderation_note: null,
              moderated_by: session.user.id,
              moderated_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
            }
          : {
              status: "draft",
              moderation_state: "rejected",
              moderation_note: reason,
              moderated_by: session.user.id,
              moderated_at: new Date().toISOString(),
            },
      )
      .eq("id", task.id);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await supabase
      .from("task_status_history")
      .insert({
        task_id: task.id,
        previous_status: "draft",
        new_status: approved ? "open" : "draft",
        changed_by: session.user.id,
        note: approved ? "Approved for Marketplace" : reason,
      });
    setNotice(
      approved
        ? "Task approved and now visible to all members."
        : "Task rejected with a private reason for the poster.",
    );
    await logAdminAction(approved ? `Approved task: ${task.title}` : `Rejected task: ${task.title}`, "task");
    await load();
  };

  const decideVerification = async (
    record: VerificationRecord,
    approved: boolean,
    reason?: string,
  ) => {
    if (!session) return;
    if (!approved && !reason) {
      // Open rejection modal instead of window.prompt
      setRejectModal({ type: 'verification', record });
      setRejectReason("");
      return;
    }
    const { error } = await supabase
      .from("verification_requests")
      .update({
        status: approved ? "approved" : "rejected",
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", record.id);
      
    if (!error) {
      // Also update the profile verification_status directly
      await supabase
        .from("profiles")
        .update({
          verification_status: approved ? "verified" : "rejected",
        })
        .eq("id", record.user_id);
        
      // Fetch user email via RPC to send email
      try {
        const { data: contact } = await supabase.rpc('get_user_contact_info', { uid: record.user_id });
        if (contact && contact.email) {
          const emailSubject = approved ? 'QuestKarte — Your account has been verified! ✓' : 'QuestKarte — Verification update required';
          const emailBody = approved 
            ? `<div style="background-color:#071124;padding:40px 20px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background-color:#0f1b38;border-radius:16px;border:1px solid #1e2d54;overflow:hidden;"><tr><td style="background-color:#0a1530;padding:30px 36px 22px;border-bottom:1px solid #1a2847;"><div style="font-size:26px;font-weight:900;color:#f0c05a;letter-spacing:4px;font-family:Georgia,serif;">QUESTKARTE</div><div style="font-size:16px;font-weight:700;color:#c9d4ec;margin-top:14px;">Account Verified</div></td></tr><tr><td style="padding:30px 36px 10px;"><p style="color:#c9d4ec;font-size:15px;margin:0 0 4px;font-family:'Segoe UI',Arial,sans-serif;">Hello ${contact.name},</p></td></tr><tr><td style="padding:0 36px;"><div style="background-color:rgba(70,214,163,0.1);border:2px solid rgba(70,214,163,0.4);border-radius:14px;padding:22px;text-align:center;margin:20px 0;"><span style="font-size:36px;color:#46d6a3;">✓</span><p style="font-size:18px;font-weight:800;color:#46d6a3;margin:8px 0 0;">Verification Approved</p></div><p style="color:#8392b3;font-size:14px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">Your identity documents have been reviewed and approved by our team. You now have full access to the QuestKarte marketplace.</p></td></tr></table></div>`
            : `<div style="background-color:#071124;padding:40px 20px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background-color:#0f1b38;border-radius:16px;border:1px solid #1e2d54;overflow:hidden;"><tr><td style="background-color:#0a1530;padding:30px 36px 22px;border-bottom:1px solid #1a2847;"><div style="font-size:26px;font-weight:900;color:#f0c05a;letter-spacing:4px;font-family:Georgia,serif;">QUESTKARTE</div><div style="font-size:16px;font-weight:700;color:#c9d4ec;margin-top:14px;">Verification Update</div></td></tr><tr><td style="padding:30px 36px 10px;"><p style="color:#c9d4ec;font-size:15px;margin:0 0 4px;font-family:'Segoe UI',Arial,sans-serif;">Hello ${contact.name},</p></td></tr><tr><td style="padding:0 36px;"><div style="background-color:rgba(255,107,82,0.08);border:2px solid rgba(255,107,82,0.4);border-radius:14px;padding:22px;text-align:center;margin:20px 0;"><span style="font-size:36px;color:#ff6b52;">⚠</span><p style="font-size:18px;font-weight:800;color:#ff6b52;margin:8px 0 0;">Additional Information Needed</p></div><p style="color:#8392b3;font-size:14px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">Our team reviewed your documents but was unable to approve your verification at this time.</p><div style="background-color:#111d3a;border-left:3px solid #ff6b52;border-radius:0 10px 10px 0;padding:14px 18px;margin:16px 0;"><p style="color:#7a8aaa;font-size:13px;margin:0;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;"><strong>Moderator note:</strong> ${reason || 'Please submit clearer documents.'}</p></div><p style="color:#8392b3;font-size:14px;line-height:1.6;margin-top:16px;font-family:'Segoe UI',Arial,sans-serif;">Please sign in to QuestKarte and submit a new verification request with corrected documents.</p></td></tr></table></div>`;
          
          const { error: invokeError } = await supabase.functions.invoke('send-email', {
            body: { to: contact.email, subject: emailSubject, html: emailBody }
          });
          
          if (invokeError) {
            console.error("Email send failed:", invokeError);
            setNotice("Action succeeded, but email failed to send. Check console.");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to send email:", err);
      }
    }
    
    setNotice(
      error
        ? error.message
        : approved
          ? "Verification approved. Email sent successfully."
          : "Verification rejected. Email sent successfully."
    );
    if (!error) {
      await logAdminAction(approved ? `Approved verification for user` : `Rejected verification for user`, "verification");
      await load();
    }
  };

  const openVerificationEvidence = async (record: VerificationRecord) => {
    const { data, error } = await supabase
      .from("verification_evidence")
      .select("evidence_kind,storage_path,file_name,mime_type")
      .eq("request_id", record.id);
    const documents = error
      ? [
          {
            evidence_kind: "primary_document",
            storage_path: record.document_path,
            file_name: record.document_name,
            mime_type: null,
          },
        ]
      : data || [];
    const results = await Promise.all(
      documents.map(async (document) => ({
        document,
        signed: await supabase.storage
          .from("verification-documents")
          .createSignedUrl(document.storage_path, 300),
      })),
    );
    const items = results.flatMap(({ document, signed }) =>
      signed.data?.signedUrl
        ? [
            {
              label: document.evidence_kind.replaceAll("_", " "),
              fileName: document.file_name,
              mimeType: document.mime_type,
              url: signed.data.signedUrl,
            },
          ]
        : [],
    );
    if (!items.length) {
      setNotice(
        error?.message ||
          "Private documents could not be opened. Run the latest verification database query first.",
      );
      return;
    }
    setEvidencePreview({
      title:
        record.type === "student"
          ? "Student verification evidence"
          : "Professional verification evidence",
      items,
    });
  };

  const openTaskEvidence = async (task: StaffTaskRecord) => {
    const { data } = await supabase
      .from("task_attachments")
      .select("storage_path")
      .eq("task_id", task.id)
      .order("created_at");
      
    const images: string[] = [];
    if (data && data.length > 0) {
      await Promise.all(
        data.map(async (doc) => {
          const { data: signed } = await supabase.storage.from("task-attachments").createSignedUrl(doc.storage_path, 3600);
          if (signed?.signedUrl) images.push(signed.signedUrl);
        })
      );
    }
    
    const poster = members.find((m) => m.id === task.posted_by);
    const category = categories.find((c) => c.id === task.category_id);
    
    setTaskPreview({
      id: task.id,
      title: task.title,
      description: task.description,
      category: category?.name || "General",
      commission: task.is_service_swap
        ? task.swap_details || "Service swap"
        : `${task.currency === "PHP" ? "PHP " : ""}${Number(task.commission_amount || 0).toLocaleString()}`,
      location: task.location_label,
      schedule: `Submitted ${new Date(task.created_at).toLocaleDateString()}`,
      posterName: poster?.full_name || "QuestKarte member",
      trust: `Trust Factor ${poster?.trust_factor || 0}`,
      initials: (poster?.full_name || "QM").slice(0, 2).toUpperCase(),
      kind: task.is_service_swap ? "swap" : task.requires_student_verification ? "student" : undefined,
      images,
    });
  };

  const resolveCase = async (
    table: "reports" | "disputes",
    id: string,
    outcome: "resolved" | "dismissed",
  ) => {
    if (!session) return;
    const note = window
      .prompt(
        outcome === "resolved"
          ? "Resolution note for staff history:"
          : "Reason for dismissing this case:",
      )
      ?.trim();
    if (!note) return;
    const { error } = await supabase
      .from(table)
      .update({
        status: outcome,
        handled_by: session.user.id,
        resolution_note: note,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    setNotice(error ? error.message : `Case marked ${outcome}.`);
    if (!error) {
      await logAdminAction(`${outcome === 'resolved' ? 'Resolved' : 'Dismissed'} ${table === 'reports' ? 'report' : 'dispute'}`, table);
      await load();
    }
  };

  const promote = async (member: StaffMember) => {
    const ok = window.confirm(
      `Make ${member.full_name} a QuestKarte Moderator? They will gain review permissions.`,
    );
    if (!ok) return;
    const { error } = await supabase.rpc("promote_to_moderator", {
      target_user_id: member.id,
    });
    setNotice(
      error
        ? `${error.message} Run the latest staff migration first.`
        : `${member.full_name} is now a Moderator.`,
    );
    if (!error) {
      await logAdminAction(`Promoted ${member.full_name} to Moderator`, "moderator");
      await load();
    }
  };

  const addCategory = async () => {
    const name = window.prompt("New category name:")?.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const { error } = await supabase
      .from("categories")
      .insert({ name, slug, icon: "circle" });
    setNotice(error ? error.message : `${name} category added.`);
    if (!error) {
      await logAdminAction(`Added category: ${name}`, "category");
      await load();
    }
  };

  const moderatorIds = new Set(
    roles
      .filter((item) => item.role === "moderator")
      .map((item) => item.user_id),
  );
  const visibleMembers = members.filter(
    (member) =>
      !roles.some(
        (item) => item.user_id === member.id && item.role === "admin",
      ),
  );
  const title = isAdmin ? "Admin command center" : "Moderator console";

  const content = () => {
    if (tab === "overview")
      return (
        <div className="staff-overview">
            {isAdmin && <AdminAnalyticsDashboard />}
            <div style={{ padding: 30, background: 'linear-gradient(135deg, #101d57, #1b2f7a)', color: 'white', borderRadius: 16, marginBottom: 24, marginTop: isAdmin ? 24 : 0, boxShadow: '0 10px 30px rgba(16,29,87,0.2)' }}>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>Platform Health Analytics</h3>
              <p style={{ margin: 0, opacity: 0.8, marginTop: 8, fontSize: 15 }}>Real-time metrics and moderation queue status across the entire marketplace.</p>
            </div>
            
            <section className="staff-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 40 }}>
              <div className="staff-metric" style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f3f8' }}>
                <span style={{ color: '#52617f', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>Total Members</span>
                <strong style={{ fontSize: 36, display: 'block', margin: '12px 0', color: '#101d57' }}>{members.length}</strong>
                <div style={{ width: '100%', height: 8, background: '#e1e6f0', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', background: '#46d6a3' }}></div></div>
                <small style={{ marginTop: 12, display: 'block', color: '#74819c' }}>Registered accounts</small>
              </div>
              
              <div className="staff-metric" style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f3f8' }}>
                <span style={{ color: '#52617f', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>Pending Tasks</span>
                <strong style={{ fontSize: 36, display: 'block', margin: '12px 0', color: '#101d57' }}>{tasks.length}</strong>
                <div style={{ width: '100%', height: 8, background: '#e1e6f0', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (tasks.length / 50) * 100)}%`, height: '100%', background: '#f5a623' }}></div></div>
                <small style={{ marginTop: 12, display: 'block', color: '#74819c' }}>Awaiting safety review</small>
              </div>

              <div className="staff-metric" style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f3f8' }}>
                <span style={{ color: '#52617f', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>Open Reports</span>
                <strong style={{ fontSize: 36, display: 'block', margin: '12px 0', color: '#a43f3f' }}>{reports.length}</strong>
                <div style={{ width: '100%', height: 8, background: '#e1e6f0', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (reports.length / 20) * 100)}%`, height: '100%', background: '#a43f3f' }}></div></div>
                <small style={{ marginTop: 12, display: 'block', color: '#74819c' }}>Needs moderation</small>
              </div>

              <div className="staff-metric" style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f3f8' }}>
                <span style={{ color: '#52617f', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>Open Disputes</span>
                <strong style={{ fontSize: 36, display: 'block', margin: '12px 0', color: '#a43f3f' }}>{disputes.length}</strong>
                <div style={{ width: '100%', height: 8, background: '#e1e6f0', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (disputes.length / 20) * 100)}%`, height: '100%', background: '#a43f3f' }}></div></div>
                <small style={{ marginTop: 12, display: 'block', color: '#74819c' }}>Requires a decision</small>
              </div>
            </section>
        </div>
      );
    if (tab === "task_review")
      return (
        <section className="panel staff-queue">
          <div className="panel-title-row">
            <div>
              <h3>Task review queue</h3>
              <p>Only approved tasks are released to the public Marketplace.</p>
            </div>
            <button className="btn" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          {tasks.length ? (
            tasks.map((task) => (
              <article className="staff-case" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                    {(Array.isArray(task.poster) ? task.poster[0] : task.poster)?.avatar_url ? (
                      <img src={task.poster.avatar_url} alt="Profile" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
                        {(Array.isArray(task.poster) ? task.poster[0] : task.poster)?.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '13px' }}>{(Array.isArray(task.poster) ? task.poster[0] : task.poster)?.full_name || "Unknown"}</span>
                      {/* Note: email is not stored in public profiles table, so we use a placeholder or omit it */}
                    </div>
                  </div>
                  <span>
                    {task.location_label} · submitted{" "}
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                  <p>{task.description}</p>
                </div>
                <div className="staff-actions">
                  <button
                    className="btn secondary"
                    onClick={() => void openTaskEvidence(task)}
                  >
                    View Post
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => void approveTask(task, true)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      setRejectModal({ type: 'task', record: task });
                      setRejectReason("");
                    }}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="feed-message">No pending task submissions.</p>
          )}
        </section>
      );
    if (tab === "verification")
      return (
        <section className="panel staff-queue">
          <h3>Verification queue</h3>
          {verifications.length ? (
            verifications.map((record) => (
                <VerificationQueueItem 
                  key={record.id} 
                  record={record} 
                  openVerificationEvidence={openVerificationEvidence} 
                  decideVerification={decideVerification} 
                  setRejectModal={(m) => { setRejectModal(m); setRejectReason(""); }} 
                />
              ))
          ) : (
            <p className="feed-message">
              No verification requests are waiting.
            </p>
          )}
        </section>
      );
    if (tab === "reports")
      return (
        <section className="panel staff-queue">
          <h3>Reports</h3>
          {reports.length ? (
            reports.map((report) => (
              <article className="staff-case" key={report.id}>
                <div>
                  <strong>{report.reason}</strong>
                  <span>
                    {report.status} · filed{" "}
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="staff-actions">
                  <button
                    className="btn primary"
                    onClick={() =>
                      void resolveCase("reports", report.id, "resolved")
                    }
                  >
                    Resolve
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      void resolveCase("reports", report.id, "dismissed")
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="feed-message">No open reports.</p>
          )}
        </section>
      );
    if (tab === "disputes")
      return (
        <section className="panel staff-queue">
          <h3>Disputes</h3>
          {disputes.length ? (
            disputes.map((dispute) => (
              <article className="staff-case" key={dispute.id}>
                <div>
                  <strong>{dispute.reason}</strong>
                  <span>
                    {dispute.status} · filed{" "}
                    {new Date(dispute.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="staff-actions">
                  <button
                    className="btn primary"
                    onClick={() =>
                      void resolveCase("disputes", dispute.id, "resolved")
                    }
                  >
                    Resolve
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      void resolveCase("disputes", dispute.id, "dismissed")
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="feed-message">No open disputes.</p>
          )}
        </section>
      );
    if (tab === "members")
      return (
        <section className="panel staff-queue">
          <h3>Member management</h3>
          {visibleMembers.map((member) => (
            <article className="staff-case" key={member.id}>
              <div>
                <strong>{member.full_name}</strong>
                <span>
                  {member.city || "Area not set"} · Trust Factor{" "}
                  {member.trust_factor} · {member.completed_tasks_count}{" "}
                  completed
                </span>
              </div>
              <button
                className="btn"
                onClick={() => void promote(member)}
                disabled={moderatorIds.has(member.id)}
              >
                {moderatorIds.has(member.id) ? "Moderator" : "Make moderator"}
              </button>
            </article>
          ))}
        </section>
      );
    if (tab === "moderators")
      return (
        <section className="panel staff-queue">
          <h3>Moderator management</h3>
          <p className="form-intro">
            The Admin promotes existing member accounts. Moderators cannot
            create staff accounts.
          </p>
          {members
            .filter((member) => moderatorIds.has(member.id))
            .map((member) => (
              <article className="staff-case" key={member.id}>
                <div>
                  <strong>{member.full_name}</strong>
                  <span>Moderator · Trust Factor {member.trust_factor}</span>
                </div>
                <span className="role-chip">Active</span>
              </article>
            ))}
        </section>
      );
    if (tab === "categories")
      return (
        <section className="panel staff-queue">
          <div className="panel-title-row">
            <div>
              <h3>Marketplace categories</h3>
              <p>Only the Admin can add or manage category availability.</p>
            </div>
            <button className="btn primary" onClick={() => void addCategory()}>
              Add category
            </button>
          </div>
          <div className="category-admin-grid">
            {categories.map((category) => (
              <article key={category.id}>
                <strong>{category.name}</strong>
                <span>{category.is_active ? "Active" : "Hidden"}</span>
                <button
                  className="btn"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("categories")
                      .update({ is_active: !category.is_active })
                      .eq("id", category.id);
                    setNotice(
                      error ? error.message : `${category.name} updated.`,
                    );
                    if (!error) await load();
                  }}
                >
                  {category.is_active ? "Hide" : "Activate"}
                </button>
              </article>
            ))}
          </div>
        </section>
      );
    return (
      <section className="panel staff-queue">
        <div className="panel-title-row">
          <div>
            <h3>Audit log</h3>
            <p>Recorded actions taken by authorised staff.</p>
          </div>
          <button className="btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {audit.length ? (
            audit.map((entry) => (
              <article className="staff-case" key={entry.id}>
                <div>
                  <strong>{entry.action}</strong>
                  <span>
                    {entry.entity_type} {entry.profiles?.full_name ? "by " + entry.profiles.full_name : ""} •{" "}
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              </article>
            ))
          ) : (
          <p className="feed-message">
            No staff actions have been recorded yet.
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="staff-workspace view">
      {taskPreview && (
        <TaskDetailModal 
          quest={taskPreview} 
          onClose={() => setTaskPreview(null)} 
        />
      )}
      <section className="staff-workspace-hero">
        <div>
          <span className="eyebrow">QuestKarte staff access</span>
          <h2>{title}</h2>
          <p>
            {isAdmin
              ? "Platform governance, member access, categories, and activity oversight."
              : "Safety decisions, task review, verification, reports, and disputes."}
          </p>
        </div>
        <div className="staff-identity">
          <span>{isAdmin ? "A" : "M"}</span>
          <div>
            <strong>{isAdmin ? "Administrator" : "Moderator"}</strong>
            <small>{session?.user.email || "Preview account"}</small>
          </div>
          <button className="btn" onClick={onExit}>
            Sign out
          </button>
        </div>
      </section>
      <nav className="staff-tabs" aria-label="Staff tools">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {loading ? (
        <section className="panel feed-message">
          Loading staff workspace...
        </section>
      ) : (
        content()
      )}
      {notice && <p className="staff-notice">{notice}</p>}
      {evidencePreview && (
        <VerificationEvidenceModal
          preview={evidencePreview}
          onClose={() => setEvidencePreview(null)}
        />
      )}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} role="presentation" onClick={() => setRejectModal(null)}>
          <div style={{ position: 'relative', width: 'min(100%, 480px)', borderRadius: '18px', padding: '30px', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,.3)', color: '#1a2847' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" style={{ position: 'absolute', right: '14px', top: '12px', border: 0, background: 'transparent', color: '#6b7a9e', fontSize: '24px', cursor: 'pointer' }} onClick={() => setRejectModal(null)} aria-label="Close">×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fff0ef', display: 'grid', placeItems: 'center', fontSize: '20px', flexShrink: 0 }}>⚠</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1a2847' }}>
                  {rejectModal.type === 'verification' ? 'Reject Verification' : 'Reject Task'}
                </h3>
                <p style={{ margin: '2px 0 0', color: '#6b7a9e', fontSize: '13px' }}>
                  The {rejectModal.type === 'verification' ? 'member' : 'poster'} will see this reason privately.
                </p>
              </div>
            </div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '13px', color: '#3a4a6a' }}>Rejection reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={rejectModal.type === 'verification'
                ? 'e.g. The uploaded student ID is blurry and unreadable. Please re-submit a clearer photo.'
                : 'e.g. This task description contains prohibited content.'}
              rows={4}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #d0d9ea', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', color: '#1a2847' }}
              autoFocus
            />
            <p style={{ margin: '8px 0 18px', color: '#9aa2ba', fontSize: '12px', lineHeight: 1.5 }}>
              This reason will be sent to the {rejectModal.type === 'verification' ? "member's" : "poster's"} email and shown in their dashboard.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" style={{ padding: '10px 20px', border: '1px solid #d0d9ea', borderRadius: '10px', background: '#fff', color: '#3a4a6a', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setRejectModal(null)}>Cancel</button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                style={{ padding: '10px 24px', border: 0, borderRadius: '10px', background: rejectReason.trim() ? '#c94a35' : '#e0c9c5', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', opacity: rejectReason.trim() ? 1 : 0.7 }}
                onClick={async () => {
                  const reason = rejectReason.trim();
                  if (!reason) return;
                  if (rejectModal.type === 'verification') {
                    await decideVerification(rejectModal.record as VerificationRecord, false, reason);
                  } else {
                    await approveTask(rejectModal.record as StaffTaskRecord, false);
                  }
                  setRejectModal(null);
                  setRejectReason("");
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationEvidenceModal({
  preview,
  onClose,
}: {
  preview: { title: string; items: VerificationEvidencePreview[] };
  onClose: () => void;
}) {
  return (
    <div
      className="evidence-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="evidence-modal"
        role="dialog"
        aria-modal="true"
        aria-label={preview.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="evidence-modal-head">
          <div>
            <span className="eyebrow">Private staff review</span>
            <h3>{preview.title}</h3>
            <p>
              All files submitted by this member. Links expire after five
              minutes.
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="evidence-preview-grid">
          {preview.items.map((item) => (
            <article key={item.url} className="evidence-preview-item">
              <div className="evidence-preview-media">
                {item.mimeType?.startsWith("image/") ? (
                  <img src={item.url} alt={item.label} />
                ) : (
                  <span>PDF</span>
                )}
              </div>
              <div>
                <strong>{item.label}</strong>
                <span>{item.fileName}</span>
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open full file
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const Brand = ({ markOnly = false }: { markOnly?: boolean }) => (
  <div className="brand">
    <div className="brand-mark">
      <img src="/questkarte-logo.svg" alt="QuestKarte emblem" />
    </div>
    {!markOnly && <span className="brand-word">QuestKarte</span>}
  </div>
);
const RailItem = ({
  item,
  active,
  onClick,
  badge,
}: {
  item: (typeof nav)[number];
  active: boolean;
  onClick: () => void;
  badge?: number;
}) => (
  <button className={`rail-item ${active ? "active" : ""}`} onClick={onClick} style={{ position: 'relative' }}>
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {item.icon}
      {badge && badge > 0 ? (
        <span style={{ position: 'absolute', top: -6, right: -8, background: '#e53935', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1, boxShadow: '0 0 0 2px #1a2340' }}>{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </span>
    <small>{item.label}</small>
  </button>
);
const NavButton = ({
  item,
  active,
  onClick,
}: {
  item: (typeof nav)[number];
  active: boolean;
  onClick: () => void;
}) => (
  <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
    <span>{item.icon}</span>
    <small>{item.label}</small>
  </button>
);
const Toggle = ({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <div className="toggle-row">
    <div>
      <div className="tt">{title}</div>
      <div className="td">{detail}</div>
    </div>
    <button
      type="button"
      className={`switch ${checked ? "on" : ""}`}
      onClick={onChange}
      aria-pressed={checked}
    />
  </div>
);
const Progress = ({ percent }: { percent: number }) => (
  <div className="xp-path">
    <div className="xp-path-fill" style={{ width: `${percent}%` }} />
    <i className="xp-node done" style={{ left: "0%" }} />
    <i className="xp-node done" style={{ left: "33%" }} />
    <i className="xp-node current" style={{ left: `${percent}%` }} />
    <i className="xp-node" style={{ left: "100%" }} />
    <span className="xp-label done" style={{ left: "0%" }}>
      Open
    </span>
    <span className="xp-label current" style={{ left: `${percent}%` }}>
      Ongoing
    </span>
    <span className="xp-label" style={{ left: "100%" }}>
      Done
    </span>
  </div>
);
const Conversation = ({
  name,
  quest,
  snippet,
  active,
  onClick,
}: {
  name: string;
  quest: string;
  snippet: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button className={`convo-item ${active ? "active" : ""}`} onClick={onClick}>
    <span className="avatar">
      {name
        .split(" ")
        .map((word) => word[0])
        .join("")}
    </span>
    <span className="convo-info">
      <span className="convo-name">
        {name}
        <small className="time">2m</small>
      </span>
      <span className="convo-quest">{quest}</span>
      <span className="convo-snip">{snippet}</span>
    </span>
    {active && <i className="unread-dot" />}
  </button>
);
const Stat = ({
  label,
  value,
  percent,
  gold,
}: {
  label: string;
  value: string;
  percent: number;
  gold?: boolean;
}) => (
  <div className="stat-bar-row">
    <div className="sb-top">
      <span className="lb">{label}</span>
      <span className="val">{value}</span>
    </div>
    <div className="sb-track">
      <div
        className={`sb-fill ${gold ? "gold-fill" : ""}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  </div>
);
const Medal = ({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: string;
}) => (
  <div className="medal">
    <div className={`medal-ic ${tone}`}>
      <span className="in">{icon}</span>
    </div>
    <span className="lb">{label}</span>
  </div>
);
const Setting = ({
  icon,
  name,
  onClick,
}: {
  icon: string;
  name: string;
  onClick: () => void;
}) => (
  <button className="settings-item" onClick={onClick}>
    <span className="left">
      <span className="settings-ic">{icon}</span>
      {name}
    </span>
    <span>›</span>
  </button>
);
const Empty = () => (
  <div className="empty-state">
    <div>⌕</div>
    <h3>No quests match that filter</h3>
    <p>Try broadening your search or explore another category.</p>
    <button>Reset search</button>
  </div>
);
const titleFor = (page: Page) =>
  ({
    home: "Find your next quest",
    tasks: "Your quest log",
    post: "Forge a new quest",
    chat: "Messages",
    account: "Your member profile",
    settings: "Settings",
    staff: "Staff workspace",
  })[page];
const subtitleFor = (page: Page) =>
  ({
    home: "Smart matches based on your skills and location.",
    tasks: "Stay on top of every task, application, and milestone.",
    post: "Share a clear task and find the right person faster.",
    chat: "Coordinate safely without leaving QuestKarte.",
    account: "Your reputation grows with every completed quest.",
    settings: "Manage your profile, preferences, and session.",
    staff: "Role-based tools for a safe, trusted marketplace.",
  })[page];
const categoryIcon = (category: string) =>
  ({
    Cleaning: "⌁",
    Delivery: "→",
    Tutoring: "⌘",
    Design: "✦",
    Errands: "◌",
    Other: "◇",
  })[category] || "◇";

/* ─── Timeline stepper helper ─────────────────────────────────────── */
type TLStage = {
  label: string;
  date?: string;
  done: boolean;
  current: boolean;
};
function TaskTimeline({ stages }: { stages: TLStage[] }) {
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  return (
    <div className="task-timeline">
      {stages.map((stage, i) => (
        <div
          key={i}
          className={`tl-step ${stage.done ? "done" : ""} ${stage.current ? "current" : ""}`.trim()}
        >
          <div className="tl-dot">
            {stage.done && <CheckIcon />}
            {!stage.done && stage.current && (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
              </svg>
            )}
          </div>
          <div className="tl-label">
            <strong>{stage.label}</strong>
            {stage.date && <small>{stage.date}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

/* ─── Payment receipt card ─────────────────────────────────────────── */
function PaymentReceiptCard({
  task,
}: {
  task: {
    title: string;
    commission_amount: number | null;
    currency: string;
    payment_type: string;
    completed_at: string | null;
    poster_name?: string;
    provider_name?: string;
    payment_status?: string;
    is_service_swap?: boolean;
  };
}) {
  const isGcash = task.payment_type === "gcash";
  const amount = Number(task.commission_amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  });
  const completedDate = task.completed_at
    ? new Date(task.completed_at).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  if (!isGcash) {
    if (task.payment_status === 'paid' || task.is_service_swap) return null;
    return (
      <div className="cash-meetup-card">
        <svg viewBox="0 0 24 24">
          <path d="M17 11V7a5 5 0 0 0-10 0v4" />
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <circle cx="12" cy="16" r="1" />
        </svg>
        <div className="cash-meetup-body">
          <strong>Ready to meet up for cash payment</strong>
          <p>
            The job is confirmed done. Use the task chat to arrange a time and
            place to complete the cash exchange safely.
          </p>
          <span className="tlc-meta">
            <span className="tlc-reward">₱ {amount}</span> · agreed amount
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="payment-receipt">
      <div className="payment-receipt-header">
        <svg
          viewBox="0 0 24 24"
          style={{
            stroke: "#fff",
            fill: "none",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div>
          <strong>Payment Released</strong>
          <span>QuestKarte Transaction Receipt</span>
        </div>
      </div>
      <div className="payment-receipt-body">
        <div className="receipt-row receipt-amount-row">
          <span>Amount</span>
          <strong>₱ {amount}</strong>
        </div>
        <div className="receipt-row">
          <span>Task</span>
          <strong>{task.title}</strong>
        </div>
        <div className="receipt-row">
          <span>Method</span>
          <strong>GCash (simulated escrow)</strong>
        </div>
        <div className="receipt-row">
          <span>Status</span>
          <strong style={{ color: "#1a7a45" }}>✓ Released to provider</strong>
        </div>
        <div className="receipt-row">
          <span>Completed</span>
          <strong>{completedDate}</strong>
        </div>
      </div>
    </div>
  );
}

/* ─── Full task lifecycle workspace ───────────────────────────────── */

function TaskReviewForm({
  task,
  isClient,
  tfDelta,
  submitReview,
}: {
  task: any;
  isClient: boolean;
  tfDelta?: number;
  submitReview: (task: any, isClient: boolean, rating: number, comment: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const commentRef = useRef("");

  return (
    <div className="tlc-review-zone">
      <h4>Rate your {isClient ? "client" : "provider"}</h4>
      <div className="review-stars-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            className={rating >= star ? "selected" : ""}
            onClick={() => setRating(star)}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        defaultValue={""}
        maxLength={1500}
        onChange={(e) => { commentRef.current = e.target.value; }}
        placeholder={`Optional written ${isClient ? 'feedback' : 'review'} visible on the ${isClient ? "client's" : "provider's"} profile.`}
      />
      <button
        type="button"
        className="btn primary"
        onClick={() => void submitReview(task, isClient, rating, commentRef.current)}
      >
        Submit review
      </button>
      {tfDelta !== undefined && (
        <div className={`tf-delta-toast ${tfDelta < 0 ? "negative" : ""}`}>
          {tfDelta >= 0 ? `+${tfDelta}` : tfDelta} Trust Factor{" "}
          {tfDelta >= 0
            ? `earned by ${isClient ? "client" : "provider"}`
            : `deducted from ${isClient ? "client" : "provider"}`}
        </div>
      )}
    </div>
  );
}

function TaskWorkspace({

  session,
  onGoPost,
  onOpenChat = () => {},
}: {
  session: Session;
  onGoPost: () => void;
  onOpenChat?: (taskId: string) => void;
}) {
  // ── Types ──────────────────────────────────────────────────────────
  type FullTask = {
    id: string;
    title: string;
    status:
      | "draft"
      | "open"
      | "assigned"
      | "in_progress"
      | "pending_client_review"
      | "swap_in_progress"
      | "pending_swap_review"
      | "completed"
      | "cancelled"
      | "disputed";
    moderation_state: string;
    assigned_to: string | null;
    posted_by: string;
    created_at: string;
    deadline_at: string | null;
    completed_at: string | null;
    commission_amount: number | null;
    currency: string;
    payment_type: string;
    payment_status: string;
    category_id: string | null;
    is_service_swap: boolean;
    swap_details: string | null;
  };
  type AcceptedApplication = {
    id: string;
    status: string;
    created_at: string;
    task: FullTask | null;
  };
  type Deliverable = {
    id: string;
    task_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    submitted_by: string;
    signedUrl?: string;
  };

  // ── State ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"posted" | "applied">(() => (localStorage.getItem('questkarte-tasks-tab') as any) || "posted");
    useEffect(() => { localStorage.setItem('questkarte-tasks-tab', tab); }, [tab]);
  const [posted, setPosted] = useState<FullTask[]>([]);
  const [applied, setApplied] = useState<AcceptedApplication[]>([]);
  const [deliverablesByTask, setDeliverablesByTask] = useState<
    Record<string, Deliverable[]>
  >({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [cameraTask, setCameraTask] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [confirmingTask, setConfirmingTask] = useState<string | null>(null);
      const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [fullyReviewedTaskIds, setFullyReviewedTaskIds] = useState<string[]>([]);
  const [tfDeltas, setTfDeltas] = useState<Record<string, number>>({});

  // ── Load ───────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const [own, mine, reviewRows] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,status,moderation_state,assigned_to,posted_by,created_at,deadline_at,completed_at,commission_amount,currency,payment_type,payment_status,category_id,is_service_swap,swap_details",
        )
        .eq("posted_by", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select(
          "id,status,created_at,task:tasks(id,title,status,moderation_state,assigned_to,posted_by,created_at,deadline_at,completed_at,commission_amount,currency,payment_type,payment_status,category_id,is_service_swap,swap_details)",
        )
        .eq("applicant_id", session.user.id)
          .neq("status", "rejected")
          .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("task_id, reviewer_id")
        .or(`reviewer_id.eq.${session.user.id},reviewee_id.eq.${session.user.id}`),
    ]);
    const ownedTasks = (own.data || []) as FullTask[];
    const appliedList = (mine.data || []) as unknown as AcceptedApplication[];
    setPosted(ownedTasks);
    setApplied(appliedList);
    
    const allReviews = (reviewRows.data || []) as { task_id: string; reviewer_id: string }[];
    setReviewedIds(allReviews.filter(r => r.reviewer_id === session.user.id).map(r => r.task_id));
    
    const reviewCounts = allReviews.reduce((acc, r) => {
      acc[r.task_id] = (acc[r.task_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setFullyReviewedTaskIds(Object.keys(reviewCounts).filter(id => reviewCounts[id] >= 2));

    // Load deliverables for all active tasks
    const activeTaskIds = [
      ...ownedTasks
        .filter((t) =>
          [
            "assigned",
            "in_progress",
            "pending_client_review",
            "swap_in_progress",
            "pending_swap_review",
            "completed",
          ].includes(t.status),
        )
        .map((t) => t.id),
      ...appliedList
        .filter(
          (a) =>
            a.task &&
            [
              "assigned",
              "in_progress",
              "pending_client_review",
              "swap_in_progress",
              "pending_swap_review",
              "completed",
            ].includes(a.task.status),
        )
        .map((a) => a.task!.id),
    ];
    if (activeTaskIds.length) {
      const { data: delivs } = await supabase
        .from("task_deliverables")
        .select("id,task_id,storage_path,file_name,mime_type,submitted_by")
        .in("task_id", activeTaskIds)
        .order("created_at", { ascending: false });
      const byTask: Record<string, Deliverable[]> = {};
      await Promise.all(
        (delivs || []).map(async (d) => {
          const { data: signed } = await supabase.storage
            .from("task-deliverables")
            .createSignedUrl(d.storage_path, 3600);
          (byTask[d.task_id] ||= []).push({
            ...d,
            signedUrl: signed?.signedUrl,
          });
        }),
      );
      setDeliverablesByTask(byTask);
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  // ── Helpers ────────────────────────────────────────────────────────
  const tlStages = (task: FullTask, hasReviewed: boolean): TLStage[] => {
    const s = task.status;
    const isDone = (stages: string[]) => stages.includes(s);
    
    if (task.is_service_swap) {
      return [
        {
          label: "Open",
          date: fmtDate(task.created_at),
          done: isDone(["assigned", "in_progress", "pending_client_review", "swap_in_progress", "pending_swap_review", "completed"]),
          current: s === "open" || s === "draft",
        },
        {
          label: "Applicant Works",
          date: undefined,
          done: isDone(["pending_client_review", "swap_in_progress", "pending_swap_review", "completed"]),
          current: s === "assigned" || s === "in_progress",
        },
        {
          label: "App. Review",
          date: undefined,
          done: isDone(["swap_in_progress", "pending_swap_review", "completed"]),
          current: s === "pending_client_review",
        },
        {
          label: "Provider Works",
          date: undefined,
          done: isDone(["pending_swap_review", "completed"]),
          current: s === "swap_in_progress",
        },
        {
          label: "Prov. Review",
          date: undefined,
          done: s === "completed" && hasReviewed,
          current: s === "pending_swap_review" || (s === "completed" && !hasReviewed),
        },
        {
          label: "Completed",
          date: (s === "completed" && hasReviewed) ? fmtDate(task.completed_at) : undefined,
          done: s === "completed" && hasReviewed,
          current: false,
        },
      ];
    }

    return [
      {
        label: "Open",
        date: fmtDate(task.created_at),
        done: isDone(["assigned", "in_progress", "pending_client_review", "completed"]),
        current: s === "open" || s === "draft",
      },
      {
        label: "Ongoing",
        date: undefined,
        done: isDone(["pending_client_review", "completed"]),
        current: s === "assigned" || s === "in_progress",
      },
      {
        label: "Reviews",
        date: undefined,
        done: s === "completed" && hasReviewed,
        current: s === "pending_client_review" || (s === "completed" && !hasReviewed),
      },
      {
        label: "Completed",
        date: (s === "completed" && hasReviewed) ? fmtDate(task.completed_at) : undefined,
        done: s === "completed" && hasReviewed,
        current: false,
      },
    ];
  };

  const badgeClass = (task: FullTask) => {
    if (task.status === "draft") return "assigned";
    return ({
      open: "open",
      assigned: "assigned",
      in_progress: "in-progress",
      pending_client_review: "pending-review",
      swap_in_progress: "in-progress",
      pending_swap_review: "pending-review",
      completed: "completed",
      disputed: "disputed",
      cancelled: "disputed",
    })[task.status] || "open";
  };

  const badgeLabel = (task: FullTask) => {
    if (task.status === "draft") return "Pending Moderation";
    return ({
      open: "Open",
      assigned: "Ongoing",
      in_progress: "Ongoing",
      pending_client_review: "Pending Review",
      swap_in_progress: "Swap Ongoing",
      pending_swap_review: "Swap Review",
      completed: "Completed",
      disputed: "Disputed",
      cancelled: "Cancelled",
    })[task.status] || task.status;
  };

  const fmtReward = (task: FullTask) =>
    task.commission_amount
      ? `₱ ${Number(task.commission_amount).toLocaleString()}`
      : "Service swap";

  // ── Actions ────────────────────────────────────────────────────────
  const startProgress = async (taskId: string) => {
    const { error } = await supabase.rpc("update_task_progress", {
      target_task_id: taskId,
      next_status: "in_progress",
      progress_note: "Work started",
    });
    setNotice(
      error ? error.message : "Task is now in progress. Do great work!",
    );
    if (!error) void load();
  };

  const handleCameraCapture = async (taskId: string, file: File) => {
    setUploadingTask(taskId);
    const path = `${session.user.id}/${taskId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const upload = await supabase.storage
      .from("task-deliverables")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      setNotice(upload.error.message);
      setUploadingTask(null);
      return;
    }
    const { error: dbErr } = await supabase
      .from("task_deliverables")
      .insert({
        task_id: taskId,
        submitted_by: session.user.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        caption: "Camera proof of completion",
      });
    if (dbErr) {
      setNotice(dbErr.message);
      setUploadingTask(null);
      return;
    }
    const task = [...posted, ...applied.map(a => a.task!)].find(t => t?.id === taskId);
    const isSwapProvider = task?.status === "swap_in_progress";
    
    // Now call the RPC to move state
    const { error: rpcErr } = await supabase.rpc(
      isSwapProvider ? "provider_mark_swap_done" : "applicant_mark_done", 
      { target_task_id: taskId }
    );
    setUploadingTask(null);
    if (rpcErr) {
      setNotice(`Photo uploaded but status update failed: ${rpcErr.message}`);
    } else {
      setNotice(isSwapProvider ? "Swap proof submitted! Waiting for applicant to confirm." : "Proof submitted! Waiting for the client to confirm.");
    }
    void load();
  };

  const confirmCompletion = async (taskId: string) => {
    setConfirmingTask(taskId);
    const { error } = await supabase.rpc("client_confirm_completion", {
      target_task_id: taskId,
    });
    setConfirmingTask(null);
    if (error) {
      setNotice(error.message);
    } else {
      const task = [...posted, ...applied.map(a => a.task!)].find(t => t?.id === taskId);
      if (task?.is_service_swap) {
        setNotice("Applicant work confirmed! Please complete your swap service and upload proof.");
      } else {
        setNotice("Job confirmed! Payment released and task completed.");
      }
    }
    void load();
  };



  const confirmSwapCompletion = async (taskId: string) => {
    setConfirmingTask(taskId);
    const { error } = await supabase.rpc("applicant_confirm_swap_completion", {
      target_task_id: taskId,
    });
    setConfirmingTask(null);
    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Swap confirmed! Task is fully completed.");
    }
    void load();
  };

  const submitReview = async (task: FullTask, _isClient: boolean, rating: number, comment: string) => {
    if (!rating) {
      setNotice("Choose a star rating first.");
      return;
    }
    const revieweeId = task.posted_by === session.user.id ? task.assigned_to : task.posted_by;
    if (!revieweeId) {
      setNotice("Cannot find the other participant.");
      return;
    }
    const { error } = await supabase
      .from("reviews")
      .insert({
        task_id: task.id,
        reviewer_id: session.user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
      });
    if (error) {
      setNotice(error.message);
      return;
    }
    const delta = [0, -2, -1, 0, 1, 2][rating] || 0;
    setTfDeltas((prev) => ({ ...prev, [task.id]: delta }));
    setNotice("Review submitted. Thank you!");
    void load();
  };

  const markCashPayment = async (taskId: string, role: 'client' | 'provider', currentStatus: string) => {
    // We use a new RPC function because RLS prevents direct updates to tasks table by regular users
    const { error } = await supabase.rpc('mark_cash_payment', {
      target_task_id: taskId,
      role: role,
      current_status: currentStatus
    });
    if (error) { setNotice(error.message); }
    else { void load(); }
  };

  // ── Render helpers ─────────────────────────────────────────────────
  const ClientTaskCard = ({ task }: { task: FullTask }) => {
    const deliverables = deliverablesByTask[task.id] || [];
    const isCompleted = task.status === "completed";
    const isPendingReview = task.status === "pending_client_review";
    const isOngoing =
      task.status === "assigned" || task.status === "in_progress";
    const notReviewed = isCompleted && !reviewedIds.includes(task.id);
    const isFullyCompleted = isCompleted && fullyReviewedTaskIds.includes(task.id);
    const tfDelta = tfDeltas[task.id];
    return (
      <article className="task-lifecycle-card" style={{ position: 'relative', overflow: 'hidden' }}>
        {(task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, color: 'rgba(220, 38, 38, 0.15)', border: '6px solid rgba(220, 38, 38, 0.15)', borderRadius: 12, padding: '10px 40px', letterSpacing: 4, whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', zIndex: 10 }}>
            OFFICIALLY FINISHED
          </div>
        )}
        <div className="tlc-header">
          <div className="tlc-header-left">
            <div className="tlc-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {task.title}
              {task.status === "completed" && (task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11, padding: '4px 8px', background: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', borderRadius: 12, display: 'inline-flex', alignItems: 'center' }}
                  onClick={() => {
                    if (window.confirm('Delete this officially finished task from your history?')) {
                      localStorage.setItem('dismissed-task-' + task.id, 'true');
                      window.location.reload();
                    }
                  }}
                >
                  Delete History
                </button>
              )}
            </div>
            <div className="tlc-meta">
              <span className="tlc-reward">{fmtReward(task)}</span>
              <span>·</span>
              <span>
                {task.is_service_swap ? "Service swap" : task.payment_type === "gcash" ? "GCash" : "Cash meetup"}
              </span>
              {task.deadline_at && (
                <>
                  <span>·</span>
                  <span>Due {fmtDate(task.deadline_at)}</span>
                </>
              )}
            </div>
          </div>
          <span className={`tlc-status-badge ${badgeClass(task)}`}>
            {badgeLabel(task)}
          </span>
        </div>
        <div className="tlc-body">
          {(task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted ? (
            <div style={{ position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 12, background: 'rgba(21,155,120,0.05)', border: '1px solid rgba(21,155,120,0.2)', marginBottom: 16 }}>
              
              <h4 style={{ margin: '0 0 8px 0', color: '#159b78', position: 'relative' }}>Task Officially Finished</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#4a5568', position: 'relative' }}>
                The task <strong>{task.title}</strong> has been fully completed and payment has been exchanged. 
                You can now delete this task from your history using the button above.
              </p>
            </div>
          ) : (
            <TaskTimeline stages={tlStages(task, isFullyCompleted)} />
          )}

          {/* Ongoing: chat link */}
          {isOngoing && task.assigned_to && (
            <div className="tlc-actions">
              <button
                type="button"
                className="tlc-chat-link"
                onClick={() => onOpenChat(task.id)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Message applicant
              </button>
              <span style={{ fontSize: 12, color: "#7a8daa" }}>
                Waiting for the provider to submit proof of completion.
              </span>
            </div>
          )}

          {/* Pending client review: show proof + confirm button */}
          {isPendingReview && (
            <div className="tlc-proof-section">
              <div className="tlc-proof-label">Proof of completion</div>
              {deliverables.length ? (
                <div className="tlc-proof-grid">
                  {deliverables.slice(0, 4).map((d) => (
                    <div className="tlc-proof-thumb" key={d.id}>
                      {d.mime_type.startsWith("image/") && d.signedUrl ? (
                        <img src={d.signedUrl} alt="Proof" onClick={() => setEnlargedImage(d.signedUrl || null)} style={{ cursor: "zoom-in" }} />
                      ) : (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            color: "#7a8daa",
                            fontSize: 11,
                          }}
                        >
                          FILE
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tlc-proof-empty">
                  <span>📷</span>
                  <span>
                    The provider marked this as done but no proof photo was
                    linked yet.
                  </span>
                </div>
              )}
              <div className="tlc-actions">
                <button
                  type="button"
                  className="tlc-chat-link"
                  onClick={() => onOpenChat(task.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message applicant
                </button>
                <button
                  type="button"
                  className="tlc-confirm-btn"
                  disabled={confirmingTask === task.id}
                  onClick={() => void confirmCompletion(task.id)}
                >
                  {confirmingTask === task.id
                    ? "Confirming…"
                    : "✓ Confirm Job Done"}
                </button>
              </div>
            </div>
          )}

          {/* Swap In Progress: Poster must upload proof */}
          {task.status === "swap_in_progress" && (
            <div className="tlc-proof-section">
              <div className="tlc-proof-label">Submit proof for your swap service</div>
              {deliverables.length > 0 && (
                <div className="tlc-proof-grid">
                  {deliverables.map((d) => (
                    <div className="tlc-proof-thumb" key={d.id}>
                      {d.mime_type.startsWith("image/") && d.signedUrl ? (
                        <img src={d.signedUrl} alt="Proof" onClick={() => setEnlargedImage(d.signedUrl || null)} style={{ cursor: "zoom-in" }} />
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#7a8daa", fontSize: 11 }}>FILE</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="tlc-actions">
                <button
                  type="button"
                  className="tlc-camera-btn"
                  disabled={uploadingTask === task.id}
                  onClick={() => setCameraTask(task.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {uploadingTask === task.id
                    ? "Uploading proof…"
                    : deliverables.some(d => d.submitted_by === session.user.id)
                      ? "Add another photo"
                      : "Take proof photo"}
                </button>
                {deliverables.some(d => d.submitted_by === session.user.id) && (
                  <button
                    type="button"
                    className="tlc-confirm-btn"
                    disabled={uploadingTask === task.id}
                    onClick={() => {
                      void supabase.rpc("provider_mark_swap_done", { target_task_id: task.id }).then(({ error }) => {
                        if (error) setNotice(error.message);
                        else {
                          setNotice("Marked swap as done! Waiting for applicant confirmation.");
                          void load();
                        }
                      });
                    }}
                  >
                    ✓ Mark My Swap as Done
                  </button>
                )}
                <button type="button" className="tlc-chat-link" onClick={() => onOpenChat(task.id)}>
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Message applicant
                </button>
              </div>
            </div>
          )}

          {/* Pending Swap Review: waiting for applicant to confirm */}
          {task.status === "pending_swap_review" && (
            <div className="tlc-waiting">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong style={{ display: "block", marginBottom: 3 }}>
                  Waiting for applicant confirmation
                </strong>
                Your proof was submitted. The applicant will review it and confirm the task is complete.
              </div>
            </div>
          )}

          {/* Completed: waiting for other party to review */}
          {isCompleted && !notReviewed && !isFullyCompleted && (
            <div className="tlc-waiting">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong style={{ display: "block", marginBottom: 3 }}>
                  Waiting for other party's review
                </strong>
                You have submitted your review. The transaction will be fully complete once the other party submits theirs.
              </div>
            </div>
          )}

          {/* Completed: payment receipt */}
          {isCompleted && isFullyCompleted && !(task.payment_status === 'paid' || task.is_service_swap) && (
            <>
              <PaymentReceiptCard task={{ ...task, title: task.title }} />
              {task.is_service_swap ? (
                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#4a5568' }}>This is a Service Swap. No cash payment is required. Please leave a review to complete the transaction.</span>
                </div>
              ) : task.payment_type !== 'gcash' && task.payment_status !== 'paid' && (
                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#4a5568' }}>Confirm when you have paid the provider.</span>
                  {task.payment_status === 'client_paid' ? (
                    <span style={{ fontSize: 12, color: '#159b78', fontWeight: 600 }}>✓ You paid (Waiting for provider)</span>
                  ) : (
                    <button onClick={() => void markCashPayment(task.id, 'client', task.payment_status || '')} className="btn primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                      I have already handed the payment cash
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Completed: leave a review */}
          {notReviewed && (
            <TaskReviewForm task={task} isClient={false} tfDelta={tfDelta} submitReview={submitReview as any} />
          )}
        </div>
      </article>
    );
  };

  const ApplicantTaskCard = ({
    application,
  }: {
    application: AcceptedApplication;
  }) => {
    const task = application.task;
    if (!task)
      return (
        <article className="task-lifecycle-card">
          <div className="tlc-header">
            <div className="tlc-title" style={{ color: "#7a8daa" }}>
              Task unavailable
            </div>
          </div>
        </article>
      );
    const isAccepted =
      application.status === "accepted" && task.assigned_to === session.user.id;
    const deliverables = deliverablesByTask[task.id] || [];
    const isCompleted = task.status === "completed";
    const isPendingReview = task.status === "pending_client_review";
    const isInProgress = task.status === "in_progress";
    const isAssigned = task.status === "assigned";
    const notReviewed = isCompleted && !reviewedIds.includes(task.id);
    const isFullyCompleted = isCompleted && fullyReviewedTaskIds.includes(task.id);
    const tfDelta = tfDeltas[task.id];
    return (
      <article className="task-lifecycle-card" style={{ position: 'relative', overflow: 'hidden' }}>
        {isAccepted && (task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, color: 'rgba(220, 38, 38, 0.15)', border: '6px solid rgba(220, 38, 38, 0.15)', borderRadius: 12, padding: '10px 40px', letterSpacing: 4, whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', zIndex: 10 }}>
            OFFICIALLY FINISHED
          </div>
        )}
        <div className="tlc-header">
          <div className="tlc-header-left">
            <div className="tlc-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {task.title}
              {task.status === "completed" && (task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11, padding: '4px 8px', background: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', borderRadius: 12, display: 'inline-flex', alignItems: 'center' }}
                  onClick={() => {
                    if (window.confirm('Delete this officially finished task from your history?')) {
                      localStorage.setItem('dismissed-task-' + task.id, 'true');
                      window.location.reload();
                    }
                  }}
                >
                  Delete History
                </button>
              )}
            </div>
            <div className="tlc-meta">
              <span className="tlc-reward">{fmtReward(task)}</span>
              <span>·</span>
              <span>
                {task.is_service_swap ? "Service swap" : task.payment_type === "gcash" ? "GCash" : "Cash meetup"}
              </span>
              {task.deadline_at && (
                <>
                  <span>·</span>
                  <span>Due {fmtDate(task.deadline_at)}</span>
                </>
              )}
            </div>
          </div>
          {isAccepted ? (
            <span className={`tlc-status-badge ${badgeClass(task)}`}>
              {badgeLabel(task)}
            </span>
          ) : (
            <span
              className={`tlc-status-badge ${application.status === "pending" ? "assigned" : "open"}`}
            >
              {application.status}
            </span>
          )}
        </div>
        <div className="tlc-body">
          {isAccepted && (task.payment_status === "paid" || task.is_service_swap) && isFullyCompleted ? (
            <div style={{ position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 12, background: 'rgba(21,155,120,0.05)', border: '1px solid rgba(21,155,120,0.2)', marginBottom: 16 }}>
              
              <h4 style={{ margin: '0 0 8px 0', color: '#159b78', position: 'relative' }}>Task Officially Finished</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#4a5568', position: 'relative' }}>
                The task <strong>{task.title}</strong> has been fully completed and {task.is_service_swap ? 'the swap has been finalized' : 'payment has been exchanged'}. 
                You can now delete this task from your history using the button above.
              </p>
            </div>
          ) : isAccepted ? (
            <TaskTimeline stages={tlStages(task, isFullyCompleted)} />
          ) : null}

          {/* Ready to start */}
          {isAccepted && isAssigned && (
            <div className="tlc-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => void startProgress(task.id)}
              >
                Start task
              </button>
              <button
                type="button"
                className="tlc-chat-link"
                onClick={() => onOpenChat(task.id)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Message client
              </button>
            </div>
          )}

          {/* In progress: camera button to mark done */}
          {isAccepted && isInProgress && (
            <div className="tlc-proof-section">
              <div className="tlc-proof-label">Submit proof of completion</div>
              {deliverables.length > 0 && (
                <div className="tlc-proof-grid">
                  {deliverables.slice(0, 4).map((d) => (
                    <div className="tlc-proof-thumb" key={d.id}>
                      {d.mime_type.startsWith("image/") && d.signedUrl ? (
                        <img src={d.signedUrl} alt="Proof" onClick={() => setEnlargedImage(d.signedUrl || null)} style={{ cursor: "zoom-in" }} />
                      ) : (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            color: "#7a8daa",
                            fontSize: 11,
                          }}
                        >
                          FILE
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="tlc-actions">
                <button
                  type="button"
                  className="tlc-camera-btn"
                  disabled={uploadingTask === task.id}
                  onClick={() => setCameraTask(task.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {uploadingTask === task.id
                    ? "Uploading proof…"
                    : deliverables.length
                      ? "Add another photo"
                      : "Take proof photo"}
                </button>
                {deliverables.length > 0 && (
                  <button
                    type="button"
                    className="tlc-confirm-btn"
                    disabled={uploadingTask === task.id}
                    onClick={() => {
                      void supabase
                        .rpc("applicant_mark_done", { target_task_id: task.id })
                        .then(({ error }) => {
                          if (error) setNotice(error.message);
                          else {
                            setNotice(
                              "Marked as done! Waiting for client confirmation.",
                            );
                            void load();
                          }
                        });
                    }}
                  >
                    ✓ Mark as Done
                  </button>
                )}
                <button
                  type="button"
                  className="tlc-chat-link"
                  onClick={() => onOpenChat(task.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message client
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#7a8daa", margin: "4px 0 0" }}>
                📷 Real-time camera only — gallery uploads are not accepted as
                proof.
              </p>
            </div>
          )}

          {/* Pending client review: waiting state */}
          {isAccepted && isPendingReview && (
            <div className="tlc-waiting">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong style={{ display: "block", marginBottom: 3 }}>
                  Waiting for client confirmation
                </strong>
                Your proof was submitted. The client will review it and confirm
                the job is done before payment is released.
              </div>
            </div>
          )}

          {/* Swap In Progress: waiting for provider to upload proof */}
          {isAccepted && task.status === "swap_in_progress" && (
            <div className="tlc-waiting">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong style={{ display: "block", marginBottom: 3 }}>
                  Waiting for client to complete swap
                </strong>
                Your work was approved! The client is now completing their swap service and will submit proof here.
              </div>
            </div>
          )}

          {/* Pending Swap Review: Applicant reviews provider's proof */}
          {isAccepted && task.status === "pending_swap_review" && (
            <div className="tlc-proof-section">
              <div className="tlc-proof-label">Review Client's Swap Proof</div>
              {deliverables.length > 0 ? (
                <div className="tlc-proof-grid">
                  {deliverables.map((d) => (
                    <div className="tlc-proof-thumb" key={d.id}>
                      {d.mime_type.startsWith("image/") && d.signedUrl ? (
                        <img src={d.signedUrl} alt="Proof" onClick={() => setEnlargedImage(d.signedUrl || null)} style={{ cursor: "zoom-in" }} />
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#7a8daa", fontSize: 11 }}>FILE</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tlc-proof-empty">
                  <span>📷</span>
                  <span>The client marked this as done but no proof photo was linked yet.</span>
                </div>
              )}
              <div className="tlc-actions">
                <button
                  type="button"
                  className="tlc-chat-link"
                  onClick={() => onOpenChat(task.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message client
                </button>
                <button
                  type="button"
                  className="tlc-confirm-btn"
                  disabled={confirmingTask === task.id}
                  onClick={() => void confirmSwapCompletion(task.id)}
                >
                  {confirmingTask === task.id ? "Confirming…" : "✓ Confirm Swap Done"}
                </button>
              </div>
            </div>
          )}

          {/* Completed: waiting for other party to review */}
          {isAccepted && isCompleted && !notReviewed && !isFullyCompleted && (
            <div className="tlc-waiting">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong style={{ display: "block", marginBottom: 3 }}>
                  Waiting for other party's review
                </strong>
                You have submitted your review. The transaction will be fully complete once the other party submits theirs.
              </div>
            </div>
          )}

          {/* Completed: show payment card */}
          {isAccepted && isCompleted && isFullyCompleted && !(task.payment_status === 'paid' || task.is_service_swap) && (
            <>
              <PaymentReceiptCard task={{ ...task, title: task.title }} />
              {task.is_service_swap ? (
                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#4a5568' }}>This is a Service Swap. No cash payment is required. Please leave a review to complete the transaction.</span>
                </div>
              ) : task.payment_type !== 'gcash' && task.payment_status !== 'paid' && (
                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#4a5568' }}>Wait for the client to hand the cash, then confirm.</span>
                  {task.payment_status === 'provider_paid' ? (
                    <span style={{ fontSize: 12, color: '#159b78', fontWeight: 600 }}>✓ You received (Waiting for client)</span>
                  ) : (
                    <button disabled={task.payment_status !== 'client_paid'} onClick={() => void markCashPayment(task.id, 'provider', task.payment_status || '')} className="btn primary" style={{ padding: '6px 12px', fontSize: 12, opacity: task.payment_status !== 'client_paid' ? 0.5 : 1 }}>
                      {task.payment_status !== 'client_paid' ? 'Waiting for Client...' : 'Received Payment'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Completed: leave a review */}
          {isAccepted && notReviewed && (
            <TaskReviewForm task={task} isClient={true} tfDelta={tfDelta} submitReview={submitReview as any} />
          )}

          {/* Not accepted yet */}
          {!isAccepted && (
            <p style={{ fontSize: 12, color: "#7a8daa", margin: 0 }}>
              Application status:{" "}
              <strong style={{ color: "#12255c" }}>{application.status}</strong>
            </p>
          )}
        </div>
      </article>
    );
  };

  // ── Camera modal ───────────────────────────────────────────────────
  const cameraModal = cameraTask ? (
    <CameraCapture
      onCapture={(file) => {
        void handleCameraCapture(cameraTask, file);
        setCameraTask(null);
      }}
      onClose={() => setCameraTask(null)}
    />
  ) : null;

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div className="fresh-tasks view">
      <section className="panel task-workspace-head">
        <div>
          <span className="eyebrow">Your quest log</span>
          <h2>Manage every task from one place.</h2>
          <p>
            Track posted tasks, accepted applications, proof of completion, and
            payment — all in one timeline.
          </p>
        </div>
        <button className="btn primary" onClick={onGoPost}>
          + Post a task
        </button>
      </section>

      <nav className="staff-tabs task-tabs">
        <button
          className={tab === "posted" ? "active" : ""}
          onClick={() => setTab("posted")}
        >
          Posted by me <span>{posted.length}</span>
        </button>
        <button
          className={tab === "applied" ? "active" : ""}
          onClick={() => setTab("applied")}
        >
          My applications <span>{applied.length}</span>
        </button>
      </nav>

      {notice && <p className="staff-notice">{notice}</p>}

      {loading ? (
        <section className="panel feed-message">
          Loading your quest log...
        </section>
      ) : tab === "posted" ? (
        <section className="task-work-list">
          {posted.length ? (
            posted
              .map((task) => <ClientTaskCard key={task.id} task={task} />)
          ) : (
            <div className="task-empty-state">
              <div className="task-empty-icon">📋</div>
              <h3>No active tasks yet</h3>
              <p>
                Post a clear request to start receiving applications from
                verified members.
              </p>
              <button className="btn primary" onClick={onGoPost}>
                Post your first task
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="task-work-list">
          {applied.length ? (
            applied.filter(app => app.task && localStorage.getItem('dismissed-task-' + app.task.id) !== 'true').map((app) => (
              <ApplicantTaskCard key={app.id} application={app} />
            ))
          ) : (
            <div className="task-empty-state">
              <div className="task-empty-icon">🔍</div>
              <h3>No applications yet</h3>
              <p>
                Browse the marketplace and apply to tasks where your skills are
                a good fit.
              </p>
            </div>
          )}
        </section>
      )}

      {cameraModal}
      
      {enlargedImage && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", padding: "20px", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)" }} onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px" }} />
          <button style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", width: "40px", height: "40px", borderRadius: "50%", fontSize: "24px", cursor: "pointer" }}>×</button>
        </div>
      )}
    </div>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    {
      id: string;
      title: string;
      body: string;
      is_read: boolean;
      created_at: string;
    }[]
  >([]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,is_read,created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data || []) as typeof items);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = items.filter((item) => !item.is_read).length;

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    await load();
  };

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const toggle = () => {
    setOpen(!open);
    if (!open) void load(); // Refresh on open
  };

  // Grouping logic
  const now = new Date();
  const today = items.filter((i) => {
    const d = new Date(i.created_at);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });
  const yesterday = items.filter((i) => {
    const d = new Date(i.created_at);
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return (
      d.getDate() === y.getDate() &&
      d.getMonth() === y.getMonth() &&
      d.getFullYear() === y.getFullYear()
    );
  });
  const older = items.filter(
    (i) => !today.includes(i) && !yesterday.includes(i),
  );

  const renderGroup = (title: string, groupItems: typeof items) => {
    if (!groupItems.length) return null;
    return (
      <div className="notification-group">
        <h4 className="notification-group-title">{title}</h4>
        {groupItems.map((item) => (
          <article
            key={item.id}
            className={`notification-item ${item.is_read ? "read" : "unread"}`}
            style={{ cursor: item.is_read ? 'default' : 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
            onClick={() => { if (!item.is_read) void markOneRead(item.id); }}
          >
            {!item.is_read && <div className="unread-dot"></div>}
            <div className="notification-content">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            {!item.is_read && (
              <button type="button" onClick={(e) => { e.stopPropagation(); void markOneRead(item.id); }} style={{ background: 'rgba(70,214,163,0.15)', border: '1px solid rgba(70,214,163,0.4)', color: '#46d6a3', borderRadius: 6, fontSize: 10, padding: '3px 7px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>✓ Read</button>
            )}
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="notification-wrap">
      <button
        type="button"
        className={`notification-bell ${unread ? "has-unread" : ""}`}
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <svg className="bell-symbol" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <section className="elite-notification-menu">
          <div className="elite-notification-header">
            <h3>Notifications</h3>
            <div className="elite-notification-actions">
              {unread > 0 && (
                <button
                  type="button"
                  className="mark-read-btn"
                  onClick={markAllRead}
                >
                  Mark all as read
                </button>
              )}
              <button
                type="button"
                className="close-btn"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="elite-notification-body">
            {items.length ? (
              <>
                {renderGroup("Today", today)}
                {renderGroup("Yesterday", yesterday)}
                {renderGroup("This Week", older)}
              </>
            ) : (
              <div className="notification-empty">
                <div className="empty-icon">🔔</div>
                <p>You are all caught up.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function MemberGuide({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const tips: [string, string, Page][] = [
    [
      "Start with your profile",
      "Add a clear photo, short introduction, service area, and skills so other members understand what you offer.",
      "account" as Page,
    ],
    [
      "Find work nearby",
      "Use the map search to choose an area, set any radius from 1 to 50 km, and open the full map for a wider view.",
      "home" as Page,
    ],
    [
      "Post safely",
      "Describe the task clearly. New tasks are reviewed before they appear in the marketplace.",
      "post" as Page,
    ],
    [
      "Keep task work in QuestKarte",
      "Use Tasks for updates and Chat for messages once an application is accepted.",
      "tasks" as Page,
    ],
  ];
  const current = tips[tip];
  return (
    <div className={`member-guide ${open ? "open" : ""}`}>
      <button
        type="button"
        className="guide-orb"
        onClick={() => setOpen(!open)}
        aria-label="Open QuestKarte guide"
        aria-expanded={open}
      >
        <span>Q</span>
        <i>?</i>
      </button>
      {open && (
        <section className="guide-panel" aria-label="QuestKarte guide">
          <header>
            <div>
              <span className="eyebrow">QUESTKARTE GUIDE</span>
              <strong>Need a hand?</strong>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close guide">
              ×
            </button>
          </header>
          <div className="guide-tip">
            <span className="guide-step">
              {tip + 1} / {tips.length}
            </span>
            <h3>{current[0]}</h3>
            <p>{current[1]}</p>
            <button
              className="btn primary"
              onClick={() => {
                onNavigate(current[2]);
                setOpen(false);
              }}
            >
              Take me there →
            </button>
          </div>
          <footer>
            <button
              onClick={() => setTip((tip + tips.length - 1) % tips.length)}
              aria-label="Previous guide tip"
            >
              ←
            </button>
            <span>
              {tips.map((_, index) => (
                <i key={index} className={index === tip ? "active" : ""} />
              ))}
            </span>
            <button
              onClick={() => setTip((tip + 1) % tips.length)}
              aria-label="Next guide tip"
            >
              →
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}

function TaskApplicationInbox({ session }: { session: Session }) {
  return <TaskApplicationInboxV2 session={session} />;
  /*
  type ApplicationRow = { id: string; task_id: string; applicant_id: string; cover_note: string | null; status: string; created_at: string };
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, { full_name: string; trust_factor: number; avatar_url: string | null; skills?: string[] }>>({});
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
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,trust_factor,avatar_url,skills").in("id", applicantIds);
      setMembers(Object.fromEntries((profiles || []).map((profile) => [profile.id, profile])) as Record<string, { full_name: string; trust_factor: number; avatar_url: string | null; skills?: string[] }>);
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

type InboxApplication = {
  id: string;
  task_id: string;
  applicant_id: string;
  cover_note: string | null;
  status: string;
  created_at: string;
};
type InboxMember = {
  full_name: string;
  trust_factor: number;
  avatar_url: string | null;
};
type InboxAttachment = {
  id: string;
  application_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  url?: string;
};

function ApplicationDetailModal({
  application,
  member,
  attachments,
  onClose,
  onProfile,
}: {
  application: InboxApplication;
  member: InboxMember | undefined;
  attachments: InboxAttachment[];
  onClose: () => void;
  onProfile: () => void;
}) {
  const name = member?.full_name || "QuestKarte member";
  return (
    <div
      className="application-detail-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="application-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s application`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Application details</span>
            <h2>{name}'s application</h2>
          </div>
          <button
            type="button"
            className="member-profile-close"
            onClick={onClose}
            aria-label="Close application details"
          >
            ×
          </button>
        </header>
        <button
          type="button"
          className="application-detail-heading qc-poster qc-poster-button"
          onClick={onProfile}
        >
          <span className="avatar">
            {member?.avatar_url ? (
              <img src={member.avatar_url} alt="" />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </span>
          <span>
            <strong>{name}</strong>
            <small>Trust Factor {member?.trust_factor || 0}</small>
          </span>
        </button>
        <div className="application-detail-note">
          <span>Applicant message</span>
          <p>{application.cover_note || "No message was added."}</p>
        </div>
        <div>
          <span className="eyebrow">Supporting files</span>
          {attachments.length ? (
            <div className="application-file-grid">
              {attachments.map((file) => (
                <a
                  key={file.id}
                  className="application-file-tile"
                  href={file.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.mime_type?.startsWith("image/") && file.url ? (
                    <img src={file.url} alt={file.file_name} />
                  ) : (
                    <div className="application-file-document">FILE</div>
                  )}
                  <span>{file.file_name}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="feed-message">No optional files were attached.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskApplicationInboxV2({ session }: { session: Session }) {
  const [applications, setApplications] = useState<InboxApplication[]>([]);
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, InboxMember>>({});
  const [attachments, setAttachments] = useState<
    Record<string, InboxAttachment[]>
  >({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [profilePreviewId, setProfilePreviewId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] =
    useState<InboxApplication | null>(null);
  const load = async () => {
    setLoading(true);
    const { data: ownTasks } = await supabase
      .from("tasks")
      .select("id,title")
      .eq("posted_by", session.user.id)
      .eq("status", "open");
    const taskRows = ownTasks || [];
    const taskIds = taskRows.map((task) => task.id);
    setTasks(Object.fromEntries(taskRows.map((task) => [task.id, task.title])));
    if (!taskIds.length) {
      setApplications([]);
      setMembers({});
      setAttachments({});
      setLoading(false);
      return;
    }
    const { data: appRows, error } = await supabase
      .from("applications")
      .select("id,task_id,applicant_id,cover_note,status,created_at")
      .in("task_id", taskIds)
      .in("status", ["pending", "shortlisted"])
      .order("created_at", { ascending: false });
    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }
    const rows = (appRows || []) as InboxApplication[];
    const applicantIds = [
      ...new Set(rows.map((application) => application.applicant_id)),
    ];
    const [{ data: profiles }, { data: fileRows }] = await Promise.all([
      applicantIds.length
        ? supabase
            .from("profiles")
            .select("id,full_name,trust_factor,avatar_url,skills")
            .in("id", applicantIds)
        : Promise.resolve({ data: [] }),
      rows.length
        ? supabase
            .from("application_attachments")
            .select("id,application_id,storage_path,file_name,mime_type")
            .in(
              "application_id",
              rows.map((application) => application.id),
            )
        : Promise.resolve({ data: [] }),
    ]);
    setMembers(
      Object.fromEntries(
        (profiles || []).map((profile) => [profile.id, profile]),
      ) as Record<string, InboxMember>,
    );
    const nextAttachments: Record<string, InboxAttachment[]> = {};
    await Promise.all(
      (fileRows || []).map(async (file) => {
        const { data: signed } = await supabase.storage
          .from("application-attachments")
          .createSignedUrl(file.storage_path, 3600);
        (nextAttachments[file.application_id] ||= []).push({
          ...file,
          url: signed?.signedUrl,
        });
      }),
    );
    setAttachments(nextAttachments);
    setApplications(rows);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);
  const accept = async (application: InboxApplication) => {
    const { error } = await supabase.rpc("accept_application", {
      target_application_id: application.id,
    });
    setNotice(
      error
        ? error.message
        : `Accepted ${members[application.applicant_id]?.full_name || "the applicant"}. The task is now private to you and the selected applicant.`,
    );
    if (!error) {
      setSelectedApplication(null);
      void load();
    }
  };
  const decline = async (application: InboxApplication) => {
    const name =
      members[application.applicant_id]?.full_name || "this applicant";
    if (
      !window.confirm(`Decline ${name}'s application? They will be notified.`)
    )
      return;
    const { error } = await supabase.rpc("decline_application", {
      target_application_id: application.id,
    });
    setNotice(error ? error.message : `Declined ${name}'s application.`);
    if (!error) {
      if (selectedApplication?.id === application.id)
        setSelectedApplication(null);
      void load();
    }
  };
  if (loading || !applications.length)
    return loading ? (
      <section className="panel feed-message">
        Checking your application inbox...
      </section>
    ) : null;
  return (
    <>
      <section className="panel application-inbox">
        <div className="section-head">
          <div>
            <span className="eyebrow">Application inbox</span>
            <h2>Review applicants for your posted task</h2>
            <p>
              You are the task poster. Choose an applicant when you are ready;
              the selected applicant becomes the service provider and all other
              pending applications close automatically.
            </p>
          </div>
        </div>
        {notice && <p className="staff-notice">{notice}</p>}
        <div className="task-work-list">
          {applications.map((application) => {
            const member = members[application.applicant_id];
            const name = member?.full_name || "QuestKarte member";
            return (
              <article className="staff-case" key={application.id}>
                <button
                  type="button"
                  className="qc-poster qc-poster-button"
                  onClick={() => setProfilePreviewId(application.applicant_id)}
                  aria-label={`View ${name}'s profile`}
                >
                  <span className="avatar">
                    {member?.avatar_url ? (
                      <img src={member.avatar_url} alt="" />
                    ) : (
                      name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>
                      Trust Factor {member?.trust_factor || 0} · applied for{" "}
                      {tasks[application.task_id] || "your task"}
                    </small>
                  </span>
                </button>
                <div className="application-note">
                  <strong>Application note</strong>
                  <p>{application.cover_note || "No message was added."}</p>
                </div>
                <div className="application-card-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedApplication(application)}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    className="btn application-decline"
                    onClick={() => void decline(application)}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void accept(application)}
                  >
                    Accept applicant
                  </button>
                  <span className="role-chip">{application.status}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          member={members[selectedApplication.applicant_id]}
          attachments={attachments[selectedApplication.id] || []}
          onClose={() => setSelectedApplication(null)}
          onProfile={() => {
            setProfilePreviewId(selectedApplication.applicant_id);
            setSelectedApplication(null);
          }}
        />
      )}
      {profilePreviewId && (
        <MemberProfileModal
          memberId={profilePreviewId}
          onClose={() => setProfilePreviewId(null)}
        />
      )}
    </>
  );
}

// CompletedTaskReviews is now merged into TaskWorkspace's ClientTaskCard and ApplicantTaskCard.
// Stub retained for the AppShell call site.
function CompletedTaskReviews({ session: _s }: { session: Session }) {
  void _s;
  return null;
}

// TaskDeliveryAndSafety is now fully merged into TaskWorkspace above.
// This stub is kept so existing call sites in AppShell compile without error.
function TaskDeliveryAndSafety({ session: _session }: { session: Session }) {
  void _session;
  return null;
}

function LegacyPostTaskReal({
  session,
  profile,
  onPosted,
}: {
  session: Session | null;
  profile: MemberProfile | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState(localStorage.getItem('draft-title') || "");
    const [description, setDescription] = useState(localStorage.getItem('draft-desc') || "");
    useEffect(() => { localStorage.setItem('draft-title', title); }, [title]);
    useEffect(() => { localStorage.setItem('draft-desc', description); }, [description]);
  const [location, setLocation] = useState("");
  const [commission, setCommission] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || [])
      .filter(
        (file) =>
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
          file.size <= 4 * 1024 * 1024,
      )
      .slice(0, 6);
    setFiles(next);
    setNotice(
      next.length !== (list?.length || 0)
        ? "Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB."
        : "",
    );
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const amount = Number(commission.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid commission amount.");
      return;
    }
    setSaving(true);
    setNotice("");
    const coords = await new Promise<{
      latitude: number | null;
      longitude: number | null;
    }>((resolve) => {
      if (!navigator.geolocation)
        return resolve({ latitude: null, longitude: null });
      navigator.geolocation.getCurrentPosition(
        ({ coords: current }) =>
          resolve({ latitude: current.latitude, longitude: current.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { timeout: 7000, maximumAge: 60000 },
      );
    });
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", category)
      .limit(1)
      .maybeSingle();
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        posted_by: session.user.id,
        category_id: categoryRow?.id || null,
        title: title.trim(),
        description: description.trim(),
        commission_amount: amount,
        currency: "PHP",
        is_service_swap: false,
        location_label: location.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: "draft",
        moderation_state: "pending_review",
      })
      .select("id")
      .single();
    if (error || !task) {
      setSaving(false);
      setNotice(error?.message || "Unable to submit the task.");
      return;
    }
    try {
      const attachmentRows = await Promise.all(
        files.map(async (file) => {
          const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const upload = await supabase.storage
            .from("task-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          return {
            task_id: task.id,
            uploaded_by: session.user.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
          };
        }),
      );
      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase
          .from("task_attachments")
          .insert(attachmentRows);
        if (attachmentError) throw attachmentError;
      }
    } catch (uploadError) {
      setSaving(false);
      setNotice(
        `Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`,
      );
      return;
    }
    setSaving(false);
    onPosted();
  };
  const previews = files.map((file) => URL.createObjectURL(file));
  return (
    <div className="post-grid view">
      <form className="forge-card post-form-col" onSubmit={submit}>
        <div className="forge-ribbon">
          <span>Submit to moderation</span>
        </div>
        <h2>Post a task people can discover.</h2>
        <p className="form-intro">
          Posts are reviewed before they appear in the marketplace and on the
          map.
        </p>
        <label className="field-group">
          <span className="field-label">Task title</span>
          <input
            className="field-input"
            minLength={6}
            maxLength={140}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field-group">
          <span className="field-label">Description</span>
          <textarea
            className="field-textarea"
            minLength={20}
            maxLength={5000}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-two">
          <label className="field-group">
            <span className="field-label">Category</span>
            <select
              className="field-input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {[
                "Cleaning",
                "Delivery",
                "Tutoring",
                "Design",
                "Errands",
                "Other",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Commission (PHP)</span>
            <input
              className="field-input"
              required
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
            />
          </label>
        </div>
        <label className="field-group">
          <span className="field-label">General area</span>
          <input
            className="field-input"
            required
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Lahug, Cebu City"
          />
        </label>
        <label className="upload-box photo-dropzone">
          <strong>Add reference photos</strong>
          <small>
            Optional; up to 6 JPG, PNG, or WEBP images. Help applicants
            understand the work.
          </small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />
          {files.length > 0 && (
            <b>
              {files.length} image{files.length === 1 ? "" : "s"} selected
            </b>
          )}
        </label>
        {notice && <p className="setup-notice">{notice}</p>}
        <button className="post-submit" disabled={saving}>
          {saving ? "Submitting..." : "Submit for review"}
        </button>
      </form>
      <aside className="post-preview-col">
        <div className="post-preview-label">Task preview</div>
        <TaskCard
          quest={{
            id: "preview",
            category,
            title: title || "Your task title",
            description: description || "Your task details will appear here.",
            commission: commission ? `PHP ${commission}` : "Commission",
            location: location || "Your general area",
            schedule: "After moderation review",
            posterName: profile?.full_name || "You",
            avatarUrl: profile?.avatar_url,
                initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(),
            images: previews,
          }}
        />
      </aside>
    </div>
  );
}

function LegacyPostTaskRealV2({
  session,
  profile,
  onPosted,
}: {
  session: Session | null;
  profile: MemberProfile | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState(localStorage.getItem('draft-title') || "");
    const [description, setDescription] = useState(localStorage.getItem('draft-desc') || "");
    useEffect(() => { localStorage.setItem('draft-title', title); }, [title]);
    useEffect(() => { localStorage.setItem('draft-desc', description); }, [description]);
  const [location, setLocation] = useState("");
  const [commission, setCommission] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [customCategory, setCustomCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const previewImages = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => {
      previewImages.forEach((url) => URL.revokeObjectURL(url));
    },
    [previewImages],
  );
  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || [])
      .filter(
        (file) =>
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
          file.size <= 4 * 1024 * 1024,
      )
      .slice(0, 6);
    setFiles(next);
    if (next.length !== (list?.length || 0))
      setNotice(
        "Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB.",
      );
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const amount = Number(commission.replace(/[^0-9.]/g, ""));
    const custom = customCategory.trim().replace(/\s+/g, " ");
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid commission amount.");
      return;
    }
    if (category === "Other" && custom.length < 2) {
      setNotice("Describe the type of task for Other (at least 2 characters).");
      return;
    }
    setSaving(true);
    setNotice("");
    const coords = await new Promise<{
      latitude: number | null;
      longitude: number | null;
    }>((resolve) => {
      if (!navigator.geolocation)
        return resolve({ latitude: null, longitude: null });
      navigator.geolocation.getCurrentPosition(
        ({ coords: current }) =>
          resolve({ latitude: current.latitude, longitude: current.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { timeout: 7000, maximumAge: 60000 },
      );
    });
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", category)
      .limit(1)
      .maybeSingle();
    const fullDescription =
      category === "Other"
        ? `Task type: ${custom}\n\n${description.trim()}`
        : description.trim();
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        posted_by: session.user.id,
        category_id: categoryRow?.id || null,
        title: title.trim(),
        description: fullDescription,
        commission_amount: amount,
        currency: "PHP",
        is_service_swap: false,
        location_label: location.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: "draft",
        moderation_state: "pending_review",
      })
      .select("id")
      .single();
    if (error || !task) {
      setSaving(false);
      setNotice(error?.message || "Unable to submit the task.");
      return;
    }
    try {
      const attachmentRows = await Promise.all(
        files.map(async (file) => {
          const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const upload = await supabase.storage
            .from("task-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          return {
            task_id: task.id,
            uploaded_by: session.user.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
          };
        }),
      );
      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase
          .from("task_attachments")
          .insert(attachmentRows);
        if (attachmentError) throw attachmentError;
      }
    } catch (uploadError) {
      setSaving(false);
      setNotice(
        `Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`,
      );
      return;
    }
    setSaving(false);
    onPosted();
  };
  const previewCategory =
    category === "Other" && customCategory.trim()
      ? customCategory.trim()
      : category;
  return (
    <div className="post-grid view">
      <form className="forge-card post-form-col" onSubmit={submit}>
        <div className="forge-ribbon">
          <span>Submit to moderation</span>
        </div>
        <h2>Post a task people can discover.</h2>
        <p className="form-intro">
          Choose the closest category. Posts are reviewed before they appear in
          the marketplace and map.
        </p>
        <label className="field-group">
          <span className="field-label">Task title</span>
          <input
            className="field-input"
            minLength={6}
            maxLength={140}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field-group">
          <span className="field-label">Description</span>
          <textarea
            className="field-textarea"
            minLength={20}
            maxLength={5000}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-two">
          <label className="field-group">
            <span className="field-label">Category</span>
            <select
              className="field-input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {taskCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Commission (PHP)</span>
            <input
              className="field-input"
              required
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
            />
          </label>
        </div>
        {category === "Other" && (
          <label className="field-group">
            <span className="field-label">What kind of task is this?</span>
            <input
              className="field-input"
              required
              minLength={2}
              maxLength={60}
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Example: Furniture assembly or language interpretation"
            />
          </label>
        )}
        <label className="field-group">
          <span className="field-label">General area</span>
          <input
            className="field-input"
            required
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Lahug, Cebu City"
          />
        </label>
        <label className="upload-box photo-dropzone">
          <strong>Add reference photos</strong>
          <small>
            Optional; up to 6 JPG, PNG, or WEBP images. Help applicants
            understand the work.
          </small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />
          {files.length > 0 && (
            <b>
              {files.length} image{files.length === 1 ? "" : "s"} selected
            </b>
          )}
        </label>
        {notice && <p className="setup-notice">{notice}</p>}
        <button className="post-submit" disabled={saving}>
          {saving ? "Submitting..." : "Submit for review"}
        </button>
      </form>
      <aside className="post-preview-col">
        <div className="post-preview-label">Task preview</div>
        <TaskCard
          quest={{
            id: "preview",
            category: previewCategory,
            title: title || "Your task title",
            description: description || "Your task details will appear here.",
            commission: commission ? `PHP ${commission}` : "Commission",
            location: location || "Your general area",
            schedule: "After moderation review",
            posterName: profile?.full_name || "You",
            avatarUrl: profile?.avatar_url,
                initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(),
            images: previewImages,
          }}
        />
      </aside>
    </div>
  );
}


function PostTaskReal({
  session,
  profile,
  onPosted,
}: {
  session: Session | null;
  profile: MemberProfile | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState(localStorage.getItem('draft-title') || "");
    const [description, setDescription] = useState(localStorage.getItem('draft-desc') || "");
    useEffect(() => { localStorage.setItem('draft-title', title); }, [title]);
    useEffect(() => { localStorage.setItem('draft-desc', description); }, [description]);
  const [location, setLocation] = useState("");
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(null);
  const [commission, setCommission] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [customCategory, setCustomCategory] = useState("");
  const [serviceSwap, setServiceSwap] = useState(false);
  const [swapDetails, setSwapDetails] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "gcash">("cash");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const previewImages = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );

  useEffect(
    () => () => previewImages.forEach((url) => URL.revokeObjectURL(url)),
    [previewImages],
  );

  const selectFiles = (list: FileList | null) => {
    const next = Array.from(list || [])
      .filter(
        (file) =>
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
          file.size <= 4 * 1024 * 1024,
      )
      .slice(0, 6);
    setFiles(next);
    setNotice(
      next.length !== (list?.length || 0)
        ? "Use up to 6 JPG, PNG, or WEBP images, each smaller than 4 MB."
        : "",
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const amount = Number(commission.replace(/[^0-9.]/g, ""));
    const custom = customCategory.trim().replace(/\s+/g, " ");
    const swapText = swapDetails.trim();
    if (!serviceSwap && (!Number.isFinite(amount) || amount <= 0))
      return setNotice("Enter a valid commission amount.");
    if (serviceSwap && (!Number.isFinite(amount) || amount <= 0))
      return setNotice("Enter the estimated PHP value of the service swap.");
    if (serviceSwap && swapText.length < 5)
      return setNotice(
        "Briefly describe the service you are offering in exchange.",
      );
    if (category === "Other" && custom.length < 2)
      return setNotice(
        "Describe the type of task for Other (at least 2 characters).",
      );
    setSaving(true);
    setNotice("");
    const coords = pinCoords 
      ? { latitude: pinCoords[0], longitude: pinCoords[1] } 
      : await new Promise<{
          latitude: number | null;
          longitude: number | null;
        }>((resolve) => {
          if (!navigator.geolocation)
            return resolve({ latitude: null, longitude: null });
          navigator.geolocation.getCurrentPosition(
            ({ coords: current }) =>
              resolve({ latitude: current.latitude, longitude: current.longitude }),
            () => resolve({ latitude: null, longitude: null }),
            { timeout: 7000, maximumAge: 60000 },
          );
        });
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", category)
      .limit(1)
      .maybeSingle();
    const fullDescription =
      category === "Other"
        ? `Task type: ${custom}\n\n${description.trim()}`
        : description.trim();
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        posted_by: session.user.id,
        category_id: categoryRow?.id || null,
        title: title.trim(),
        description: fullDescription,
        commission_amount: amount,
        currency: "PHP",
        is_service_swap: serviceSwap,
        swap_details: serviceSwap
          ? `Service Swap Offer · PHP ${amount.toLocaleString()} — ${swapText}`
          : null,
        payment_type: paymentType,
        payment_status: "pending",
        location_label: location.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: "draft",
        moderation_state: "pending_review",
      })
      .select("id")
      .single();
    if (error || !task) {
      setSaving(false);
      setNotice(error?.message || "Unable to submit the task.");
      return;
    }
    try {
      const attachmentRows = await Promise.all(
        files.map(async (file) => {
          const path = `${session.user.id}/${task.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const upload = await supabase.storage
            .from("task-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          return {
            task_id: task.id,
            uploaded_by: session.user.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
          };
        }),
      );
      if (attachmentRows.length) {
        const { error: attachmentError } = await supabase
          .from("task_attachments")
          .insert(attachmentRows);
        if (attachmentError) throw attachmentError;
      }
    } catch (uploadError) {
      setSaving(false);
      setNotice(
        `Task submitted, but images were not saved: ${uploadError instanceof Error ? uploadError.message : "upload error"}`,
      );
      return;
    }
    setSaving(false);
    onPosted();
  };

  const previewCategory =
    category === "Other" && customCategory.trim()
      ? customCategory.trim()
      : category;
  const previewCommission = serviceSwap
    ? `Service Swap Offer · PHP ${commission || "0"}`
    : commission
      ? `PHP ${commission}`
      : "Commission";
  return (
    <div className="post-grid view">
      <form className="forge-card post-form-col" onSubmit={submit}>
        <div className="forge-ribbon">
          <span>Submit to moderation</span>
        </div>
        <h2>Post a task people can discover.</h2>
        <p className="form-intro">
          Posts are reviewed before they appear in the marketplace and map.
        </p>
        <label className="field-group">
          <span className="field-label">Task title</span>
          <input
            className="field-input"
            minLength={6}
            maxLength={140}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field-group">
          <span className="field-label">Description</span>
          <textarea
            className="field-textarea"
            minLength={20}
            maxLength={5000}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-two">
          <label className="field-group">
            <span className="field-label">Category</span>
            <select
              className="field-input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {taskCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Estimated value (PHP)</span>
            <input
              className="field-input"
              required
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
            />
          </label>
        </div>
        {category === "Other" && (
          <label className="field-group">
            <span className="field-label">What kind of task is this?</span>
            <input
              className="field-input"
              required
              minLength={2}
              maxLength={60}
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Example: Furniture assembly or language interpretation"
            />
          </label>
        )}
        <div className="field-group">
          <span className="field-label">Payment type</span>
          <div className="segmented">
            <button
              type="button"
              className={`seg ${!serviceSwap ? "active" : ""}`}
              onClick={() => setServiceSwap(false)}
            >
              Money payment
            </button>
            <button
              type="button"
              className={`seg ${serviceSwap ? "active" : ""}`}
              onClick={() => setServiceSwap(true)}
            >
              Service swap
            </button>
          </div>
        </div>

        {!serviceSwap && (
          <div className="field-group">
            <span className="field-label">Money payment method</span>
            <div className="segmented">
              <button
                type="button"
                className={`seg ${paymentType === "cash" ? "active" : ""}`}
                onClick={() => setPaymentType("cash")}
              >
                Cash (meet up)
              </button>
              <button
                type="button"
                className={`seg ${paymentType === "gcash" ? "active" : ""}`}
                onClick={() => setPaymentType("gcash")}
              >
                GCash (online)
              </button>
            </div>
          </div>
        )}
        {serviceSwap && (
          <label className="field-group">
            <span className="field-label">Service swap offer</span>
            <input
              className="field-input"
              minLength={5}
              maxLength={300}
              value={swapDetails}
              onChange={(event) => setSwapDetails(event.target.value)}
              placeholder="Example: I can provide a two-hour website consultation."
            />
          </label>
        )}
        <div className="field-group" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <span className="field-label">Exact location pin</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              className="field-input"
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Area description (e.g. Lahug, Cebu City)"
            />
            <LocationPickerMap position={pinCoords} setPosition={setPinCoords} setLocationLabel={setLocation} />
          </div>
        </div>
        <label className="upload-box photo-dropzone">
          <strong>Add reference photos</strong>
          <small>
            Optional; up to 6 JPG, PNG, or WEBP images. Help applicants
            understand the work.
          </small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />
          {files.length > 0 && (
            <b>
              {files.length} image{files.length === 1 ? "" : "s"} selected
            </b>
          )}
        </label>
        {notice && <p className="setup-notice">{notice}</p>}
        <button className="post-submit" disabled={saving}>
          {saving ? "Submitting..." : "Submit for review"}
        </button>
      </form>
      <aside className="post-preview-col">
        <div className="post-preview-label">Task preview</div>
        <TaskCard
          quest={{
            id: "preview",
            category: previewCategory,
            title: title || "Your task title",
            description: description || "Your task details will appear here.",
            commission: previewCommission,
            location: location || "Your general area",
            schedule: "After moderation review",
            posterName: profile?.full_name || "You",
            avatarUrl: profile?.avatar_url,
                initials: (profile?.full_name || "You").slice(0, 2).toUpperCase(),
            kind: serviceSwap ? "swap" : undefined,
            images: previewImages,
          }}
        />
      </aside>
    </div>
  );
}

void PostTask;
void LegacyPostTaskRealV2;
void LegacyAppShell;
void LegacyPostTaskReal;
void LegacyFreshAccount;
void FreshChat;
void FreshTasks;


function HelpSafetyWidget({ isGuest }: { isGuest?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"guidelines"|"report">("guidelines");
  const [reportReason, setReportReason] = useState("");
  const [reportedUserId, setReportedUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (reportReason.length < 5) return setNotice("Reason must be at least 5 characters.");
    setIsSubmitting(true);
    setNotice("");
    const { error } = await supabase.from("reports").insert({ reported_user_id: reportedUserId || null, reason: reportReason });
    setIsSubmitting(false);
    if (error) setNotice(error.message);
    else setSuccess(true);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9000, background: '#159b78', color: '#fff', border: 'none', borderRadius: '50px', padding: '12px 20px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(21,155,120,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, background: 'rgba(255,255,255,0.2)', width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>?</span> Help & Safety
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setOpen(false)}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 20, background: '#f7f9fe', borderBottom: '1px solid #e1e6f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#101d57' }}>Help & Safety</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#52617f' }}>×</button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #e1e6f0' }}>
              <button onClick={() => setTab("guidelines")} style={{ flex: 1, padding: 15, background: tab === "guidelines" ? '#fff' : '#f7f9fe', border: 'none', borderBottom: tab === "guidelines" ? '2px solid #159b78' : '2px solid transparent', fontWeight: 'bold', color: tab === "guidelines" ? '#101d57' : '#74819c', cursor: 'pointer' }}>Guidelines</button>
              {!isGuest && <button onClick={() => setTab("report")} style={{ flex: 1, padding: 15, background: tab === "report" ? '#fff' : '#f7f9fe', border: 'none', borderBottom: tab === "report" ? '2px solid #a43f3f' : '2px solid transparent', fontWeight: 'bold', color: tab === "report" ? '#101d57' : '#74819c', cursor: 'pointer' }}>File a Report</button>}
            </div>
            <div style={{ padding: 24, overflowY: 'auto' }}>
              {tab === "guidelines" ? (
                <div style={{ color: '#52617f', fontSize: 14, lineHeight: 1.6 }}>
                  <h3 style={{ marginTop: 0, color: '#101d57', marginBottom: 15 }}>Community Guidelines</h3>
                  <p style={{ marginBottom: 10 }}><strong>1. Treat all members with respect.</strong> Harassment or discrimination is strictly prohibited.</p>
                  <p style={{ marginBottom: 10 }}><strong>2. Ensure your tasks are safe.</strong> Do not post illegal, dangerous, or harmful tasks.</p>
                  <p style={{ marginBottom: 10 }}><strong>3. Keep it on the platform.</strong> Do not ask for or provide services outside of QuestKarte.</p>
                  <p style={{ marginBottom: 10 }}><strong>4. Be honest.</strong> Misrepresenting your skills or identity may result in a ban.</p>
                  <div style={{ marginTop: 20, padding: 15, background: 'rgba(21,155,120,0.1)', borderRadius: 10, color: '#159b78' }}>
                    {isGuest ? "If you encounter behavior that violates these guidelines, please sign in to file a report with our moderation team." : "If you encounter behavior that violates these guidelines, please switch to the <strong>File a Report</strong> tab to alert our moderation team."}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#52617f', fontSize: 14 }}>
                  {success ? (
                    <div style={{ background: 'rgba(70,214,163,0.1)', color: '#159b78', padding: 20, borderRadius: 10, textAlign: 'center' }}>
                      <span style={{ fontSize: 40, display: 'block', marginBottom: 10 }}>✓</span>
                      <strong>Report submitted!</strong>
                      <p style={{ marginTop: 5 }}>Our safety team will review it shortly.</p>
                    </div>
                  ) : (
                    <>
                      <p style={{ marginTop: 0, marginBottom: 20 }}>Use this form to report a general issue or a specific user. Moderators review all reports securely.</p>
                      {notice && <p style={{ color: '#a43f3f', marginBottom: 15, padding: 10, background: '#fff7f7', borderRadius: 8, border: '1px solid #e5bbbb' }}>{notice}</p>}
                      <label style={{ display: 'block', marginBottom: 15 }}>
                        <strong style={{ display: 'block', marginBottom: 5, color: '#101d57' }}>Reported User ID (Optional)</strong>
                        <input value={reportedUserId} onChange={e => setReportedUserId(e.target.value)} placeholder="Paste User ID if applicable..." style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #cdd8ea', outline: 'none' }} />
                      </label>
                      <label style={{ display: 'block', marginBottom: 20 }}>
                        <strong style={{ display: 'block', marginBottom: 5, color: '#101d57' }}>Reason for Report *</strong>
                        <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Please explain the issue in detail..." style={{ width: '100%', minHeight: 120, padding: 12, borderRadius: 10, border: '1px solid #cdd8ea', outline: 'none', resize: 'vertical' }} />
                      </label>
                      <button onClick={submit} disabled={isSubmitting} style={{ width: '100%', padding: 15, borderRadius: 12, background: '#a43f3f', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: 15 }}>{isSubmitting ? 'Submitting...' : 'Submit Report to Moderators'}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

function TrustHistoryModal({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<{ id: string, created_at: string, points: number, reason: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('trust_events')
      .select('id, created_at, points, reason')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="task-modal-backdrop" onClick={onClose} style={{ zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="task-detail-modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="task-modal-header" style={{ marginBottom: 15 }}>
          <h3 style={{ margin: 0 }}>Trust Factor History</h3>
          <button onClick={onClose} className="task-modal-close">×</button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
          {loading ? (
            <p>Loading history...</p>
          ) : events.length === 0 ? (
            <p style={{ color: '#7a8daa', textAlign: 'center', margin: '20px 0' }}>No history found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f7f9fe', borderRadius: 8, border: '1px solid #e1e7f3' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: 13, color: '#12255c', marginBottom: '4px' }}>{ev.reason}</strong>
                    <span style={{ fontSize: 11, color: '#7a8daa' }}>{new Date(ev.created_at).toLocaleString()}</span>
                  </div>
                  <span style={{ fontWeight: 'bold', color: ev.points > 0 ? '#159b78' : ev.points < 0 ? '#d93025' : '#7a8daa', display: 'flex', alignItems: 'center', fontSize: '16px' }}>
                    {ev.points > 0 ? '+' : ''}{ev.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationPickerMap({ position, setPosition, setLocationLabel }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void, setLocationLabel?: (l: string) => void }) {
  const [loadingLoc, setLoadingLoc] = useState(false);
  const center: [number, number] = position || [10.3157, 123.8854];

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPosition([lat, lng]);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name && setLocationLabel) {
           const parts = data.display_name.split(", ");
           setLocationLabel(parts.slice(0, 3).join(", "));
        }
      } catch (err) {
        console.error(err);
      }
      setLoadingLoc(false);
    }, () => setLoadingLoc(false));
  };

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      },
    });
    return null;
  }

  function MapFlyTo() {
    const map = useMap();
    useEffect(() => {
      if (position) map.flyTo(position, 15, { animate: true });
    }, [position, map]);
    return null;
  }

  const customMarker = divIcon({
    html: `<div style="font-size: 28px; text-align: center; margin-top: -28px; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.3));">📍</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  return (
    <div style={{ position: 'relative', height: '250px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cdd8ea', marginTop: '8px', zIndex: 0 }}>
      <MapContainer center={center} zoom={position ? 14 : 11} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapClickHandler />
        <MapFlyTo />
        {position && (
          <Marker position={position} icon={customMarker} />
        )}
      </MapContainer>
      <div style={{ position: 'absolute', zIndex: 400, top: '10px', left: '50px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#12255c', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'inline-block', backdropFilter: 'blur(4px)' }}>
          {position ? '📍 Location pinned' : 'Tap on the map to place a pin'}
        </div>
        <button 
          type="button"
          onClick={locateMe}
          disabled={loadingLoc}
          style={{ pointerEvents: 'auto', background: '#12255c', color: 'white', border: 'none', borderRadius: '16px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
        >
          {loadingLoc ? 'Locating...' : '🎯 Locate me'}
        </button>
      </div>
    </div>
  );
}

function ChatAttachment({ msg, onImageClick }: { msg: any, onImageClick: (url: string) => void }) {
  const rawUrl: string | null = msg.attachment_url;
  const [url, setUrl] = useState<string | null>(rawUrl?.startsWith('http') ? rawUrl : null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!rawUrl || rawUrl.startsWith('http')) return;
    supabase.storage.from('task-attachments').createSignedUrl(rawUrl, 3600 * 24).then(({ data, error: signErr }) => {
      if (data?.signedUrl) {
        setUrl(data.signedUrl);
      } else {
        console.warn('Attachment sign error:', signErr?.message);
        const { data: pub } = supabase.storage.from('task-attachments').getPublicUrl(rawUrl);
        if (pub?.publicUrl) setUrl(pub.publicUrl);
        else setError(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrl]);

  if (error) return <div style={{ fontSize: 11, color: '#e53935', padding: '6px 10px', background: 'rgba(229,57,53,0.1)', borderRadius: 6, border: '1px solid rgba(229,57,53,0.3)' }}>Attachment unavailable</div>;
  if (!url) return <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', padding: '4px 8px' }}>Loading...</div>;

  const type = msg.attachment_type as string;

  if (type === 'image') {
    return (
      <img
        src={url}
        alt="Attachment"
        className="msg-attachment-img"
        onClick={() => onImageClick(url)}
        style={{ cursor: 'zoom-in', display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }}
      />
    );
  }

  const rawName = (rawUrl || '').split('/').pop() || 'file';
  const parts = rawName.split('__');
  const displayName = parts.length > 1 ? parts.slice(1).join('__').replace(/_/g, ' ') : rawName;
  const icon = type === 'document' ? '\u{1F4C4}' : '\u{1F4CE}';

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="msg-attachment-file"
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', padding: '8px 12px', borderRadius: 8, color: '#e0eaff', textDecoration: 'none', fontWeight: 600, fontSize: 12, border: '1px solid rgba(255,255,255,0.25)', maxWidth: 220 }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
      <span style={{ fontSize: 10, opacity: 0.6 }}>&#8595;</span>
    </a>
  );
}
