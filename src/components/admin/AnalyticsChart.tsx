import { useState, type ReactNode } from 'react'
import { Table2, BarChart3 } from 'lucide-react'

/**
 * Chart frame with consistent theming: title, optional legend, and a
 * "table view" toggle so every value is reachable without hover or colour.
 * Palette validated with the dataviz checker (blue/orange: CVD ΔE 24.7).
 */
export const CHART_COLORS = {
  lost: '#2a78d6',
  found: '#eb6834',
  primary: '#2a78d6',
  grid: '#e8edf3',
  axis: '#64748b',
} as const

export const axisProps = {
  stroke: CHART_COLORS.axis,
  tick: { fill: CHART_COLORS.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART_COLORS.grid },
} as const

export function AnalyticsChart<Row extends Record<string, unknown>>({
  title,
  description,
  legend,
  rows,
  columns,
  children,
  height = 280,
}: {
  title: string
  description?: string
  legend?: { label: string; color: string; shape?: 'rect' | 'line' }[]
  rows: Row[]
  columns: { key: keyof Row; label: string }[]
  children: ReactNode
  height?: number
}) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className="card chart-card">
      <header className="row-between chart-header">
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            {title}
          </h3>
          {description && <p className="muted small">{description}</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
        >
          {showTable ? <BarChart3 size={14} /> : <Table2 size={14} />} {showTable ? 'Chart' : 'Table'}
        </button>
      </header>

      {legend && legend.length > 1 && (
        <ul className="chart-legend">
          {legend.map((item) => (
            <li key={item.label}>
              <span
                className={`legend-key ${item.shape === 'line' ? 'legend-line' : ''}`}
                style={{ background: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="muted small chart-empty">No data for this period yet.</p>
      ) : showTable ? (
        <div className="table-wrap chart-table">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={String(c.key)}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={String(c.key)}>{String(row[c.key] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ width: '100%', height }}>{children}</div>
      )}
    </section>
  )
}
