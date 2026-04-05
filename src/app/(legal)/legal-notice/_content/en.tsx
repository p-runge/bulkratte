import { contact } from "../../_content/contact";

export function LegalNoticeEn() {
  return (
    <div className="space-y-8 text-sm leading-relaxed">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Legal Notice</h1>
        <p className="text-muted-foreground">
          Information pursuant to § 5 TMG (German Telemedia Act)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Responsible</h2>
        <address className="not-italic space-y-1">
          <p className="font-medium">{contact.companyName}</p>
          <p>CEO: {contact.ceo}</p>
          <p>{contact.street}</p>
          <p>{contact.postalCode}</p>
          <p>{contact.country.en}</p>
        </address>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p>
          Email:{" "}
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
          Responsible for content pursuant to § 18 (2) MStV
        </h2>
        <address className="not-italic space-y-1">
          <p className="font-medium">{contact.companyName}</p>
          <p>{contact.street}</p>
          <p>{contact.postalCode}</p>
        </address>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Liability for Content</h2>
        <p>
          As a service provider, we are responsible for our own content on these
          pages under general law in accordance with § 7 (1) TMG. According to
          §§ 8 to 10 TMG, however, we are not obligated to monitor transmitted
          or stored third-party information or to investigate circumstances that
          indicate illegal activity.
        </p>
        <p>
          Obligations to remove or block the use of information under general
          law remain unaffected. However, liability in this regard is only
          possible from the point in time at which a concrete legal infringement
          becomes known. Upon becoming aware of any such infringement, we will
          remove the relevant content immediately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Liability for Links</h2>
        <p>
          Our website contains links to external third-party websites over whose
          content we have no influence. We therefore cannot accept any liability
          for this external content. The respective provider or operator of the
          linked pages is always responsible for their content. The linked pages
          were checked for possible legal violations at the time of linking;
          illegal content was not identifiable at that time.
        </p>
        <p>
          Permanent monitoring of linked pages is not reasonable without
          specific indications of a legal violation. Upon becoming aware of any
          infringement, we will remove the relevant links immediately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Copyright</h2>
        <p>
          The content and works created by the site operators on these pages are
          subject to German copyright law. Reproduction, processing,
          distribution, and any form of exploitation outside the limits of
          copyright law require the written consent of the respective author or
          creator.
        </p>
        <p>
          Card and set data is provided by{" "}
          <a
            href="https://tcgdex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            TCGDex
          </a>{" "}
          and is the property of the respective rights holders (The Pokémon
          Company International, Nintendo). Bulkratte is not an official Pokémon
          product and is not affiliated with The Pokémon Company.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Dispute Resolution</h2>
        <p>
          The European Commission provides a platform for online dispute
          resolution (ODR):{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Our email address can be found in the Contact section above.
        </p>
        <p>
          We are not willing or obligated to participate in dispute resolution
          proceedings before a consumer arbitration board.
        </p>
      </section>
    </div>
  );
}
