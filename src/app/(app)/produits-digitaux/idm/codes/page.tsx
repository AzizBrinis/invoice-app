import { FamilyCodesPage } from "../../_components/family-codes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function IdmCodesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return <FamilyCodesPage familyId="idm" searchParams={searchParams} />;
}
