import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">C</span><span>clipflow</span></Link>
        <div className="auth-heading"><span className="eyebrow">WELCOME BACK</span><h1>Sign in to your space.</h1><p>Pick up where your content left off.</p></div>
        {error && <p className="form-error">Those details didn’t match an account. Please try again.</p>}
        <form action={login} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required maxLength={128}/>
          <button className="primary-button auth-submit" type="submit">Sign in</button>
        </form>
        <p className="auth-switch">New to ClipFlow? <Link href="/register">Create an account</Link></p>
      </section>
      <p className="auth-footnote">Your content workspace, all in one flow.</p>
    </main>
  );
}
