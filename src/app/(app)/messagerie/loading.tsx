import { Spinner } from "@/components/ui/spinner";

export default function MessagerieLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner label="Chargement..." />
    </div>
  );
}
