"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export function MonthlyRevenueChart({
  data,
}: {
  data: { month: string; invoiced: number; collected: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(v: number) => v.toLocaleString("en-US")} />
        <Legend />
        <Bar
          dataKey="invoiced"
          name="Invoiced"
          fill={COLORS[0]}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="collected"
          name="Collected"
          fill={COLORS[1]}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LoadsPerDayChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          name="Loads"
          stroke={COLORS[0]}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ExpensesByTypeChart({
  data,
}: {
  data: { type: string; amount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="type"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(d: { type: string; percent?: number }) =>
            `${d.type} ${((d.percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => v.toLocaleString("en-US")} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LoadsByStatusChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis dataKey="status" type="category" width={120} />
        <Tooltip />
        <Bar
          dataKey="count"
          name="Loads"
          fill={COLORS[4]}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FuelConsumptionChart({
  data,
}: {
  data: { month: string; liters: number; amount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" />
        <YAxis yAxisId="l" orientation="left" />
        <YAxis yAxisId="r" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="l"
          dataKey="liters"
          name="Liters"
          fill={COLORS[2]}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="r"
          dataKey="amount"
          name="Amount (USD)"
          fill={COLORS[3]}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
