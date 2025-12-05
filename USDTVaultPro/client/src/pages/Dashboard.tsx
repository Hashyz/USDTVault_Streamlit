import { useState, useMemo, useContext, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Web3Context } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  ArrowDownLeft,
  TrendingUp,
  TrendingDown,
  Send,
  Wallet,
  Target,
  Calendar,
  Activity,
  Clock,
  Info,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  DollarSign,
  Briefcase,
  PieChart,
  BarChart3,
  Plus,
  Award,
  Zap
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  BarChart,
  Bar,
  PieChart as RechartssPieChart,
  Pie,
  Cell
} from 'recharts';
import SendReceiveModal from '@/components/SendReceiveModal';
import NetworkWarning from '@/components/NetworkWarning';
import NotificationBar from '@/components/NotificationBar';
import TransactionList from '@/components/TransactionList';
import SavingsGoals from '@/components/SavingsGoals';
import InvestmentPlans from '@/components/InvestmentPlans';
import type { Transaction, SavingsGoal, InvestmentPlan } from '@shared/schema';

// Professional color palette for charts
const CHART_COLORS = {
  primary: '#F0B90B',
  success: '#0ECB81',
  error: '#F6465D',
  info: '#3861FB',
  secondary: '#848E9C',
};

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'send' | 'receive'>('send');
  const [chartTimeframe, setChartTimeframe] = useState('7D');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Get Web3 context for blockchain data
  const web3Context = useContext(Web3Context);
  const { 
    isConnected = false, 
    chainId = null,
    usdtBalance = '0',
    bnbBalance = '0'
  } = web3Context || {};

  // Fetch real blockchain wallet data
  const { data: walletData, isLoading: balanceLoading } = useQuery<{
    address?: string;
    bnb?: string;
    usdt?: string;
    totalUSD?: string;
    balance: string;
  }>({
    queryKey: ['/api/wallet'],
  });

  // Fetch blockchain transactions from BSCScan
  const { data: blockchainTransactions = [], isLoading: blockchainTxLoading } = useQuery<any[]>({
    queryKey: ['/api/blockchain/transactions'],
  });

  // Fetch real portfolio metrics
  const { data: portfolioMetrics, isLoading: metricsLoading } = useQuery<{
    totalTransactions: number;
    volume24h: string;
    successRate: number;
    riskScore: number;
    lastActivity: Date | null;
  }>({
    queryKey: ['/api/portfolio/metrics'],
  });

  // Also fetch stored transactions for transaction history
  const { data: storedTransactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Fetch savings goals
  const { data: savingsGoals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ['/api/savings-goals'],
  });

  // Fetch investment plans
  const { data: investmentPlans = [], isLoading: plansLoading } = useQuery<InvestmentPlan[]>({
    queryKey: ['/api/investment-plans'],
  });

  // Update last updated timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate professional stats from real blockchain data
  const stats = useMemo(() => {
    // Use real blockchain balance if available
    const balance = parseFloat(walletData?.totalUSD || walletData?.balance || user?.balance || '0');
    const bnbBalance = parseFloat(walletData?.bnb || '0');
    const usdtBalance = parseFloat(walletData?.usdt || '0');
    
    const totalSavings = savingsGoals.reduce((sum, goal) => 
      sum + parseFloat(goal.current || '0'), 0);
    
    // Calculate savings streak - highest streak among all goals
    const maxStreak = savingsGoals.reduce((max, goal) => {
      const streak = parseInt(goal.savingStreak || '0');
      return streak > max ? streak : max;
    }, 0);
    
    // Use real blockchain metrics if available
    const totalTransactions = portfolioMetrics?.totalTransactions || blockchainTransactions.length || storedTransactions.length;
    const volume24h = parseFloat(portfolioMetrics?.volume24h || '0');
    const successRate = portfolioMetrics?.successRate || 100;
    const riskScore = portfolioMetrics?.riskScore || 0;
    
    // Net worth is just your total balance (savings are part of it, not additional)
    const netWorth = balance;
    const availableBalance = Math.max(0, balance - totalSavings); // What's not locked
    
    // Calculate 24h change based on blockchain transactions
    let change24h = 0;
    let balanceYesterday = balance;
    
    // For blockchain transactions, calculate change from volume
    if (portfolioMetrics && volume24h > 0) {
      // Use volume as a proxy for change (simplified)
      change24h = volume24h * 0.01; // Conservative estimate
    }
    
    const changePercent = balanceYesterday > 0 ? (change24h / balanceYesterday) * 100 : 0;
    
    // Calculate YTD return (simplified for blockchain data)
    const ytdReturn = 0; // Will be calculated from blockchain transactions
    const ytdReturnPercent = 0;
    
    // Active goals count
    const activeGoals = savingsGoals.filter(g => parseFloat(g.current || '0') < parseFloat(g.target)).length;
    
    // Calculate future value (1 year with 10% annual growth)
    const futureValue = totalSavings * Math.pow(1.10, 1);
    
    return {
      netWorth,
      netWorthChange: change24h,
      netWorthChangePercent: changePercent,
      totalSavings,
      availableBalance,
      portfolioValue: balance,
      totalTransactions,
      ytdReturn,
      ytdReturnPercent,
      activeGoals,
      volume24h,
      successRate,
      maxStreak,
      futureValue,
    };
  }, [walletData, user, savingsGoals, portfolioMetrics, blockchainTransactions, storedTransactions]);

  // Generate chart data from real transaction history
  const chartData = useMemo(() => {
    const currentBalance = parseFloat(walletData?.totalUSD || walletData?.balance || user?.balance || '0');
    const allTransactions = [...blockchainTransactions, ...storedTransactions];
    
    // Check if this is a new account (created today)
    const today = new Date();
    const todayString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // If no transactions or all transactions are from today, show new account message
    const hasHistoricalTransactions = allTransactions.some(tx => {
      const txDate = new Date(tx.createdAt || tx.timestamp);
      return txDate.toDateString() !== today.toDateString();
    });
    
    if (!hasHistoricalTransactions || allTransactions.length === 0) {
      // New account - only show today's data point
      return [{
        date: 'Today',
        value: currentBalance,
        isNew: true,
      }];
    }
    
    // Otherwise, show historical data based on timeframe
    const days = chartTimeframe === '24H' ? 1 : 
                 chartTimeframe === '7D' ? 7 : 
                 chartTimeframe === '30D' ? 30 : 
                 chartTimeframe === '90D' ? 90 : 365;
    
    const data = [];
    const now = Date.now();
    
    // Group blockchain transactions by day and calculate running balance
    const dailyChanges = new Map<string, number>();
    
    // Process blockchain transactions to calculate daily changes
    allTransactions.forEach(tx => {
      const txDate = new Date(tx.createdAt || tx.timestamp);
      const dateKey = txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const amount = parseFloat(tx.amount);
      
      const currentChange = dailyChanges.get(dateKey) || 0;
      if (tx.type === 'receive') {
        dailyChanges.set(dateKey, currentChange + amount);
      } else if (tx.type === 'send') {
        dailyChanges.set(dateKey, currentChange - amount);
      }
    });
    
    // Build chart data by calculating running balance for each day
    let runningBalance = currentBalance;
    
    // First, calculate what the balance was at the start of the period
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayChange = dailyChanges.get(dateKey) || 0;
      runningBalance -= dayChange;
    }
    
    // Now build forward from the start balance
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayChange = dailyChanges.get(dateKey) || 0;
      
      runningBalance += dayChange;
      
      data.push({
        date: dateKey,
        value: parseFloat(Math.max(0, runningBalance).toFixed(2)),
      });
    }
    
    return data;
  }, [chartTimeframe, walletData, user, blockchainTransactions, storedTransactions]);

  // Format transactions for professional display
  const formattedTransactions = useMemo(() => {
    const allTxs = [...blockchainTransactions, ...storedTransactions];
    return allTxs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      address: tx.destinationAddress || tx.sourceAddress || '',
      timestamp: new Date(tx.createdAt).toLocaleString(),
      status: tx.status === 'success' ? 'completed' : tx.status as 'completed' | 'pending' | 'failed',
    }));
  }, [blockchainTransactions, storedTransactions]);

  // Format savings goals for display
  const formattedGoals = useMemo(() => {
    return savingsGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      current: parseFloat(goal.current || '0'),
      target: parseFloat(goal.target),
      deadline: new Date(goal.deadline).toLocaleDateString(),
    }));
  }, [savingsGoals]);

  // Format investment plans for display
  const formattedPlans = useMemo(() => {
    return investmentPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      amount: parseFloat(plan.amount),
      frequency: plan.frequency,
      nextContribution: new Date(plan.nextContribution).toLocaleDateString(),
      autoInvest: plan.autoInvest,
    }));
  }, [investmentPlans]);

  // Calculate real portfolio allocation based on actual balances
  const allocationData = useMemo(() => {
    // Get real wallet balances
    const walletBalance = parseFloat(walletData?.totalUSD || walletData?.balance || user?.balance || '0');
    const walletUSDT = parseFloat(walletData?.usdt || usdtBalance || '0');
    const walletBNB = parseFloat(walletData?.bnb || bnbBalance || '0');
    const savingsValue = stats.totalSavings;
    const availableUSDT = Math.max(0, walletUSDT - savingsValue); // USDT not in savings
    
    // Calculate total value (USDT + BNB value in USD)
    // Note: Savings are part of USDT, not additional
    const bnbValueUSD = walletBNB * 300; // Assuming BNB price ~$300
    const totalValue = walletBalance; // Just the wallet balance, not double counting
    
    if (totalValue === 0) {
      // No assets - show empty state
      return [
        { name: 'No Assets', value: 100, amount: 0, color: CHART_COLORS.secondary },
      ];
    }
    
    // Define thresholds for filtering dust/gas amounts
    const DUST_THRESHOLD_USD = 1; // Ignore assets worth less than $1
    const DUST_THRESHOLD_PERCENT = 2; // Ignore assets that represent less than 2% of portfolio
    
    // Collect all potential allocations with their raw data
    // Savings are part of USDT, not a separate asset
    const rawAllocations = [];
    
    // Show USDT breakdown: Available vs Locked in Savings
    if (availableUSDT > 0) {
      rawAllocations.push({
        name: 'Available USDT',
        amount: availableUSDT,
        color: CHART_COLORS.primary,
      });
    }
    
    if (savingsValue > 0) {
      rawAllocations.push({
        name: 'USDT in Savings',
        amount: savingsValue,
        color: CHART_COLORS.success,
      });
    }
    
    if (bnbValueUSD > 0) {
      rawAllocations.push({
        name: 'BNB (Gas)',
        amount: bnbValueUSD,
        color: CHART_COLORS.info,
      });
    }
    
    // Filter out dust amounts (below $1 OR below 2% of portfolio)
    const significantAllocations = rawAllocations.filter(allocation => {
      const percentOfPortfolio = (allocation.amount / totalValue) * 100;
      return allocation.amount >= DUST_THRESHOLD_USD && percentOfPortfolio >= DUST_THRESHOLD_PERCENT;
    });
    
    // If all assets except one are dust, show the main asset as 100%
    if (significantAllocations.length === 0 && rawAllocations.length > 0) {
      // Find the largest asset and show it as 100%
      const largestAsset = rawAllocations.reduce((prev, current) => 
        prev.amount > current.amount ? prev : current
      );
      return [{
        ...largestAsset,
        value: 100,
      }];
    }
    
    // Calculate the total value of significant allocations
    const significantTotal = significantAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    
    // Recalculate percentages based only on significant allocations
    const data = significantAllocations.map(allocation => {
      const percent = significantTotal > 0 ? (allocation.amount / significantTotal) * 100 : 0;
      return {
        ...allocation,
        value: parseFloat(percent.toFixed(1)),
      };
    });
    
    // Ensure percentages sum to 100% (adjust for rounding errors)
    if (data.length > 0) {
      const totalPercent = data.reduce((sum, item) => sum + item.value, 0);
      if (totalPercent !== 100 && totalPercent > 0) {
        // Adjust the largest allocation to make it sum to 100%
        const largestIndex = data.reduce((maxIndex, current, index) => 
          data[maxIndex].value < current.value ? index : maxIndex, 0
        );
        data[largestIndex].value = parseFloat((data[largestIndex].value + (100 - totalPercent)).toFixed(1));
      }
    }
    
    // If no data after filtering, show the primary asset as 100%
    if (data.length === 0 && walletBalance > 0) {
      data.push({
        name: 'USDT',
        value: 100,
        amount: walletBalance,
        color: CHART_COLORS.primary,
      });
    }
    
    return data.length > 0 ? data : [{ name: 'No Assets', value: 100, amount: 0, color: CHART_COLORS.secondary }];
  }, [walletData, user, usdtBalance, bnbBalance, stats.totalSavings]);

  const openSendModal = () => {
    setModalTab('send');
    setModalOpen(true);
  };

  const openReceiveModal = () => {
    setModalTab('receive');
    setModalOpen(true);
  };

  // Use blockchain balance when connected, otherwise use database balance
  const balance = isConnected 
    ? parseFloat(usdtBalance) 
    : parseFloat(walletData?.balance || user?.balance || '0');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCompactNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Network Warning Banner */}
      <NetworkWarning />
      
      {/* Smart Notifications */}
      <NotificationBar />
      
      {/* Professional Header */}
      <div className="bg-background-secondary/50 backdrop-blur-sm border-b border-border/50 -mx-6 -mt-6 px-6 py-4" data-testid="header-dashboard">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-dashboard-title">Portfolio Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-last-updated">
              Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={isConnected ? "default" : "secondary"} 
              className="font-mono text-xs"
              data-testid="badge-network-status"
            >
              {isConnected ? `BSC Mainnet` : 'Demo Mode'}
            </Badge>
            {user?.walletAddress && (
              <Badge variant="outline" className="font-mono text-xs" data-testid="badge-wallet-address">
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Value Hero Section */}
      <Card className="bg-gradient-to-br from-background-secondary via-background-secondary to-primary/5 border-border/50" data-testid="card-portfolio-hero">
        <CardContent className="p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Total Balance */}
            <div className="lg:col-span-1">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
                <div className="flex items-baseline gap-3">
                  {balanceLoading ? (
                    <Skeleton className="h-10 w-32" />
                  ) : (
                    <>
                      <span className="text-3xl lg:text-4xl font-bold font-mono" data-testid="text-net-worth">
                        {formatCurrency(stats.netWorth)}
                      </span>
                      {stats.netWorthChangePercent !== 0 && (
                        <Badge 
                          variant={stats.netWorthChangePercent > 0 ? "default" : "destructive"}
                          className="font-mono text-xs"
                          data-testid="badge-net-worth-change"
                        >
                          {stats.netWorthChangePercent > 0 ? (
                            <ChevronUp className="w-3 h-3 mr-1" />
                          ) : (
                            <ChevronDown className="w-3 h-3 mr-1" />
                          )}
                          {Math.abs(stats.netWorthChangePercent).toFixed(2)}%
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2" data-testid="text-24h-change">
                  24h Change: {stats.netWorthChange >= 0 ? '+' : ''}{formatCurrency(stats.netWorthChange)}
                </p>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="lg:col-span-1 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Portfolio Value</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-portfolio-value">
                  {formatCurrency(stats.portfolioValue)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Savings</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-total-savings">
                  {formatCurrency(stats.totalSavings)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Active Goals</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-active-goals">
                  {stats.activeGoals}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">YTD Return</p>
                <p className="text-xl font-semibold font-mono text-success" data-testid="text-ytd-return">
                  {stats.ytdReturnPercent >= 0 ? '+' : ''}{stats.ytdReturnPercent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-1 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <Button 
                onClick={openSendModal}
                size="default"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-send"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
              <Button 
                onClick={openReceiveModal}
                size="default"
                variant="outline"
                className="flex-1"
                data-testid="button-receive"
              >
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Receive
              </Button>
              <Button 
                onClick={() => navigate('/goals')}
                size="default"
                variant="outline"
                className="flex-1"
                data-testid="button-add-goal"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart */}
        <Card className="lg:col-span-2" data-testid="card-portfolio-chart">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Portfolio Performance</CardTitle>
              <Tabs value={chartTimeframe} onValueChange={setChartTimeframe} className="w-auto" data-testid="tabs-chart-timeframe">
                <TabsList className="h-8">
                  {['24H', '7D', '30D', '90D', '1Y'].map((tf) => (
                    <TabsTrigger 
                      key={tf} 
                      value={tf} 
                      className="text-xs px-3 py-1"
                      data-testid={`tab-timeframe-${tf}`}
                    >
                      {tf}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" data-testid="chart-portfolio-performance">
              {chartData.length === 1 && chartData[0].isNew ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="bg-primary/10 p-4 rounded-full">
                    <Wallet className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Portfolio Created Today</h3>
                    <p className="text-sm text-muted-foreground">November 13, 2025</p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Badge variant="outline" className="text-lg font-mono px-3 py-1">
                        Initial Deposit: {formatCurrency(chartData[0].value)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Your portfolio history will appear as you make transactions
                    </p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#5E6673"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#5E6673"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => `$${formatCompactNumber(value)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E2329',
                        border: '1px solid #2B3139',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#848E9C' }}
                      formatter={(value: number) => [formatCurrency(value), 'Balance']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Allocation */}
        <Card data-testid="card-asset-allocation">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex flex-col items-center justify-center" data-testid="chart-asset-allocation">
              <ResponsiveContainer width="100%" height={200}>
                <RechartssPieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E2329',
                      border: '1px solid #2B3139',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                </RechartssPieChart>
              </ResponsiveContainer>
              <div className="space-y-2 w-full">
                {allocationData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm" data-testid={`allocation-${item.name.toLowerCase()}`}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono font-medium" data-testid={`text-allocation-${item.name.toLowerCase()}`}>
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Behavioral Nudges - Savings Journey */}
      {stats.totalSavings > 0 && (
        <Card className="bg-gradient-to-br from-success/10 to-primary/5 border-success/20" data-testid="card-savings-journey">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Savings Streak */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-foreground">Your Savings Journey</h3>
                </div>
                
                {stats.maxStreak > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-success/20 p-3 rounded-full">
                        <Zap className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono text-success" data-testid="text-savings-streak">
                          Day {stats.maxStreak}
                        </p>
                        <p className="text-sm text-muted-foreground">of your savings journey</p>
                      </div>
                    </div>
                    
                    {/* Achievement Badges */}
                    <div className="flex gap-2 mt-3">
                      {stats.maxStreak >= 7 && (
                        <Badge variant="outline" className="gap-1" data-testid="badge-7-days">
                          <Award className="w-3 h-3" />
                          Week Warrior
                        </Badge>
                      )}
                      {stats.maxStreak >= 30 && (
                        <Badge variant="default" className="gap-1" data-testid="badge-30-days">
                          <Award className="w-3 h-3" />
                          Monthly Master
                        </Badge>
                      )}
                      {stats.maxStreak >= 100 && (
                        <Badge className="bg-gradient-to-r from-primary to-success gap-1" data-testid="badge-100-days">
                          <Award className="w-3 h-3" />
                          Century Saver
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-background/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Start your savings streak today! Every day without withdrawals counts.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Future Value Projection */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Stay Disciplined</h3>
                </div>
                
                <div className="bg-background/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm text-muted-foreground">
                    If you don't withdraw and keep saving:
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-primary" data-testid="text-future-value">
                      {formatCurrency(stats.futureValue)}
                    </span>
                    <span className="text-sm text-muted-foreground">in 1 year</span>
                  </div>
                  <p className="text-xs text-success">
                    +{formatCurrency(stats.futureValue - stats.totalSavings)} growth potential
                  </p>
                </div>
                
                {/* Motivational Message */}
                <div className="text-sm italic text-muted-foreground">
                  {stats.maxStreak > 30 
                    ? `"Extraordinary discipline! Your future self will thank you."` 
                    : stats.maxStreak > 7 
                    ? `"Great progress! Consistency builds wealth."` 
                    : `"Every journey starts with a single step. Keep going!"`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-24h-volume">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">24h Volume</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-24h-volume">
                  {formatCurrency(stats.volume24h)}
                </p>
              </div>
              <Activity className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-transactions">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Transactions</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-total-transactions">
                  {stats.totalTransactions}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-info/20" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-success-rate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Success Rate</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-success-rate">
                  {stats.successRate.toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-success/20" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-risk-score">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Risk Score</p>
                <p className="text-xl font-semibold font-mono" data-testid="text-risk-score">
                  {stats.successRate >= 95 ? 'Low' : stats.successRate >= 80 ? 'Medium' : 'High'}
                </p>
              </div>
              <Info className="w-8 h-8 text-secondary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card data-testid="card-recent-transactions">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/transactions')}
              className="text-xs"
              data-testid="button-view-all-transactions"
            >
              View All
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <TransactionList transactions={formattedTransactions.slice(0, 5)} />
            )}
          </CardContent>
        </Card>

        {/* Goals & Plans */}
        <div className="space-y-6">
          <Card data-testid="card-savings-goals">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-medium">Savings Goals</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/goals')}
                className="text-xs"
                data-testid="button-manage-goals"
              >
                Manage
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : (
                <SavingsGoals 
                  goals={formattedGoals.slice(0, 3)} 
                  onDeposit={(goalId) => navigate(`/goals?deposit=${goalId}`)}
                />
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-investment-plans">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-medium">Investment Plans</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/plans')}
                className="text-xs"
                data-testid="button-manage-plans"
              >
                Manage
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : (
                <InvestmentPlans plans={formattedPlans.slice(0, 3)} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SendReceiveModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        defaultTab={modalTab}
        currentBalance={balance}
      />
    </div>
  );
}