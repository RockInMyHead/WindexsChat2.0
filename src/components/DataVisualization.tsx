import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ChartData {
  name: string;
  value?: number;
  [key: string]: any;
}

export interface VisualizationConfig {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartData[];
  title: string;
  xAxisKey?: string;
  yAxisKey?: string;
  colors?: string[];
  width?: number;
  height?: number;
}

interface DataVisualizationProps {
  config: VisualizationConfig;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

const DataVisualization: React.FC<DataVisualizationProps> = ({ config }) => {
  const {
    type,
    data,
    title,
    xAxisKey = 'name',
    yAxisKey = 'value',
    colors = COLORS,
    width = 500,
    height = 300,
  } = config;

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey={yAxisKey}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0] }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxisKey} fill={colors[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yAxisKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey={yAxisKey}
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Неподдерживаемый тип графика: {type}</div>;
    }
  };

  return (
    <Card className="my-4 border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

// Функция для парсинга конфигурации визуализации из текста
export const parseVisualizationConfig = (text: string): VisualizationConfig | null => {
  try {
    // Ищем ВСЕ JSON конфигурации в тексте и берем ПОСЛЕДНЮЮ (обычно самая актуальная)
    const jsonMatches = Array.from(text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g));

    if (jsonMatches.length > 0) {
      // Берем последний найденный JSON блок
      const lastMatch = jsonMatches[jsonMatches.length - 1];
      const config = JSON.parse(lastMatch[1]);

      // Валидация конфигурации
      if (
        config.type &&
        ['line', 'bar', 'pie', 'area'].includes(config.type) &&
        Array.isArray(config.data) &&
        config.title
      ) {
        return config as VisualizationConfig;
      }
    }

    // Альтернативный формат: поиск ключевых слов
    const typeMatch = text.match(/(?:тип|type):\s*(line|bar|pie|area)/i);
    const titleMatch = text.match(/(?:заголовок|title):\s*([^\n]+)/i);

    if (typeMatch && titleMatch) {
      const type = typeMatch[1].toLowerCase() as VisualizationConfig['type'];
      const title = titleMatch[1].trim();

      // Пытаемся извлечь данные из текста (упрощенная логика)
      const dataSection = text.split('данные:')[1] || text.split('data:')[1] || '';

      // Это будет нужно доработать для полноценного парсинга
      return {
        type,
        title,
        data: [],
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing visualization config:', error);
    return null;
  }
};

// Функция для генерации примерных данных
export const generateSampleData = (type: string): ChartData[] => {
  switch (type) {
    case 'sales':
      return [
        { name: 'Янв', value: 4000 },
        { name: 'Фев', value: 3000 },
        { name: 'Мар', value: 5000 },
        { name: 'Апр', value: 4500 },
        { name: 'Май', value: 6000 },
        { name: 'Июн', value: 5500 },
      ];

    case 'categories':
      return [
        { name: 'Электроника', value: 35 },
        { name: 'Одежда', value: 25 },
        { name: 'Книги', value: 15 },
        { name: 'Спорт', value: 15 },
        { name: 'Другое', value: 10 },
      ];

    case 'growth':
      return [
        { name: '2020', value: 100 },
        { name: '2021', value: 120 },
        { name: '2022', value: 150 },
        { name: '2023', value: 180 },
        { name: '2025', value: 220 },
      ];

    default:
      return [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 15 },
        { name: 'D', value: 25 },
      ];
  }
};

export default DataVisualization;
