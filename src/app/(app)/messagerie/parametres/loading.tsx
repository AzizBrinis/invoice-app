import { Spinner } from "@/components/ui/spinner";

export default function ParametresLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner label="Chargement des paramètres..." />
    </div>
  );
}
