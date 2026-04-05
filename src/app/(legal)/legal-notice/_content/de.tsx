import { contact } from "../../_content/contact";

export function LegalNoticeDe() {
  return (
    <div className="space-y-8 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Impressum</h1>
        <p className="text-muted-foreground">Angaben gemäß § 5 TMG</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Verantwortlich</h2>
        <address className="not-italic space-y-1">
          <p className="font-medium">{contact.companyName}</p>
          <p>Geschäftsführer: {contact.ceo}</p>
          <p>{contact.street}</p>
          <p>{contact.postalCode}</p>
          <p>{contact.country.de}</p>
        </address>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Kontakt</h2>
        <p>
          E-Mail:{" "}
          <a
            href={`mailto:${contact.email}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {contact.email}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
        </h2>
        <address className="not-italic space-y-1">
          <p className="font-medium">{contact.companyName}</p>
          <p>{contact.street}</p>
          <p>{contact.postalCode}</p>
        </address>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
          auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
          §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
        </p>
        <p>
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
          Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
          Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
          Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
          von entsprechenden Rechtsverletzungen werden wir diese Inhalte
          umgehend entfernen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Haftung für Links</h2>
        <p>
          Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
          fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
          verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
          Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
          Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
        </p>
        <p>
          Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch
          ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
          Bekanntwerden von Rechtsverletzungen werden wir derartige Links
          umgehend entfernen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Urheberrecht</h2>
        <p>
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen
          Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
          jeweiligen Autors bzw. Erstellers.
        </p>
        <p>
          Karten- und Setdaten stammen von{" "}
          <a
            href="https://tcgdex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            TCGDex
          </a>{" "}
          und sind Eigentum der jeweiligen Rechteinhaber (The Pokémon Company
          International, Nintendo). Bulkratte ist kein offizielles
          Pokémon-Produkt und steht in keiner Verbindung zu The Pokémon Company.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Unsere E-Mail-Adresse finden Sie im Abschnitt Kontakt oben.
        </p>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </div>
  );
}
