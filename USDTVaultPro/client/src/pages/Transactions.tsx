import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpRight, ArrowDownLeft, Search, Clock, ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch real blockchain transactions from BSCScan
  const { data: blockchainTransactions = [], isLoading: blockchainLoading } = useQuery<any[]>({
    queryKey: ['/api/blockchain/transactions'],
  });

  // Also fetch stored transactions
  const { data: storedTransactions = [], isLoading: storedLoading } = useQuery<any[]>({
    queryKey: ['/api/transactions'],
  });

  // Combine both sources of transactions
  const transactions = [...blockchainTransactions, ...storedTransactions];
  const isLoading = blockchainLoading || storedLoading;

  const filteredTransactions = transactions.filter((tx: any) => {
    const matchesSearch = tx.destinationAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.sourceAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.transactionHash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.amount.toString().includes(searchTerm);
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Transaction History</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">View all your USDT transactions and transfers</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search address or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            data-testid="input-search-transactions"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-transaction-type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="send">Sent</SelectItem>
            <SelectItem value="receive">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTransactions.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
            <p className="text-base sm:text-lg font-medium mb-2">No transactions found</p>
            <p className="text-sm sm:text-base text-muted-foreground text-center">
              {searchTerm || typeFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Your transaction history will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop view */}
          <Card className="hidden sm:block">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Recent Transactions</CardTitle>
              <CardDescription className="text-sm">{filteredTransactions.length} transaction(s) found</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredTransactions.map((tx: any) => (
                  <div key={tx.id} className="p-4 sm:p-6 hover-elevate" data-testid={`transaction-${tx.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          tx.type === 'send' 
                            ? 'bg-red-100 dark:bg-red-900/20' 
                            : 'bg-green-100 dark:bg-green-900/20'
                        }`}>
                          {tx.type === 'send' ? (
                            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-medium">
                            {tx.type === 'send' ? 'Sent to' : 'Received from'}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                            {tx.destinationAddress || tx.sourceAddress || 'Unknown'}
                          </p>
                          {tx.transactionHash && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted-foreground">Hash:</span>
                              <span className="text-xs font-mono">
                                {tx.transactionHash.slice(0, 8)}...{tx.transactionHash.slice(-6)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-base sm:text-lg ${
                          tx.type === 'send' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {tx.type === 'send' ? '-' : '+'}{parseFloat(tx.amount).toLocaleString()} {tx.currency || 'USDT'}
                        </p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            data-testid={`badge-type-${tx.id}`}
                          >
                            {tx.transactionHash ? (
                              <>
                                <Link2 className="w-3 h-3 mr-1" />
                                On-chain
                              </>
                            ) : (
                              'Off-chain'
                            )}
                          </Badge>
                          <Badge variant={
                            tx.status === 'completed' || tx.status === 'success' ? 'default' : 
                            tx.status === 'pending' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {tx.status}
                          </Badge>
                          {tx.transactionHash && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => window.open(`https://bscscan.com/tx/${tx.transactionHash}`, '_blank')}
                              data-testid={`button-bscscan-${tx.id}`}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {tx.timestamp ? format(new Date(tx.timestamp), 'MMM d, HH:mm') : 
                             tx.createdAt ? format(new Date(tx.createdAt), 'MMM d, HH:mm') : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mobile view - Card format */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold">Recent Transactions</h3>
              <Badge variant="secondary" className="text-xs">{filteredTransactions.length} found</Badge>
            </div>
            {filteredTransactions.map((tx: any) => (
              <Card key={tx.id} className="p-4" data-testid={`transaction-mobile-${tx.id}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-full ${
                        tx.type === 'send' 
                          ? 'bg-red-100 dark:bg-red-900/20' 
                          : 'bg-green-100 dark:bg-green-900/20'
                      }`}>
                        {tx.type === 'send' ? (
                          <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {tx.type === 'send' ? 'Sent' : 'Received'}
                      </span>
                    </div>
                    <p className={`font-bold text-base ${
                      tx.type === 'send' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {tx.type === 'send' ? '-' : '+'}{parseFloat(tx.amount).toLocaleString()} USDT
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {tx.type === 'send' ? 'To:' : 'From:'}
                    </p>
                    <p className="text-xs font-mono break-all">
                      {tx.destinationAddress || tx.sourceAddress || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        tx.status === 'completed' || tx.status === 'success' ? 'default' : 
                        tx.status === 'pending' ? 'secondary' : 'destructive'
                      } className="text-xs">
                        {tx.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tx.transactionHash ? 'On-chain' : 'Off-chain'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {tx.transactionHash && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(`https://bscscan.com/tx/${tx.transactionHash}`, '_blank')}
                          data-testid={`button-bscscan-mobile-${tx.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {tx.timestamp ? format(new Date(tx.timestamp), 'MMM d, HH:mm') : 
                         tx.createdAt ? format(new Date(tx.createdAt), 'MMM d, HH:mm') : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}