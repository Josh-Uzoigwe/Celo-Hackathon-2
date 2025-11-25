import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, 
  CartesianGrid, ComposedChart, Bar
} from 'recharts';
import { PricePoint } from '../types';

interface PriceChartProps {
  data: PricePoint[];
  color: string;
  currentPrice: number;
  mode: 'line' | 'candle';
  theme: 'dark' | 'light';
}

// Helper: Smart formatting for crypto prices based on magnitude
const formatSmartPrice = (price: number) => {
  if (price === 0) return '0';
  const absPrice = Math.abs(price);

  if (absPrice < 0.000001) return price.toFixed(9); // For extremely small caps
  if (absPrice < 0.001) return price.toFixed(7);    // For meme coins
  if (absPrice < 1) return price.toFixed(5);        // For penny coins
  if (absPrice < 10) return price.toFixed(4);       // For stablecoins/low caps
  if (absPrice < 1000) return price.toFixed(2);     // For mid caps
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 }); // For BTC/ETH
};

// Helper to aggregate simple price points into OHLC Candles
const aggregateCandles = (data: PricePoint[], intervalPoints: number = 5) => {
  const candles = [];
  // Ensure we have enough data points to form candles
  const safeInterval = Math.max(1, intervalPoints);
  
  for (let i = 0; i < data.length; i += safeInterval) {
    const chunk = data.slice(i, i + safeInterval);
    if (chunk.length === 0) continue;
    
    const prices = chunk.map(d => d.price);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const timestamp = chunk[chunk.length - 1].timestamp;

    candles.push({
      timestamp,
      open,
      close,
      high,
      low,
    });
  }
  return candles;
};

// Custom SVG Shape for TradingView-style Candlesticks
const CandlestickShape = (props: any) => {
  const {
    x,
    y,
    width,
    height,
    payload
  } = props;
  
  const { open, close, high, low } = payload;
  const isGrowing = close >= open;
  const color = isGrowing ? '#10b981' : '#f43f5e'; // Emerald-500 : Rose-500
  
  // Recharts passes 'y' as the top coordinate of the bar (which corresponds to 'high')
  // and 'height' as the total height (high - low).
  
  const range = high - low;
  // Prevent division by zero if flat
  const safeRange = range === 0 ? 0.0001 : range;
  const ratio = height / safeRange;
  
  // Calculate relative positions from the top (high)
  const openOffset = (high - open) * ratio;
  const closeOffset = (high - close) * ratio;
  
  const bodyTop = Math.min(openOffset, closeOffset);
  const bodyHeight = Math.max(2, Math.abs(openOffset - closeOffset)); // Min 2px height for visibility

  // Center the wick
  const wickX = x + width / 2;

  return (
    <g>
      {/* Wick: Central line from High to Low */}
      <line 
        x1={wickX} 
        y1={y} 
        x2={wickX} 
        y2={y + height} 
        stroke={color} 
        strokeWidth={1.5} 
      />
      {/* Body: Rectangle from Open to Close */}
      <rect 
        x={x} 
        y={y + bodyTop} 
        width={width} 
        height={bodyHeight} 
        fill={color} 
        stroke={color}
        strokeWidth={0} 
        rx={1}
      />
    </g>
  );
};

export const PriceChart: React.FC<PriceChartProps> = ({ data, color, currentPrice, mode, theme }) => {
  const isDark = theme === 'dark';
  
  // Aggregate data if in candle mode
  const chartData = useMemo(() => {
    if (mode === 'candle') {
      // Group more points to make each candle represent more 'action'
      // If we have lots of data, group by 8s, otherwise 4s
      const interval = data.length > 80 ? 8 : 4;
      return aggregateCandles(data, interval);
    }
    return data;
  }, [data, mode]);

  const yAxisDomain = useMemo(() => {
    const prices = data.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    // Add buffer to prevent flat line look or 0-range errors
    let padding;
    if (min === max) {
       // If flat, create artificial range around the price
       padding = min === 0 ? 1 : min * 0.005; // 0.5% buffer
    } else {
       // Tighter padding to make candles look taller (10% instead of 15%)
       padding = (max - min) * 0.10; 
    }
    
    return [min - padding, max + padding];
  }, [data]);

  // Styling Constants
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "#475569" : "#cbd5e1";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const timeStr = new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      return (
        <div style={{ 
          backgroundColor: tooltipBg, 
          borderColor: tooltipBorder, 
          borderWidth: 1, 
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          minWidth: '160px'
        }}>
          <p style={{ color: axisColor, fontSize: '11px', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>
            {timeStr}
          </p>
          {mode === 'candle' ? (
             <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
                  <span className="text-slate-500">O</span>
                  <span className={isDark ? "text-slate-200 text-right" : "text-slate-900 text-right"}>{formatSmartPrice(d.open)}</span>
                  
                  <span className="text-slate-500">H</span>
                  <span className="text-emerald-500 text-right">{formatSmartPrice(d.high)}</span>
                  
                  <span className="text-slate-500">L</span>
                  <span className="text-rose-500 text-right">{formatSmartPrice(d.low)}</span>
                  
                  <span className="text-slate-500">C</span>
                  <span className={isDark ? "text-slate-200 text-right" : "text-slate-900 text-right"}>{formatSmartPrice(d.close)}</span>
                </div>
                {/* Volatility Indicator */}
                <div className={`text-[10px] text-center mt-1 py-0.5 rounded ${d.close >= d.open ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {d.close >= d.open ? 'BULLISH' : 'BEARISH'}
                </div>
             </div>
          ) : (
             <div className="flex flex-col gap-1">
               <span className="text-xs text-slate-500 uppercase tracking-wider">Price</span>
               <span style={{ color: isDark ? '#fff' : '#0f172a', fontSize: '16px', fontWeight: 'bold' }}>
                 ${formatSmartPrice(d.price)}
               </span>
             </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full h-[380px] mt-4 rounded-xl overflow-hidden transition-all duration-300`}>
      <ResponsiveContainer width="100%" height="100%">
        {mode === 'candle' ? (
          <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.3} />
            <XAxis dataKey="timestamp" hide />
            <YAxis 
              domain={yAxisDomain} 
              orientation="right" 
              tick={{ fill: axisColor, fontSize: 11, fontFamily: 'monospace' }} 
              axisLine={false}
              tickLine={false}
              width={75}
              tickFormatter={(val) => formatSmartPrice(val)}
            />
            {/* Tooltip needs cursor true for better hover interaction on bars */}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? '#334155' : '#cbd5e1', opacity: 0.1 }} />
            
            <Bar 
              dataKey={(d) => [d.low, d.high]} 
              shape={<CandlestickShape />}
              barSize={20} // Wider candles
              isAnimationActive={false}
            />
            
            <ReferenceLine 
              y={currentPrice} 
              stroke={isDark ? "#ffffff" : "#000000"} 
              strokeDasharray="3 3" 
              opacity={0.4} 
              label={{ 
                position: 'right', 
                value: formatSmartPrice(currentPrice), 
                fill: isDark ? '#fff' : '#000', 
                fontSize: 10,
                offset: 5,
                opacity: 0.8
              }}
            />
          </ComposedChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.3} />
            <XAxis dataKey="timestamp" hide />
            <YAxis 
              domain={yAxisDomain} 
              orientation="right" 
              tick={{ fill: axisColor, fontSize: 11, fontFamily: 'monospace' }} 
              axisLine={false}
              tickLine={false}
              width={75}
              tickFormatter={(val) => formatSmartPrice(val)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: axisColor, strokeDasharray: '3 3', opacity: 0.5 }} />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke={color} 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              isAnimationActive={false}
            />
            <ReferenceLine 
              y={currentPrice} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              strokeWidth={1} 
            >
            </ReferenceLine>
            {/* Floating Price Tag */}
            <ReferenceLine 
              y={currentPrice} 
              label={({ viewBox }) => {
                const { x, y } = viewBox;
                // Avoid rendering label if Y is out of bounds (can happen during init)
                if (y < 0 || y > 500) return null;
                
                return (
                  <g transform={`translate(${x + 20}, ${y})`}>
                    <rect x={0} y={-10} width={70} height={20} fill="#10b981" rx={4} />
                    <text x={35} y={4} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">
                      {formatSmartPrice(currentPrice)}
                    </text>
                    <circle cx={-5} cy={0} r={3} fill="#10b981">
                      <animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                );
              }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};