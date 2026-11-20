import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">C</span><span>clipflow</span></Link>
        <div className="auth-heading"><span className="eyebrow">GET STARTED</span><h1>Your creator space starts here.</h1><p>Create your account and we’ll set up your first workspace.</p></div>
        {error === "exists" ? <p className="form-error">An account with that email already exists. Try signing in.</p> : error ? <p className="form-error">Check your details. Passwords must match and contain at least 10 characters.</p> : null}
        <form action={register} className="auth-form">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Your name" required minLength={1} maxLength={80}/>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 10 characters" required minLength={10} maxLength={128}/>
          <label htmlFor="confirmPassword">Confirm password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" required minLength={10} maxLength={128}/>
          <button className="primary-button auth-submit" type="submit">Create free account</button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        <p className="auth-terms">By creating an account, you agree to use ClipFlow responsibly and connect only social accounts you own or are authorised to manage.</p>
      </section>
      <p className="auth-footnote">Plan, organise and publish with confidence.</p>
    </main>
  );
}
