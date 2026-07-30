-- A non-owner role: RLS does not apply to superusers or to a table's owner.
CREATE ROLE app_user NOLOGIN;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA auth TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO app_user;
