import { useEffect, useState } from "react";
import "./landing.css";

type LandingPageProps = {
  onStart: () => void;
  onBrowse: () => void;
};

const sampleTasks = [
  ["Tutoring", "Need Math Tutor for 2 Sessions", "₱600", "Lahug · Cebu City", "Students welcome"],
  ["Cleaning", "House Deep Cleaning, Half Day", "₱500", "Banilad · Cebu City", "Weekend"],
  ["Design", "Logo Design for Small Business", "₱1,200", "Remote", "Portfolio useful"],
  ["Delivery", "Grocery Delivery, SM Cebu", "₱200", "SM City · Cebu", "Today"],
  ["Academic", "Academic Paper Proofreading", "₱400", "Remote", "Students welcome"],
  ["Events", "Event Setup Assistance", "₱800", "IT Park · Cebu", "Urgent"],
] as const;

const navLinks = [
  ["Browse tasks", "tasks"],
  ["How it works", "how-it-works"],
  ["Trust", "trust"],
  ["For students", "students"],
] as const;

export default function LandingPage({ onStart, onBrowse }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const listener = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", listener, { passive: true });
    return () => window.removeEventListener("scroll", listener);
  }, []);

  const goTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="landing">
      <header className={`landing-nav ${scrolled ? "is-scrolled" : ""}`}>
        <button className="landing-brand" onClick={() => goTo("top")} aria-label="QuestKarte home">
          <img src="/questkarte-logo.svg" alt="" />
          <span>QuestKarte<small>CEBU TASK MARKETPLACE</small></span>
        </button>
        <nav className={menuOpen ? "landing-links open" : "landing-links"} aria-label="Landing page navigation">
          {navLinks.map(([label, id]) => <button key={id} onClick={() => goTo(id)}>{label}</button>)}
        </nav>
        <div className="landing-actions">
          <button className="text-action" onClick={onStart}>Log in</button>
          <button className="coral-button nav-cta" onClick={onStart}>Begin your quest <span>→</span></button>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? "×" : "☰"}</button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="hero-photo" />
        <div className="hero-grid" />
        <div className="hero-content reveal">
          <p className="landing-eyebrow"><span /> CEBU CITY'S TASK MARKETPLACE</p>
          <h1>Your next quest<br /><em>starts here.</em></h1>
          <p className="hero-copy">QuestKarte connects members across Cebu City to post tasks, discover work, and build a reputation through completed, trusted service.</p>
          <div className="hero-buttons">
            <button className="coral-button large" onClick={onStart}>Begin your quest <span>→</span></button>
            <button className="outline-button large" onClick={onBrowse}>Browse available tasks <span>↗</span></button>
          </div>
          <p className="hero-note">One member account can post a task or apply for one.</p>
        </div>
        <div className="hero-bottom"><span>SCROLL TO EXPLORE</span><i>↓</i></div>
      </section>

      <section className="landing-section how-section" id="how-it-works">
        <div className="section-intro"><p className="landing-eyebrow">HOW QUESTKARTE WORKS</p><h2>Simple from first post<br />to <em>finished work.</em></h2><p>Clear steps keep expectations visible for both the person posting and the person completing the work.</p></div>
        <div className="steps-grid">
          <article className="step-card"><img src="/landing/coffee-work.jpg" alt="A member working on a laptop in a coffee shop" /><div><span className="step-number">01</span><span className="step-icon coral">⌖</span><h3>Post a task</h3><p>Describe what needs doing, add a budget, location, schedule, and reference photos.</p></div></article>
          <article className="step-card"><img src="/landing/student-phone.jpg" alt="A student using a phone outdoors" /><div><span className="step-number">02</span><span className="step-icon mint">⌕</span><h3>Discover & apply</h3><p>Explore approved tasks nearby, filter by skill or distance, and apply with confidence.</p></div></article>
          <article className="step-card"><img src="/landing/handshake.jpg" alt="Professionals meeting after an agreement" /><div><span className="step-number">03</span><span className="step-icon gold">✦</span><h3>Complete & grow</h3><p>Track progress, share deliverables, leave a review, and build your Trust Factor.</p></div></article>
        </div>
      </section>

      <section className="landing-section feed-section" id="tasks">
        <div className="section-heading-row"><div><p className="landing-eyebrow">MARKETPLACE PREVIEW</p><h2>What you can<br /><em>discover.</em></h2></div><p>Examples of the kinds of tasks QuestKarte is designed to help members coordinate. Live listings are shown after you enter the marketplace.</p></div>
        <div className="landing-task-grid">
          {sampleTasks.map(([category, title, amount, location, detail]) => <article className="landing-task" key={title}>
            <div className="task-card-top"><span>{category}</span><button aria-label={`Save ${title}`}>☆</button></div><h3>{title}</h3><strong>{amount}</strong><p>⌖ {location}</p><footer><span>{detail}</span><button onClick={onBrowse}>View task <b>→</b></button></footer>
          </article>)}
        </div>
        <button className="coral-button centered-cta" onClick={onBrowse}>Explore the marketplace <span>→</span></button>
      </section>

      <section className="landing-section trust-section" id="trust">
        <div className="trust-visual"><div className="trust-orbit orbit-one" /><div className="trust-orbit orbit-two" /><div className="trust-meter"><span>TRUST FACTOR</span><strong>87</strong><small>of 100</small><i>Gold Trusted</i></div><p>This is an illustrative example. Your score starts fresh and grows through genuine activity.</p></div>
        <div className="trust-copy"><p className="landing-eyebrow">A REPUTATION YOU OWN</p><h2>Your reputation is<br /><em>your currency.</em></h2><p>QuestKarte turns completed work, useful reviews, and verified information into a single Trust Factor. It gives people more context before they choose whom to work with.</p><ul><li><span className="rank-dot bronze" /> Bronze <small>Getting started</small></li><li><span className="rank-dot silver" /> Silver <small>Building consistency</small></li><li><span className="rank-dot gold" /> Gold <small>Established reliability</small></li><li><span className="rank-dot platinum" /> Certified <small>Strong verified record</small></li></ul></div>
      </section>

      <section className="safety-section" id="safety"><div className="safety-pattern" /><div className="landing-section"><div className="safety-heading"><p className="landing-eyebrow">SAFETY BY DESIGN</p><h2>Built for trust.<br /><em>Designed for clarity.</em></h2><p>Tasks can be reviewed before they appear publicly, reports can be investigated, and member verification is handled through a controlled staff workflow.</p></div><div className="safety-grid"><article><span className="mint">⌑</span><h3>Member verification</h3><p>Members can submit identity or qualification documents for staff review when verification is needed.</p></article><article><span className="coral">◈</span><h3>Moderated task flow</h3><p>Posts are reviewed before marketplace publication so the visible feed focuses on available tasks.</p></article><article><span className="violet">◌</span><h3>Reports & disputes</h3><p>Members can report concerns and open task disputes with evidence for staff review.</p></article></div></div></section>

      <section className="landing-section student-section" id="students"><div className="student-photo"><img src="/landing/designer.jpg" alt="A creative student working at a desktop" /></div><div className="student-copy"><p className="landing-eyebrow">BUILT FOR STUDENTS</p><h2>Earn without<br /><em>losing your rhythm.</em></h2><p>Find flexible tasks, offer the skills you are learning, and grow a portfolio of trusted work around your own schedule.</p><ul><li>Student-focused opportunities</li><li>Clear location and schedule details</li><li>Verified-student status where applicable</li><li>A practical record of completed work</li></ul><button className="coral-button" onClick={onStart}>Create your member account <span>→</span></button></div></section>

      <section className="landing-section experience-section"><div className="experience-title"><p className="landing-eyebrow">ONE CONNECTED WORKSPACE</p><h2>The full quest<br /><em>experience.</em></h2><p>Use the marketplace, map, task workspace, messages, and profile tools from the same responsive web app.</p></div><div className="device-stage"><div className="device laptop"><div className="device-bar"><i /><i /><i /></div><div className="device-ui"><aside>QK</aside><main><span>My workspace</span><b>Find the right task</b><div /><div /></main></div></div><div className="device phone"><div className="speaker" /><div className="phone-ui"><small>Nearby tasks</small><strong>Find your next task</strong><div className="mini-map">⌖</div><p>Trusted service, closer to you.</p><button>Explore</button></div></div><div className="device tablet"><div className="tablet-map"><span>⌖</span><i /><i /><i /><i /></div></div></div></section>

      <section className="landing-section cta-section"><div className="cta-glow" /><p className="landing-eyebrow">READY WHEN YOU ARE</p><h2>Your quest<br /><em>begins now.</em></h2><p>Join Cebu City members creating clearer, more accountable ways to get things done.</p><div className="hero-buttons"><button className="coral-button large" onClick={onStart}>Begin your quest <span>→</span></button><button className="outline-button large" onClick={onBrowse}>Browse tasks <span>↗</span></button></div><small>Free to create an account. Features are built around real task activity.</small></section>

      <footer className="landing-footer"><div className="footer-brand"><img src="/questkarte-logo.svg" alt="QuestKarte" /><p>Every task is a quest. Every quest deserves its karte.</p></div><div><h4>Platform</h4><button onClick={onBrowse}>Browse tasks</button><button onClick={onStart}>Post a task</button><button onClick={() => goTo("trust")}>Trust system</button></div><div><h4>About</h4><button onClick={() => goTo("how-it-works")}>How it works</button><button onClick={() => goTo("students")}>For students</button><button onClick={() => goTo("safety")}>Safety</button></div><div><h4>Support</h4><button onClick={onStart}>Log in</button><button onClick={onStart}>Create account</button><a href="mailto:hello@questkarte.local">Contact us</a></div><p className="footer-bottom">© 2026 QuestKarte · Cebu City, Philippines · Built by Group 6 Seven</p></footer>
    </main>
  );
}
