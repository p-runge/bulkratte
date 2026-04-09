# Bulkratte

[![Bulkratte Logo](./public/bulkratte_logo.png)](https://bulkratte.de)

## Description

Bulkratte is a web application designed to help users manage and organize their Pokémon card collections efficiently. With Bulkratte, users can easily catalog their cards, track their values, and share their collections with friends.

## Features

### Wiki

- **Searching Cards in TCG**: Search through all cards, sets and series the TCG has to offer.
- **Multi-Language Support for Core Data**: Access card data like names and even images in multiple languages (EN and DE for now, more coming soon).
- **Check Sets for Chase Cards**: Quickly check what cards of a set have the highest market price.

### Collection Management

- **User Accounts and Authentication**: Easily create an account with 2 clicks using Discord or Google and log in to access your collection on any device.
- **Add Cards to Collection**: Add individual, physical cards to your personal collection, including condition, language, and variant details.
- **Custom Binder Creation**: Define custom binders you want to complete and fill them over time by adding cards from your collection.
- **Dynamic Wantlists**: Maintain dynamic wantlists that update in real-time as your collection changes.
- **Shareable Wantlists**: Share your wantlists with potential trade partners via a link with optional expiry dates for temporary contacts.
- **Trade Partners**: Connect with close friends to share your full collection and wantlist details with each other for seamless trading.

## Coming "Soon ™️"

- **Card Scanning**: Use your device's camera to scan cards and automatically add them to your collection or check their market value.
- **Cardmarket Export of Wantlists**: Export your wantlists in a format compatible with Cardmarket for easy purchasing.
- **Better Mobile Experience**: Mobile UX is a bit rough at the moment. Improved mobile layouts for managing your collection on the go.
- **Progressive Web App (PWA)**: Access Bulkratte on any device with offline capabilities.
- **Value Tracking**: Keep track of the market value of your collection.
- **Magic the Gathering Support**: Manage your Magic the Gathering card collection alongside your Pokémon cards.

## Development

### Dev Setup

Run the following command to start the development environment:

```bash
pnpm install
docker compose up
pnpm dev
```

If you want to set up a tunnel to your local development environment e.g. for testing with a mobile device:

```bash
pnpm dev:tunnel
```

### Environment Variables

| Variable            | Required | Description                                                                                   |
| ------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | ✅       | PostgreSQL connection string for the app (full access)                                        |
| `DATABASE_URL_CORE` | —        | Restricted connection string used by `db:import-core`. Falls back to `DATABASE_URL` if unset. |

`DATABASE_URL_CORE` connects as the `core_importer` role, which only has access to `sets`, `cards`, `card_prices`, and `localizations`. This prevents import scripts from accidentally touching user data.

Local default (created automatically by Docker init script):

```
DATABASE_URL_CORE=postgres://core_importer:core_importer_pw@localhost:5469/mydatabase
```

### Production Setup (Neon — One-Time SQL)

Run the following as your Neon project owner to create the restricted role:

```sql
CREATE ROLE core_importer WITH LOGIN PASSWORD '<secure_password>';
GRANT CONNECT ON DATABASE <dbname> TO core_importer;
GRANT CREATE, USAGE ON SCHEMA public TO core_importer;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE sets, cards, card_prices, localizations
  TO core_importer;
```

Then add `DATABASE_URL_CORE` to your environment with the `core_importer` credentials.
