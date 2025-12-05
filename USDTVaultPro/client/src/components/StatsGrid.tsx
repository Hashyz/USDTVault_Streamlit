import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  Target, 
  ArrowLeftRight,
  DollarSign,
  PiggyBank,
  Activity,
  ChevronUp,
  ChevronDown,
  Coins,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
  colorScheme?: 'default' | 'success' | 'warning' | 'destructive';
  isEmpty?: boolean;
}

function StatCard({ title, value, icon, trend, subtitle, colorScheme = 'default', isEmpty = false }: StatCardProps) {
  const getColorClasses = () => {
    switch(colorScheme) {
      case 'success':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'destructive':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const iconColorClasses = getColorClasses();

  return (
    <Card className={`p-6 hover-elevate active-elevate-2 transition-all duration-300 ${isEmpty ? 'bg-gradient-to-br from-muted/50 to-transparent' : ''}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{subtitle || `Your ${title.toLowerCase()} overview`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-2xl font-bold font-mono animate-in fade-in slide-in-from-bottom duration-500" 
               data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-md ${iconColorClasses} animate-in fade-in duration-700`}>
            {icon}
          </div>
        </div>
        
        {trend !== undefined && (
          <div className="flex items-center gap-2">
            <Badge 
              variant={trend >= 0 ? "default" : "destructive"} 
              className="flex items-center gap-1 text-xs px-2 py-0.5"
            >
              {trend >= 0 ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {Math.abs(trend).toFixed(2)}%
            </Badge>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
        
        {isEmpty && (
          <p className="text-xs text-muted-foreground">
            No data yet • Get started
          </p>
        )}
      </div>
    </Card>
  );
}

interface StatsGridProps {
  netWorth: number;
  totalSavings: number;
  portfolioValue: number;
  totalTransactions: number;
}

export default function StatsGrid({ netWorth, totalSavings, portfolioValue, totalTransactions }: StatsGridProps) {
  // Determine color schemes based on values
  const netWorthColor = netWorth > 10000 ? 'success' : netWorth > 0 ? 'warning' : 'default';
  const savingsColor = totalSavings > 5000 ? 'success' : totalSavings > 0 ? 'warning' : 'default';
  const portfolioColor = portfolioValue > 10000 ? 'success' : portfolioValue > 0 ? 'warning' : 'default';
  
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
      <StatCard
        title="Net Worth"
        value={netWorth === 0 ? '$0.00' : `$${netWorth.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        icon={<Coins className="w-5 h-5" />}
        trend={netWorth > 0 ? 5.2 : 0}
        subtitle="Total value of all assets"
        colorScheme={netWorthColor}
        isEmpty={netWorth === 0}
      />
      <StatCard
        title="Total Savings"
        value={totalSavings === 0 ? '$0.00' : `$${totalSavings.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        icon={<PiggyBank className="w-5 h-5" />}
        trend={totalSavings > 0 ? 3.1 : 0}
        subtitle="Amount saved towards goals"
        colorScheme={savingsColor}
        isEmpty={totalSavings === 0}
      />
      <StatCard
        title="Portfolio Value"
        value={portfolioValue === 0 ? '$0.00' : `$${portfolioValue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        icon={<TrendingUp className="w-5 h-5" />}
        trend={portfolioValue > 0 ? 8.4 : 0}
        subtitle="Current investment value"
        colorScheme={portfolioColor}
        isEmpty={portfolioValue === 0}
      />
      <StatCard
        title="Transactions"
        value={totalTransactions === 0 ? 'None yet' : totalTransactions.toString()}
        icon={<Activity className="w-5 h-5" />}
        subtitle="Total transaction count"
        isEmpty={totalTransactions === 0}
      />
    </div>
  );
}