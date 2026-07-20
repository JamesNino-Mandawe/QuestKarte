import { useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabase";

type AuthMode = "signin" | "signup" | "otp" | "forgot";

export default function AuthScreen({ onExplore }: { onExplore: () => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
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
    
    if (mode === "otp") {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
      setLoading(false);
      if (error) { setNotice(error.message); return; }
      if (data?.session) {
        // Automatically signed in by Supabase Auth state change which App.tsx listens to
        return;
      }
      return;
    }
    
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, terms_accepted_at: new Date().toISOString() } } })
      : await supabase.auth.signInWithPassword({ email, password });
      
    setLoading(false);
    if (result.error) { setNotice(result.error.message); return; }
    
    if (mode === "signup") {
      // Supabase sends OTP email if email confirmations are enabled
      setMode("otp");
      setNotice("A 6-digit secure code has been sent to your email.");
    }
  };

  const heading = mode === "forgot" ? "Reset your password" : mode === "otp" ? "Verify your email" : mode === "signin" ? "Continue with QuestKarte" : "Create your QuestKarte account";
  const description = mode === "forgot" ? "Enter your email and we will send a secure reset link." : mode === "otp" ? `We sent a 6-digit code to ${email}. This code expires in 10 minutes.` : mode === "signin" ? "Sign in to manage tasks, applications, messages, and your trust record." : "One account can post requests and apply for work. Verification unlocks marketplace actions.";

  return (
    <main className="auth-page">
      <div className="auth-compass" aria-hidden="true"><i /><b /><em /></div>
      <section className="auth-card">
        <div className="auth-brand">
          <img src="/questkarte-logo.svg" alt="QuestKarte emblem" />
          <div><span>QuestKarte</span><small>Tasks · Trust · Territory</small></div>
        </div>
        
        <div className="auth-heading">
          <p className="eyebrow">Secure member access</p>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        
        {(mode === "signin" || mode === "signup") && (
          <div className="auth-tabs">
            <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign in</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button>
          </div>
        )}
        
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={100} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          
          {mode !== "otp" && (
            <label>
              <span>Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value.trim())} required type="email" placeholder="you@example.com" autoComplete="email" />
            </label>
          )}
          
          {(mode === "signin" || mode === "signup") && (
            <>
              <label>
                <span>Password</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} type="password" placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
              </label>
              {mode === "signup" && (
                <label>
                  <span>Confirm password</span>
                  <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} type="password" placeholder="Repeat your password" autoComplete="new-password" />
                </label>
              )}
            </>
          )}
          
          {mode === "otp" && (
            <label>
              <span>6-digit verification code</span>
              <input value={otpCode} onChange={(event) => setOtpCode(event.target.value.trim())} required maxLength={6} placeholder="000000" style={{ letterSpacing: '0.5em', fontSize: '1.2rem', textAlign: 'center' }} />
            </label>
          )}
          
          {mode === "signup" && (
            <label className="auth-check">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>I agree to the <button type="button" onClick={() => setTermsOpen(true)}>Terms and Privacy Notice</button>.</span>
            </label>
          )}
          
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          
          <button className="auth-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "otp" ? "Verify and continue" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        
        {mode === "signin" && <button type="button" className="auth-link-button" onClick={() => changeMode("forgot")}>Forgot password?</button>}
        {mode === "forgot" && <button type="button" className="auth-link-button" onClick={() => changeMode("signin")}>Back to sign in</button>}
        {mode === "otp" && <button type="button" className="auth-link-button" onClick={() => changeMode("signup")}>Change email or restart</button>}
        
        <button className="auth-demo" type="button" onClick={onExplore}>Explore as guest</button>
        <p className="auth-guest-note">Guests can browse the marketplace. Verified members can post and apply.</p>
        
        {termsOpen && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgba(2,5,16,0.85)', backdropFilter: 'blur(8px)' }} role="presentation">
            <div style={{ position: 'relative', width: 'min(100%, 560px)', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(237,196,88,.35)', borderRadius: '20px', padding: '28px', background: '#101a39', boxShadow: '0 30px 80px rgba(0,0,0,.48)', color: '#edf2ff' }} role="dialog" aria-modal="true" aria-labelledby="terms-title">
              <button style={{ position: 'absolute', right: '14px', top: '12px', border: 0, background: 'transparent', color: '#edf2ff', fontSize: '26px', cursor: 'pointer' }} type="button" onClick={() => setTermsOpen(false)} aria-label="Close terms">×</button>
              <p className="eyebrow">QuestKarte terms</p>
              <h2 id="terms-title" style={{ margin: '6px 0 13px', fontSize: '25px', fontFamily: '"Space Grotesk", sans-serif' }}>Use QuestKarte safely and honestly.</h2>
              <p style={{ color: '#c2cce1', lineHeight: 1.65, fontSize: '13px', marginBottom: '13px' }}>Members must provide accurate information, treat others respectfully, avoid unlawful or unsafe tasks, and use the platform only for legitimate service requests and applications.</p>
              <p style={{ color: '#c2cce1', lineHeight: 1.65, fontSize: '13px', marginBottom: '13px' }}>Verification documents and identity evidence are private. They are reviewed only by authorized QuestKarte staff and are never shown on public profiles.</p>
              <p style={{ color: '#c2cce1', lineHeight: 1.65, fontSize: '13px', marginBottom: '13px' }}>Task, review, trust, and moderation decisions are recorded to protect marketplace safety. Serious violations can result in restrictions or account suspension.</p>
              <button type="button" className="auth-submit" style={{ width: '100%', marginTop: '8px' }} onClick={() => { setTermsAccepted(true); setTermsOpen(false); }}>I understand</button>
            </div>
          </div>,
          document.body
        )}
        
        <p className="auth-foot">
          {(mode === "signin" || mode === "forgot") ? "New to QuestKarte?" : mode === "signup" ? "Already have an account?" : ""} 
          {(mode === "signin" || mode === "forgot") && <button type="button" onClick={() => changeMode("signup")}>Create one</button>} 
          {mode === "signup" && <button type="button" onClick={() => changeMode("signin")}>Sign in</button>}
        </p>
      </section>
    </main>
  );
}
