import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Shield, 
  Moon, 
  Sun,
  Globe, 
  Lock, 
  Key, 
  RefreshCw, 
  Trash2, 
  User,
  Wallet,
  Clock,
  Download,
  Upload,
  Copy,
  CheckCircle,
  AlertCircle,
  Palette,
  Settings as SettingsIcon,
  Monitor,
  Smartphone,
  Layout,
  TrendingDown,
  TrendingUp,
  Award,
  Activity,
  Bot,
  Brain,
  MessageCircle,
  Target,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';
import { useState, useEffect, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Web3Context } from '@/contexts/Web3Context';
import PinModal from '@/components/PinModal';
import ImportWalletModal from '@/components/ImportWalletModal';
import CredentialExport from '@/components/CredentialExport';
import TwoFactorSetupModal from '@/components/TwoFactorSetupModal';
import TwoFactorVerifyModal from '@/components/TwoFactorVerifyModal';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const web3Context = useContext(Web3Context);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'update' | 'remove'>('setup');
  const [importWalletModalOpen, setImportWalletModalOpen] = useState(false);
  const [exportCredentialsModalOpen, setExportCredentialsModalOpen] = useState(false);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [twoFactorVerifyOpen, setTwoFactorVerifyOpen] = useState(false);
  const [twoFactorAction, setTwoFactorAction] = useState<'disable' | null>(null);
  const [copied, setCopied] = useState(false);

  // Settings state
  const [darkMode, setDarkMode] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [goalReminders, setGoalReminders] = useState(true);
  const [investmentAlerts, setInvestmentAlerts] = useState(true);

  // Fetch PIN status
  const { data: pinStatus, refetch: refetchPinStatus } = useQuery<{
    hasPinSetup: boolean;
    isLocked: boolean | null;
    attemptsRemaining: number | null;
  }>({
    queryKey: ['/api/auth/pin/status'],
    retry: 1,
  });

  // Fetch 2FA status
  const { data: twoFactorStatus, refetch: refetch2FAStatus } = useQuery<{
    enabled: boolean;
    hasBackupCodes: boolean;
  }>({
    queryKey: ['/api/auth/2fa/status'],
    retry: 1,
  });

  // Fetch imported wallet address
  const { data: walletData, refetch: refetchWalletData } = useQuery<{
    hasImportedWallet: boolean;
    address?: string;
  }>({
    queryKey: ['/api/wallet/imported-address'],
    retry: false,
  });
  
  // Fetch withdrawal patterns
  const { data: withdrawalPatterns } = useQuery<{
    totalWithdrawals: number;
    resistedWithdrawals: number;
    reasonCounts: Record<string, number>;
    mostCommonReason: string | null;
    resistanceRate: number;
    counselingImpact?: number;
    totalCounselingSessions?: number;
    counselingSuccessRate?: number;
  }>({
    queryKey: ['/api/withdrawal-patterns'],
    retry: false,
  });
  
  // Fetch withdrawal history  
  const { data: withdrawalHistory } = useQuery<Array<{
    id: string;
    goalTitle: string;
    amount: string;
    reason: string;
    reasonDetails?: string;
    usedCoolingPeriod: boolean;
    completed: boolean;
    createdAt: string;
  }>>({
    queryKey: ['/api/withdrawal-history'],
    retry: false,
  });
  
  // Fetch AI counseling metrics
  const { data: counselingMetrics } = useQuery<{
    totalSessions: number;
    successfulDissuasions: number;
    totalWithdrawals: number;
    overallSuccessRate: number;
    averageTimeSpent: number;
    averageMessagesPerSession: number;
    successByReason: Record<string, { total: number; kept: number; rate: number }>;
    dailyMetrics: Array<{ date: string; sessions: number; kept: number; withdrew: number }>;
    mostEffectiveForReason: string | null;
  }>({
    queryKey: ['/api/ai/counseling-metrics'],
    retry: false,
  });

  const handleSave = () => {
    toast({
      title: 'Settings Updated',
      description: 'Your preferences have been saved successfully',
    });
  };

  const handlePinAction = (mode: 'setup' | 'update' | 'remove') => {
    setPinModalMode(mode);
    setPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    refetchPinStatus();
  };

  const handleImportSuccess = (address: string) => {
    refetchWalletData();
    if (web3Context?.checkImportedWallet) {
      web3Context.checkImportedWallet();
    }
  };

  // 2FA disable mutation
  const disable2FAMutation = useMutation({
    mutationFn: async (data: { password: string; code: string }) =>
      apiRequest('/api/auth/2fa/disable', 'POST', data),
    onSuccess: () => {
      toast({
        title: '2FA Disabled',
        description: 'Two-factor authentication has been disabled',
      });
      refetch2FAStatus();
      setTwoFactorVerifyOpen(false);
      setTwoFactorAction(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Disable 2FA',
        description: error.message || 'Could not disable two-factor authentication',
        variant: 'destructive',
      });
    },
  });

  const handle2FAToggle = (checked: boolean) => {
    if (checked) {
      // Open setup modal
      setTwoFactorSetupOpen(true);
    } else {
      // Prompt for password and code to disable
      const password = prompt('Enter your password to disable 2FA:');
      if (!password) return;
      
      const code = prompt('Enter your current 2FA code or backup code:');
      if (!code) return;
      
      disable2FAMutation.mutate({ password, code });
    }
  };

  const handle2FASetupSuccess = () => {
    refetch2FAStatus();
    toast({
      title: '2FA Enabled',
      description: 'Two-factor authentication is now active on your account',
    });
  };

  const copyAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
      });
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, security, and preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Account Settings */}
        <Card data-testid="card-account-settings">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Account Settings</CardTitle>
            </div>
            <CardDescription>
              Manage your account information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {user?.username || 'Not set'}
                  </p>
                </div>
                <Badge variant="outline" data-testid="badge-account-status">
                  Active
                </Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Account Type</Label>
                <p className="text-xs text-muted-foreground">
                  Standard Account
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Management */}
        <Card data-testid="card-wallet-management">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Wallet Management</CardTitle>
            </div>
            <CardDescription>
              Import and manage your BSC wallet for on-chain transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {walletData?.hasImportedWallet && walletData?.address ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Imported Wallet</span>
                    <Badge 
                      variant="outline" 
                      className="bg-success/10 text-success border-success/30"
                      data-testid="badge-wallet-status"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-background px-3 py-1.5 rounded flex-1 truncate">
                      {truncateAddress(walletData.address)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyAddress}
                      data-testid="button-copy-wallet-address"
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Your private key is encrypted using AES-256 encryption and stored securely. 
                    Never share your private key with anyone.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No wallet imported. Import your BSC wallet to enable on-chain transactions.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant={walletData?.hasImportedWallet ? "outline" : "default"}
                className="w-full sm:w-auto"
                onClick={() => setImportWalletModalOpen(true)}
                data-testid="button-import-wallet"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {walletData?.hasImportedWallet ? 'Manage Wallet' : 'Import Wallet'}
              </Button>
              <Button 
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setExportCredentialsModalOpen(true)}
                data-testid="button-export-credentials"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card data-testid="card-security-settings">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Security Settings</CardTitle>
            </div>
            <CardDescription>
              Configure security features to protect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PIN Security Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">PIN Security</Label>
                    {pinStatus?.hasPinSetup ? (
                      <Badge 
                        variant="outline" 
                        className="bg-success/10 text-success border-success/30"
                        data-testid="badge-pin-status"
                      >
                        Enabled
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="bg-muted/50"
                        data-testid="badge-pin-status"
                      >
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pinStatus?.hasPinSetup 
                      ? 'Your account is protected with a 6-digit PIN'
                      : 'Set up a PIN to secure sensitive operations'
                    }
                  </p>
                  {pinStatus?.isLocked && (
                    <p className="text-xs text-destructive">
                      Account locked due to failed attempts. Try again later.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {!pinStatus?.hasPinSetup ? (
                  <Button 
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handlePinAction('setup')}
                    data-testid="button-setup-pin"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Set Up PIN
                  </Button>
                ) : (
                  <>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => handlePinAction('update')}
                      disabled={pinStatus?.isLocked || false}
                      data-testid="button-update-pin"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Update PIN
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => handlePinAction('remove')}
                      data-testid="button-remove-pin"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove PIN
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Two-Factor Authentication */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="two-factor" className="font-medium">
                    Two-Factor Authentication
                  </Label>
                  {twoFactorStatus?.enabled && (
                    <Badge 
                      variant="outline" 
                      className="bg-success/10 text-success border-success/30"
                      data-testid="badge-2fa-status"
                    >
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {twoFactorStatus?.enabled 
                    ? 'Your account is protected with 2FA' 
                    : 'Add an extra layer of security to your account'
                  }
                </p>
              </div>
              <Switch 
                id="two-factor" 
                checked={twoFactorStatus?.enabled || false}
                onCheckedChange={handle2FAToggle}
                data-testid="toggle-two-factor" 
              />
            </div>

            {/* Auto-Logout */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="auto-logout" className="font-medium">
                    Auto-Logout
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically logout after 30 minutes of inactivity
                </p>
              </div>
              <Switch 
                id="auto-logout" 
                checked={autoLogout}
                onCheckedChange={setAutoLogout}
                data-testid="toggle-auto-logout" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card data-testid="card-notifications">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>
              Configure how you receive alerts and updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="transaction-alerts" className="font-medium">
                  Transaction Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified for all transactions
                </p>
              </div>
              <Switch 
                id="transaction-alerts" 
                checked={transactionAlerts}
                onCheckedChange={setTransactionAlerts}
                data-testid="toggle-transaction-alerts" 
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="goal-reminders" className="font-medium">
                  Goal Reminders
                </Label>
                <p className="text-xs text-muted-foreground">
                  Weekly progress updates for savings goals
                </p>
              </div>
              <Switch 
                id="goal-reminders" 
                checked={goalReminders}
                onCheckedChange={setGoalReminders}
                data-testid="toggle-goal-reminders" 
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="investment-alerts" className="font-medium">
                  Investment Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notifications for scheduled investments
                </p>
              </div>
              <Switch 
                id="investment-alerts" 
                checked={investmentAlerts}
                onCheckedChange={setInvestmentAlerts}
                data-testid="toggle-investment-alerts" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card data-testid="card-appearance">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>
              Customize the look and feel of your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="dark-mode" className="font-medium">
                    Theme Mode
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Toggle between light and dark theme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <Switch 
                  id="dark-mode" 
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                  data-testid="toggle-dark-mode" 
                />
                <Moon className="h-4 w-4" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="compact-view" className="font-medium">
                    Compact View
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reduce spacing for more content density
                </p>
              </div>
              <Switch 
                id="compact-view" 
                checked={compactView}
                onCheckedChange={setCompactView}
                data-testid="toggle-compact-view" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Patterns & Behavioral Insights */}
        <Card data-testid="card-withdrawal-patterns">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Your Withdrawal Patterns</CardTitle>
            </div>
            <CardDescription>
              Understanding your financial behavior helps build better habits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {withdrawalPatterns ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-muted-foreground">Total Withdrawals</p>
                    </div>
                    <p className="text-2xl font-bold">{withdrawalPatterns.totalWithdrawals}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-success" />
                      <p className="text-sm text-muted-foreground">Resisted Withdrawals</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{withdrawalPatterns.resistedWithdrawals}</p>
                  </div>
                </div>
                
                {withdrawalPatterns.resistanceRate > 0 && (
                  <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <p className="font-semibold text-success">Resistance Rate</p>
                    </div>
                    <p className="text-3xl font-bold text-success">{withdrawalPatterns.resistanceRate.toFixed(0)}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Great job resisting impulsive withdrawals!
                    </p>
                  </div>
                )}
                
                {withdrawalPatterns.mostCommonReason && (
                  <Alert className="border-info/20 bg-info/5">
                    <AlertCircle className="h-4 w-4 text-info" />
                    <AlertDescription>
                      <p className="font-medium mb-1">Most Common Withdrawal Reason</p>
                      <p className="text-sm capitalize">{withdrawalPatterns.mostCommonReason.replace('-', ' ')}</p>
                      {withdrawalPatterns.mostCommonReason === 'emergency' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Consider building a separate emergency fund to avoid touching your savings goals.
                        </p>
                      )}
                      {withdrawalPatterns.mostCommonReason === 'gambling' && (
                        <p className="text-xs text-destructive mt-2">
                          If gambling is affecting your savings, consider seeking help: 1-800-522-4700
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Recent Withdrawal History */}
                {withdrawalHistory && withdrawalHistory.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Withdrawal Activity</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {withdrawalHistory.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="p-3 bg-background-secondary rounded-lg text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{entry.goalTitle}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                Reason: {entry.reason.replace('-', ' ')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold">${parseFloat(entry.amount).toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {entry.usedCoolingPeriod && (
                            <Badge variant="outline" className="mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              Used cooling period
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-success mx-auto mb-3" />
                <p className="font-semibold">No withdrawal history yet!</p>
                <p className="text-sm text-muted-foreground">Keep saving and building those healthy financial habits.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Counseling Effectiveness */}
        <Card data-testid="card-ai-counseling-metrics">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <CardTitle>AI Counseling Effectiveness</CardTitle>
            </div>
            <CardDescription>
              See how our AI counselor helps you make better financial decisions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {counselingMetrics && counselingMetrics.totalSessions > 0 ? (
              <>
                {/* Overall Success Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground">Sessions</p>
                    </div>
                    <p className="text-2xl font-bold">{counselingMetrics.totalSessions}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <p className="text-sm text-muted-foreground">Kept Saving</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{counselingMetrics.successfulDissuasions}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {counselingMetrics.overallSuccessRate.toFixed(0)}%
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Avg Time</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {Math.floor(counselingMetrics.averageTimeSpent / 60)}m
                    </p>
                  </div>
                </div>
                
                {/* Success Rate Banner */}
                {counselingMetrics.overallSuccessRate >= 70 && (
                  <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-success" />
                      <p className="font-semibold text-success">High Impact Counseling</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Our AI counselor has helped you resist {counselingMetrics.overallSuccessRate.toFixed(0)}% of withdrawal attempts!
                    </p>
                  </div>
                )}
                
                {/* Success by Reason Chart */}
                {Object.keys(counselingMetrics.successByReason).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Success Rate by Withdrawal Reason
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(counselingMetrics.successByReason)
                        .sort((a, b) => b[1].rate - a[1].rate)
                        .map(([reason, data]) => (
                          <div key={reason} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{reason.replace('-', ' ')}</span>
                              <span className="font-semibold">
                                {data.rate.toFixed(0)}% success ({data.kept}/{data.total})
                              </span>
                            </div>
                            <Progress 
                              value={data.rate} 
                              className="h-2"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Counseling Impact Over Time Chart */}
                {counselingMetrics.dailyMetrics && counselingMetrics.dailyMetrics.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Counseling Impact Over Time
                    </h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={counselingMetrics.dailyMetrics}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#5E6673"
                            fontSize={12}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis stroke="#5E6673" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#161A1E', 
                              border: '1px solid #2B3139',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: '#EAECEF' }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="kept" 
                            stroke="#0ECB81" 
                            strokeWidth={2}
                            name="Kept Saving"
                            dot={{ fill: '#0ECB81', r: 4 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="withdrew" 
                            stroke="#F6465D" 
                            strokeWidth={2}
                            name="Withdrew"
                            dot={{ fill: '#F6465D', r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {/* Conversation Insights */}
                <div className="p-4 bg-background-secondary rounded-lg space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Conversation Insights
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Avg Messages per Session</p>
                      <p className="font-semibold">
                        {counselingMetrics.averageMessagesPerSession.toFixed(1)} messages
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Most Effective For</p>
                      <p className="font-semibold capitalize">
                        {counselingMetrics.mostEffectiveForReason?.replace('-', ' ') || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Tips Based on Metrics */}
                {counselingMetrics.overallSuccessRate < 50 && (
                  <Alert className="border-warning/20 bg-warning/5">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription>
                      <p className="font-medium mb-1">Tip: Take More Time to Reflect</p>
                      <p className="text-sm">
                        Try engaging more with the AI counselor before making withdrawal decisions. 
                        The more you discuss, the better you understand your true needs vs wants.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-primary mx-auto mb-3" />
                <p className="font-semibold">No Counseling Sessions Yet</p>
                <p className="text-sm text-muted-foreground">
                  When you consider withdrawing, our AI counselor will help you think through your decision.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Preferences */}
        <Card data-testid="card-transaction-preferences">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Transaction Preferences</CardTitle>
            </div>
            <CardDescription>
              Set your default preferences for blockchain transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-gas" className="text-sm font-medium">
                Default Gas Price (Gwei)
              </Label>
              <Input 
                id="default-gas" 
                type="number" 
                placeholder="5" 
                defaultValue="5"
                className="w-full"
                data-testid="input-default-gas"
              />
              <p className="text-xs text-muted-foreground">
                Set your preferred gas price for BSC transactions
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slippage" className="text-sm font-medium">
                Slippage Tolerance (%)
              </Label>
              <Input 
                id="slippage" 
                type="number" 
                placeholder="0.5" 
                defaultValue="0.5"
                step="0.1"
                className="w-full"
                data-testid="input-slippage-tolerance"
              />
              <p className="text-xs text-muted-foreground">
                Maximum price difference you accept when swapping
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave} 
          data-testid="button-save-settings"
        >
          Save All Changes
        </Button>
      </div>

      {/* Modals */}
      <PinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        mode={pinModalMode}
        onSuccess={handlePinSuccess}
      />

      <ImportWalletModal
        open={importWalletModalOpen}
        onOpenChange={setImportWalletModalOpen}
        onImportSuccess={handleImportSuccess}
      />

      <Dialog open={exportCredentialsModalOpen} onOpenChange={setExportCredentialsModalOpen}>
        <CredentialExport />
      </Dialog>

      <TwoFactorSetupModal
        open={twoFactorSetupOpen}
        onClose={() => setTwoFactorSetupOpen(false)}
        onSuccess={handle2FASetupSuccess}
      />

      <TwoFactorVerifyModal
        open={twoFactorVerifyOpen}
        onClose={() => setTwoFactorVerifyOpen(false)}
        mode="verify"
      />
    </div>
  );
}