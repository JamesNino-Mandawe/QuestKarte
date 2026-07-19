import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";

export default function AuthScreen({ onExplore, onStaffPreview }: { onExplore: () => void; onStaffPreview: (role: "moderator" | "admin") => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const changeMode = (nextMode: AuthMode) => { setMode(nextMode); setNotice(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && password !== confirmPassword) { setNotice("Your password confirmation does not match."); return; }
    if (mode === "signup" && !termsAccepted) { setNotice("Please accept the Terms and Privacy Notice before creating an account."); return; }
    setLoading(true); setNotice("");
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      setLoading(false);
      setNotice(error ? error.message : "If that email is registered, a secure password-reset link has been sent.");
      return;
    }
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, terms_accepted_at: new Date().toISOString() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) { setNotice(result.error.message); return; }
    if (mode === "signup" && !result.data.session) setNotice("Account created. Confirm the secure email sent by QuestKarte, then sign in.");
  };

  const heading = mode === "forgot" ? "Reset your password" : mode === "signin" ? "Continue with QuestKarte" : "Create your QuestKarte account";
  const description = mode === "forgot" ? "Enter your email and we will send a secure reset link." : mode === "signin" ? "Sign in to manage tasks, applications, messages, and your trust record." : "One account can post requests and apply for work. Verification unlocks marketplace actions.";

  return <main className="auth-page"><div className="auth-compass" aria-hidden="true"><i /><b /><em /></div><section className="auth-card"><div className="auth-brand"><img src="/questkarte-logo.png" alt="QuestKarte emblem" /><div><span>QuestKarte</span><small>Tasks · Trust · Territory</small></div></div><div className="auth-heading"><p className="eyebrow">Secure member access</p><h1>{heading}</h1><p>{description}</p></div>{mode !== "forgot" && <div className="auth-tabs"><button type="button" className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign in</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button></div>}<form className="auth-form" onSubmit={submit}>{mode === "signup" && <label><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={100} placeholder="Your name" autoComplete="name" /></label>}<label><span>Email address</span><input value={email} onChange={(event) => setEmail(event.target.value.trim())} required type="email" placeholder="you@example.com" autoComplete="email" /></label>{mode !== "forgot" && <><label><span>Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} type="password" placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>{mode === "signup" && <label><span>Confirm password</span><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} type="password" placeholder="Repeat your password" autoComplete="new-password" /></label>}</>}{mode === "signup" && <label className="auth-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I agree to the <button type="button" onClick={() => setTermsOpen(true)}>Terms and Privacy Notice</button>.</span></label>}{notice && <p className="auth-notice" role="status">{notice}</p>}<button className="auth-submit" disabled={loading}>{loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "signin" ? "Sign in" : "Create account"}</button></form>{mode === "signin" && <button type="button" className="auth-link-button" onClick={() => changeMode("forgot")}>Forgot password?</button>}{mode === "forgot" && <button type="button" className="auth-link-button" onClick={() => changeMode("signin")}>Back to sign in</button>}<button className="auth-demo" type="button" onClick={onExplore}>Explore as guest</button><p className="auth-guest-note">Guests can browse the marketplace. Verified members can post and apply.</p><div className="staff-preview"><span>Staff UI previews</span><button type="button" onClick={() => onStaffPreview("moderator")}>Moderator console</button><button type="button" onClick={() => onStaffPreview("admin")}>Admin command center</button></div>{termsOpen && <div className="terms-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-title"><div><button className="terms-close" type="button" onClick={() => setTermsOpen(false)} aria-label="Close terms">×</button><p className="eyebrow">QuestKarte terms</p><h2 id="terms-title">Use QuestKarte safely and honestly.</h2><p>Members must provide accurate information, treat others respectfully, avoid unlawful or unsafe tasks, and use the platform only for legitimate service requests and applications.</p><p>Verification documents and identity evidence are private. They are reviewed only by authorized QuestKarte staff and are never shown on public profiles.</p><p>Task, review, trust, and moderation decisions are recorded to protect marketplace safety. Serious violations can result in restrictions or account suspension.</p><button type="button" className="auth-submit" onClick={() => { setTermsAccepted(true); setTermsOpen(false); }}>I understand</button></div></div>}<p className="auth-foot">{mode === "signin" ? "New to QuestKarte?" : "Already have an account?"} <button type="button" onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create one" : "Sign in"}</button></p></section></main>;
}
