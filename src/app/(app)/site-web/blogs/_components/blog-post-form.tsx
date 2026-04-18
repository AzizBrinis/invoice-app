import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BlogPostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  redirectTo?: string;
  defaultValues: {
    title: string;
    slug: string;
    excerpt: string;
    bodyHtml: string;
    coverImageUrl: string;
    socialImageUrl: string;
    category: string;
    tags: string;
    authorName: string;
    status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
    publishDate: string;
    featured: boolean;
    metaTitle: string;
    metaDescription: string;
  };
};

export function BlogPostForm({
  action,
  submitLabel,
  redirectTo,
  defaultValues,
}: BlogPostFormProps) {
  return (
    <form action={action} className="space-y-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <section className="card space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Publication
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Définissez le positionnement public, la date de diffusion et les métadonnées principales.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="blog-title" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Titre
            </label>
            <Input
              id="blog-title"
              name="title"
              required
              defaultValue={defaultValues.title}
              placeholder="Ex. Comment structurer un blog e-commerce efficace"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-slug" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Slug
            </label>
            <Input
              id="blog-slug"
              name="slug"
              defaultValue={defaultValues.slug}
              placeholder="laissez vide pour générer automatiquement"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-status" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Statut
            </label>
            <select
              id="blog-status"
              name="status"
              defaultValue={defaultValues.status}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="SCHEDULED">Programmé</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-publish-date" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Date de publication
            </label>
            <Input
              id="blog-publish-date"
              name="publishDate"
              type="date"
              defaultValue={defaultValues.publishDate}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-author" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Auteur affiché
            </label>
            <Input
              id="blog-author"
              name="authorName"
              required
              defaultValue={defaultValues.authorName}
              placeholder="Nom affiché sur le blog"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-category" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Catégorie
            </label>
            <Input
              id="blog-category"
              name="category"
              defaultValue={defaultValues.category}
              placeholder="Guides, Actualités, Tendances..."
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="blog-tags" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Tags
            </label>
            <Input
              id="blog-tags"
              name="tags"
              defaultValue={defaultValues.tags}
              placeholder="seo, contenu, catalogue"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Séparez les tags par des virgules ou des retours à la ligne.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          <input
            type="checkbox"
            name="featured"
            value="true"
            defaultChecked={defaultValues.featured}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Mettre cet article en avant dans le blog public</span>
        </label>
      </section>

      <section className="card space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Média et SEO
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Définissez le visuel principal et les métadonnées sociales pour le partage.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="blog-cover-url" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              URL de l&apos;image de couverture
            </label>
            <Input
              id="blog-cover-url"
              name="coverImageUrl"
              defaultValue={defaultValues.coverImageUrl}
              placeholder="https://... ou /uploads/... ou data:image/..."
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="blog-cover-file" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Importer une image de couverture
            </label>
            <Input
              id="blog-cover-file"
              name="coverImageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Le fichier importé remplace l&apos;URL de couverture pour cet enregistrement.
            </p>
          </div>
          {defaultValues.coverImageUrl ? (
            <div className="space-y-2 lg:col-span-2">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Aperçu couverture
              </p>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={defaultValues.coverImageUrl}
                  alt={defaultValues.title || "Couverture du blog"}
                  className="h-56 w-full object-cover"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            <label htmlFor="blog-social-image" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Image Open Graph / sociale
            </label>
            <Input
              id="blog-social-image"
              name="socialImageUrl"
              defaultValue={defaultValues.socialImageUrl}
              placeholder="Laissez vide pour réutiliser la couverture"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="blog-meta-title" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Meta title
            </label>
            <Input
              id="blog-meta-title"
              name="metaTitle"
              defaultValue={defaultValues.metaTitle}
              placeholder="Titre SEO (160 caractères max)"
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="blog-meta-description" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Meta description
            </label>
            <Textarea
              id="blog-meta-description"
              name="metaDescription"
              defaultValue={defaultValues.metaDescription}
              rows={4}
              placeholder="Résumé SEO (260 caractères max)"
            />
          </div>
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Contenu
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Saisissez un résumé éditorial et le corps HTML sécurisé de l&apos;article. Les balises principales (`p`, `h2-h6`, `ul`, `ol`, `img`, `blockquote`, `table`, `a`) sont conservées.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="blog-excerpt" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Extrait / résumé
          </label>
          <Textarea
            id="blog-excerpt"
            name="excerpt"
            defaultValue={defaultValues.excerpt}
            rows={4}
            placeholder="Résumé court utilisé dans les listes et le SEO si besoin"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="blog-body" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Corps HTML
          </label>
          <Textarea
            id="blog-body"
            name="bodyHtml"
            required
            defaultValue={defaultValues.bodyHtml}
            rows={22}
            placeholder="<p>Votre contenu HTML sécurisé...</p>"
            className="min-h-[28rem] font-mono text-xs leading-6"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          L&apos;article sera publié dans le template Ciseco aux routes `/blog` et `/blog/[slug]`.
        </p>
        <FormSubmitButton>{submitLabel}</FormSubmitButton>
      </div>
    </form>
  );
}
