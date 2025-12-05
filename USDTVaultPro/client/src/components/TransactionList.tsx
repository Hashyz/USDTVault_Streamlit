import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpRight, 
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Send,
  Wallet,
  TrendingUp
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  address: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success border-success/30';
      case 'pending': return 'bg-warning/10 text-warning border-warning/30';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/30';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-3 h-3" />;
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'failed': return <XCircle className="w-3 h-3" />;
    }
  };

  const isEmpty = !transactions || transactions.length === 0;

  return (
    <Card className={`p-6 ${isEmpty ? 'bg-gradient-to-br from-muted/50 to-transparent' : ''}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
          </div>
          {!isEmpty && (
            <Badge variant="secondary" className="text-xs">
              {transactions.length} total
            </Badge>
          )}
        </div>
        
        {isEmpty ? (
          <div className="h-[400px] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
            <div className="p-4 bg-primary/5 rounded-full">
              <Activity className="w-12 h-12 text-primary/50" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="text-lg font-semibold">No transactions yet</h4>
              <p className="text-sm text-muted-foreground max-w-[300px]">
                Your transaction history will appear here once you start sending or receiving USDT
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                size="sm"
                className="bg-gradient-to-r from-primary to-primary/80"
                onClick={() => {
                  const event = new CustomEvent('open-send-modal');
                  window.dispatchEvent(event);
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                Send First
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const event = new CustomEvent('open-receive-modal');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Receive Funds
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <TrendingUp className="w-3 h-3" />
              Start building your transaction history
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate active-elevate-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom"
                  style={{ animationDelay: `${index * 50}ms` }}
                  data-testid={`transaction-${tx.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-md ${
                      tx.type === 'send' 
                        ? 'bg-gradient-to-br from-destructive/20 to-destructive/10' 
                        : 'bg-gradient-to-br from-success/20 to-success/10'
                    }`}>
                      {tx.type === 'send' ? (
                        <ArrowUpRight className="w-4 h-4 text-destructive" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-success" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{tx.type}</p>
                        <Badge 
                          variant="outline" 
                          className={`${getStatusColor(tx.status)} text-xs px-1.5 py-0 flex items-center gap-1`}
                        >
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono mt-1">
                        {truncateAddress(tx.address)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className={`font-bold font-mono text-lg ${
                      tx.type === 'send' ? 'text-destructive' : 'text-success'
                    }`}>
                      {tx.type === 'send' ? '-' : '+'}{tx.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">USDT</p>
                    <p className="text-xs text-muted-foreground">{tx.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
}