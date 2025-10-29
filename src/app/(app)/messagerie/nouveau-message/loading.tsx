import { Spinner } from "@/components/ui/spinner";

export default function NouveauMessageLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner label="Chargement du composeur..." />
    </div>
  );
}
