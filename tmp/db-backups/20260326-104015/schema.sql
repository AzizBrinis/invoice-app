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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: shadow; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA shadow;


ALTER SCHEMA shadow OWNER TO postgres;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: AIAuditStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AIAuditStatus" AS ENUM (
    'SUCCESS',
    'ERROR'
);


ALTER TYPE public."AIAuditStatus" OWNER TO postgres;

--
-- Name: AIConversationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AIConversationStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."AIConversationStatus" OWNER TO postgres;

--
-- Name: AIMessageRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AIMessageRole" AS ENUM (
    'SYSTEM',
    'USER',
    'ASSISTANT',
    'TOOL'
);


ALTER TYPE public."AIMessageRole" OWNER TO postgres;

--
-- Name: AccountInvitationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."AccountInvitationStatus" OWNER TO postgres;

--
-- Name: AccountMembershipRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountMembershipRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER'
);


ALTER TYPE public."AccountMembershipRole" OWNER TO postgres;

--
-- Name: AccountPermission; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountPermission" AS ENUM (
    'DASHBOARD_VIEW',
    'CLIENTS_VIEW',
    'CLIENTS_MANAGE',
    'SERVICES_MANAGE',
    'PAYMENTS_MANAGE',
    'RECEIPTS_MANAGE',
    'REPORTS_VIEW',
    'COLLABORATORS_MANAGE'
);


ALTER TYPE public."AccountPermission" OWNER TO postgres;

--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountType" AS ENUM (
    'FULL_APP',
    'CLIENT_PAYMENTS'
);


ALTER TYPE public."AccountType" OWNER TO postgres;

--
-- Name: BackgroundJobEventType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BackgroundJobEventType" AS ENUM (
    'ENQUEUED',
    'DEDUPED',
    'STARTED',
    'SUCCEEDED',
    'FAILED',
    'RETRY_SCHEDULED'
);


ALTER TYPE public."BackgroundJobEventType" OWNER TO postgres;

--
-- Name: BackgroundJobStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BackgroundJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."BackgroundJobStatus" OWNER TO postgres;

--
-- Name: ClientSource; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ClientSource" AS ENUM (
    'MANUAL',
    'IMPORT',
    'WEBSITE_LEAD'
);


ALTER TYPE public."ClientSource" OWNER TO postgres;

--
-- Name: DocumentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DocumentType" AS ENUM (
    'DEVIS',
    'FACTURE',
    'RECU'
);


ALTER TYPE public."DocumentType" OWNER TO postgres;

--
-- Name: EmailStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EmailStatus" AS ENUM (
    'EN_ATTENTE',
    'ENVOYE',
    'ECHEC'
);


ALTER TYPE public."EmailStatus" OWNER TO postgres;

--
-- Name: InvoiceAuditAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceAuditAction" AS ENUM (
    'CANCELLATION',
    'DELETION'
);


ALTER TYPE public."InvoiceAuditAction" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'BROUILLON',
    'ENVOYEE',
    'PAYEE',
    'PARTIELLE',
    'RETARD',
    'ANNULEE'
);


ALTER TYPE public."InvoiceStatus" OWNER TO postgres;

--
-- Name: MessagingAutoReplyType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingAutoReplyType" AS ENUM (
    'STANDARD',
    'VACATION'
);


ALTER TYPE public."MessagingAutoReplyType" OWNER TO postgres;

--
-- Name: MessagingEventType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingEventType" AS ENUM (
    'OPEN',
    'CLICK'
);


ALTER TYPE public."MessagingEventType" OWNER TO postgres;

--
-- Name: MessagingLocalBodyState; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingLocalBodyState" AS ENUM (
    'NONE',
    'TEXT_READY',
    'HTML_READY',
    'OVERSIZED_FALLBACK'
);


ALTER TYPE public."MessagingLocalBodyState" OWNER TO postgres;

--
-- Name: MessagingLocalSyncStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingLocalSyncStatus" AS ENUM (
    'DISABLED',
    'BOOTSTRAPPING',
    'READY',
    'DEGRADED',
    'ERROR'
);


ALTER TYPE public."MessagingLocalSyncStatus" OWNER TO postgres;

--
-- Name: MessagingMailboxName; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingMailboxName" AS ENUM (
    'INBOX',
    'SENT',
    'DRAFTS',
    'TRASH',
    'SPAM'
);


ALTER TYPE public."MessagingMailboxName" OWNER TO postgres;

--
-- Name: MessagingRecipientType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingRecipientType" AS ENUM (
    'TO',
    'CC',
    'BCC'
);


ALTER TYPE public."MessagingRecipientType" OWNER TO postgres;

--
-- Name: MessagingScheduledStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessagingScheduledStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."MessagingScheduledStatus" OWNER TO postgres;

--
-- Name: OrderPaymentProofStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderPaymentProofStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."OrderPaymentProofStatus" OWNER TO postgres;

--
-- Name: OrderPaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderPaymentStatus" AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'REFUNDED'
);


ALTER TYPE public."OrderPaymentStatus" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FULFILLED',
    'CANCELLED',
    'REFUNDED'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: PdfTemplateType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PdfTemplateType" AS ENUM (
    'DEVIS',
    'FACTURE',
    'RECU'
);


ALTER TYPE public."PdfTemplateType" OWNER TO postgres;

--
-- Name: ProductSaleMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProductSaleMode" AS ENUM (
    'INSTANT',
    'QUOTE'
);


ALTER TYPE public."ProductSaleMode" OWNER TO postgres;

--
-- Name: QuoteRequestStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QuoteRequestStatus" AS ENUM (
    'NEW',
    'IN_PROGRESS',
    'CONVERTED',
    'CLOSED'
);


ALTER TYPE public."QuoteRequestStatus" OWNER TO postgres;

--
-- Name: QuoteStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QuoteStatus" AS ENUM (
    'BROUILLON',
    'ENVOYE',
    'ACCEPTE',
    'REFUSE',
    'EXPIRE'
);


ALTER TYPE public."QuoteStatus" OWNER TO postgres;

--
-- Name: SavedResponseFormat; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SavedResponseFormat" AS ENUM (
    'PLAINTEXT',
    'HTML'
);


ALTER TYPE public."SavedResponseFormat" OWNER TO postgres;

--
-- Name: SequenceType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SequenceType" AS ENUM (
    'DEVIS',
    'FACTURE',
    'RECU'
);


ALTER TYPE public."SequenceType" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'ACCOUNTANT',
    'VIEWER'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

--
-- Name: WebsiteDomainStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."WebsiteDomainStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'ACTIVE'
);


ALTER TYPE public."WebsiteDomainStatus" OWNER TO postgres;

--
-- Name: WebsiteThemeMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."WebsiteThemeMode" AS ENUM (
    'SYSTEM',
    'LIGHT',
    'DARK'
);


ALTER TYPE public."WebsiteThemeMode" OWNER TO postgres;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
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


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: AIAuditStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."AIAuditStatus" AS ENUM (
    'SUCCESS',
    'ERROR'
);


ALTER TYPE shadow."AIAuditStatus" OWNER TO postgres;

--
-- Name: AIConversationStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."AIConversationStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);


ALTER TYPE shadow."AIConversationStatus" OWNER TO postgres;

--
-- Name: AIMessageRole; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."AIMessageRole" AS ENUM (
    'SYSTEM',
    'USER',
    'ASSISTANT',
    'TOOL'
);


ALTER TYPE shadow."AIMessageRole" OWNER TO postgres;

--
-- Name: BackgroundJobEventType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."BackgroundJobEventType" AS ENUM (
    'ENQUEUED',
    'DEDUPED',
    'STARTED',
    'SUCCEEDED',
    'FAILED',
    'RETRY_SCHEDULED'
);


ALTER TYPE shadow."BackgroundJobEventType" OWNER TO postgres;

--
-- Name: BackgroundJobStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."BackgroundJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE shadow."BackgroundJobStatus" OWNER TO postgres;

--
-- Name: ClientSource; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."ClientSource" AS ENUM (
    'MANUAL',
    'IMPORT',
    'WEBSITE_LEAD'
);


ALTER TYPE shadow."ClientSource" OWNER TO postgres;

--
-- Name: DocumentType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."DocumentType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


ALTER TYPE shadow."DocumentType" OWNER TO postgres;

--
-- Name: EmailStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."EmailStatus" AS ENUM (
    'EN_ATTENTE',
    'ENVOYE',
    'ECHEC'
);


ALTER TYPE shadow."EmailStatus" OWNER TO postgres;

--
-- Name: InvoiceAuditAction; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."InvoiceAuditAction" AS ENUM (
    'CANCELLATION',
    'DELETION'
);


ALTER TYPE shadow."InvoiceAuditAction" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."InvoiceStatus" AS ENUM (
    'BROUILLON',
    'ENVOYEE',
    'PAYEE',
    'PARTIELLE',
    'RETARD',
    'ANNULEE'
);


ALTER TYPE shadow."InvoiceStatus" OWNER TO postgres;

--
-- Name: MessagingAutoReplyType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."MessagingAutoReplyType" AS ENUM (
    'STANDARD',
    'VACATION'
);


ALTER TYPE shadow."MessagingAutoReplyType" OWNER TO postgres;

--
-- Name: MessagingEventType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."MessagingEventType" AS ENUM (
    'OPEN',
    'CLICK'
);


ALTER TYPE shadow."MessagingEventType" OWNER TO postgres;

--
-- Name: MessagingRecipientType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."MessagingRecipientType" AS ENUM (
    'TO',
    'CC',
    'BCC'
);


ALTER TYPE shadow."MessagingRecipientType" OWNER TO postgres;

--
-- Name: MessagingScheduledStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."MessagingScheduledStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE shadow."MessagingScheduledStatus" OWNER TO postgres;

--
-- Name: PdfTemplateType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."PdfTemplateType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


ALTER TYPE shadow."PdfTemplateType" OWNER TO postgres;

--
-- Name: QuoteStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."QuoteStatus" AS ENUM (
    'BROUILLON',
    'ENVOYE',
    'ACCEPTE',
    'REFUSE',
    'EXPIRE'
);


ALTER TYPE shadow."QuoteStatus" OWNER TO postgres;

--
-- Name: SavedResponseFormat; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."SavedResponseFormat" AS ENUM (
    'PLAINTEXT',
    'HTML'
);


ALTER TYPE shadow."SavedResponseFormat" OWNER TO postgres;

--
-- Name: SequenceType; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."SequenceType" AS ENUM (
    'DEVIS',
    'FACTURE'
);


ALTER TYPE shadow."SequenceType" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."UserRole" AS ENUM (
    'ADMIN',
    'ACCOUNTANT',
    'VIEWER'
);


ALTER TYPE shadow."UserRole" OWNER TO postgres;

--
-- Name: WebsiteDomainStatus; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."WebsiteDomainStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'ACTIVE'
);


ALTER TYPE shadow."WebsiteDomainStatus" OWNER TO postgres;

--
-- Name: WebsiteThemeMode; Type: TYPE; Schema: shadow; Owner: postgres
--

CREATE TYPE shadow."WebsiteThemeMode" AS ENUM (
    'SYSTEM',
    'LIGHT',
    'DARK'
);


ALTER TYPE shadow."WebsiteThemeMode" OWNER TO postgres;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO postgres;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO postgres;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO postgres;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO postgres;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO postgres;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: postgres
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


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO postgres;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
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


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

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


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION storage.get_level(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.get_prefix(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.get_prefixes(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: AIAuditLog; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."AIAuditLog" OWNER TO postgres;

--
-- Name: AIConversation; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."AIConversation" OWNER TO postgres;

--
-- Name: AIMessage; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."AIMessage" OWNER TO postgres;

--
-- Name: AIPendingToolCall; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."AIPendingToolCall" OWNER TO postgres;

--
-- Name: AIUsageStat; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."AIUsageStat" OWNER TO postgres;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    type public."AccountType" DEFAULT 'FULL_APP'::public."AccountType" NOT NULL,
    "displayName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Account" OWNER TO postgres;

--
-- Name: AccountInvitation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AccountInvitation" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    email text NOT NULL,
    "invitedByUserId" text NOT NULL,
    "acceptedByUserId" text,
    role public."AccountMembershipRole" DEFAULT 'MEMBER'::public."AccountMembershipRole" NOT NULL,
    status public."AccountInvitationStatus" DEFAULT 'PENDING'::public."AccountInvitationStatus" NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AccountInvitation" OWNER TO postgres;

--
-- Name: AccountInvitationPermission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AccountInvitationPermission" (
    id text NOT NULL,
    "invitationId" text NOT NULL,
    permission public."AccountPermission" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AccountInvitationPermission" OWNER TO postgres;

--
-- Name: AccountMembership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AccountMembership" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "userId" text NOT NULL,
    role public."AccountMembershipRole" DEFAULT 'MEMBER'::public."AccountMembershipRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AccountMembership" OWNER TO postgres;

--
-- Name: AccountMembershipPermission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AccountMembershipPermission" (
    id text NOT NULL,
    "membershipId" text NOT NULL,
    permission public."AccountPermission" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AccountMembershipPermission" OWNER TO postgres;

--
-- Name: BackgroundJob; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."BackgroundJob" OWNER TO postgres;

--
-- Name: BackgroundJobEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BackgroundJobEvent" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    type public."BackgroundJobEventType" NOT NULL,
    detail jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."BackgroundJobEvent" OWNER TO postgres;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Client" OWNER TO postgres;

--
-- Name: ClientPayment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientPayment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "clientId" text NOT NULL,
    "receiptNumber" text,
    currency text DEFAULT 'TND'::text NOT NULL,
    "amountCents" integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    method text,
    reference text,
    description text,
    note text,
    "privateNote" text,
    "receiptIssuedAt" timestamp(3) without time zone,
    "receiptSentAt" timestamp(3) without time zone,
    "receiptSnapshot" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ClientPayment" OWNER TO postgres;

--
-- Name: ClientPaymentService; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientPaymentService" (
    id text NOT NULL,
    "clientPaymentId" text NOT NULL,
    "clientServiceId" text,
    "titleSnapshot" text NOT NULL,
    "detailsSnapshot" text,
    "allocatedAmountCents" integer,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ClientPaymentService" OWNER TO postgres;

--
-- Name: ClientSession; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientSession" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "clientId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ClientSession" OWNER TO postgres;

--
-- Name: CompanySettings; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."CompanySettings" OWNER TO postgres;

--
-- Name: ContactMessage; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."ContactMessage" OWNER TO postgres;

--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."EmailLog" OWNER TO postgres;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Invoice" OWNER TO postgres;

--
-- Name: InvoiceAuditLog; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."InvoiceAuditLog" OWNER TO postgres;

--
-- Name: InvoiceLine; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."InvoiceLine" OWNER TO postgres;

--
-- Name: MessagingAutoReplyLog; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingAutoReplyLog" OWNER TO postgres;

--
-- Name: MessagingEmail; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingEmail" OWNER TO postgres;

--
-- Name: MessagingEmailEvent; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingEmailEvent" OWNER TO postgres;

--
-- Name: MessagingEmailLink; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessagingEmailLink" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    url text NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessagingEmailLink" OWNER TO postgres;

--
-- Name: MessagingEmailLinkRecipient; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingEmailLinkRecipient" OWNER TO postgres;

--
-- Name: MessagingEmailRecipient; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingEmailRecipient" OWNER TO postgres;

--
-- Name: MessagingInboxSyncState; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessagingInboxSyncState" (
    "userId" text NOT NULL,
    "lastInboxAutoReplyUid" integer,
    "lastInboxSyncAt" timestamp(3) without time zone,
    "lastAutoReplyAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessagingInboxSyncState" OWNER TO postgres;

--
-- Name: MessagingLocalAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessagingLocalAttachment" (
    id text NOT NULL,
    "messageRecordId" text NOT NULL,
    "attachmentId" text NOT NULL,
    filename text NOT NULL,
    "contentType" text NOT NULL,
    size integer NOT NULL,
    "contentId" text,
    "contentLocation" text,
    inline boolean DEFAULT false NOT NULL,
    "cachedBlobKey" text,
    "cachedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessagingLocalAttachment" OWNER TO postgres;

--
-- Name: MessagingLocalMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessagingLocalMessage" (
    id text NOT NULL,
    "userId" text NOT NULL,
    mailbox public."MessagingMailboxName" NOT NULL,
    "remotePath" text,
    "uidValidity" integer NOT NULL,
    uid integer NOT NULL,
    "messageId" text,
    subject text,
    "fromLabel" text,
    "fromAddress" text,
    "toRecipients" jsonb,
    "ccRecipients" jsonb,
    "bccRecipients" jsonb,
    "replyToRecipients" jsonb,
    "internalDate" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    seen boolean DEFAULT false NOT NULL,
    answered boolean DEFAULT false NOT NULL,
    flagged boolean DEFAULT false NOT NULL,
    draft boolean DEFAULT false NOT NULL,
    "hasAttachments" boolean DEFAULT false NOT NULL,
    "previewText" text,
    "normalizedText" text,
    "sanitizedHtml" text,
    "searchText" text,
    "bodyState" public."MessagingLocalBodyState" DEFAULT 'NONE'::public."MessagingLocalBodyState" NOT NULL,
    "lastSyncedAt" timestamp(3) without time zone,
    "hydratedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessagingLocalMessage" OWNER TO postgres;

--
-- Name: MessagingMailboxLocalSyncState; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessagingMailboxLocalSyncState" (
    id text NOT NULL,
    "userId" text NOT NULL,
    mailbox public."MessagingMailboxName" NOT NULL,
    "remotePath" text,
    "uidValidity" integer,
    "lastKnownUidNext" integer,
    "lastSyncedUid" integer,
    "lastBackfilledUid" integer,
    "remoteMessageCount" integer,
    "localMessageCount" integer,
    status public."MessagingLocalSyncStatus" DEFAULT 'DISABLED'::public."MessagingLocalSyncStatus" NOT NULL,
    "lastSuccessfulSyncAt" timestamp(3) without time zone,
    "lastAttemptedSyncAt" timestamp(3) without time zone,
    "lastFullResyncAt" timestamp(3) without time zone,
    "lastError" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessagingMailboxLocalSyncState" OWNER TO postgres;

--
-- Name: MessagingSavedResponse; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingSavedResponse" OWNER TO postgres;

--
-- Name: MessagingScheduledAttachment; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingScheduledAttachment" OWNER TO postgres;

--
-- Name: MessagingScheduledEmail; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."MessagingScheduledEmail" OWNER TO postgres;

--
-- Name: MessagingSettings; Type: TABLE; Schema: public; Owner: postgres
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "localSyncEnabled" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."MessagingSettings" OWNER TO postgres;

--
-- Name: NumberingSequence; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."NumberingSequence" OWNER TO postgres;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Order" OWNER TO postgres;

--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."OrderItem" OWNER TO postgres;

--
-- Name: OrderPayment; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."OrderPayment" OWNER TO postgres;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: PaymentService; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PaymentService" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "sourceClientId" text,
    title text NOT NULL,
    details text,
    "priceCents" integer DEFAULT 0 NOT NULL,
    notes text,
    "privateNotes" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PaymentService" OWNER TO postgres;

--
-- Name: PdfTemplate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PdfTemplate" (
    id text NOT NULL,
    type public."PdfTemplateType" NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PdfTemplate" OWNER TO postgres;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Product" OWNER TO postgres;

--
-- Name: Quote; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."Quote" OWNER TO postgres;

--
-- Name: QuoteLine; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."QuoteLine" OWNER TO postgres;

--
-- Name: QuoteRequest; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."QuoteRequest" OWNER TO postgres;

--
-- Name: QuoteRequestAttachment; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."QuoteRequestAttachment" OWNER TO postgres;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "activeTenantId" text
);


ALTER TABLE public."Session" OWNER TO postgres;

--
-- Name: SpamDetectionLog; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."SpamDetectionLog" OWNER TO postgres;

--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SpamDetectionLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SpamDetectionLog_id_seq" OWNER TO postgres;

--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SpamDetectionLog_id_seq" OWNED BY public."SpamDetectionLog".id;


--
-- Name: SpamSenderReputation; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."SpamSenderReputation" OWNER TO postgres;

--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SpamSenderReputation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SpamSenderReputation_id_seq" OWNER TO postgres;

--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SpamSenderReputation_id_seq" OWNED BY public."SpamSenderReputation".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: WebsiteConfig; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public."WebsiteConfig" OWNER TO postgres;

--
-- Name: WishlistItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WishlistItem" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "clientId" text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WishlistItem" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
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


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
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
-- Name: AIAuditLog; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."AIAuditLog" OWNER TO postgres;

--
-- Name: AIConversation; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."AIConversation" OWNER TO postgres;

--
-- Name: AIMessage; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."AIMessage" OWNER TO postgres;

--
-- Name: AIPendingToolCall; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."AIPendingToolCall" OWNER TO postgres;

--
-- Name: AIUsageStat; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."AIUsageStat" OWNER TO postgres;

--
-- Name: BackgroundJob; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."BackgroundJob" OWNER TO postgres;

--
-- Name: BackgroundJobEvent; Type: TABLE; Schema: shadow; Owner: postgres
--

CREATE TABLE shadow."BackgroundJobEvent" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    type shadow."BackgroundJobEventType" NOT NULL,
    detail jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE shadow."BackgroundJobEvent" OWNER TO postgres;

--
-- Name: Client; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."Client" OWNER TO postgres;

--
-- Name: CompanySettings; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."CompanySettings" OWNER TO postgres;

--
-- Name: EmailLog; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."EmailLog" OWNER TO postgres;

--
-- Name: Invoice; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."Invoice" OWNER TO postgres;

--
-- Name: InvoiceAuditLog; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."InvoiceAuditLog" OWNER TO postgres;

--
-- Name: InvoiceLine; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."InvoiceLine" OWNER TO postgres;

--
-- Name: MessagingAutoReplyLog; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingAutoReplyLog" OWNER TO postgres;

--
-- Name: MessagingEmail; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingEmail" OWNER TO postgres;

--
-- Name: MessagingEmailEvent; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingEmailEvent" OWNER TO postgres;

--
-- Name: MessagingEmailLink; Type: TABLE; Schema: shadow; Owner: postgres
--

CREATE TABLE shadow."MessagingEmailLink" (
    id text NOT NULL,
    "emailId" text NOT NULL,
    url text NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow."MessagingEmailLink" OWNER TO postgres;

--
-- Name: MessagingEmailLinkRecipient; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingEmailLinkRecipient" OWNER TO postgres;

--
-- Name: MessagingEmailRecipient; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingEmailRecipient" OWNER TO postgres;

--
-- Name: MessagingInboxSyncState; Type: TABLE; Schema: shadow; Owner: postgres
--

CREATE TABLE shadow."MessagingInboxSyncState" (
    "userId" text NOT NULL,
    "lastInboxAutoReplyUid" integer,
    "lastInboxSyncAt" timestamp(3) without time zone,
    "lastAutoReplyAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow."MessagingInboxSyncState" OWNER TO postgres;

--
-- Name: MessagingSavedResponse; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingSavedResponse" OWNER TO postgres;

--
-- Name: MessagingScheduledAttachment; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingScheduledAttachment" OWNER TO postgres;

--
-- Name: MessagingScheduledEmail; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingScheduledEmail" OWNER TO postgres;

--
-- Name: MessagingSettings; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."MessagingSettings" OWNER TO postgres;

--
-- Name: NumberingSequence; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."NumberingSequence" OWNER TO postgres;

--
-- Name: Payment; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."Payment" OWNER TO postgres;

--
-- Name: PdfTemplate; Type: TABLE; Schema: shadow; Owner: postgres
--

CREATE TABLE shadow."PdfTemplate" (
    id text NOT NULL,
    type shadow."PdfTemplateType" NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow."PdfTemplate" OWNER TO postgres;

--
-- Name: Product; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."Product" OWNER TO postgres;

--
-- Name: Quote; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."Quote" OWNER TO postgres;

--
-- Name: QuoteLine; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."QuoteLine" OWNER TO postgres;

--
-- Name: Session; Type: TABLE; Schema: shadow; Owner: postgres
--

CREATE TABLE shadow."Session" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE shadow."Session" OWNER TO postgres;

--
-- Name: SpamDetectionLog; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."SpamDetectionLog" OWNER TO postgres;

--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE; Schema: shadow; Owner: postgres
--

CREATE SEQUENCE shadow."SpamDetectionLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow."SpamDetectionLog_id_seq" OWNER TO postgres;

--
-- Name: SpamDetectionLog_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow; Owner: postgres
--

ALTER SEQUENCE shadow."SpamDetectionLog_id_seq" OWNED BY shadow."SpamDetectionLog".id;


--
-- Name: SpamSenderReputation; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."SpamSenderReputation" OWNER TO postgres;

--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE; Schema: shadow; Owner: postgres
--

CREATE SEQUENCE shadow."SpamSenderReputation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE shadow."SpamSenderReputation_id_seq" OWNER TO postgres;

--
-- Name: SpamSenderReputation_id_seq; Type: SEQUENCE OWNED BY; Schema: shadow; Owner: postgres
--

ALTER SEQUENCE shadow."SpamSenderReputation_id_seq" OWNED BY shadow."SpamSenderReputation".id;


--
-- Name: User; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."User" OWNER TO postgres;

--
-- Name: WebsiteConfig; Type: TABLE; Schema: shadow; Owner: postgres
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


ALTER TABLE shadow."WebsiteConfig" OWNER TO postgres;

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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
    user_metadata jsonb
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: SpamDetectionLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamDetectionLog" ALTER COLUMN id SET DEFAULT nextval('public."SpamDetectionLog_id_seq"'::regclass);


--
-- Name: SpamSenderReputation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamSenderReputation" ALTER COLUMN id SET DEFAULT nextval('public."SpamSenderReputation_id_seq"'::regclass);


--
-- Name: SpamDetectionLog id; Type: DEFAULT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamDetectionLog" ALTER COLUMN id SET DEFAULT nextval('shadow."SpamDetectionLog_id_seq"'::regclass);


--
-- Name: SpamSenderReputation id; Type: DEFAULT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamSenderReputation" ALTER COLUMN id SET DEFAULT nextval('shadow."SpamSenderReputation_id_seq"'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: AIAuditLog AIAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AIConversation AIConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIConversation"
    ADD CONSTRAINT "AIConversation_pkey" PRIMARY KEY (id);


--
-- Name: AIMessage AIMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_pkey" PRIMARY KEY (id);


--
-- Name: AIPendingToolCall AIPendingToolCall_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_pkey" PRIMARY KEY (id);


--
-- Name: AIUsageStat AIUsageStat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_pkey" PRIMARY KEY (id);


--
-- Name: AccountInvitationPermission AccountInvitationPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitationPermission"
    ADD CONSTRAINT "AccountInvitationPermission_pkey" PRIMARY KEY (id);


--
-- Name: AccountInvitation AccountInvitation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitation"
    ADD CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY (id);


--
-- Name: AccountMembershipPermission AccountMembershipPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountMembershipPermission"
    ADD CONSTRAINT "AccountMembershipPermission_pkey" PRIMARY KEY (id);


--
-- Name: AccountMembership AccountMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountMembership"
    ADD CONSTRAINT "AccountMembership_pkey" PRIMARY KEY (id);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJobEvent BackgroundJobEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJob BackgroundJob_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackgroundJob"
    ADD CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY (id);


--
-- Name: ClientPaymentService ClientPaymentService_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPaymentService"
    ADD CONSTRAINT "ClientPaymentService_pkey" PRIMARY KEY (id);


--
-- Name: ClientPayment ClientPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPayment"
    ADD CONSTRAINT "ClientPayment_pkey" PRIMARY KEY (id);


--
-- Name: ClientSession ClientSession_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientSession"
    ADD CONSTRAINT "ClientSession_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: CompanySettings CompanySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_pkey" PRIMARY KEY (id);


--
-- Name: ContactMessage ContactMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceAuditLog InvoiceAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailEvent MessagingEmailEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLink MessagingEmailLink_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmail MessagingEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_pkey" PRIMARY KEY ("userId");


--
-- Name: MessagingLocalAttachment MessagingLocalAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingLocalAttachment"
    ADD CONSTRAINT "MessagingLocalAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MessagingLocalMessage MessagingLocalMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingLocalMessage"
    ADD CONSTRAINT "MessagingLocalMessage_pkey" PRIMARY KEY (id);


--
-- Name: MessagingMailboxLocalSyncState MessagingMailboxLocalSyncState_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingMailboxLocalSyncState"
    ADD CONSTRAINT "MessagingMailboxLocalSyncState_pkey" PRIMARY KEY (id);


--
-- Name: MessagingSavedResponse MessagingSavedResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingSettings MessagingSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY (id);


--
-- Name: NumberingSequence NumberingSequence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: OrderPayment OrderPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PaymentService PaymentService_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PaymentService"
    ADD CONSTRAINT "PaymentService_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PdfTemplate PdfTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: QuoteLine QuoteLine_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_pkey" PRIMARY KEY (id);


--
-- Name: QuoteRequestAttachment QuoteRequestAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequestAttachment"
    ADD CONSTRAINT "QuoteRequestAttachment_pkey" PRIMARY KEY (id);


--
-- Name: QuoteRequest QuoteRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY (id);


--
-- Name: Quote Quote_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SpamDetectionLog SpamDetectionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_pkey" PRIMARY KEY (id);


--
-- Name: SpamSenderReputation SpamSenderReputation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebsiteConfig WebsiteConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY (id);


--
-- Name: WishlistItem WishlistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: AIAuditLog AIAuditLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AIConversation AIConversation_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIConversation"
    ADD CONSTRAINT "AIConversation_pkey" PRIMARY KEY (id);


--
-- Name: AIMessage AIMessage_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_pkey" PRIMARY KEY (id);


--
-- Name: AIPendingToolCall AIPendingToolCall_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_pkey" PRIMARY KEY (id);


--
-- Name: AIUsageStat AIUsageStat_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJobEvent BackgroundJobEvent_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_pkey" PRIMARY KEY (id);


--
-- Name: BackgroundJob BackgroundJob_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."BackgroundJob"
    ADD CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: CompanySettings CompanySettings_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceAuditLog InvoiceAuditLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailEvent MessagingEmailEvent_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailLink MessagingEmailLink_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_pkey" PRIMARY KEY (id);


--
-- Name: MessagingEmail MessagingEmail_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_pkey" PRIMARY KEY ("userId");


--
-- Name: MessagingSavedResponse MessagingSavedResponse_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_pkey" PRIMARY KEY (id);


--
-- Name: MessagingSettings MessagingSettings_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY (id);


--
-- Name: NumberingSequence NumberingSequence_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PdfTemplate PdfTemplate_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: QuoteLine QuoteLine_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_pkey" PRIMARY KEY (id);


--
-- Name: Quote Quote_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SpamDetectionLog SpamDetectionLog_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_pkey" PRIMARY KEY (id);


--
-- Name: SpamSenderReputation SpamSenderReputation_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebsiteConfig WebsiteConfig_pkey; Type: CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: AIAuditLog_conversationId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIAuditLog_conversationId_idx" ON public."AIAuditLog" USING btree ("conversationId");


--
-- Name: AIAuditLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIAuditLog_userId_createdAt_idx" ON public."AIAuditLog" USING btree ("userId", "createdAt");


--
-- Name: AIConversation_user_status_lastActivity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIConversation_user_status_lastActivity_idx" ON public."AIConversation" USING btree ("userId", status, "lastActivityAt" DESC);


--
-- Name: AIMessage_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON public."AIMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AIMessage_userId_role_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIMessage_userId_role_createdAt_idx" ON public."AIMessage" USING btree ("userId", role, "createdAt");


--
-- Name: AIPendingToolCall_conversationId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIPendingToolCall_conversationId_idx" ON public."AIPendingToolCall" USING btree ("conversationId");


--
-- Name: AIPendingToolCall_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIPendingToolCall_userId_createdAt_idx" ON public."AIPendingToolCall" USING btree ("userId", "createdAt");


--
-- Name: AIUsageStat_periodKey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AIUsageStat_periodKey_idx" ON public."AIUsageStat" USING btree ("periodKey");


--
-- Name: AIUsageStat_userId_periodKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AIUsageStat_userId_periodKey_key" ON public."AIUsageStat" USING btree ("userId", "periodKey");


--
-- Name: AccountInvitationPermission_invitationId_permission_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AccountInvitationPermission_invitationId_permission_key" ON public."AccountInvitationPermission" USING btree ("invitationId", permission);


--
-- Name: AccountInvitation_accountId_email_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AccountInvitation_accountId_email_status_idx" ON public."AccountInvitation" USING btree ("accountId", email, status);


--
-- Name: AccountInvitation_email_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AccountInvitation_email_status_idx" ON public."AccountInvitation" USING btree (email, status);


--
-- Name: AccountInvitation_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON public."AccountInvitation" USING btree ("tokenHash");


--
-- Name: AccountMembershipPermission_membershipId_permission_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AccountMembershipPermission_membershipId_permission_key" ON public."AccountMembershipPermission" USING btree ("membershipId", permission);


--
-- Name: AccountMembership_accountId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AccountMembership_accountId_userId_key" ON public."AccountMembership" USING btree ("accountId", "userId");


--
-- Name: AccountMembership_userId_accountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AccountMembership_userId_accountId_idx" ON public."AccountMembership" USING btree ("userId", "accountId");


--
-- Name: BackgroundJobEvent_jobId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BackgroundJobEvent_jobId_createdAt_idx" ON public."BackgroundJobEvent" USING btree ("jobId", "createdAt");


--
-- Name: BackgroundJob_runAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BackgroundJob_runAt_idx" ON public."BackgroundJob" USING btree ("runAt");


--
-- Name: BackgroundJob_status_runAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BackgroundJob_status_runAt_idx" ON public."BackgroundJob" USING btree (status, "runAt");


--
-- Name: BackgroundJob_type_dedupeKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON public."BackgroundJob" USING btree (type, "dedupeKey");


--
-- Name: ClientPaymentService_clientPaymentId_position_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPaymentService_clientPaymentId_position_idx" ON public."ClientPaymentService" USING btree ("clientPaymentId", "position");


--
-- Name: ClientPaymentService_clientServiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPaymentService_clientServiceId_idx" ON public."ClientPaymentService" USING btree ("clientServiceId");


--
-- Name: ClientPaymentService_detailsSnapshot_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPaymentService_detailsSnapshot_trgm_idx" ON public."ClientPaymentService" USING gin ("detailsSnapshot" public.gin_trgm_ops);


--
-- Name: ClientPaymentService_titleSnapshot_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPaymentService_titleSnapshot_trgm_idx" ON public."ClientPaymentService" USING gin ("titleSnapshot" public.gin_trgm_ops);


--
-- Name: ClientPayment_description_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_description_trgm_idx" ON public."ClientPayment" USING gin (description public.gin_trgm_ops);


--
-- Name: ClientPayment_method_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_method_trgm_idx" ON public."ClientPayment" USING gin (method public.gin_trgm_ops);


--
-- Name: ClientPayment_note_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_note_trgm_idx" ON public."ClientPayment" USING gin (note public.gin_trgm_ops);


--
-- Name: ClientPayment_receiptNumber_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_receiptNumber_trgm_idx" ON public."ClientPayment" USING gin ("receiptNumber" public.gin_trgm_ops);


--
-- Name: ClientPayment_reference_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_reference_trgm_idx" ON public."ClientPayment" USING gin (reference public.gin_trgm_ops);


--
-- Name: ClientPayment_userId_clientId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_userId_clientId_date_idx" ON public."ClientPayment" USING btree ("userId", "clientId", date);


--
-- Name: ClientPayment_userId_receiptIssuedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientPayment_userId_receiptIssuedAt_idx" ON public."ClientPayment" USING btree ("userId", "receiptIssuedAt");


--
-- Name: ClientPayment_userId_receiptNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientPayment_userId_receiptNumber_key" ON public."ClientPayment" USING btree ("userId", "receiptNumber");


--
-- Name: ClientSession_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ClientSession_clientId_idx" ON public."ClientSession" USING btree ("clientId");


--
-- Name: ClientSession_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientSession_tokenHash_key" ON public."ClientSession" USING btree ("tokenHash");


--
-- Name: Client_authUserId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_authUserId_idx" ON public."Client" USING btree ("authUserId");


--
-- Name: Client_companyName_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_companyName_trgm_idx" ON public."Client" USING gin ("companyName" public.gin_trgm_ops);


--
-- Name: Client_displayName_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_displayName_trgm_idx" ON public."Client" USING gin ("displayName" public.gin_trgm_ops);


--
-- Name: Client_email_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_email_trgm_idx" ON public."Client" USING gin (email public.gin_trgm_ops);


--
-- Name: Client_phone_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_phone_trgm_idx" ON public."Client" USING gin (phone public.gin_trgm_ops);


--
-- Name: Client_userId_authUserId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Client_userId_authUserId_key" ON public."Client" USING btree ("userId", "authUserId");


--
-- Name: Client_userId_displayName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_userId_displayName_idx" ON public."Client" USING btree ("userId", "displayName");


--
-- Name: Client_vatNumber_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Client_vatNumber_trgm_idx" ON public."Client" USING gin ("vatNumber" public.gin_trgm_ops);


--
-- Name: CompanySettings_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "CompanySettings_userId_key" ON public."CompanySettings" USING btree ("userId");


--
-- Name: ContactMessage_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ContactMessage_userId_createdAt_idx" ON public."ContactMessage" USING btree ("userId", "createdAt");


--
-- Name: ContactMessage_websiteId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ContactMessage_websiteId_createdAt_idx" ON public."ContactMessage" USING btree ("websiteId", "createdAt");


--
-- Name: EmailLog_userId_documentType_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "EmailLog_userId_documentType_idx" ON public."EmailLog" USING btree ("userId", "documentType");


--
-- Name: InvoiceAuditLog_userId_invoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON public."InvoiceAuditLog" USING btree ("userId", "invoiceId");


--
-- Name: Invoice_quoteId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_quoteId_key" ON public."Invoice" USING btree ("quoteId");


--
-- Name: Invoice_userId_clientId_issueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_userId_clientId_issueDate_idx" ON public."Invoice" USING btree ("userId", "clientId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_dueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_userId_dueDate_idx" ON public."Invoice" USING btree ("userId", "dueDate", id DESC);


--
-- Name: Invoice_userId_issueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_userId_issueDate_idx" ON public."Invoice" USING btree ("userId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_userId_number_key" ON public."Invoice" USING btree ("userId", number);


--
-- Name: Invoice_userId_status_issueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Invoice_userId_status_issueDate_idx" ON public."Invoice" USING btree ("userId", status, "issueDate" DESC, id DESC);


--
-- Name: MessagingAutoReplyLog_userId_senderEmail_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON public."MessagingAutoReplyLog" USING btree ("userId", "senderEmail");


--
-- Name: MessagingAutoReplyLog_userId_sentAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON public."MessagingAutoReplyLog" USING btree ("userId", "sentAt");


--
-- Name: MessagingEmailEvent_emailId_occurredAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON public."MessagingEmailEvent" USING btree ("emailId", "occurredAt");


--
-- Name: MessagingEmailEvent_linkRecipientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON public."MessagingEmailEvent" USING btree ("linkRecipientId");


--
-- Name: MessagingEmailEvent_recipientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON public."MessagingEmailEvent" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_linkId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON public."MessagingEmailLinkRecipient" USING btree ("linkId");


--
-- Name: MessagingEmailLinkRecipient_recipientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON public."MessagingEmailLinkRecipient" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON public."MessagingEmailLinkRecipient" USING btree (token);


--
-- Name: MessagingEmailLink_emailId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailLink_emailId_idx" ON public."MessagingEmailLink" USING btree ("emailId");


--
-- Name: MessagingEmailRecipient_emailId_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON public."MessagingEmailRecipient" USING btree ("emailId", address);


--
-- Name: MessagingEmailRecipient_openToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON public."MessagingEmailRecipient" USING btree ("openToken");


--
-- Name: MessagingEmail_userId_messageId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON public."MessagingEmail" USING btree ("userId", "messageId");


--
-- Name: MessagingEmail_userId_sentAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON public."MessagingEmail" USING btree ("userId", "sentAt");


--
-- Name: MessagingLocalAttachment_messageRecordId_attachmentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingLocalAttachment_messageRecordId_attachmentId_key" ON public."MessagingLocalAttachment" USING btree ("messageRecordId", "attachmentId");


--
-- Name: MessagingLocalAttachment_messageRecordId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalAttachment_messageRecordId_idx" ON public."MessagingLocalAttachment" USING btree ("messageRecordId");


--
-- Name: MessagingLocalMessage_fromAddress_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_fromAddress_trgm_idx" ON public."MessagingLocalMessage" USING gin ("fromAddress" public.gin_trgm_ops);


--
-- Name: MessagingLocalMessage_searchText_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_searchText_trgm_idx" ON public."MessagingLocalMessage" USING gin ("searchText" public.gin_trgm_ops);


--
-- Name: MessagingLocalMessage_subject_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_subject_trgm_idx" ON public."MessagingLocalMessage" USING gin (subject public.gin_trgm_ops);


--
-- Name: MessagingLocalMessage_userId_mailbox_internalDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_userId_mailbox_internalDate_idx" ON public."MessagingLocalMessage" USING btree ("userId", mailbox, "internalDate");


--
-- Name: MessagingLocalMessage_userId_mailbox_seen_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_userId_mailbox_seen_idx" ON public."MessagingLocalMessage" USING btree ("userId", mailbox, seen);


--
-- Name: MessagingLocalMessage_userId_mailbox_uidValidity_uid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingLocalMessage_userId_mailbox_uidValidity_uid_key" ON public."MessagingLocalMessage" USING btree ("userId", mailbox, "uidValidity", uid);


--
-- Name: MessagingLocalMessage_userId_messageId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingLocalMessage_userId_messageId_idx" ON public."MessagingLocalMessage" USING btree ("userId", "messageId");


--
-- Name: MessagingMailboxLocalSyncState_userId_mailbox_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingMailboxLocalSyncState_userId_mailbox_key" ON public."MessagingMailboxLocalSyncState" USING btree ("userId", mailbox);


--
-- Name: MessagingMailboxLocalSyncState_userId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingMailboxLocalSyncState_userId_status_idx" ON public."MessagingMailboxLocalSyncState" USING btree ("userId", status);


--
-- Name: MessagingSavedResponse_userId_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON public."MessagingSavedResponse" USING btree ("userId", slug);


--
-- Name: MessagingSavedResponse_userId_title_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON public."MessagingSavedResponse" USING btree ("userId", title);


--
-- Name: MessagingScheduledAttachment_scheduledEmailId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON public."MessagingScheduledAttachment" USING btree ("scheduledEmailId");


--
-- Name: MessagingScheduledEmail_status_sendAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON public."MessagingScheduledEmail" USING btree (status, "sendAt");


--
-- Name: MessagingScheduledEmail_userId_status_sendAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON public."MessagingScheduledEmail" USING btree ("userId", status, "sendAt");


--
-- Name: MessagingSettings_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON public."MessagingSettings" USING btree ("userId");


--
-- Name: NumberingSequence_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NumberingSequence_userId_idx" ON public."NumberingSequence" USING btree ("userId");


--
-- Name: NumberingSequence_userId_type_year_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON public."NumberingSequence" USING btree ("userId", type, year);


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: OrderPayment_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderPayment_orderId_idx" ON public."OrderPayment" USING btree ("orderId");


--
-- Name: OrderPayment_userId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderPayment_userId_status_idx" ON public."OrderPayment" USING btree ("userId", status);


--
-- Name: Order_invoiceId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Order_invoiceId_key" ON public."Order" USING btree ("invoiceId");


--
-- Name: Order_quoteId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Order_quoteId_key" ON public."Order" USING btree ("quoteId");


--
-- Name: Order_userId_orderNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_userId_orderNumber_idx" ON public."Order" USING btree ("userId", "orderNumber");


--
-- Name: Order_userId_orderNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Order_userId_orderNumber_key" ON public."Order" USING btree ("userId", "orderNumber");


--
-- Name: Order_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_userId_status_createdAt_idx" ON public."Order" USING btree ("userId", status, "createdAt");


--
-- Name: PaymentService_details_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_details_trgm_idx" ON public."PaymentService" USING gin (details public.gin_trgm_ops);


--
-- Name: PaymentService_notes_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_notes_trgm_idx" ON public."PaymentService" USING gin (notes public.gin_trgm_ops);


--
-- Name: PaymentService_privateNotes_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_privateNotes_trgm_idx" ON public."PaymentService" USING gin ("privateNotes" public.gin_trgm_ops);


--
-- Name: PaymentService_title_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_title_trgm_idx" ON public."PaymentService" USING gin (title public.gin_trgm_ops);


--
-- Name: PaymentService_userId_sourceClientId_updatedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_userId_sourceClientId_updatedAt_idx" ON public."PaymentService" USING btree ("userId", "sourceClientId", "updatedAt");


--
-- Name: PaymentService_userId_updatedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PaymentService_userId_updatedAt_idx" ON public."PaymentService" USING btree ("userId", "updatedAt");


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_userId_idx" ON public."Payment" USING btree ("userId");


--
-- Name: Product_category_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_category_trgm_idx" ON public."Product" USING gin (category public.gin_trgm_ops);


--
-- Name: Product_description_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_description_trgm_idx" ON public."Product" USING gin (description public.gin_trgm_ops);


--
-- Name: Product_name_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_name_trgm_idx" ON public."Product" USING gin (name public.gin_trgm_ops);


--
-- Name: Product_sku_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_sku_trgm_idx" ON public."Product" USING gin (sku public.gin_trgm_ops);


--
-- Name: Product_userId_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_userId_name_idx" ON public."Product" USING btree ("userId", name);


--
-- Name: Product_userId_publicSlug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Product_userId_publicSlug_key" ON public."Product" USING btree ("userId", "publicSlug");


--
-- Name: Product_userId_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Product_userId_sku_key" ON public."Product" USING btree ("userId", sku);


--
-- Name: QuoteRequestAttachment_quoteRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "QuoteRequestAttachment_quoteRequestId_idx" ON public."QuoteRequestAttachment" USING btree ("quoteRequestId");


--
-- Name: QuoteRequest_quoteId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "QuoteRequest_quoteId_key" ON public."QuoteRequest" USING btree ("quoteId");


--
-- Name: QuoteRequest_userId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "QuoteRequest_userId_status_createdAt_idx" ON public."QuoteRequest" USING btree ("userId", status, "createdAt");


--
-- Name: Quote_userId_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quote_userId_clientId_idx" ON public."Quote" USING btree ("userId", "clientId");


--
-- Name: Quote_userId_issueDate_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quote_userId_issueDate_id_idx" ON public."Quote" USING btree ("userId", "issueDate", id);


--
-- Name: Quote_userId_number_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quote_userId_number_idx" ON public."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Quote_userId_number_key" ON public."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_reference_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quote_userId_reference_idx" ON public."Quote" USING btree ("userId", reference);


--
-- Name: Quote_userId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Quote_userId_status_idx" ON public."Quote" USING btree ("userId", status);


--
-- Name: Session_activeTenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Session_activeTenantId_idx" ON public."Session" USING btree ("activeTenantId");


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: SpamDetectionLog_userId_mailbox_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON public."SpamDetectionLog" USING btree ("userId", mailbox);


--
-- Name: SpamSenderReputation_userId_domain_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON public."SpamSenderReputation" USING btree ("userId", domain);


--
-- Name: SpamSenderReputation_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SpamSenderReputation_userId_idx" ON public."SpamSenderReputation" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WebsiteConfig_customDomain_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON public."WebsiteConfig" USING btree ("customDomain");


--
-- Name: WebsiteConfig_domainVerificationCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON public."WebsiteConfig" USING btree ("domainVerificationCode");


--
-- Name: WebsiteConfig_previewToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON public."WebsiteConfig" USING btree ("previewToken");


--
-- Name: WebsiteConfig_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON public."WebsiteConfig" USING btree (slug);


--
-- Name: WebsiteConfig_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON public."WebsiteConfig" USING btree ("userId");


--
-- Name: WishlistItem_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WishlistItem_clientId_idx" ON public."WishlistItem" USING btree ("clientId");


--
-- Name: WishlistItem_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WishlistItem_productId_idx" ON public."WishlistItem" USING btree ("productId");


--
-- Name: WishlistItem_userId_clientId_productId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WishlistItem_userId_clientId_productId_key" ON public."WishlistItem" USING btree ("userId", "clientId", "productId");


--
-- Name: WishlistItem_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WishlistItem_userId_idx" ON public."WishlistItem" USING btree ("userId");


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: AIAuditLog_conversationId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIAuditLog_conversationId_idx" ON shadow."AIAuditLog" USING btree ("conversationId");


--
-- Name: AIAuditLog_userId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIAuditLog_userId_createdAt_idx" ON shadow."AIAuditLog" USING btree ("userId", "createdAt");


--
-- Name: AIConversation_user_status_lastActivity_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIConversation_user_status_lastActivity_idx" ON shadow."AIConversation" USING btree ("userId", status, "lastActivityAt" DESC);


--
-- Name: AIMessage_conversationId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON shadow."AIMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AIMessage_userId_role_createdAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIMessage_userId_role_createdAt_idx" ON shadow."AIMessage" USING btree ("userId", role, "createdAt");


--
-- Name: AIPendingToolCall_conversationId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIPendingToolCall_conversationId_idx" ON shadow."AIPendingToolCall" USING btree ("conversationId");


--
-- Name: AIPendingToolCall_userId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIPendingToolCall_userId_createdAt_idx" ON shadow."AIPendingToolCall" USING btree ("userId", "createdAt");


--
-- Name: AIUsageStat_periodKey_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "AIUsageStat_periodKey_idx" ON shadow."AIUsageStat" USING btree ("periodKey");


--
-- Name: AIUsageStat_userId_periodKey_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "AIUsageStat_userId_periodKey_key" ON shadow."AIUsageStat" USING btree ("userId", "periodKey");


--
-- Name: BackgroundJobEvent_jobId_createdAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "BackgroundJobEvent_jobId_createdAt_idx" ON shadow."BackgroundJobEvent" USING btree ("jobId", "createdAt");


--
-- Name: BackgroundJob_runAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "BackgroundJob_runAt_idx" ON shadow."BackgroundJob" USING btree ("runAt");


--
-- Name: BackgroundJob_status_runAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "BackgroundJob_status_runAt_idx" ON shadow."BackgroundJob" USING btree (status, "runAt");


--
-- Name: BackgroundJob_type_dedupeKey_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON shadow."BackgroundJob" USING btree (type, "dedupeKey");


--
-- Name: Client_userId_displayName_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Client_userId_displayName_idx" ON shadow."Client" USING btree ("userId", "displayName");


--
-- Name: CompanySettings_userId_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "CompanySettings_userId_key" ON shadow."CompanySettings" USING btree ("userId");


--
-- Name: EmailLog_userId_documentType_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "EmailLog_userId_documentType_idx" ON shadow."EmailLog" USING btree ("userId", "documentType");


--
-- Name: InvoiceAuditLog_userId_invoiceId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON shadow."InvoiceAuditLog" USING btree ("userId", "invoiceId");


--
-- Name: Invoice_quoteId_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_quoteId_key" ON shadow."Invoice" USING btree ("quoteId");


--
-- Name: Invoice_userId_clientId_issueDate_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Invoice_userId_clientId_issueDate_idx" ON shadow."Invoice" USING btree ("userId", "clientId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_dueDate_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Invoice_userId_dueDate_idx" ON shadow."Invoice" USING btree ("userId", "dueDate", id DESC);


--
-- Name: Invoice_userId_issueDate_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Invoice_userId_issueDate_idx" ON shadow."Invoice" USING btree ("userId", "issueDate" DESC, id DESC);


--
-- Name: Invoice_userId_number_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "Invoice_userId_number_key" ON shadow."Invoice" USING btree ("userId", number);


--
-- Name: Invoice_userId_status_issueDate_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Invoice_userId_status_issueDate_idx" ON shadow."Invoice" USING btree ("userId", status, "issueDate" DESC, id DESC);


--
-- Name: MessagingAutoReplyLog_userId_senderEmail_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON shadow."MessagingAutoReplyLog" USING btree ("userId", "senderEmail");


--
-- Name: MessagingAutoReplyLog_userId_sentAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON shadow."MessagingAutoReplyLog" USING btree ("userId", "sentAt");


--
-- Name: MessagingEmailEvent_emailId_occurredAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON shadow."MessagingEmailEvent" USING btree ("emailId", "occurredAt");


--
-- Name: MessagingEmailEvent_linkRecipientId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON shadow."MessagingEmailEvent" USING btree ("linkRecipientId");


--
-- Name: MessagingEmailEvent_recipientId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON shadow."MessagingEmailEvent" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_linkId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON shadow."MessagingEmailLinkRecipient" USING btree ("linkId");


--
-- Name: MessagingEmailLinkRecipient_recipientId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON shadow."MessagingEmailLinkRecipient" USING btree ("recipientId");


--
-- Name: MessagingEmailLinkRecipient_token_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON shadow."MessagingEmailLinkRecipient" USING btree (token);


--
-- Name: MessagingEmailLink_emailId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailLink_emailId_idx" ON shadow."MessagingEmailLink" USING btree ("emailId");


--
-- Name: MessagingEmailRecipient_emailId_address_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON shadow."MessagingEmailRecipient" USING btree ("emailId", address);


--
-- Name: MessagingEmailRecipient_openToken_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON shadow."MessagingEmailRecipient" USING btree ("openToken");


--
-- Name: MessagingEmail_userId_messageId_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON shadow."MessagingEmail" USING btree ("userId", "messageId");


--
-- Name: MessagingEmail_userId_sentAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON shadow."MessagingEmail" USING btree ("userId", "sentAt");


--
-- Name: MessagingSavedResponse_userId_slug_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON shadow."MessagingSavedResponse" USING btree ("userId", slug);


--
-- Name: MessagingSavedResponse_userId_title_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON shadow."MessagingSavedResponse" USING btree ("userId", title);


--
-- Name: MessagingScheduledAttachment_scheduledEmailId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON shadow."MessagingScheduledAttachment" USING btree ("scheduledEmailId");


--
-- Name: MessagingScheduledEmail_status_sendAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON shadow."MessagingScheduledEmail" USING btree (status, "sendAt");


--
-- Name: MessagingScheduledEmail_userId_status_sendAt_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON shadow."MessagingScheduledEmail" USING btree ("userId", status, "sendAt");


--
-- Name: MessagingSettings_userId_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON shadow."MessagingSettings" USING btree ("userId");


--
-- Name: NumberingSequence_userId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "NumberingSequence_userId_idx" ON shadow."NumberingSequence" USING btree ("userId");


--
-- Name: NumberingSequence_userId_type_year_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON shadow."NumberingSequence" USING btree ("userId", type, year);


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Payment_userId_idx" ON shadow."Payment" USING btree ("userId");


--
-- Name: Product_userId_name_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Product_userId_name_idx" ON shadow."Product" USING btree ("userId", name);


--
-- Name: Product_userId_sku_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "Product_userId_sku_key" ON shadow."Product" USING btree ("userId", sku);


--
-- Name: Quote_userId_clientId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Quote_userId_clientId_idx" ON shadow."Quote" USING btree ("userId", "clientId");


--
-- Name: Quote_userId_issueDate_id_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Quote_userId_issueDate_id_idx" ON shadow."Quote" USING btree ("userId", "issueDate", id);


--
-- Name: Quote_userId_number_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Quote_userId_number_idx" ON shadow."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_number_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "Quote_userId_number_key" ON shadow."Quote" USING btree ("userId", number);


--
-- Name: Quote_userId_reference_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Quote_userId_reference_idx" ON shadow."Quote" USING btree ("userId", reference);


--
-- Name: Quote_userId_status_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "Quote_userId_status_idx" ON shadow."Quote" USING btree ("userId", status);


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON shadow."Session" USING btree ("tokenHash");


--
-- Name: SpamDetectionLog_userId_mailbox_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON shadow."SpamDetectionLog" USING btree ("userId", mailbox);


--
-- Name: SpamSenderReputation_userId_domain_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON shadow."SpamSenderReputation" USING btree ("userId", domain);


--
-- Name: SpamSenderReputation_userId_idx; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE INDEX "SpamSenderReputation_userId_idx" ON shadow."SpamSenderReputation" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON shadow."User" USING btree (email);


--
-- Name: WebsiteConfig_customDomain_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON shadow."WebsiteConfig" USING btree ("customDomain");


--
-- Name: WebsiteConfig_domainVerificationCode_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON shadow."WebsiteConfig" USING btree ("domainVerificationCode");


--
-- Name: WebsiteConfig_previewToken_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON shadow."WebsiteConfig" USING btree ("previewToken");


--
-- Name: WebsiteConfig_slug_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON shadow."WebsiteConfig" USING btree (slug);


--
-- Name: WebsiteConfig_userId_key; Type: INDEX; Schema: shadow; Owner: postgres
--

CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON shadow."WebsiteConfig" USING btree ("userId");


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: AIAuditLog AIAuditLog_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AIAuditLog AIAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIConversation AIConversation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIConversation"
    ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIMessage"
    ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIUsageStat AIUsageStat_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountInvitationPermission AccountInvitationPermission_invitationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitationPermission"
    ADD CONSTRAINT "AccountInvitationPermission_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES public."AccountInvitation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountInvitation AccountInvitation_acceptedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitation"
    ADD CONSTRAINT "AccountInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AccountInvitation AccountInvitation_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitation"
    ADD CONSTRAINT "AccountInvitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountInvitation AccountInvitation_invitedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountInvitation"
    ADD CONSTRAINT "AccountInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountMembershipPermission AccountMembershipPermission_membershipId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountMembershipPermission"
    ADD CONSTRAINT "AccountMembershipPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES public."AccountMembership"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountMembership AccountMembership_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountMembership"
    ADD CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AccountMembership AccountMembership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountMembership"
    ADD CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Account Account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_id_fkey" FOREIGN KEY (id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BackgroundJobEvent BackgroundJobEvent_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."BackgroundJob"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientPaymentService ClientPaymentService_clientPaymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPaymentService"
    ADD CONSTRAINT "ClientPaymentService_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES public."ClientPayment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientPaymentService ClientPaymentService_clientServiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPaymentService"
    ADD CONSTRAINT "ClientPaymentService_clientServiceId_fkey" FOREIGN KEY ("clientServiceId") REFERENCES public."PaymentService"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ClientPayment ClientPayment_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPayment"
    ADD CONSTRAINT "ClientPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientPayment ClientPayment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPayment"
    ADD CONSTRAINT "ClientPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientSession ClientSession_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientSession"
    ADD CONSTRAINT "ClientSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanySettings CompanySettings_invoiceTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES public."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_quoteTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES public."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactMessage ContactMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactMessage ContactMessage_websiteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES public."WebsiteConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailLog EmailLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceAuditLog InvoiceAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkRecipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES public."MessagingEmailLinkRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_linkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES public."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLink MessagingEmailLink_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_emailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES public."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmail MessagingEmail_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingLocalAttachment MessagingLocalAttachment_messageRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingLocalAttachment"
    ADD CONSTRAINT "MessagingLocalAttachment_messageRecordId_fkey" FOREIGN KEY ("messageRecordId") REFERENCES public."MessagingLocalMessage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingLocalMessage MessagingLocalMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingLocalMessage"
    ADD CONSTRAINT "MessagingLocalMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingMailboxLocalSyncState MessagingMailboxLocalSyncState_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingMailboxLocalSyncState"
    ADD CONSTRAINT "MessagingMailboxLocalSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSavedResponse MessagingSavedResponse_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_scheduledEmailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES public."MessagingScheduledEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSettings MessagingSettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NumberingSequence NumberingSequence_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrderPayment OrderPayment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderPayment OrderPayment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentService PaymentService_sourceClientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PaymentService"
    ADD CONSTRAINT "PaymentService_sourceClientId_fkey" FOREIGN KEY ("sourceClientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentService PaymentService_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PaymentService"
    ADD CONSTRAINT "PaymentService_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteLine QuoteLine_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteLine QuoteLine_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteLine"
    ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteRequestAttachment QuoteRequestAttachment_quoteRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequestAttachment"
    ADD CONSTRAINT "QuoteRequestAttachment_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES public."QuoteRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteRequest QuoteRequest_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuoteRequest QuoteRequest_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteRequest QuoteRequest_quoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteRequest QuoteRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quote Quote_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quote Quote_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_activeTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamDetectionLog SpamDetectionLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamSenderReputation SpamSenderReputation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebsiteConfig WebsiteConfig_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIAuditLog AIAuditLog_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AIAuditLog AIAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIAuditLog"
    ADD CONSTRAINT "AIAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIConversation AIConversation_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIConversation"
    ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIMessage AIMessage_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIMessage"
    ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_conversationId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES shadow."AIConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIPendingToolCall AIPendingToolCall_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIPendingToolCall"
    ADD CONSTRAINT "AIPendingToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIUsageStat AIUsageStat_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."AIUsageStat"
    ADD CONSTRAINT "AIUsageStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BackgroundJobEvent BackgroundJobEvent_jobId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."BackgroundJobEvent"
    ADD CONSTRAINT "BackgroundJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES shadow."BackgroundJob"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Client"
    ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanySettings CompanySettings_invoiceTemplateId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES shadow."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_quoteTemplateId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES shadow."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanySettings CompanySettings_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."CompanySettings"
    ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailLog EmailLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."EmailLog"
    ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceAuditLog InvoiceAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."InvoiceAuditLog"
    ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES shadow."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLine InvoiceLine_productId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES shadow."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invoice Invoice_quoteId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES shadow."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Invoice"
    ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingAutoReplyLog MessagingAutoReplyLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingAutoReplyLog"
    ADD CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES shadow."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_linkRecipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES shadow."MessagingEmailLinkRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailEvent MessagingEmailEvent_recipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailEvent"
    ADD CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES shadow."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_linkId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES shadow."MessagingEmailLink"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLinkRecipient MessagingEmailLinkRecipient_recipientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailLinkRecipient"
    ADD CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES shadow."MessagingEmailRecipient"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailLink MessagingEmailLink_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailLink"
    ADD CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmailRecipient MessagingEmailRecipient_emailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmailRecipient"
    ADD CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES shadow."MessagingEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingEmail MessagingEmail_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingEmail"
    ADD CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingInboxSyncState MessagingInboxSyncState_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingInboxSyncState"
    ADD CONSTRAINT "MessagingInboxSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSavedResponse MessagingSavedResponse_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingSavedResponse"
    ADD CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledAttachment MessagingScheduledAttachment_scheduledEmailId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingScheduledAttachment"
    ADD CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES shadow."MessagingScheduledEmail"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingScheduledEmail MessagingScheduledEmail_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingScheduledEmail"
    ADD CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessagingSettings MessagingSettings_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."MessagingSettings"
    ADD CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NumberingSequence NumberingSequence_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."NumberingSequence"
    ADD CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES shadow."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Product"
    ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuoteLine QuoteLine_productId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES shadow."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuoteLine QuoteLine_quoteId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."QuoteLine"
    ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES shadow."Quote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quote Quote_clientId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES shadow."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Quote Quote_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Quote"
    ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamDetectionLog SpamDetectionLog_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamDetectionLog"
    ADD CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SpamSenderReputation SpamSenderReputation_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."SpamSenderReputation"
    ADD CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebsiteConfig WebsiteConfig_userId_fkey; Type: FK CONSTRAINT; Schema: shadow; Owner: postgres
--

ALTER TABLE ONLY shadow."WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES shadow."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO service_role;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO supabase_storage_admin;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA vault TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: postgres
--

GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.grant_pg_graphql_access() FROM postgres;
GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: postgres
--

GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgrst_ddl_watch() FROM postgres;
GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgrst_drop_watch() FROM postgres;
GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.set_graphql_placeholder() FROM postgres;
GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.flow_state TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.identities TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.instances TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.saml_providers TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.sessions TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.sso_domains TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.sso_providers TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT ON TABLE auth.users TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;
SET SESSION AUTHORIZATION postgres;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;
RESET SESSION AUTHORIZATION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

