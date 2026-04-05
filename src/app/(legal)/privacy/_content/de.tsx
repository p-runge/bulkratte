import { contact } from "../../_content/contact";

export function PrivacyPolicyDe() {
  return (
    <div className="space-y-8 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Datenschutzerklärung
        </h1>
        <p className="text-muted-foreground">Stand: April 2025</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Verantwortlicher</h2>
        <p>
          Bulkratte wird betrieben von:
          <br />
          <span className="font-medium">{contact.companyName}</span>
          <br />
          {contact.street}
          <br />
          {contact.postalCode}
          <br />
          {contact.country.de}
          <br />
          Kontakt:{" "}
          <a
            href={contact.emailHref}
            className="text-primary underline-offset-4 hover:underline"
          >
            {contact.email}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Welche Daten wir erheben</h2>
        <p>
          Wenn du dich mit Discord oder Google anmeldest, erhalten und speichern
          wir folgende Daten, die von diesen Diensten bereitgestellt werden:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Anzeigename</li>
          <li>E-Mail-Adresse</li>
          <li>Profilbild-URL</li>
          <li>
            OAuth-Kontobezeichner und -tokens (ausschließlich zur
            Sitzungsverwaltung)
          </li>
        </ul>
        <p>Während der Nutzung von Bulkratte speichern wir außerdem:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Deine Pokémon-Kartensammlung (Karten, Zustand, Varianten, Notizen)
          </li>
          <li>Von dir hochgeladene Fotos deiner Karten</li>
          <li>Von dir erstellte Sets</li>
          <li>Wunschlisten-Freigabelinks und deren Zugriffszeitpunkte</li>
          <li>Tauschverbindungen und Einladungslinks</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          3. Zweck der Datenverarbeitung
        </h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">
              Authentifizierung &amp; Kontoverwaltung
            </span>{" "}
            — zur Identitätsverifizierung und Aufrechterhaltung einer sicheren
            Sitzung. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b
            DSGVO).
          </p>
          <p>
            <span className="font-medium">Kernfunktionalität</span> — das
            Speichern deiner Sammlung, Sets, Fotos, Wunschlisten und
            Tauschverbindungen ist der eigentliche Zweck des Dienstes.
            Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
          <p>
            <span className="font-medium">Spracheinstellung</span> — wir
            speichern deine bevorzugte Sprache in einem Cookie, damit die Seite
            bei jedem Besuch in deiner Sprache erscheint. Rechtsgrundlage:
            berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Cookies</h2>
        <p>Wir verwenden zwei Cookies:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Sitzungs-Cookie</span> (
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              authjs.session-token
            </code>
            ) — hält dich eingeloggt. Dieser Cookie ist für den Betrieb des
            Dienstes unbedingt erforderlich.
          </li>
          <li>
            <span className="font-medium">Sprach-Cookie</span> (
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              preferred-locale
            </code>
            ) — speichert deine Spracheinstellung. Dieser Cookie ist rein
            funktional.
          </li>
        </ul>
        <p>
          Keiner dieser Cookies wird für Tracking oder Werbung verwendet. Es
          werden keine Drittanbieter-Cookies von Bulkratte gesetzt.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Analyse</h2>
        <p>
          Wir nutzen{" "}
          <a
            href="https://plausible.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Plausible Analytics
          </a>
          , um die aggregierte Nutzung der Website zu verstehen. Plausible ist
          datenschutzfreundlich konzipiert: Es werden keine Cookies gesetzt,
          keine Personen seitenübergreifend verfolgt und keine personenbezogenen
          Daten erhoben. Die statistischen Daten werden auf der EU-Infrastruktur
          von Plausible verarbeitet.
        </p>
        <p>
          Wir nutzen außerdem{" "}
          <a
            href="https://vercel.com/docs/speed-insights"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Vercel Speed Insights
          </a>{" "}
          zur Überwachung der Seitenperformance. Dieser Dienst misst technische
          Kennzahlen (Ladezeiten, Core Web Vitals) und speichert keine
          personenbezogenen Daten.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Drittanbieter</h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">Discord &amp; Google</span> —
            ausschließlich zur Authentifizierung. Wir geben deine Daten nicht
            über das für den OAuth-Login erforderliche Maß hinaus an diese
            Dienste zurück.
          </p>
          <p>
            <span className="font-medium">Vercel</span> — unser Hosting-
            Anbieter. Deine Anfragen werden auf der Infrastruktur von Vercel
            verarbeitet. Siehe{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Datenschutzerklärung von Vercel
            </a>
            .
          </p>
          <p>
            <span className="font-medium">Cloudflare R2</span> — zur Speicherung
            der von dir hochgeladenen Kartenfotos. Bilder werden über die
            Infrastruktur von Cloudflare ausgeliefert. Siehe{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Datenschutzerklärung von Cloudflare
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Speicherdauer</h2>
        <p>
          Dein Konto und alle zugehörigen Daten (Sammlung, Sets, Fotos,
          Wunschlisten, Tauschverbindungen) werden so lange gespeichert, wie
          dein Konto besteht. Wenn du möchtest, dass deine Daten gelöscht
          werden, kontaktiere uns unter der oben genannten Adresse — wir
          entfernen sie innerhalb von 30 Tagen.
        </p>
        <p>
          Authentifizierungs-Sitzungstoken laufen automatisch ab und werden
          anschließend aus unserer Datenbank entfernt.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Deine Rechte (DSGVO)</h2>
        <p>
          Als Nutzer in der EU/EWR hast du folgende Rechte bezüglich deiner
          personenbezogenen Daten:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Auskunft</span> — Anforderung einer
            Kopie der bei uns gespeicherten Daten.
          </li>
          <li>
            <span className="font-medium">Berichtigung</span> — Bitte um
            Korrektur unrichtiger Daten.
          </li>
          <li>
            <span className="font-medium">Löschung</span> — Anforderung der
            Löschung deines Kontos und aller zugehörigen Daten.
          </li>
          <li>
            <span className="font-medium">Datenübertragbarkeit</span> — Erhalt
            deiner Daten in einem maschinenlesbaren Format.
          </li>
          <li>
            <span className="font-medium">Widerspruch</span> — Widerspruch gegen
            die Verarbeitung auf Grundlage berechtigter Interessen.
          </li>
          <li>
            <span className="font-medium">Einschränkung</span> — Bitte um
            Aussetzung der Verarbeitung während eines Streitfalls.
          </li>
        </ul>
        <p>
          Zur Ausübung dieser Rechte wende dich an die E-Mail-Adresse in
          Abschnitt 1. Du hast außerdem das Recht, eine Beschwerde bei deiner
          nationalen Datenschutzbehörde einzureichen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          9. Änderungen dieser Erklärung
        </h2>
        <p>
          Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren.
          Das &bdquo;Stand&ldquo;-Datum am Anfang dieser Seite wird bei
          Änderungen aktualisiert. Wir empfehlen, diese Seite regelmäßig zu
          überprüfen.
        </p>
      </section>
    </div>
  );
}
