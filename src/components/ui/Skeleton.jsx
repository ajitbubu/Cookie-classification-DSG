import './Skeleton.css';

// Content-shaped loading placeholders (decision 7A). Hidden from assistive
// tech; the container that shows them sets aria-busy.
export function KpiSkeleton() {
  return (
    <div className="ui-skeleton ui-skeleton--kpi" aria-hidden="true">
      <span className="ui-skeleton__bar ui-skeleton__bar--sm" />
      <span className="ui-skeleton__bar ui-skeleton__bar--lg" />
      <span className="ui-skeleton__bar ui-skeleton__bar--md" />
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="ui-skeleton ui-skeleton--chart" aria-hidden="true" />;
}

export function RowSkeleton({ columns = 4 }) {
  return (
    <tr className="ui-skeleton ui-skeleton--row" aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <td key={i}><span className="ui-skeleton__bar" /></td>
      ))}
    </tr>
  );
}
