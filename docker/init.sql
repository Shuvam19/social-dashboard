ALTER USER postgres CREATEDB;

-- Connect to the target database
\c social_dashboard;

-- Grant permissions to the postgres user on the public schema
GRANT ALL ON SCHEMA public TO postgres;
ALTER SCHEMA public OWNER TO postgres;
