import clsx from "clsx";

type InfoBlock = {
  title: string;
  badge?: string | null;
  lines: string[];
};

type InfoBlocksProps = {
  shipping: InfoBlock;
  payment: InfoBlock;
};

export function InfoBlocks({ shipping, payment }: InfoBlocksProps) {
  return (
    <div className="mt-8 grid gap-8 sm:grid-cols-2">
      <InfoCard block={shipping} />
      <InfoCard block={payment} />
    </div>
  );
}

function InfoCard({ block }: { block: InfoBlock }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {block.title}
      </p>
      <div className="space-y-2 text-sm text-slate-600">
        {block.badge ? (
          <span className="inline-flex w-fit items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {block.badge}
          </span>
        ) : null}
        {block.lines.map((line, index) => (
          <p
            key={`${block.title}-${index}-${line}`}
            className={clsx(index === 0 && !block.badge ? "font-semibold text-slate-900" : "")}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
