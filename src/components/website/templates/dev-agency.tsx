import Image from "next/image";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type { CatalogPayload } from "@/server/website";
import { LeadCaptureForm } from "@/components/website/lead-form";
import { Button } from "@/components/ui/button";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

function formatPrice(
  amount: number,
  currencyCode: string,
  enabled: boolean,
) {
  if (!enabled) {
    return "Sur devis";
  }
  return formatCurrency(fromCents(amount, currencyCode), currencyCode);
}

export function DevAgencyTemplate({
  data,
  mode,
  path,
}: TemplateProps) {
  const { website, products } = data;
  const services =
    (products.featured.length ? products.featured : products.all).slice(
      0,
      4,
    );
  const projects = products.all.slice(0, 4);
  const logoSrc =
    website.contact.logoData != null
      ? `data:image/png;base64,${website.contact.logoData}`
      : website.contact.logoUrl;
  const aboutTitle =
    website.aboutTitle ?? "Équipe produit & tech engagée";
  const aboutBody =
    website.aboutBody ??
    "Nous aidons les entreprises ambitieuses à concevoir, développer et lancer des produits numériques fiables. Notre équipe combine expertise technique, product thinking et accompagnement de bout en bout.";

  return (
    <div className="min-h-screen bg-white text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      {mode === "preview" ? (
        <div className="bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
          Mode prévisualisation — aucune donnée n’est persistée.
        </div>
      ) : null}

      <header className="relative isolate overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-900 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="h-full w-full bg-[radial-gradient(circle,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[length:24px_24px]" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 sm:px-8 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              {logoSrc ? (
                <div className="relative h-6 w-6 overflow-hidden rounded-full bg-white/30">
                  <Image
                    src={logoSrc}
                    alt={website.contact.companyName}
                    fill
                    sizes="24px"
                  />
                </div>
              ) : null}
              <span>{website.heroEyebrow ?? "Agence digitale"}</span>
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-wider text-blue-200/80">
                {website.contact.companyName}
              </p>
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                {website.heroTitle}
              </h1>
              {website.heroSubtitle ? (
                <p className="text-lg text-zinc-200">
                  {website.heroSubtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-zinc-900 hover:bg-zinc-100">
                <a href="#contact">
                  {website.heroPrimaryCtaLabel ?? DEFAULT_PRIMARY_CTA_LABEL}
                </a>
              </Button>
              {website.heroSecondaryCtaLabel ? (
                <Button asChild variant="ghost" className="text-white hover:bg-white/10">
                  <a href={website.heroSecondaryCtaUrl ?? "#services"}>
                    {website.heroSecondaryCtaLabel}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex-1">
            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-200">
                Services clés
              </p>
              <ul className="mt-4 space-y-3 text-sm text-zinc-50">
                {services.slice(0, 3).map((service) => (
                  <li key={service.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                    {service.name}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl bg-black/30 px-4 py-3 text-sm text-zinc-200">
                <p className="font-semibold text-white">
                  +{products.all.length} projets livrés
                </p>
                <p>Accompagnement de la stratégie à la livraison.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-16 py-12">
        <section id="services" className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Services
              </p>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                Ce que nous réalisons
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Une offre structurée pour accélérer vos produits digitaux.
              </p>
            </div>
            <Button asChild variant="ghost">
              <a href="#contact">Parler à un expert</a>
            </Button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.id}
                className="group flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    {service.category ?? "Expertise"}
                  </p>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {service.name}
                  </h3>
                  {service.description ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      {service.description}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-300">
                  <span>{service.unit}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatPrice(
                      service.priceTTCCents,
                      website.currencyCode,
                      website.showPrices,
                    )}
                  </span>
                </div>
              </article>
            ))}
            {services.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Aucun service visible. Activez l’option “Catalogue public” dans vos produits pour alimenter cette section.
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Notre équipe
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                  {aboutTitle}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {aboutBody}
                </p>
                <dl className="grid gap-4 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
                  {website.contact.email ? (
                    <div>
                      <dt className="font-semibold text-zinc-900 dark:text-white">Email</dt>
                      <dd>{website.contact.email}</dd>
                    </div>
                  ) : null}
                  {website.contact.phone ? (
                    <div>
                      <dt className="font-semibold text-zinc-900 dark:text-white">Téléphone</dt>
                      <dd>{website.contact.phone}</dd>
                    </div>
                  ) : null}
                  {website.contact.address ? (
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-zinc-900 dark:text-white">
                        Adresse
                      </dt>
                      <dd>{website.contact.address}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 text-sm shadow-sm transition hover:border-blue-500 dark:border-zinc-700/80 dark:bg-zinc-900"
                  >
                    <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {project.category ?? "Projet"}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
                      {project.name}
                    </h3>
                    {project.description ? (
                      <p className="mt-2 line-clamp-3 text-xs text-zinc-600 dark:text-zinc-300">
                        {project.description}
                      </p>
                    ) : null}
                  </article>
                ))}
                {projects.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Ajoutez des produits pour afficher un portfolio de projets récents.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto w-full max-w-6xl px-6 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400">
                Contact
              </p>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                Parlez-nous de votre prochain sprint
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {website.contactBlurb ??
                  "Décrivez votre besoin (MVP, refonte, renfort squad…). Nous revenons vers vous sous 24h avec une proposition structurée."}
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="font-semibold text-zinc-900 dark:text-white">
                  Pourquoi nous choisir ?
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
                  <li>Squads seniors dédiés (design, dev, QA).</li>
                  <li>Workshops produit, roadmap et pilotage agile.</li>
                  <li>Qualité de livraison et accompagnement long terme.</li>
                </ul>
              </div>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <LeadCaptureForm
                slug={website.slug}
                mode={mode}
                thanksMessage={website.leadThanksMessage}
                spamProtectionEnabled={website.spamProtectionEnabled}
                path={path}
                className="space-y-4"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
