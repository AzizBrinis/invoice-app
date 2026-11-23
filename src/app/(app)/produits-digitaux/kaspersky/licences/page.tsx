import { FamilyHistoryPage } from "../../_components/family-history";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function KasperskyHistoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return <FamilyHistoryPage familyId="kaspersky" searchParams={searchParams} />;
}
