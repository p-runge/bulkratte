-- Initialization script for the local Docker PostgreSQL container.
-- Runs automatically on first container start (fresh volume).
-- For existing volumes: docker-compose down -v && docker-compose up -d (then re-seed).

-- Restricted role used by db:import-core. Can read/write the four core tables and
-- create temporary snapshot tables in public, but has no access to user data tables.
CREATE USER core_importer WITH PASSWORD 'core_importer_pw';
GRANT CONNECT ON DATABASE mydatabase TO core_importer;
-- Allow creating snapshot tables (_pre_sets etc.) used for the diff report
GRANT CREATE, USAGE ON SCHEMA public TO core_importer;
-- Grant DML only on the four core tables — user data tables are inaccessible
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE sets, cards, card_prices, localizations
  TO core_importer;
