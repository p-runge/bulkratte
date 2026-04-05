import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Bulkratte",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: April 2025</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Data Controller</h2>
        <p>
          Bulkratte is operated by:
          <br />
          <span className="font-medium">Progani GmbH</span>
          <br />
          Osterstr. 8
          <br />
          20259 Hamburg, Germany
          <br />
          Contact:{" "}
          <a
            href="mailto:kontakt@progani.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            kontakt@progani.com
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. What Data We Collect</h2>
        <p>
          When you sign in with Discord or Google, we receive and store the
          following data provided by those services:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Display name</li>
          <li>Email address</li>
          <li>Profile picture URL</li>
          <li>
            OAuth account identifiers and tokens (used only to maintain your
            session)
          </li>
        </ul>
        <p>As you use Bulkratte, we also store data you create:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Your Pokémon card collection (cards, conditions, variants, notes)
          </li>
          <li>Photos you upload of your cards</li>
          <li>Custom sets you create</li>
          <li>Wantlist share links and their access timestamps</li>
          <li>Trade connections and invite links</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Why We Process Your Data</h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">
              Authentication & account management
            </span>{" "}
            — to verify your identity and maintain a secure session across
            visits. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).
          </p>
          <p>
            <span className="font-medium">Core functionality</span> — storing
            your collection, sets, photos, wantlists, and trade connections is
            the entire purpose of the service. Legal basis: performance of a
            contract (Art. 6(1)(b) GDPR).
          </p>
          <p>
            <span className="font-medium">Language preference</span> — we store
            your preferred language in a cookie to make the site work in your
            language on every visit. Legal basis: legitimate interest (Art.
            6(1)(f) GDPR).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Cookies</h2>
        <p>We use two cookies:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Session cookie</span> (
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              authjs.session-token
            </code>
            ) — keeps you logged in. This cookie is strictly necessary for the
            service to function.
          </li>
          <li>
            <span className="font-medium">Language cookie</span> (
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              preferred-locale
            </code>
            ) — remembers your language preference. This cookie is strictly
            functional.
          </li>
        </ul>
        <p>
          Neither cookie is used for tracking or advertising. No third-party
          cookies are set by Bulkratte.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Analytics</h2>
        <p>
          We use{" "}
          <a
            href="https://plausible.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Plausible Analytics
          </a>{" "}
          to understand how the site is used in aggregate. Plausible is
          privacy-friendly by design: it sets no cookies, does not track
          individuals across sites, and does not collect any personal data.
          Statistical data is processed on Plausible&apos;s EU infrastructure.
        </p>
        <p>
          We also use{" "}
          <a
            href="https://vercel.com/docs/speed-insights"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Vercel Speed Insights
          </a>{" "}
          to monitor page performance. This service measures technical metrics
          (load times, Core Web Vitals) and does not store personal data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">Discord & Google</span> — used solely
            for authentication. We do not share your data back with them beyond
            what is required for the OAuth login flow.
          </p>
          <p>
            <span className="font-medium">Vercel</span> — our hosting provider.
            Your requests are processed on Vercel&apos;s infrastructure. See{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Vercel&apos;s Privacy Policy
            </a>
            .
          </p>
          <p>
            <span className="font-medium">Cloudflare R2</span> — used to store
            card photos you upload. Images are served via Cloudflare&apos;s
            infrastructure. See{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Cloudflare&apos;s Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Data Retention</h2>
        <p>
          Your account and all associated data (collection, sets, photos,
          wantlists, trade connections) are kept for as long as your account
          exists. If you want your data deleted, contact us at the address above
          and we will remove it within 30 days.
        </p>
        <p>
          Auth session tokens expire automatically and are removed from our
          database when they do.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Your Rights (GDPR)</h2>
        <p>
          As a user in the EU/EEA you have the following rights regarding your
          personal data:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Access</span> — request a copy of the
            data we hold about you.
          </li>
          <li>
            <span className="font-medium">Rectification</span> — ask us to
            correct inaccurate data.
          </li>
          <li>
            <span className="font-medium">Erasure</span> — request deletion of
            your account and all associated data.
          </li>
          <li>
            <span className="font-medium">Portability</span> — receive your data
            in a machine-readable format.
          </li>
          <li>
            <span className="font-medium">Objection</span> — object to
            processing based on legitimate interest.
          </li>
          <li>
            <span className="font-medium">Restriction</span> — ask us to pause
            processing while a dispute is resolved.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at the email address in
          section 1. You also have the right to lodge a complaint with your
          national data protection authority.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. The &quot;last
          updated&quot; date at the top of this page will reflect any changes.
          We encourage you to review this page periodically.
        </p>
      </section>
    </div>
  );
}
