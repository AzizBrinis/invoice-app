import { FamilyGeneratePage } from "../../_components/family-generate";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function KasperskyGeneratePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return <FamilyGeneratePage familyId="kaspersky" searchParams={searchParams} />;
}
