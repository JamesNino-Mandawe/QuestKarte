import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./verification-gate.css";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
type MemberType = "student" | "professional";
type EvidenceKey = "student_id" | "study_load" | "nbi_clearance" | "government_id" | "face_verification";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function TermsDialog({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgba(7,17,36,0.85)', backdropFilter: 'blur(8px)' }} role="presentation" onMouseDown={onClose}>
      <section style={{ position: 'relative', width: 'min(100%, 720px)', maxHeight: 'min(780px, calc(100vh - 44px))', overflow: 'auto', padding: '30px', borderRadius: '20px', background: '#fff', color: '#263b64', boxShadow: '0 30px 80px rgba(0,0,0,.48)' }} role="dialog" aria-modal="true" aria-labelledby="terms-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" style={{ position: 'absolute', right: '16px', top: '16px', border: '1px solid #ccd9ee', borderRadius: '9px', background: '#fff', color: '#173d90', fontSize: '25px', width: '37px', height: '37px', cursor: 'pointer' }} onClick={onClose} aria-label="Close Terms and Conditions">×</button>
        <span className="eyebrow" style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '1.6px', textTransform: 'uppercase', color: '#173d90', display: 'block', marginBottom: '6px' }}>QuestKarte legal</span>
        <h2 id="terms-title" style={{ color: '#0d2f79', margin: '0 0 6px', fontSize: '28px', fontFamily: '"Space Grotesk", sans-serif' }}>Terms and Conditions</h2>
        <p style={{ fontSize: '12px', color: '#7183a5', marginBottom: '16px' }}>Effective 18 July 2026 · Version 1.0</p>
        <div>
          <h3 style={{ margin: '22px 0 5px', color: '#173d90', fontSize: '16px' }}>1. Honest membership</h3><p style={{ margin: 0, color: '#53698e', lineHeight: 1.55 }}>Use your own identity and provide accurate profile and task details. Do not impersonate another person, submit false documents, or use QuestKarte for unlawful, harmful, or deceptive activity.</p>
          <h3 style={{ margin: '22px 0 5px', color: '#173d90', fontSize: '16px' }}>2. Verification and private documents</h3><p style={{ margin: 0, color: '#53698e', lineHeight: 1.55 }}>Verification documents and face photos are stored privately and reviewed by authorised QuestKarte staff. Face verification is a manual identity comparison; QuestKarte does not make an automated biometric decision. Approval is not guaranteed and staff may request clearer information.</p>
          <h3 style={{ margin: '22px 0 5px', color: '#173d90', fontSize: '16px' }}>3. Marketplace conduct</h3><p style={{ margin: 0, color: '#53698e', lineHeight: 1.55 }}>Members must communicate respectfully, keep task details accurate, and never request unsafe, unlawful, or off-platform payment arrangements. Report suspicious content through the platform.</p>
          <h3 style={{ margin: '22px 0 5px', color: '#173d90', fontSize: '16px' }}>4. Personal responsibility</h3><p style={{ margin: 0, color: '#53698e', lineHeight: 1.55 }}>QuestKarte helps members discover and manage local opportunities. Members remain responsible for assessing safety, agreeing scope and payment, and protecting their personal information during each arrangement.</p>
          <h3 style={{ margin: '22px 0 5px', color: '#173d90', fontSize: '16px' }}>5. Moderation</h3><p style={{ margin: 0, color: '#53698e', lineHeight: 1.55, marginBottom: '24px' }}>QuestKarte may review, reject, suspend, remove, or escalate content and accounts that breach these terms or create a safety risk. You may contact support to ask about a moderation outcome.</p>
        </div>
        <button type="button" style={{ background: '#1d46a9', color: '#fff', border: 0, padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%' }} onClick={onClose}>I understand</button>
      </section>
    </div>,
    document.body
  );
}

export default function VerificationGate({ session, status, termsAcceptedAt, onSignOut }: { session: Session; status: VerificationStatus; termsAcceptedAt: string | null; onSignOut: () => void }) {
  const [memberType, setMemberType] = useState<MemberType>("student");
  const [institution, setInstitution] = useState("");
  const [institutionalEmail, setInstitutionalEmail] = useState("");
  const [files, setFiles] = useState<Partial<Record<EvidenceKey, File>>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (status !== "rejected") { setRejectionReason(""); return; }
    void supabase
      .from("verification_requests")
      .select("rejection_reason")
      .eq("user_id", session.user.id)
      .eq("status", "rejected")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRejectionReason(data?.rejection_reason?.trim() || "Please submit clear, current documents that match your account details."));
  }, [session.user.id, status]);

  const chooseFile = (key: EvidenceKey, file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) { setNotice("Use a JPG, PNG, WEBP, or PDF file up to 10 MB."); return; }
    setFiles((current) => ({ ...current, [key]: file }));
    setNotice("");
  };
  const uploadEvidence = async (requestId: string, key: EvidenceKey, file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${session.user.id}/${requestId}/${key}-${safeName}`;
    const { error } = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return { evidence_kind: key, storage_path: path, file_name: file.name, mime_type: file.type };
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptedTerms) { setNotice("Please read and accept the Terms and Conditions before submitting verification."); return; }
    const studentReady = institution.trim() && institutionalEmail.trim() && files.student_id && files.study_load && files.face_verification;
    const professionalReady = institution.trim() && files.nbi_clearance && files.government_id && files.face_verification;
    if (!(memberType === "student" ? studentReady : professionalReady)) { setNotice(memberType === "student" ? "Add your institution, institutional email, student ID, study load, and face verification." : "Add your organisation or service area, NBI clearance, valid ID, and face verification."); return; }
    setSaving(true); setNotice("");
    const requestId = crypto.randomUUID(); const uploaded: Array<{ evidence_kind: EvidenceKey; storage_path: string; file_name: string; mime_type: string }> = [];
    try {
      for (const [key, file] of Object.entries(files) as Array<[EvidenceKey, File | undefined]>) if (file) uploaded.push(await uploadEvidence(requestId, key, file));
      if (!termsAcceptedAt) { const { error } = await supabase.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("id", session.user.id); if (error) throw error; }
      const primary = uploaded[0];
      const { error: requestError } = await supabase.from("verification_requests").insert({ id: requestId, user_id: session.user.id, type: memberType, school_name: memberType === "student" ? institution.trim() : null, school_email: memberType === "student" ? institutionalEmail.trim() : null, institution_or_company: memberType === "professional" ? institution.trim() : null, document_path: primary.storage_path, document_name: primary.file_name, notes: memberType === "student" ? "Student verification: student ID, study load, institutional email, and manual face check." : "Professional/worker verification: NBI clearance, valid ID, and manual face check." });
      if (requestError) throw requestError;
      const { error: evidenceError } = await supabase.from("verification_evidence").insert(uploaded.map((item) => ({ ...item, request_id: requestId, user_id: session.user.id })));
      if (evidenceError) throw evidenceError;
      setNotice("Verification submitted. A moderator will review your private documents before your account is opened.");
    } catch (error) { await Promise.all(uploaded.map((item) => supabase.storage.from("verification-documents").remove([item.storage_path]))); setNotice(error instanceof Error ? error.message : "Verification could not be submitted. Please try again."); }
    finally { setSaving(false); }
  };
  const isWaiting = status === "pending" || notice.startsWith("Verification submitted");
  return <main className="verification-page"><section className="verification-card">
    <div className="verification-brand"><img src="/questkarte-logo.svg" alt="QuestKarte" /><div><strong>QuestKarte</strong><span>Secure member verification</span></div></div>
    {isWaiting ? <div className="verification-waiting"><span className="waiting-icon">✓</span><span className="eyebrow">Verification received</span><h1>Your account is being reviewed.</h1><p>Your documents are private. A moderator must approve them before you can use the marketplace, post tasks, or contact members.</p><div style={{ background: '#edf5ff', border: '1px solid #b8d4f0', borderRadius: '12px', padding: '16px 18px', margin: '18px 0 8px', textAlign: 'left' }}><p style={{ margin: 0, color: '#1a4a8a', fontSize: '13px', lineHeight: 1.6, fontWeight: 500 }}>📧 <strong>You will receive an email notification</strong> at <strong>{session.user.email}</strong> once a moderator has reviewed your documents. This email will let you know whether your verification was <strong style={{ color: '#1a7a4a' }}>approved</strong> or <strong style={{ color: '#b44030' }}>declined</strong>.</p></div><div className="review-steps"><span>Submitted</span><span className="active">Staff review</span><span>Account opened</span></div><button type="button" className="btn primary" style={{ width: '100%', marginTop: '10px' }} onClick={onSignOut}>Return to website</button><p style={{ margin: '10px 0 0', color: '#7a8aaa', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>You will be signed out. Come back anytime to check your status.</p><button type="button" className="btn secondary" style={{ marginTop: '6px' }} onClick={onSignOut}>Use a different account</button></div> : <>
      <span className="eyebrow">Required before marketplace access</span><h1>Verify your QuestKarte account</h1><p className="verification-intro">To protect members, every account is reviewed before it can post, apply, or message. Documents are visible only to authorised staff.</p>
      {status === "rejected" && <div className="verification-notice error"><strong>Your verification was not approved yet.</strong><br />Moderator note: {rejectionReason || "Loading the moderator's note…"}<br /><br />You can correct the issue and submit a new verification request below.</div>}
      <form onSubmit={submit} className="verification-form"><div className="member-type-toggle"><button type="button" className={memberType === "student" ? "selected" : ""} onClick={() => setMemberType("student")}>Student</button><button type="button" className={memberType === "professional" ? "selected" : ""} onClick={() => setMemberType("professional")}>Professional / worker</button></div>
        <label>{memberType === "student" ? "School or institution" : "Organisation or service area"}<input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder={memberType === "student" ? "e.g. Cebu Institute of Technology" : "e.g. Cebu City · freelance technician"} /></label>
        {memberType === "student" && <label>Institutional email<input type="email" value={institutionalEmail} onChange={(event) => setInstitutionalEmail(event.target.value)} placeholder="name@school.edu.ph" /></label>}
        <section className="evidence-section"><div><strong>Private documents</strong><span>JPG, PNG, WEBP, or PDF · maximum 10 MB each</span></div>{memberType === "student" ? <><EvidenceInput label="Student ID" required file={files.student_id} onFile={(file) => chooseFile("student_id", file)} /><EvidenceInput label="Current study load" required file={files.study_load} onFile={(file) => chooseFile("study_load", file)} /></> : <><EvidenceInput label="NBI clearance" required file={files.nbi_clearance} onFile={(file) => chooseFile("nbi_clearance", file)} /><EvidenceInput label="One valid government ID" required file={files.government_id} onFile={(file) => chooseFile("government_id", file)} /></>}<EvidenceInput label="Face verification photo" required file={files.face_verification} onFile={(file) => chooseFile("face_verification", file)} helper="A clear current selfie. It is manually compared with your ID; no automated biometric decision is used." /></section>
        <label className="terms-check"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>I have read and agree to the <button type="button" onClick={() => setTermsOpen(true)}>Terms and Conditions</button>.</span></label>
        {notice && <div className={`verification-notice ${notice.startsWith("Verification submitted") ? "success" : "error"}`}>{notice}</div>}<button className="btn primary verification-submit" disabled={saving}>{saving ? "Submitting private documents…" : "Submit verification for review"}</button>
      </form><button type="button" className="verification-signout" onClick={onSignOut}>Use a different account</button>
    </>}
  </section>{termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}</main>;
}

function EvidenceInput({ label, required, file, helper, onFile }: { label: string; required?: boolean; file?: File; helper?: string; onFile: (file?: File) => void }) { return <label className="evidence-input"><span><strong>{label}{required ? " *" : ""}</strong>{helper && <small>{helper}</small>}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => onFile(event.target.files?.[0])} /><em>{file ? file.name : "Choose file"}</em></label>; }
