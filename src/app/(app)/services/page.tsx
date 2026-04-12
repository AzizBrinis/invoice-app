import Link from "next/link";
import { AccountPermission } from "@/lib/db/prisma";
import {
  hasAccountPermission,
  requireAppSectionAccess,
} from "@/lib/authorization";
import { getClient } from "@/server/clients";
import { listPaymentServicesPage } from "@/server/client-payments";
import { getSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { ServiceManagementPanel } from "@/app/(app)/services/_components/service-management-panel";

type SearchParams = Record<string, string | string[] | undefined>;
type ServicesPageProps = { searchParams?: Promise<SearchParams> };

function readSingleSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePageParam(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildServicesHref(filters: {
  search?: string | null;
  page?: number | null;
}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) {
    params.set("recherche", filters.search.trim());
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `/services?${query}` : "/services";
}

export default async function ServicesPage({
  searchParams,
}: ServicesPageProps) {
  const user = await requireAppSectionAccess("services", {
    redirectOnFailure: true,
  });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const search = readSingleSearchParam(resolvedSearchParams, "recherche") ?? "";
  const currentPage = parsePageParam(
    readSingleSearchParam(resolvedSearchParams, "page"),
  );
  const legacyClientId = readSingleSearchParam(resolvedSearchParams, "client");
  const successMessage = readSingleSearchParam(resolvedSearchParams, "message");
  const warningMessage = readSingleSearchParam(resolvedSearchParams, "warning");
  const errorMessage = readSingleSearchParam(resolvedSearchParams, "error");

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const [legacyClient, servicesPage, settings] = await Promise.all([
    legacyClientId ? getClient(legacyClientId, tenantId) : Promise.resolve(null),
    listPaymentServicesPage({ search, page: currentPage }, tenantId),
    getSettings(tenantId),
  ]);
  const canManageServices = hasAccountPermission(
    user,
    AccountPermission.SERVICES_MANAGE,
  );

  const redirectBase = buildServicesHref({
    search,
    page: servicesPage.page,
  });

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {errorMessage ? <Alert variant="error" title={errorMessage} /> : null}
      {successMessage ? <Alert variant="success" title={successMessage} /> : null}
      {warningMessage ? <Alert variant="warning" title={warningMessage} /> : null}

      {legacyClientId ? (
        <Alert
          variant="warning"
          title="Catalogue global des services"
          description={
            legacyClient
              ? `Le lien client ouvre maintenant le catalogue global. Les services ne sont plus geres depuis ${legacyClient.displayName}, mais depuis cette section commune a tout le compte.`
              : "Les services sont maintenant geres dans un catalogue global pour tout le compte."
          }
        />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Services
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Catalogue global des services reutilisables pour tous les clients du
            compte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/paiements">Voir les paiements</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/clients">Voir les clients</Link>
          </Button>
        </div>
      </div>

      <form className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="services-search" className="label">
            Recherche service
          </label>
          <Input
            id="services-search"
            name="recherche"
            type="search"
            defaultValue={search}
            placeholder="Nom, details, notes..."
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Rechercher</Button>
          {search || legacyClientId ? (
            <Button asChild variant="ghost">
              <Link href="/services">Reinitialiser</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <ServiceManagementPanel
        currency={settings.defaultCurrency}
        canManageServices={canManageServices}
        redirectBase={redirectBase}
        search={search}
        page={servicesPage.page}
        pageSize={servicesPage.pageSize}
        pageCount={servicesPage.pageCount}
        total={servicesPage.total}
        activeCount={servicesPage.activeCount}
        inactiveCount={servicesPage.inactiveCount}
        services={servicesPage.items}
      />
    </div>
  );
}
