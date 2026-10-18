import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import { formatMonthRu } from '../lib/dates.js'

interface SavedBarsProps {
  history: Array<{ from: string; to: string; income: number; expense: number; saved: number }>
}

export function SavedBars({ history }: SavedBarsProps) {
  const data = history.map((item) => ({
    month: formatMonthRu(item.from).split(' ')[0],
    saved: item.saved / 100,
  }))

  return (
    <div className="overflow-x-auto">
      <BarChart width={560} height={200} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fill: '#8B98A8', fontSize: 12 }}
          axisLine={{ stroke: '#232C37' }}
          tickLine={false}
        />
        <YAxis hide />
        <Bar dataKey="saved" radius={[6, 6, 0, 0]}>
          {data.map((item) => (
            <Cell key={item.month} fill={item.saved >= 0 ? '#34D399' : '#FB7185'} />
          ))}
        </Bar>
      </BarChart>
    </div>
  )
}
