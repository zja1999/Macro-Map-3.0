import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MacroVerse collects, uses, shares, and protects personal data.",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-base font-bold text-ink">{title}</h2>
    <div className="space-y-2 text-sm leading-6 text-ink-dim">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-edge bg-bg/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/recipes" className="text-lg font-black tracking-tight">
            Macro<span className="text-accent">verse</span>
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-ink-dim hover:text-ink">Log in</Link>
            <Link href="/register" className="font-semibold text-accent">Create account</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="space-y-2 border-b border-edge pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Privacy policy</p>
          <h1 className="text-3xl font-black tracking-tight">Your data should work for you.</h1>
          <p className="text-sm text-ink-faint">Effective July 11, 2026</p>
        </div>

        <Section title="Scope">
          <p>
            This policy explains how MacroVerse handles information when you use our website, installable web app,
            or Android app. MacroVerse combines nutrition tracking, fitness and health logs, planning tools, and
            community features. It is not a medical service and is not a substitute for professional advice.
          </p>
        </Section>

        <Section title="Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Account and profile:</strong> email, username, display name, biography, avatar, account status, and sign-in provider.</li>
            <li><strong>Nutrition and planning:</strong> targets, food and water logs, recipes, saved restaurant orders, groceries, and meal plans.</li>
            <li><strong>Fitness and health:</strong> measurements, habits, fasting and sleep records, workouts, routes, and health metrics you enter or import.</li>
            <li><strong>Community activity:</strong> posts, comments, reactions, votes, follows, groups, challenges, reports, feedback, and notifications.</li>
            <li><strong>Device and security:</strong> session records, hashed abuse-prevention identifiers, push registration tokens, and ordinary request metadata processed by our hosting providers.</li>
            <li><strong>Location:</strong> if you choose “near me,” your device location is used to find nearby restaurants. Precise device location is not stored in your MacroVerse profile by that feature.</li>
          </ul>
          <p>Some health, route, progress, and profile information can be sensitive. You choose whether to provide it and whether supported content is public or private.</p>
        </Section>

        <Section title="Where information comes from">
          <p>
            We receive information from you, your device, other users who interact with you, and services you choose
            to connect. Connected health providers may supply profile identifiers, workouts, sleep, steps, heart
            metrics, routes, or measurements depending on the permissions you grant. You can disconnect a provider
            in Settings; disconnecting stops future access but does not automatically erase data already imported.
          </p>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide, personalize, synchronize, and improve MacroVerse features.</li>
            <li>Calculate and display nutrition, fitness, habit, and challenge results.</li>
            <li>Operate community, moderation, safety, notification, and support workflows.</li>
            <li>Secure accounts, prevent abuse, diagnose failures, and comply with law.</li>
            <li>Send account verification, recovery, and service messages.</li>
          </ul>
          <p>We do not sell personal information or use it for third-party targeted advertising.</p>
        </Section>

        <Section title="When information is shared">
          <p>
            Content you mark public may be visible to other users. Private logs, targets, saved orders, routes,
            progress information, and connected-health data are not made public unless a feature clearly asks you to
            share or publish something.
          </p>
          <p>
            We use service providers for hosting, databases, email delivery, identity, maps/geocoding, nutrition
            lookup, push delivery, and optional health connections. They process only the information needed to
            provide their service under their own terms and privacy commitments. We may also disclose information
            when required by law, to protect people or the service, or as part of a business transfer with appropriate safeguards.
          </p>
        </Section>

        <Section title="Retention, export, and deletion">
          <p>
            We retain account data while your account is active and as needed for the purposes above. Some security
            events expire through operational cleanup. Moderation and audit records may retain a de-identified or
            null actor reference after an account is removed when necessary for safety and accountability.
          </p>
          <p>
            Signed-in users can download a JSON copy of their data from Settings. The export excludes passwords,
            session and recovery tokens, encrypted provider credentials, device tokens, internal storage keys, and
            other users&apos; private information. You can permanently delete your account from Settings. Deletion removes
            user-owned data through the application&apos;s account-deletion process and cannot be undone.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use safeguards including encrypted transport, hashed passwords and public authentication tokens,
            HTTP-only session cookies, access controls, and encryption for connected-health credentials. No system is
            perfectly secure, so use a unique password and contact us if you believe your account is at risk.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <p>
            You can update profile and visibility settings, manage integrations, export your data, and delete your
            account in Settings. Depending on where you live, you may also have rights to access, correct, delete,
            restrict, or object to processing, and to appeal or complain to a data-protection authority.
          </p>
        </Section>

        <Section title="Children">
          <p>
            MacroVerse is not directed to children under 13, and account setup does not support an age below 13. If
            you believe a child provided personal information contrary to this policy, contact us so we can investigate and delete it.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            We may update this policy as MacroVerse changes. We will change the effective date and provide additional
            notice when required. For privacy questions or requests, use the Feedback control while signed in. We will
            add a public contact method here before public launch.
          </p>
        </Section>
      </main>
    </div>
  );
}
