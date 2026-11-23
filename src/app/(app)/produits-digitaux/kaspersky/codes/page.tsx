import { FamilyCodesPage } from "../../_components/family-codes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function KasperskyCodesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return <FamilyCodesPage familyId="kaspersky" searchParams={searchParams} />;
}
