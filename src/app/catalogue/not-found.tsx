export default function CatalogueNotFound() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm font-semibold uppercase text-slate-500">
          Site indisponible
        </p>
        <h1 className="text-3xl font-semibold">
          Ce site public n’est pas encore disponible.
        </h1>
        <p className="text-base leading-7 text-slate-600">
          Le domaine n’est pas lié à un site actif, ou la publication n’est pas
          terminée. Vérifiez le domaine configuré dans l’espace d’administration
          puis relancez la vérification si nécessaire.
        </p>
      </div>
    </main>
  );
}
