import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

const timeframes = ['7D', '1M', '3M', '1Y', 'All'] as const;

export default function BalanceChart() {
  const [timeframe, setTimeframe] = useState<typeof timeframes[number]>('1M');
  const { user } = useAuth();
  
  // Fetch transaction history
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['/api/transactions'],
    enabled: !!user,
  });

  const getDaysForTimeframe = (tf: typeof timeframes[number]) => {
    switch (tf) {
      case '7D': return 7;
      case '1M': return 30;
      case '3M': return 90;
      case '1Y': return 365;
      case 'All': return 730;
      default: return 30;
    }
  };

  // Process transaction data to create balance history
  const generateBalanceData = () => {
    const days = getDaysForTimeframe(timeframe);
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // If no transactions, show current balance as a flat line
    if (!transactions || transactions.length === 0) {
      const currentBalance = parseFloat(user?.balance || '0');
      const data = [];
      
      // Generate data points for the selected timeframe
      for (let i = 0; i <= Math.min(days, 30); i += Math.max(1, Math.floor(days / 30))) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          balance: currentBalance,
        });
      }
      
      // Add current date with current balance
      data.push({
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: currentBalance,
      });
      
      return data;
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime()
    );

    // Calculate balance at each point
    let currentBalance = parseFloat(user?.balance || '0');
    const balanceHistory: { date: Date; balance: number }[] = [];

    // Work backwards from current balance
    for (let i = sortedTransactions.length - 1; i >= 0; i--) {
      const tx = sortedTransactions[i];
      const txDate = new Date(tx.createdAt || tx.timestamp);
      
      // Only include transactions within the timeframe
      if (txDate >= startDate) {
        balanceHistory.unshift({
          date: txDate,
          balance: currentBalance,
        });

        // Adjust balance based on transaction
        if (tx.type === 'receive' || tx.type === 'deposit') {
          currentBalance -= parseFloat(tx.amount);
        } else if (tx.type === 'send' || tx.type === 'withdraw') {
          currentBalance += parseFloat(tx.amount);
        }
      }
    }

    // Add starting balance
    if (balanceHistory.length > 0) {
      balanceHistory.unshift({
        date: startDate,
        balance: currentBalance,
      });
    }

    // Add current balance at the end
    balanceHistory.push({
      date: now,
      balance: parseFloat(user?.balance || '0'),
    });

    // If we have very few data points, interpolate for better visualization
    if (balanceHistory.length < 5) {
      const interpolatedData = [];
      const pointsToGenerate = Math.min(30, days);
      
      for (let i = 0; i <= pointsToGenerate; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (i * days / pointsToGenerate));
        
        // Find the closest balance point
        let balance = currentBalance;
        for (const point of balanceHistory) {
          if (point.date <= date) {
            balance = point.balance;
          } else {
            break;
          }
        }
        
        interpolatedData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          balance: balance,
        });
      }
      
      return interpolatedData;
    }

    // Convert to chart format
    return balanceHistory.map(item => ({
      date: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: item.balance,
    }));
  };

  const data = generateBalanceData();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-1">
              {timeframes.map((tf) => (
                <Skeleton key={tf} className="h-8 w-12" />
              ))}
            </div>
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Balance Overview</h3>
          <div className="flex gap-1">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(tf)}
                data-testid={`button-timeframe-${tf.toLowerCase()}`}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `$${(value / 1000).toFixed(1)}k`;
                  }
                  return `$${value.toFixed(0)}`;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#colorBalance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {data.length <= 2 && (
          <p className="text-xs text-muted-foreground text-center">
            Balance history will appear here as you make transactions
          </p>
        )}
      </div>
    </Card>
  );
}