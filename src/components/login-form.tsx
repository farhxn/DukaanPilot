"use client";

import { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator, setPersistence, inMemoryPersistence, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { apiRequest } from "./api-client";

type Settings = { enabled: boolean; emulatorUrl: string | null; firebase: { apiKey: string; projectId: string; authDomain: string; appId: string } };

export function LoginForm({ settings }: { settings: Settings }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function login(localCreate = false) {
    setPending(true); setError("");
    const name = `dukaanpilot-web-${settings.firebase.projectId}`;
    const app = getApps().find(app => app.name === name) ?? initializeApp(settings.firebase, name);
    const auth = getAuth(app);
    try {
      if (settings.emulatorUrl && !auth.emulatorConfig) connectAuthEmulator(auth, settings.emulatorUrl, { disableWarnings: true });
      await setPersistence(auth, inMemoryPersistence);
      const credential = settings.emulatorUrl
        ? await (localCreate ? createUserWithEmailAndPassword(auth, email, password) : signInWithEmailAndPassword(auth, email, password))
        : await signInWithPopup(auth, new GoogleAuthProvider());
      await apiRequest("/api/v1/auth/session", { method: "POST", body: { idToken: await credential.user.getIdToken() } });
      await signOut(auth);
      // Session boundaries use a fresh document, never a prefetched owner view.
      window.location.replace(new URL("/setup", window.location.origin).href);
    } catch (failure) {
      await signOut(auth).catch(() => undefined);
      const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (code === "auth/operation-not-allowed") setError("Google sign-in is not enabled for this Firebase project yet. Enable it in Firebase Authentication, then try again.");
      else if (["auth/unauthorized-domain", "auth/auth-domain-config-required"].includes(code)) setError("Add this app’s hostname to Firebase Authentication’s authorized domains, then try again.");
      else if (code === "auth/popup-closed-by-user") setError("Sign-in was closed. You can try again when you’re ready.");
      else if (code.startsWith("auth/")) setError(settings.emulatorUrl ? "Test sign-in failed. Check your email/password or create a new local account." : "Google sign-in could not finish. Check the project’s sign-in settings and try again.");
      else setError(failure instanceof Error ? failure.message : "Sign-in could not finish. Please try again.");
      setPending(false);
    }
  }
  return <div className="auth-form">{settings.emulatorUrl ? <><p className="local-auth-note">Local test sign-in. These accounts are stored only in the Auth emulator.</p><label>Email<input type="email" value={email} autoComplete="username" onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" minLength={8} value={password} autoComplete="current-password" onChange={event => setPassword(event.target.value)} /></label><div className="form-actions"><button className="button button-dark" disabled={pending || !email || password.length < 8} onClick={() => login()}>Sign in locally</button><button className="button button-outline" disabled={pending || !email || password.length < 8} onClick={() => login(true)}>Create local test account</button></div></> : <button className="button button-dark google-signin" disabled={pending} onClick={() => login()}>Continue with Google</button>}{pending && <p className="form-message" role="status">Verifying your sign-in…</p>}{error && <p className="form-error" role="alert">{error}</p>}<p className="form-hint">Your browser session lasts up to one hour. Sign out on shared devices.</p></div>;
}
