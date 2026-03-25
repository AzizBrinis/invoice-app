--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: shadow; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA shadow;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: AIAuditStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AIAuditStatus" AS ENUM (
    'SUCCESS',
    'ERROR'
);


--
-- Name: AIConversationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AIConversationStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);


--
-- Name: AIMessageRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AIMessageRole" AS ENUM (
    'SYSTEM',
    'USER',
    'ASSISTANT',
    'TOOL'
);


--
-- Name: BackgroundJobEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BackgroundJobEventType" AS ENUM (
    'ENQUEUED',
    'DEDUPED',
    'STARTED',
    'SUCCEEDED',
    'FAILED',
    'RETRY_SCHEDULED'
);


--
-- Name: BackgroundJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BackgroundJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


--
-- Name: ClientSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClientSource" AS ENUM (
    'MANUAL',
    'IMPORT',
    'WEBSITE_LEAD'
);


--
-- Name: DocumentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: EmailStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmailStatus" AS ENUM (
    'EN_ATTENTE',
    'ENVOYE',
    'ECHEC'
);


--
-- Name: InvoiceAuditAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceAuditAction" AS ENUM (
    'CANCELLATION',
    'DELETION'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'BROUILLON',
    'ENVOYEE',
    'PAYEE',
    'PARTIELLE',
    'RETARD',
    'ANNULEE'
);


--
-- Name: MessagingAutoReplyType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessagingAutoReplyType" AS ENUM (
    'STANDARD',
    'VACATION'
);


--
-- Name: MessagingEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessagingEventType" AS ENUM (
    'OPEN',
    'CLICK'
);


--
-- Name: MessagingRecipientType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessagingRecipientType" AS ENUM (
    'TO',
    'CC',
    'BCC'
);


--
-- Name: MessagingScheduledStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessagingScheduledStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'FAILED',
    'CANCELLED'
);


--
-- Name: OrderPaymentProofStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderPaymentProofStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: OrderPaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderPaymentStatus" AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'REFUNDED'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FULFILLED',
    'CANCELLED',
    'REFUNDED'
);


--
-- Name: PdfTemplateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PdfTemplateType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: ProductSaleMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductSaleMode" AS ENUM (
    'INSTANT',
    'QUOTE'
);


--
-- Name: QuoteRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuoteRequestStatus" AS ENUM (
    'NEW',
    'IN_PROGRESS',
    'CONVERTED',
    'CLOSED'
);


--
-- Name: QuoteStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuoteStatus" AS ENUM (
    'BROUILLON',
    'ENVOYE',
    'ACCEPTE',
    'REFUSE',
    'EXPIRE'
);


--
-- Name: SavedResponseFormat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SavedResponseFormat" AS ENUM (
    'PLAINTEXT',
    'HTML'
);


--
-- Name: SequenceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SequenceType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'ACCOUNTANT',
    'VIEWER'
);


--
-- Name: WebsiteDomainStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WebsiteDomainStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'ACTIVE'
);


--
-- Name: WebsiteThemeMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WebsiteThemeMode" AS ENUM (
    'SYSTEM',
    'LIGHT',
    'DARK'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: AIAuditStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."AIAuditStatus" AS ENUM (
    'SUCCESS',
    'ERROR'
);


--
-- Name: AIConversationStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."AIConversationStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);


--
-- Name: AIMessageRole; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."AIMessageRole" AS ENUM (
    'SYSTEM',
    'USER',
    'ASSISTANT',
    'TOOL'
);


--
-- Name: BackgroundJobEventType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."BackgroundJobEventType" AS ENUM (
    'ENQUEUED',
    'DEDUPED',
    'STARTED',
    'SUCCEEDED',
    'FAILED',
    'RETRY_SCHEDULED'
);


--
-- Name: BackgroundJobStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."BackgroundJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


--
-- Name: ClientSource; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."ClientSource" AS ENUM (
    'MANUAL',
    'IMPORT',
    'WEBSITE_LEAD'
);


--
-- Name: DocumentType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."DocumentType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: EmailStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."EmailStatus" AS ENUM (
    'EN_ATTENTE',
    'ENVOYE',
    'ECHEC'
);


--
-- Name: InvoiceAuditAction; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."InvoiceAuditAction" AS ENUM (
    'CANCELLATION',
    'DELETION'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."InvoiceStatus" AS ENUM (
    'BROUILLON',
    'ENVOYEE',
    'PAYEE',
    'PARTIELLE',
    'RETARD',
    'ANNULEE'
);


--
-- Name: MessagingAutoReplyType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."MessagingAutoReplyType" AS ENUM (
    'STANDARD',
    'VACATION'
);


--
-- Name: MessagingEventType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."MessagingEventType" AS ENUM (
    'OPEN',
    'CLICK'
);


--
-- Name: MessagingRecipientType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."MessagingRecipientType" AS ENUM (
    'TO',
    'CC',
    'BCC'
);


--
-- Name: MessagingScheduledStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."MessagingScheduledStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'FAILED',
    'CANCELLED'
);


--
-- Name: PdfTemplateType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."PdfTemplateType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: QuoteStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."QuoteStatus" AS ENUM (
    'BROUILLON',
    'ENVOYE',
    'ACCEPTE',
    'REFUSE',
    'EXPIRE'
);


--
-- Name: SavedResponseFormat; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."SavedResponseFormat" AS ENUM (
    'PLAINTEXT',
    'HTML'
);


--
-- Name: SequenceType; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."SequenceType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


--
-- Name: UserRole; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."UserRole" AS ENUM (
    'ADMIN',
    'ACCOUNTANT',
    'VIEWER'
);


--
-- Name: WebsiteDomainStatus; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."WebsiteDomainStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'ACTIVE'
);


--
-- Name: WebsiteThemeMode; Type: TYPE; Schema: shadow; Owner: -
--

CREATE TYPE shadow."WebsiteThemeMode" AS ENUM (
    'SYSTEM',
    'LIGHT',
    'DARK'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: AIAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIAuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "conversationId" text,
    "toolName" text NOT NULL,
    "actionLabel" text NOT NULL,
    payload jsonb,
    result jsonb,
    status public."AIAuditStatus" DEFAULT 'SUCCESS'::public."AIAuditStatus" NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIConversation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text DEFAULT 'Nouvelle conversation'::text NOT NULL,
    status public."AIConversationStatus" DEFAULT 'ACTIVE'::public."AIConversationStatus" NOT NULL,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIMessage" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    "userId" text NOT NULL,
    role public."AIMessageRole" NOT NULL,
    content jsonb NOT NULL,
    "toolName" text,
    "toolCallId" text,
    attachments jsonb,
    metadata jsonb,
    "tokenCount" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIPendingToolCall; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIPendingToolCall" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "conversationId" text NOT NULL,
    "toolName" text NOT NULL,
    arguments jsonb NOT NULL,
    summary text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AIUsageStat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIUsageStat" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "periodKey" text NOT NULL,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "toolInvocationCount" integer DEFAULT 0 NOT NULL,
    "tokenCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BackgroundJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BackgroundJob" (
    id text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    "dedupeKey" text,
    priority integer DEFAULT 0 NOT NULL,
    "runAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."BackgroundJobStatus" DEFAULT 'PENDING'::public."BackgroundJobStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 5 NOT NULL,
    "retryBackoffMs" integer DEFAULT 60000 NOT NULL,
    "lastError" text,
    "lockedAt" timestamp(3) without time zone,
    "lastRunAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BackgroundJobEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BackgroundJobEvent" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    type public."BackgroundJobEventType" NOT NULL,
    detail jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "displayName" text NOT NULL,
    "companyName" text,
    address text,
    email text,
    phone text,
    "vatNumber" text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    source public."ClientSource" DEFAULT 'MANUAL'::public."ClientSource" NOT NULL,
    "leadMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "authUserId" text,
    "passwordHash" text
);


--
-- Name: ClientSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClientSession" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "clientId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CompanySettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompanySettings" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "companyName" text NOT NULL,
    "logoUrl" text,
    "logoData" text,
    "matriculeFiscal" text,
    "tvaNumber" text,
    address text,
    email text,
    phone text,
    iban text,
    "stampImage" text,
    "signatureImage" text,
    "stampPosition" text DEFAULT 'bottom-right'::text NOT NULL,
    "signaturePosition" text DEFAULT 'bottom-right'::text NOT NULL,
    "defaultCurrency" text DEFAULT 'TND'::text NOT NULL,
    "defaultVatRate" double precision DEFAULT 0 NOT NULL,
    "paymentTerms" text,
    "invoiceNumberPrefix" text DEFAULT 'FAC'::text NOT NULL,
    "quoteNumberPrefix" text DEFAULT 'DEV'::text NOT NULL,
    "resetNumberingAnnually" boolean DEFAULT true NOT NULL,
    "defaultInvoiceFooter" text,
    "defaultQuoteFooter" text,
    "legalFooter" text,
    "defaultConditions" text,
    "invoiceTemplateId" text,
    "quoteTemplateId" text,
    "taxConfiguration" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContactMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContactMessage" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "websiteId" text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    "sourcePath" text,
    "sourceDomain" text,
    "sourceSlug" text,
    "ipAddress" text,
    "userAgent" text,
    "readAt" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "documentType" public."DocumentType" NOT NULL,
    "documentId" text NOT NULL,
    "to" text NOT NULL,
    subject text NOT NULL,
    body text,
    "sentAt" timestamp(3) without time zone,
    status public."EmailStatus" DEFAULT 'EN_ATTENTE'::public."EmailStatus" NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "userId" text NOT NULL,
    number text NOT NULL,
    status public."InvoiceStatus" DEFAULT 'BROUILLON'::public."InvoiceStatus" NOT NULL,
    reference text,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "clientId" text NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    "globalDiscountRate" double precision,
    "globalDiscountAmountCents" integer,
    "vatBreakdown" jsonb,
    "taxSummary" jsonb,
    "taxConfiguration" jsonb,
    notes text,
    terms text,
    "lateFeeRate" double precision,
    "subtotalHTCents" integer NOT NULL,
    "totalDiscountCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "amountPaidCents" integer DEFAULT 0 NOT NULL,
    "fodecAmountCents" integer DEFAULT 0 NOT NULL,
    "timbreAmountCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "quoteId" text
);


--
-- Name: InvoiceAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceAuditLog" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "userId" text NOT NULL,
    action public."InvoiceAuditAction" NOT NULL,
    "previousStatus" public."InvoiceStatus",
    "newStatus" public."InvoiceStatus",
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InvoiceLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceLine" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    unit text DEFAULT 'unité'::text NOT NULL,
    "unitPriceHTCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "discountRate" double precision,
    "discountAmountCents" integer,
    "totalHTCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecRate" double precision,
    "fodecAmountCents" integer,
    "position" integer NOT NULL
);


--
-- Name: MessagingAutoReplyLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingAutoReplyLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "senderEmail" text NOT NULL,
    "replyType" public."MessagingAutoReplyType" NOT NULL,
    "originalMessageId" text,
    "originalUid" integer,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingEmail" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "messageId" text NOT NULL,
    subject text,
    "sentAt" timestamp(3) without time zone NOT NULL,
    "trackingEnabled" boolean DEFAULT false NOT NULL,
    "senderSessionHash" text,
    "senderIpHash" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingEmailEvent" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    "recipientId" text,
    "linkId" text,
    "linkRecipientId" text,
    type public."MessagingEventType" NOT NULL,
    "userAgent" text,
    "deviceFamily" text,
    "deviceType" text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingEmailLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingEmailLink" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    url text NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailLinkRecipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingEmailLinkRecipient" (
    id text NOT NULL,
    "linkId" text NOT NULL,
    "recipientId" text NOT NULL,
    token text NOT NULL,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "firstClickedAt" timestamp(3) without time zone,
    "lastClickedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailRecipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingEmailRecipient" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    address text NOT NULL,
    name text,
    type public."MessagingRecipientType" NOT NULL,
    "openToken" text NOT NULL,
    "openCount" integer DEFAULT 0 NOT NULL,
    "firstOpenedAt" timestamp(3) without time zone,
    "lastOpenedAt" timestamp(3) without time zone,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "lastClickedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingInboxSyncState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingInboxSyncState" (
    "userId" text NOT NULL,
    "lastInboxAutoReplyUid" integer,
    "lastInboxSyncAt" timestamp(3) without time zone,
    "lastAutoReplyAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingSavedResponse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingSavedResponse" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    slug text,
    description text,
    content text NOT NULL,
    format public."SavedResponseFormat" DEFAULT 'PLAINTEXT'::public."SavedResponseFormat" NOT NULL,
    "builtIn" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingScheduledAttachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingScheduledAttachment" (
    id text NOT NULL,
    "scheduledEmailId" text NOT NULL,
    filename text,
    "contentType" text,
    size integer NOT NULL,
    content bytea NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingScheduledEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingScheduledEmail" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "to" jsonb NOT NULL,
    cc jsonb,
    bcc jsonb,
    subject text NOT NULL,
    text text NOT NULL,
    html text NOT NULL,
    "previewText" text NOT NULL,
    "sendAt" timestamp(3) without time zone NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "canceledAt" timestamp(3) without time zone,
    status public."MessagingScheduledStatus" DEFAULT 'PENDING'::public."MessagingScheduledStatus" NOT NULL,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessagingSettings" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fromEmail" text,
    "senderName" text,
    "senderLogoUrl" text,
    "imapHost" text,
    "imapPort" integer,
    "imapSecure" boolean DEFAULT true NOT NULL,
    "imapUser" text,
    "imapPassword" text,
    "smtpHost" text,
    "smtpPort" integer,
    "smtpSecure" boolean DEFAULT true NOT NULL,
    "smtpUser" text,
    "smtpPassword" text,
    "spamFilterEnabled" boolean DEFAULT true NOT NULL,
    "trackingEnabled" boolean DEFAULT true NOT NULL,
    "autoReplyEnabled" boolean DEFAULT false NOT NULL,
    "autoReplySubject" text,
    "autoReplyBody" text,
    "vacationModeEnabled" boolean DEFAULT false NOT NULL,
    "vacationSubject" text,
    "vacationMessage" text,
    "vacationStartDate" timestamp(3) without time zone,
    "vacationEndDate" timestamp(3) without time zone,
    "vacationBackupEmail" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NumberingSequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NumberingSequence" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."SequenceType" NOT NULL,
    prefix text NOT NULL,
    year integer NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "orderNumber" text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    "paymentStatus" public."OrderPaymentStatus" DEFAULT 'PENDING'::public."OrderPaymentStatus" NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    "clientId" text NOT NULL,
    "customerName" text NOT NULL,
    "customerEmail" text NOT NULL,
    "customerPhone" text,
    "customerCompany" text,
    "customerAddress" text,
    notes text,
    "internalNotes" text,
    "subtotalHTCents" integer NOT NULL,
    "totalDiscountCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "amountPaidCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "quoteId" text,
    "invoiceId" text
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    unit text DEFAULT 'unité'::text NOT NULL,
    "unitPriceHTCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "discountRate" double precision,
    "discountAmountCents" integer,
    "totalHTCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "position" integer NOT NULL
);


--
-- Name: OrderPayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderPayment" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "userId" text NOT NULL,
    status public."OrderPaymentStatus" DEFAULT 'PENDING'::public."OrderPaymentStatus" NOT NULL,
    "amountCents" integer NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    method text,
    provider text,
    "externalReference" text,
    "paidAt" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "proofUrl" text,
    "proofMimeType" text,
    "proofSizeBytes" integer,
    "proofUploadedAt" timestamp(3) without time zone,
    "proofStatus" public."OrderPaymentProofStatus"
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "userId" text NOT NULL,
    "amountCents" integer NOT NULL,
    method text,
    date timestamp(3) without time zone NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PdfTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PdfTemplate" (
    id text NOT NULL,
    type public."PdfTemplateType" NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "userId" text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    unit text DEFAULT 'unité'::text NOT NULL,
    "priceHTCents" integer NOT NULL,
    "priceTTCCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "defaultDiscountRate" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "isListedInCatalog" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "saleMode" public."ProductSaleMode" DEFAULT 'INSTANT'::public."ProductSaleMode" NOT NULL,
    "publicSlug" text NOT NULL,
    excerpt text,
    "coverImageUrl" text,
    gallery jsonb,
    "quoteFormSchema" jsonb,
    "descriptionHtml" text,
    "metaTitle" text,
    "metaDescription" text,
    "optionConfig" jsonb,
    "variantStock" jsonb,
    "stockQuantity" integer
);


--
-- Name: Quote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Quote" (
    id text NOT NULL,
    "userId" text NOT NULL,
    number text NOT NULL,
    status public."QuoteStatus" DEFAULT 'BROUILLON'::public."QuoteStatus" NOT NULL,
    reference text,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "validUntil" timestamp(3) without time zone,
    "clientId" text NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    "globalDiscountRate" double precision,
    "globalDiscountAmountCents" integer,
    "vatBreakdown" jsonb,
    "taxSummary" jsonb,
    "taxConfiguration" jsonb,
    notes text,
    terms text,
    "subtotalHTCents" integer NOT NULL,
    "totalDiscountCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecAmountCents" integer DEFAULT 0 NOT NULL,
    "timbreAmountCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuoteLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteLine" (
    id text NOT NULL,
    "quoteId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    unit text DEFAULT 'unité'::text NOT NULL,
    "unitPriceHTCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "discountRate" double precision,
    "discountAmountCents" integer,
    "totalHTCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecRate" double precision,
    "fodecAmountCents" integer,
    "position" integer NOT NULL
);


--
-- Name: QuoteRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "clientId" text NOT NULL,
    "productId" text,
    status public."QuoteRequestStatus" DEFAULT 'NEW'::public."QuoteRequestStatus" NOT NULL,
    "customerName" text NOT NULL,
    "customerEmail" text NOT NULL,
    "customerPhone" text,
    "customerCompany" text,
    "customerAddress" text,
    message text,
    "formData" jsonb,
    "sourcePath" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "quoteId" text
);


--
-- Name: QuoteRequestAttachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteRequestAttachment" (
    id text NOT NULL,
    "quoteRequestId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "mimeType" text,
    "sizeBytes" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SpamDetectionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SpamDetectionLog" (
    id integer NOT NULL,
    "messageId" text,
    mailbox text NOT NULL,
    "targetMailbox" text,
    uid integer NOT NULL,
    subject text,
    sender text,
    score integer NOT NULL,
    threshold integer NOT NULL,
    reasons jsonb,
    "autoMoved" boolean DEFAULT false NOT NULL,
    manual boolean DEFAULT false NOT NULL,
    actor text,
    "detectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SpamDetectionLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SpamDetectionLog_id_seq" OWNED BY public."SpamDetectionLog".id;


--
-- Name: SpamSenderReputation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SpamSenderReputation" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    domain text NOT NULL,
    "spamCount" integer DEFAULT 0 NOT NULL,
    "hamCount" integer DEFAULT 0 NOT NULL,
    "lastFeedbackAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SpamSenderReputation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SpamSenderReputation_id_seq" OWNED BY public."SpamSenderReputation".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text,
    role public."UserRole" DEFAULT 'VIEWER'::public."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WebsiteConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebsiteConfig" (
    id text NOT NULL,
    "userId" text NOT NULL,
    slug text NOT NULL,
    "templateKey" text DEFAULT 'dev-agency'::text NOT NULL,
    "previewToken" text NOT NULL,
    "heroEyebrow" text,
    "heroTitle" text DEFAULT 'Découvrez nos solutions'::text NOT NULL,
    "heroSubtitle" text,
    "heroPrimaryCtaLabel" text DEFAULT 'Demander un devis'::text,
    "heroSecondaryCtaLabel" text DEFAULT 'Télécharger la plaquette'::text,
    "heroSecondaryCtaUrl" text,
    "aboutTitle" text,
    "aboutBody" text,
    "contactBlurb" text,
    "contactEmailOverride" text,
    "contactPhoneOverride" text,
    "contactAddressOverride" text,
    "seoTitle" text,
    "seoDescription" text,
    "seoKeywords" text,
    "socialImageUrl" text,
    "socialLinks" jsonb,
    theme public."WebsiteThemeMode" DEFAULT 'SYSTEM'::public."WebsiteThemeMode" NOT NULL,
    "accentColor" text DEFAULT '#2563eb'::text NOT NULL,
    "showPrices" boolean DEFAULT true NOT NULL,
    "showInactiveProducts" boolean DEFAULT false NOT NULL,
    "featuredProductIds" jsonb,
    "leadNotificationEmail" text,
    "leadAutoTag" text,
    "leadThanksMessage" text,
    "spamProtectionEnabled" boolean DEFAULT true NOT NULL,
    "customDomain" text,
    "domainStatus" public."WebsiteDomainStatus" DEFAULT 'PENDING'::public."WebsiteDomainStatus" NOT NULL,
    "domainVerificationCode" text NOT NULL,
    "domainVerifiedAt" timestamp(3) without time zone,
    "domainActivatedAt" timestamp(3) without time zone,
    published boolean DEFAULT false NOT NULL,
    "previewPath" text DEFAULT 'catalogue'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "builderConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "builderVersionHistory" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "ecommerceSettings" jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: WishlistItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WishlistItem" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "clientId" text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: AIAuditLog; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."AIAuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "conversationId" text,
    "toolName" text NOT NULL,
    "actionLabel" text NOT NULL,
    payload jsonb,
    result jsonb,
    status shadow."AIAuditStatus" DEFAULT 'SUCCESS'::shadow."AIAuditStatus" NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIConversation; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."AIConversation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text DEFAULT 'Nouvelle conversation'::text NOT NULL,
    status shadow."AIConversationStatus" DEFAULT 'ACTIVE'::shadow."AIConversationStatus" NOT NULL,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIMessage; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."AIMessage" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    "userId" text NOT NULL,
    role shadow."AIMessageRole" NOT NULL,
    content jsonb NOT NULL,
    "toolName" text,
    "toolCallId" text,
    attachments jsonb,
    metadata jsonb,
    "tokenCount" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AIPendingToolCall; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."AIPendingToolCall" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "conversationId" text NOT NULL,
    "toolName" text NOT NULL,
    arguments jsonb NOT NULL,
    summary text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AIUsageStat; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."AIUsageStat" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "periodKey" text NOT NULL,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "toolInvocationCount" integer DEFAULT 0 NOT NULL,
    "tokenCount" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BackgroundJob; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."BackgroundJob" (
    id text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    "dedupeKey" text,
    priority integer DEFAULT 0 NOT NULL,
    "runAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status shadow."BackgroundJobStatus" DEFAULT 'PENDING'::shadow."BackgroundJobStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 5 NOT NULL,
    "retryBackoffMs" integer DEFAULT 60000 NOT NULL,
    "lastError" text,
    "lockedAt" timestamp(3) without time zone,
    "lastRunAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BackgroundJobEvent; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."BackgroundJobEvent" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    type shadow."BackgroundJobEventType" NOT NULL,
    detail jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Client; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Client" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "displayName" text NOT NULL,
    "companyName" text,
    address text,
    email text,
    phone text,
    "vatNumber" text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    source shadow."ClientSource" DEFAULT 'MANUAL'::shadow."ClientSource" NOT NULL,
    "leadMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CompanySettings; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."CompanySettings" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "companyName" text NOT NULL,
    "logoUrl" text,
    "logoData" text,
    "matriculeFiscal" text,
    "tvaNumber" text,
    address text,
    email text,
    phone text,
    iban text,
    "stampImage" text,
    "signatureImage" text,
    "stampPosition" text DEFAULT 'bottom-right'::text NOT NULL,
    "signaturePosition" text DEFAULT 'bottom-right'::text NOT NULL,
    "defaultCurrency" text DEFAULT 'TND'::text NOT NULL,
    "defaultVatRate" double precision DEFAULT 0 NOT NULL,
    "paymentTerms" text,
    "invoiceNumberPrefix" text DEFAULT 'FAC'::text NOT NULL,
    "quoteNumberPrefix" text DEFAULT 'DEV'::text NOT NULL,
    "resetNumberingAnnually" boolean DEFAULT true NOT NULL,
    "defaultInvoiceFooter" text,
    "defaultQuoteFooter" text,
    "legalFooter" text,
    "defaultConditions" text,
    "invoiceTemplateId" text,
    "quoteTemplateId" text,
    "taxConfiguration" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmailLog; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."EmailLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "documentType" shadow."DocumentType" NOT NULL,
    "documentId" text NOT NULL,
    "to" text NOT NULL,
    subject text NOT NULL,
    body text,
    "sentAt" timestamp(3) without time zone,
    status shadow."EmailStatus" DEFAULT 'EN_ATTENTE'::shadow."EmailStatus" NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Invoice" (
    id text NOT NULL,
    "userId" text NOT NULL,
    number text NOT NULL,
    status shadow."InvoiceStatus" DEFAULT 'BROUILLON'::shadow."InvoiceStatus" NOT NULL,
    reference text,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "clientId" text NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    "globalDiscountRate" double precision,
    "globalDiscountAmountCents" integer,
    "vatBreakdown" jsonb,
    "taxSummary" jsonb,
    "taxConfiguration" jsonb,
    notes text,
    terms text,
    "lateFeeRate" double precision,
    "subtotalHTCents" integer NOT NULL,
    "totalDiscountCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "amountPaidCents" integer DEFAULT 0 NOT NULL,
    "fodecAmountCents" integer DEFAULT 0 NOT NULL,
    "timbreAmountCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "quoteId" text
);


--
-- Name: InvoiceAuditLog; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."InvoiceAuditLog" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "userId" text NOT NULL,
    action shadow."InvoiceAuditAction" NOT NULL,
    "previousStatus" shadow."InvoiceStatus",
    "newStatus" shadow."InvoiceStatus",
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InvoiceLine; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."InvoiceLine" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    unit text DEFAULT 'unité'::text NOT NULL,
    "unitPriceHTCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "discountRate" double precision,
    "discountAmountCents" integer,
    "totalHTCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecRate" double precision,
    "fodecAmountCents" integer,
    "position" integer NOT NULL
);


--
-- Name: MessagingAutoReplyLog; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingAutoReplyLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "senderEmail" text NOT NULL,
    "replyType" shadow."MessagingAutoReplyType" NOT NULL,
    "originalMessageId" text,
    "originalUid" integer,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingEmail; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingEmail" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "messageId" text NOT NULL,
    subject text,
    "sentAt" timestamp(3) without time zone NOT NULL,
    "trackingEnabled" boolean DEFAULT false NOT NULL,
    "senderSessionHash" text,
    "senderIpHash" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailEvent; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingEmailEvent" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    "recipientId" text,
    "linkId" text,
    "linkRecipientId" text,
    type shadow."MessagingEventType" NOT NULL,
    "userAgent" text,
    "deviceFamily" text,
    "deviceType" text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingEmailLink; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingEmailLink" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    url text NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailLinkRecipient; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingEmailLinkRecipient" (
    id text NOT NULL,
    "linkId" text NOT NULL,
    "recipientId" text NOT NULL,
    token text NOT NULL,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "firstClickedAt" timestamp(3) without time zone,
    "lastClickedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingEmailRecipient; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingEmailRecipient" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    address text NOT NULL,
    name text,
    type shadow."MessagingRecipientType" NOT NULL,
    "openToken" text NOT NULL,
    "openCount" integer DEFAULT 0 NOT NULL,
    "firstOpenedAt" timestamp(3) without time zone,
    "lastOpenedAt" timestamp(3) without time zone,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "lastClickedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingInboxSyncState; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingInboxSyncState" (
    "userId" text NOT NULL,
    "lastInboxAutoReplyUid" integer,
    "lastInboxSyncAt" timestamp(3) without time zone,
    "lastAutoReplyAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingSavedResponse; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingSavedResponse" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    slug text,
    description text,
    content text NOT NULL,
    format shadow."SavedResponseFormat" DEFAULT 'PLAINTEXT'::shadow."SavedResponseFormat" NOT NULL,
    "builtIn" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingScheduledAttachment; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingScheduledAttachment" (
    id text NOT NULL,
    "scheduledEmailId" text NOT NULL,
    filename text,
    "contentType" text,
    size integer NOT NULL,
    content bytea NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessagingScheduledEmail; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingScheduledEmail" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "to" jsonb NOT NULL,
    cc jsonb,
    bcc jsonb,
    subject text NOT NULL,
    text text NOT NULL,
    html text NOT NULL,
    "previewText" text NOT NULL,
    "sendAt" timestamp(3) without time zone NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "canceledAt" timestamp(3) without time zone,
    status shadow."MessagingScheduledStatus" DEFAULT 'PENDING'::shadow."MessagingScheduledStatus" NOT NULL,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MessagingSettings; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."MessagingSettings" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "fromEmail" text,
    "senderName" text,
    "senderLogoUrl" text,
    "imapHost" text,
    "imapPort" integer,
    "imapSecure" boolean DEFAULT true NOT NULL,
    "imapUser" text,
    "imapPassword" text,
    "smtpHost" text,
    "smtpPort" integer,
    "smtpSecure" boolean DEFAULT true NOT NULL,
    "smtpUser" text,
    "smtpPassword" text,
    "spamFilterEnabled" boolean DEFAULT true NOT NULL,
    "trackingEnabled" boolean DEFAULT true NOT NULL,
    "autoReplyEnabled" boolean DEFAULT false NOT NULL,
    "autoReplySubject" text,
    "autoReplyBody" text,
    "vacationModeEnabled" boolean DEFAULT false NOT NULL,
    "vacationSubject" text,
    "vacationMessage" text,
    "vacationStartDate" timestamp(3) without time zone,
    "vacationEndDate" timestamp(3) without time zone,
    "vacationBackupEmail" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NumberingSequence; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."NumberingSequence" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type shadow."SequenceType" NOT NULL,
    prefix text NOT NULL,
    year integer NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "userId" text NOT NULL,
    "amountCents" integer NOT NULL,
    method text,
    date timestamp(3) without time zone NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PdfTemplate; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."PdfTemplate" (
    id text NOT NULL,
    type shadow."PdfTemplateType" NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Product" (
    id text NOT NULL,
    "userId" text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    unit text DEFAULT 'unité'::text NOT NULL,
    "priceHTCents" integer NOT NULL,
    "priceTTCCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "defaultDiscountRate" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "isListedInCatalog" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Quote; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Quote" (
    id text NOT NULL,
    "userId" text NOT NULL,
    number text NOT NULL,
    status shadow."QuoteStatus" DEFAULT 'BROUILLON'::shadow."QuoteStatus" NOT NULL,
    reference text,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "validUntil" timestamp(3) without time zone,
    "clientId" text NOT NULL,
    currency text DEFAULT 'TND'::text NOT NULL,
    "globalDiscountRate" double precision,
    "globalDiscountAmountCents" integer,
    "vatBreakdown" jsonb,
    "taxSummary" jsonb,
    "taxConfiguration" jsonb,
    notes text,
    terms text,
    "subtotalHTCents" integer NOT NULL,
    "totalDiscountCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecAmountCents" integer DEFAULT 0 NOT NULL,
    "timbreAmountCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuoteLine; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."QuoteLine" (
    id text NOT NULL,
    "quoteId" text NOT NULL,
    "productId" text,
    description text NOT NULL,
    quantity double precision NOT NULL,
    unit text DEFAULT 'unité'::text NOT NULL,
    "unitPriceHTCents" integer NOT NULL,
    "vatRate" double precision NOT NULL,
    "discountRate" double precision,
    "discountAmountCents" integer,
    "totalHTCents" integer NOT NULL,
    "totalTVACents" integer NOT NULL,
    "totalTTCCents" integer NOT NULL,
    "fodecRate" double precision,
    "fodecAmountCents" integer,
    "position" integer NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."Session" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SpamDetectionLog; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."SpamDetectionLog" (
    id integer NOT NULL,
    "messageId" text,
    mailbox text NOT NULL,
    "targetMailbox" text,
    uid integer NOT NULL,
    subject text,
    sender text,
    score integer NOT NULL,
    threshold integer NOT NULL,
    reasons jsonb,
    "autoMoved" boolean DEFAULT false NOT NULL,
    manual boolean DEFAULT false NOT NULL,
    actor text,
    "detectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE; Schema: shadow; Owner: -
--

CREATE SEQUENCE shadow."SpamDetectionLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow; Owner: -
--

ALTER SEQUENCE shadow."SpamDetectionLog_id_seq" OWNED BY shadow."SpamDetectionLog".id;


--
-- Name: SpamSenderReputation; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."SpamSenderReputation" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    domain text NOT NULL,
    "spamCount" integer DEFAULT 0 NOT NULL,
    "hamCount" integer DEFAULT 0 NOT NULL,
    "lastFeedbackAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE; Schema: shadow; Owner: -
--

CREATE SEQUENCE shadow."SpamSenderReputation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow; Owner: -
--

ALTER SEQUENCE shadow."SpamSenderReputation_id_seq" OWNED BY shadow."SpamSenderReputation".id;


--
-- Name: User; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text,
    role shadow."UserRole" DEFAULT 'VIEWER'::shadow."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WebsiteConfig; Type: TABLE; Schema: shadow; Owner: -
--

CREATE TABLE shadow."WebsiteConfig" (
    id text NOT NULL,
    "userId" text NOT NULL,
    slug text NOT NULL,
    "templateKey" text DEFAULT 'dev-agency'::text NOT NULL,
    "previewToken" text NOT NULL,
    "heroEyebrow" text,
    "heroTitle" text DEFAULT 'Découvrez nos solutions'::text NOT NULL,
    "heroSubtitle" text,
    "heroPrimaryCtaLabel" text DEFAULT 'Demander un devis'::text,
    "heroSecondaryCtaLabel" text DEFAULT 'Télécharger la plaquette'::text,
    "heroSecondaryCtaUrl" text,
    "aboutTitle" text,
    "aboutBody" text,
    "contactBlurb" text,
    "contactEmailOverride" text,
    "contactPhoneOverride" text,
    "contactAddressOverride" text,
    "seoTitle" text,
    "seoDescription" text,
    "seoKeywords" text,
    "socialImageUrl" text,
    "socialLinks" jsonb,
    theme shadow."WebsiteThemeMode" DEFAULT 'SYSTEM'::shadow."WebsiteThemeMode" NOT NULL,
    "accentColor" text DEFAULT '#2563eb'::text NOT NULL,
    "showPrices" boolean DEFAULT true NOT NULL,
    "showInactiveProducts" boolean DEFAULT false NOT NULL,
    "featuredProductIds" jsonb,
    "leadNotificationEmail" text,
    "leadAutoTag" text,
    "leadThanksMessage" text,
    "spamProtectionEnabled" boolean DEFAULT true NOT NULL,
    "customDomain" text,
    "domainStatus" shadow."WebsiteDomainStatus" DEFAULT 'PENDING'::shadow."WebsiteDomainStatus" NOT NULL,
    "domainVerificationCode" text NOT NULL,
    "domainVerifiedAt" timestamp(3) without time zone,
    "domainActivatedAt" timestamp(3) without time zone,
    published boolean DEFAULT false NOT NULL,
    "previewPath" text DEFAULT 'catalogue'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: SpamDetectionLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamDetectionLog" ALTER COLUMN id SET DEFAULT nextval('public."SpamDetectionLog_id_seq"'::regclass);


--
-- Name: SpamSenderReputation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamSenderReputation" ALTER COLUMN id SET DEFAULT nextval('public."SpamSenderReputation_id_seq"'::regclass);


--
-- Name: SpamDetectionLog id; Type: DEFAULT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamDetectionLog" ALTER COLUMN id SET DEFAULT nextval('shadow."SpamDetectionLog_id_seq"'::regclass);


--
-- Name: SpamSenderReputation id; Type: DEFAULT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamSenderReputation" ALTER COLUMN id SET DEFAULT nextval('shadow."SpamSenderReputation_id_seq"'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: AIAuditLog AIAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AIConversation AIConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIConversation"
    ADD CONSTRAINT "AIConversation_pkey" PRIMARY KEY (id);


--
-- Name: AIMessage AIMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_pkey" PRIMARY KEY (id);


--
-- Name: AIPendingToolCall AIPendingToolCall_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_pkey" PRIMARY KEY (id);


--
-- Name: AIUsageStat AIUsageStat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJobEvent BackgroundJobEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJob BackgroundJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BackgroundJob"
    ADD CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY (id);


--
-- Name: ClientSession ClientSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientSession"
    ADD CONSTRAINT "ClientSession_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: CompanySettings CompanySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_pkey" PRIMARY KEY (id);


--
-- Name: ContactMessage ContactMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceAuditLog InvoiceAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailEvent MessagingEmailEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLink MessagingEmailLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmail MessagingEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_pkey" PRIMARY KEY ("userId");


--
-- Name: MessagingSavedResponse MessagingSavedResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingSettings MessagingSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY (id);


--
-- Name: NumberingSequence NumberingSequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: OrderPayment OrderPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PdfTemplate PdfTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: QuoteLine QuoteLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_pkey" PRIMARY KEY (id);


--
-- Name: QuoteRequestAttachment QuoteRequestAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestAttachment"
    ADD CONSTRAINT "QuoteRequestAttachment_pkey" PRIMARY KEY (id);


--
-- Name: QuoteRequest QuoteRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY (id);


--
-- Name: Quote Quote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SpamDetectionLog SpamDetectionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_pkey" PRIMARY KEY (id);


--
-- Name: SpamSenderReputation SpamSenderReputation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebsiteConfig WebsiteConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY (id);


--
-- Name: WishlistItem WishlistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: AIAuditLog AIAuditLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AIConversation AIConversation_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIConversation"
    ADD CONSTRAINT "AIConversation_pkey" PRIMARY KEY (id);


--
-- Name: AIMessage AIMessage_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_pkey" PRIMARY KEY (id);


--
-- Name: AIPendingToolCall AIPendingToolCall_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_pkey" PRIMARY KEY (id);


--
-- Name: AIUsageStat AIUsageStat_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJobEvent BackgroundJobEvent_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJob BackgroundJob_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."BackgroundJob"
    ADD CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: CompanySettings CompanySettings_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceAuditLog InvoiceAuditLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailEvent MessagingEmailEvent_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLink MessagingEmailLink_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmail MessagingEmail_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_pkey" PRIMARY KEY ("userId");


--
-- Name: MessagingSavedResponse MessagingSavedResponse_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingSettings MessagingSettings_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY (id);


--
-- Name: NumberingSequence NumberingSequence_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PdfTemplate PdfTemplate_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: QuoteLine QuoteLine_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_pkey" PRIMARY KEY (id);


--
-- Name: Quote Quote_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SpamDetectionLog SpamDetectionLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_pkey" PRIMARY KEY (id);


--
-- Name: SpamSenderReputation SpamSenderReputation_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebsiteConfig WebsiteConfig_pkey; Type: CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: AIAuditLog_conversationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIAuditLog_conversationId_idx" ON public."AIAuditLog" USING btree ("conversationId");


--
-- Name: AIAuditLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIAuditLog_userId_createdAt_idx" ON public."AIAuditLog" USING btree ("userId", "createdAt");


--
-- Name: AIConversation_user_status_lastActivity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIConversation_user_status_lastActivity_idx" ON public."AIConversation" USING btree ("userId", status, "lastActivityAt" DESC);


--
-- Name: AIMessage_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON public."AIMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AIMessage_userId_role_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIMessage_userId_role_createdAt_idx" ON public."AIMessage" USING btree ("userId", role, "createdAt");


--
-- Name: AIPendingToolCall_conversationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIPendingToolCall_conversationId_idx" ON public."AIPendingToolCall" USING btree ("conversationId");


--
-- Name: AIPendingToolCall_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIPendingToolCall_userId_createdAt_idx" ON public."AIPendingToolCall" USING btree ("userId", "createdAt");


--
-- Name: AIUsageStat_periodKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIUsageStat_periodKey_idx" ON public."AIUsageStat" USING btree ("periodKey");


--
-- Name: AIUsageStat_userId_periodKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AIUsageStat_userId_periodKey_key" ON public."AIUsageStat" USING btree ("userId", "periodKey");


--
-- Name: BackgroundJobEvent_jobId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BackgroundJobEvent_jobId_createdAt_idx" ON public."BackgroundJobEvent" USING btree ("jobId", "createdAt");


--
-- Name: BackgroundJob_runAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BackgroundJob_runAt_idx" ON public."BackgroundJob" USING btree ("runAt");


--
-- Name: BackgroundJob_status_runAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BackgroundJob_status_runAt_idx" ON public."BackgroundJob" USING btree (status, "runAt");


--
-- Name: BackgroundJob_type_dedupeKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON public."BackgroundJob" USING btree (type, "dedupeKey");


--
-- Name: ClientSession_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClientSession_clientId_idx" ON public."ClientSession" USING btree ("clientId");


--
-- Name: ClientSession_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClientSession_tokenHash_key" ON public."ClientSession" USING btree ("tokenHash");


--
-- Name: Client_authUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_authUserId_idx" ON public."Client" USING btree ("authUserId");


--
-- Name: Client_companyName_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_companyName_trgm_idx" ON public."Client" USING gin ("companyName" public.gin_trgm_ops);


--
-- Name: Client_displayName_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_displayName_trgm_idx" ON public."Client" USING gin ("displayName" public.gin_trgm_ops);


--
-- Name: Client_email_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_email_trgm_idx" ON public."Client" USING gin (email public.gin_trgm_ops);


--
-- Name: Client_phone_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_phone_trgm_idx" ON public."Client" USING gin (phone public.gin_trgm_ops);


--
-- Name: Client_userId_authUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Client_userId_authUserId_key" ON public."Client" USING btree ("userId", "authUserId");


--
-- Name: Client_userId_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_userId_displayName_idx" ON public."Client" USING btree ("userId", "displayName");


--
-- Name: Client_vatNumber_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_vatNumber_trgm_idx" ON public."Client" USING gin ("vatNumber" public.gin_trgm_ops);


--
-- Name: CompanySettings_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CompanySettings_userId_key" ON public."CompanySettings" USING btree ("userId");


--
-- Name: ContactMessage_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContactMessage_userId_createdAt_idx" ON public."ContactMessage" USING btree ("userId", "createdAt");


--
-- Name: ContactMessage_websiteId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContactMessage_websiteId_createdAt_idx" ON public."ContactMessage" USING btree ("websiteId", "createdAt");


--
-- Name: EmailLog_userId_documentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailLog_userId_documentType_idx" ON public."EmailLog" USING btree ("userId", "documentType");


--
-- Name: InvoiceAuditLog_userId_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON public."InvoiceAuditLog" USING btree ("userId", "invoiceId");


--
-- Name: Invoice_quoteId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_quoteId_key" ON public."Invoice" USING btree ("quoteId");


--
-- Name: Invoice_userId_clientId_issueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_userId_clientId_issueDate_idx" ON public."Invoice" USING btree ("userId", "clientId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_userId_dueDate_idx" ON public."Invoice" USING btree ("userId", "dueDate", id DESC);


--
-- Name: Invoice_userId_issueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_userId_issueDate_idx" ON public."Invoice" USING btree ("userId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_userId_number_key" ON public."Invoice" USING btree ("userId", number);


--
-- Name: Invoice_userId_status_issueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_userId_status_issueDate_idx" ON public."Invoice" USING btree ("userId", status, "issueDate" DESC, id DESC);


--
-- Name: MessagingAutoReplyLog_userId_senderEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON public."MessagingAutoReplyLog" USING btree ("userId", "senderEmail");


--
-- Name: MessagingAutoReplyLog_userId_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON public."MessagingAutoReplyLog" USING btree ("userId", "sentAt");


--
-- Name: MessagingEmailEvent_emailId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON public."MessagingEmailEvent" USING btree ("emailId", "occurredAt");


--
-- Name: MessagingEmailEvent_linkRecipientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON public."MessagingEmailEvent" USING btree ("linkRecipientId");


--
-- Name: MessagingEmailEvent_recipientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON public."MessagingEmailEvent" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_linkId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON public."MessagingEmailLinkRecipient" USING btree ("linkId");


--
-- Name: MessagingEmailLinkRecipient_recipientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON public."MessagingEmailLinkRecipient" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON public."MessagingEmailLinkRecipient" USING btree (token);


--
-- Name: MessagingEmailLink_emailId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailLink_emailId_idx" ON public."MessagingEmailLink" USING btree ("emailId");


--
-- Name: MessagingEmailRecipient_emailId_address_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON public."MessagingEmailRecipient" USING btree ("emailId", address);


--
-- Name: MessagingEmailRecipient_openToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON public."MessagingEmailRecipient" USING btree ("openToken");


--
-- Name: MessagingEmail_userId_messageId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON public."MessagingEmail" USING btree ("userId", "messageId");


--
-- Name: MessagingEmail_userId_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON public."MessagingEmail" USING btree ("userId", "sentAt");


--
-- Name: MessagingSavedResponse_userId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON public."MessagingSavedResponse" USING btree ("userId", slug);


--
-- Name: MessagingSavedResponse_userId_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON public."MessagingSavedResponse" USING btree ("userId", title);


--
-- Name: MessagingScheduledAttachment_scheduledEmailId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON public."MessagingScheduledAttachment" USING btree ("scheduledEmailId");


--
-- Name: MessagingScheduledEmail_status_sendAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON public."MessagingScheduledEmail" USING btree (status, "sendAt");


--
-- Name: MessagingScheduledEmail_userId_status_sendAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON public."MessagingScheduledEmail" USING btree ("userId", status, "sendAt");


--
-- Name: MessagingSettings_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON public."MessagingSettings" USING btree ("userId");


--
-- Name: NumberingSequence_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NumberingSequence_userId_idx" ON public."NumberingSequence" USING btree ("userId");


--
-- Name: NumberingSequence_userId_type_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON public."NumberingSequence" USING btree ("userId", type, year);


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: OrderPayment_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderPayment_orderId_idx" ON public."OrderPayment" USING btree ("orderId");


--
-- Name: OrderPayment_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderPayment_userId_status_idx" ON public."OrderPayment" USING btree ("userId", status);


--
-- Name: Order_invoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_invoiceId_key" ON public."Order" USING btree ("invoiceId");


--
-- Name: Order_quoteId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_quoteId_key" ON public."Order" USING btree ("quoteId");


--
-- Name: Order_userId_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_orderNumber_idx" ON public."Order" USING btree ("userId", "orderNumber");


--
-- Name: Order_userId_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_userId_orderNumber_key" ON public."Order" USING btree ("userId", "orderNumber");


--
-- Name: Order_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_userId_status_createdAt_idx" ON public."Order" USING btree ("userId", status, "createdAt");


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_userId_idx" ON public."Payment" USING btree ("userId");


--
-- Name: Product_category_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_category_trgm_idx" ON public."Product" USING gin (category public.gin_trgm_ops);


--
-- Name: Product_description_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_description_trgm_idx" ON public."Product" USING gin (description public.gin_trgm_ops);


--
-- Name: Product_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_name_trgm_idx" ON public."Product" USING gin (name public.gin_trgm_ops);


--
-- Name: Product_sku_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_sku_trgm_idx" ON public."Product" USING gin (sku public.gin_trgm_ops);


--
-- Name: Product_userId_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_userId_name_idx" ON public."Product" USING btree ("userId", name);


--
-- Name: Product_userId_publicSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_userId_publicSlug_key" ON public."Product" USING btree ("userId", "publicSlug");


--
-- Name: Product_userId_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_userId_sku_key" ON public."Product" USING btree ("userId", sku);


--
-- Name: QuoteRequestAttachment_quoteRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuoteRequestAttachment_quoteRequestId_idx" ON public."QuoteRequestAttachment" USING btree ("quoteRequestId");


--
-- Name: QuoteRequest_quoteId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuoteRequest_quoteId_key" ON public."QuoteRequest" USING btree ("quoteId");


--
-- Name: QuoteRequest_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuoteRequest_userId_status_createdAt_idx" ON public."QuoteRequest" USING btree ("userId", status, "createdAt");


--
-- Name: Quote_userId_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_userId_clientId_idx" ON public."Quote" USING btree ("userId", "clientId");


--
-- Name: Quote_userId_issueDate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_userId_issueDate_id_idx" ON public."Quote" USING btree ("userId", "issueDate", id);


--
-- Name: Quote_userId_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_userId_number_idx" ON public."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Quote_userId_number_key" ON public."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_userId_reference_idx" ON public."Quote" USING btree ("userId", reference);


--
-- Name: Quote_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quote_userId_status_idx" ON public."Quote" USING btree ("userId", status);


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: SpamDetectionLog_userId_mailbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON public."SpamDetectionLog" USING btree ("userId", mailbox);


--
-- Name: SpamSenderReputation_userId_domain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON public."SpamSenderReputation" USING btree ("userId", domain);


--
-- Name: SpamSenderReputation_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SpamSenderReputation_userId_idx" ON public."SpamSenderReputation" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WebsiteConfig_customDomain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON public."WebsiteConfig" USING btree ("customDomain");


--
-- Name: WebsiteConfig_domainVerificationCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON public."WebsiteConfig" USING btree ("domainVerificationCode");


--
-- Name: WebsiteConfig_previewToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON public."WebsiteConfig" USING btree ("previewToken");


--
-- Name: WebsiteConfig_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON public."WebsiteConfig" USING btree (slug);


--
-- Name: WebsiteConfig_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON public."WebsiteConfig" USING btree ("userId");


--
-- Name: WishlistItem_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WishlistItem_clientId_idx" ON public."WishlistItem" USING btree ("clientId");


--
-- Name: WishlistItem_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WishlistItem_productId_idx" ON public."WishlistItem" USING btree ("productId");


--
-- Name: WishlistItem_userId_clientId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WishlistItem_userId_clientId_productId_key" ON public."WishlistItem" USING btree ("userId", "clientId", "productId");


--
-- Name: WishlistItem_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WishlistItem_userId_idx" ON public."WishlistItem" USING btree ("userId");


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: AIAuditLog_conversationId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIAuditLog_conversationId_idx" ON shadow."AIAuditLog" USING btree ("conversationId");


--
-- Name: AIAuditLog_userId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIAuditLog_userId_createdAt_idx" ON shadow."AIAuditLog" USING btree ("userId", "createdAt");


--
-- Name: AIConversation_user_status_lastActivity_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIConversation_user_status_lastActivity_idx" ON shadow."AIConversation" USING btree ("userId", status, "lastActivityAt" DESC);


--
-- Name: AIMessage_conversationId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON shadow."AIMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AIMessage_userId_role_createdAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIMessage_userId_role_createdAt_idx" ON shadow."AIMessage" USING btree ("userId", role, "createdAt");


--
-- Name: AIPendingToolCall_conversationId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIPendingToolCall_conversationId_idx" ON shadow."AIPendingToolCall" USING btree ("conversationId");


--
-- Name: AIPendingToolCall_userId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIPendingToolCall_userId_createdAt_idx" ON shadow."AIPendingToolCall" USING btree ("userId", "createdAt");


--
-- Name: AIUsageStat_periodKey_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "AIUsageStat_periodKey_idx" ON shadow."AIUsageStat" USING btree ("periodKey");


--
-- Name: AIUsageStat_userId_periodKey_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "AIUsageStat_userId_periodKey_key" ON shadow."AIUsageStat" USING btree ("userId", "periodKey");


--
-- Name: BackgroundJobEvent_jobId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "BackgroundJobEvent_jobId_createdAt_idx" ON shadow."BackgroundJobEvent" USING btree ("jobId", "createdAt");


--
-- Name: BackgroundJob_runAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "BackgroundJob_runAt_idx" ON shadow."BackgroundJob" USING btree ("runAt");


--
-- Name: BackgroundJob_status_runAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "BackgroundJob_status_runAt_idx" ON shadow."BackgroundJob" USING btree (status, "runAt");


--
-- Name: BackgroundJob_type_dedupeKey_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON shadow."BackgroundJob" USING btree (type, "dedupeKey");


--
-- Name: Client_userId_displayName_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Client_userId_displayName_idx" ON shadow."Client" USING btree ("userId", "displayName");


--
-- Name: CompanySettings_userId_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "CompanySettings_userId_key" ON shadow."CompanySettings" USING btree ("userId");


--
-- Name: EmailLog_userId_documentType_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "EmailLog_userId_documentType_idx" ON shadow."EmailLog" USING btree ("userId", "documentType");


--
-- Name: InvoiceAuditLog_userId_invoiceId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON shadow."InvoiceAuditLog" USING btree ("userId", "invoiceId");


--
-- Name: Invoice_quoteId_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "Invoice_quoteId_key" ON shadow."Invoice" USING btree ("quoteId");


--
-- Name: Invoice_userId_clientId_issueDate_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Invoice_userId_clientId_issueDate_idx" ON shadow."Invoice" USING btree ("userId", "clientId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_dueDate_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Invoice_userId_dueDate_idx" ON shadow."Invoice" USING btree ("userId", "dueDate", id DESC);


--
-- Name: Invoice_userId_issueDate_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Invoice_userId_issueDate_idx" ON shadow."Invoice" USING btree ("userId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_number_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "Invoice_userId_number_key" ON shadow."Invoice" USING btree ("userId", number);


--
-- Name: Invoice_userId_status_issueDate_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Invoice_userId_status_issueDate_idx" ON shadow."Invoice" USING btree ("userId", status, "issueDate" DESC, id DESC);


--
-- Name: MessagingAutoReplyLog_userId_senderEmail_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON shadow."MessagingAutoReplyLog" USING btree ("userId", "senderEmail");


--
-- Name: MessagingAutoReplyLog_userId_sentAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON shadow."MessagingAutoReplyLog" USING btree ("userId", "sentAt");


--
-- Name: MessagingEmailEvent_emailId_occurredAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON shadow."MessagingEmailEvent" USING btree ("emailId", "occurredAt");


--
-- Name: MessagingEmailEvent_linkRecipientId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON shadow."MessagingEmailEvent" USING btree ("linkRecipientId");


--
-- Name: MessagingEmailEvent_recipientId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON shadow."MessagingEmailEvent" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_linkId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON shadow."MessagingEmailLinkRecipient" USING btree ("linkId");


--
-- Name: MessagingEmailLinkRecipient_recipientId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON shadow."MessagingEmailLinkRecipient" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_token_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON shadow."MessagingEmailLinkRecipient" USING btree (token);


--
-- Name: MessagingEmailLink_emailId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailLink_emailId_idx" ON shadow."MessagingEmailLink" USING btree ("emailId");


--
-- Name: MessagingEmailRecipient_emailId_address_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON shadow."MessagingEmailRecipient" USING btree ("emailId", address);


--
-- Name: MessagingEmailRecipient_openToken_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON shadow."MessagingEmailRecipient" USING btree ("openToken");


--
-- Name: MessagingEmail_userId_messageId_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON shadow."MessagingEmail" USING btree ("userId", "messageId");


--
-- Name: MessagingEmail_userId_sentAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON shadow."MessagingEmail" USING btree ("userId", "sentAt");


--
-- Name: MessagingSavedResponse_userId_slug_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON shadow."MessagingSavedResponse" USING btree ("userId", slug);


--
-- Name: MessagingSavedResponse_userId_title_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON shadow."MessagingSavedResponse" USING btree ("userId", title);


--
-- Name: MessagingScheduledAttachment_scheduledEmailId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON shadow."MessagingScheduledAttachment" USING btree ("scheduledEmailId");


--
-- Name: MessagingScheduledEmail_status_sendAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON shadow."MessagingScheduledEmail" USING btree (status, "sendAt");


--
-- Name: MessagingScheduledEmail_userId_status_sendAt_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON shadow."MessagingScheduledEmail" USING btree ("userId", status, "sendAt");


--
-- Name: MessagingSettings_userId_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON shadow."MessagingSettings" USING btree ("userId");


--
-- Name: NumberingSequence_userId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "NumberingSequence_userId_idx" ON shadow."NumberingSequence" USING btree ("userId");


--
-- Name: NumberingSequence_userId_type_year_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON shadow."NumberingSequence" USING btree ("userId", type, year);


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Payment_userId_idx" ON shadow."Payment" USING btree ("userId");


--
-- Name: Product_userId_name_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Product_userId_name_idx" ON shadow."Product" USING btree ("userId", name);


--
-- Name: Product_userId_sku_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "Product_userId_sku_key" ON shadow."Product" USING btree ("userId", sku);


--
-- Name: Quote_userId_clientId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Quote_userId_clientId_idx" ON shadow."Quote" USING btree ("userId", "clientId");


--
-- Name: Quote_userId_issueDate_id_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Quote_userId_issueDate_id_idx" ON shadow."Quote" USING btree ("userId", "issueDate", id);


--
-- Name: Quote_userId_number_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Quote_userId_number_idx" ON shadow."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_number_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "Quote_userId_number_key" ON shadow."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_reference_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Quote_userId_reference_idx" ON shadow."Quote" USING btree ("userId", reference);


--
-- Name: Quote_userId_status_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "Quote_userId_status_idx" ON shadow."Quote" USING btree ("userId", status);


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON shadow."Session" USING btree ("tokenHash");


--
-- Name: SpamDetectionLog_userId_mailbox_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON shadow."SpamDetectionLog" USING btree ("userId", mailbox);


--
-- Name: SpamSenderReputation_userId_domain_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON shadow."SpamSenderReputation" USING btree ("userId", domain);


--
-- Name: SpamSenderReputation_userId_idx; Type: INDEX; Schema: shadow; Owner: -
--

CREATE INDEX "SpamSenderReputation_userId_idx" ON shadow."SpamSenderReputation" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON shadow."User" USING btree (email);


--
-- Name: WebsiteConfig_customDomain_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON shadow."WebsiteConfig" USING btree ("customDomain");


--
-- Name: WebsiteConfig_domainVerificationCode_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON shadow."WebsiteConfig" USING btree ("domainVerificationCode");


--
-- Name: WebsiteConfig_previewToken_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON shadow."WebsiteConfig" USING btree ("previewToken");


--
-- Name: WebsiteConfig_slug_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON shadow."WebsiteConfig" USING btree (slug);


--
-- Name: WebsiteConfig_userId_key; Type: INDEX; Schema: shadow; Owner: -
--

CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON shadow."WebsiteConfig" USING btree ("userId");


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: AIAuditLog AIAuditLog_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AIAuditLog AIAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIConversation AIConversation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIConversation"
    ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIUsageStat AIUsageStat_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BackgroundJobEvent BackgroundJobEvent_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."BackgroundJob"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientSession ClientSession_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientSession"
    ADD CONSTRAINT "ClientSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanySettings CompanySettings_invoiceTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES public."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_quoteTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES public."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactMessage ContactMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactMessage ContactMessage_websiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES public."WebsiteConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailLog EmailLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceAuditLog InvoiceAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkRecipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES public."MessagingEmailLinkRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_linkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLink MessagingEmailLink_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmail MessagingEmail_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSavedResponse MessagingSavedResponse_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_scheduledEmailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES public."MessagingScheduledEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSettings MessagingSettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NumberingSequence NumberingSequence_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrderPayment OrderPayment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderPayment OrderPayment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteLine QuoteLine_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteLine QuoteLine_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteRequestAttachment QuoteRequestAttachment_quoteRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestAttachment"
    ADD CONSTRAINT "QuoteRequestAttachment_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES public."QuoteRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteRequest QuoteRequest_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuoteRequest QuoteRequest_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteRequest QuoteRequest_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteRequest QuoteRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quote Quote_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quote Quote_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamDetectionLog SpamDetectionLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamSenderReputation SpamSenderReputation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebsiteConfig WebsiteConfig_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIAuditLog AIAuditLog_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AIAuditLog AIAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIConversation AIConversation_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIConversation"
    ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIUsageStat AIUsageStat_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BackgroundJobEvent BackgroundJobEvent_jobId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES shadow."BackgroundJob"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Client"
    ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanySettings CompanySettings_invoiceTemplateId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES shadow."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_quoteTemplateId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES shadow."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailLog EmailLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."EmailLog"
    ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceAuditLog InvoiceAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES shadow."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_productId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES shadow."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_quoteId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES shadow."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES shadow."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkRecipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES shadow."MessagingEmailLinkRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_recipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES shadow."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_linkId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES shadow."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_recipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES shadow."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLink MessagingEmailLink_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmail MessagingEmail_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSavedResponse MessagingSavedResponse_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_scheduledEmailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES shadow."MessagingScheduledEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSettings MessagingSettings_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NumberingSequence NumberingSequence_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES shadow."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Product"
    ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteLine QuoteLine_productId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteLine QuoteLine_quoteId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES shadow."Quote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quote Quote_clientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES shadow."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quote Quote_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamDetectionLog SpamDetectionLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamSenderReputation SpamSenderReputation_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebsiteConfig WebsiteConfig_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: -
--

ALTER TABLE ONLY shadow."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- PostgreSQL database dump complete
--

