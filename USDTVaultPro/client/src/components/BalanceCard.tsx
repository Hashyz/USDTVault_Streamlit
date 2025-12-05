import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Sparkles,
  Rocket,
  ArrowRight,
  DollarSign,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BalanceCardProps {
  balance: number;
  change24h: number;
}

export default function BalanceCard({ balance, change24h }: BalanceCardProps) {
  const isPositive = change24h >= 0;
  const isEmpty = balance === 0;

  return (
    <Card className={`p-8 overflow-hidden relative ${isEmpty ? 'bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5' : 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent'} border-primary/20 hover-elevate transition-all duration-300`}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-10">
        <DollarSign className="w-32 h-32 text-primary" />
      </div>
      
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-md animate-in fade-in duration-500">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Balance</p>
              {isEmpty && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1 animate-in slide-in-from-left duration-500">
                  <Rocket className="w-3 h-3" />
                  Ready to start your crypto journey?
                </p>
              )}
            </div>
          </div>
          {!isEmpty && (
            <Badge 
              variant={isPositive ? "default" : "destructive"} 
              className="flex items-center gap-1 animate-in fade-in duration-500"
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span data-testid="text-change">
                {isPositive ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-3">
          <h2 className="text-5xl font-bold font-mono flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-700" data-testid="text-balance">
            {balance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            {isEmpty && <Sparkles className="w-8 h-8 text-primary animate-pulse" />}
          </h2>
          <span className="text-2xl text-muted-foreground font-medium">USDT</span>
        </div>

        {isEmpty ? (
          <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-bottom duration-700 delay-150">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
              Start by making your first deposit
            </p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-primary to-primary/80"
                onClick={() => {
                  const event = new CustomEvent('open-receive-modal');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Fund Wallet
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.location.href = '/savings-goals'}
              >
                <Target className="w-4 h-4 mr-2" />
                Set Goal
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">24h Change</p>
                <p className={`font-semibold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                  {isPositive ? '+' : ''}{(balance * change24h / 100).toFixed(2)} USDT
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Portfolio Health</p>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-sm font-medium text-success">Excellent</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}