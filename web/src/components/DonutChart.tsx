import { Cell, Pie, PieChart } from 'recharts'

interface DonutChartProps {
  items: Array<{ id: number; name: string; color: string; amount: number }>
}

export function DonutChart({ items }: DonutChartProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div aria-hidden="true" className="flex justify-center">
      <PieChart width={220} height={220}>
        <Pie
          data={items}
          dataKey="amount"
          nameKey="name"
          innerRadius={62}
          outerRadius={100}
          paddingAngle={2}
          stroke="none"
        >
          {items.map((item) => (
            <Cell key={item.id} fill={item.color} />
          ))}
        </Pie>
      </PieChart>
    </div>
  )
}
