import { FamilyLicenceDetailPage } from "../../../_components/family-licence-detail";

export const dynamic = "force-dynamic";

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

export default function KasperskyLicenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  return <FamilyLicenceDetailPage familyId="kaspersky" params={params} searchParams={searchParams} />;
}
