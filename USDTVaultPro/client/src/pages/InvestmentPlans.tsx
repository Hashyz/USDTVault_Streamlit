import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  TrendingUp, 
  Trash2, 
  Edit, 
  Calendar,
  DollarSign,
  Target,
  Clock,
  ChartBar,
  Activity,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, differenceInDays, startOfYear, isSameDay } from 'date-fns';
import { type InvestmentPlan } from '@shared/schema';

const planSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100000, 'Must be between 0 and 100,000'),
  frequency: z.enum(['weekly', 'monthly']),
  autoInvest: z.boolean(),
});

type PlanForm = z.infer<typeof planSchema>;

export default function InvestmentPlans() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data: plans = [], isLoading } = useQuery<InvestmentPlan[]>({
    queryKey: ['/api/investment-plans'],
  });

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      amount: '',
      frequency: 'monthly',
      autoInvest: true,
    },
  });

  // Update last updated timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!plans.length) return {
      totalMonthlyInvestment: 0,
      activePlans: 0,
      nextContribution: null,
      totalInvestedYTD: 0,
      weeklyPlans: 0,
      monthlyPlans: 0,
      autoInvestEnabled: 0,
      averageInvestment: 0,
    };

    const activePlans = plans.filter(p => p.autoInvest).length;
    const weeklyPlans = plans.filter(p => p.frequency === 'weekly').length;
    const monthlyPlans = plans.filter(p => p.frequency === 'monthly').length;
    const autoInvestEnabled = plans.filter(p => p.autoInvest).length;
    
    // Calculate total monthly investment
    const totalMonthlyInvestment = plans.reduce((sum, plan) => {
      const amount = parseFloat(plan.amount);
      if (plan.frequency === 'weekly') {
        return sum + (amount * 4.33); // Average weeks per month
      }
      return sum + amount;
    }, 0);

    // Find next contribution date
    const nextDates = plans
      .filter(p => p.autoInvest)
      .map(p => new Date(p.nextContribution))
      .sort((a, b) => a.getTime() - b.getTime());
    const nextContribution = nextDates.length > 0 ? nextDates[0] : null;

    // Calculate YTD investment (simplified calculation)
    const now = new Date();
    const yearStart = startOfYear(now);
    const monthsElapsed = now.getMonth() + 1;
    
    const totalInvestedYTD = plans.reduce((sum, plan) => {
      const amount = parseFloat(plan.amount);
      if (plan.frequency === 'weekly') {
        const weeksElapsed = Math.floor(differenceInDays(now, yearStart) / 7);
        return sum + (amount * weeksElapsed);
      } else {
        return sum + (amount * monthsElapsed);
      }
    }, 0);

    // Calculate average investment per plan
    const averageInvestment = plans.length > 0 
      ? plans.reduce((sum, p) => sum + parseFloat(p.amount), 0) / plans.length 
      : 0;

    return {
      totalMonthlyInvestment,
      activePlans,
      nextContribution,
      totalInvestedYTD,
      weeklyPlans,
      monthlyPlans,
      autoInvestEnabled,
      averageInvestment,
    };
  }, [plans]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/investment-plans', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
      toast({ 
        title: 'Plan Created', 
        description: 'Your investment plan has been created successfully' 
      });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to create plan', 
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/investment-plans/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
      toast({ 
        title: 'Plan Deleted', 
        description: 'Your investment plan has been removed' 
      });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete plan', 
        variant: 'destructive' 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/investment-plans/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
      toast({ 
        title: 'Plan Updated', 
        description: 'Your investment plan has been updated' 
      });
      setEditingPlan(null);
      setOpen(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update plan', 
        variant: 'destructive' 
      });
    },
  });

  const toggleAutoInvestMutation = useMutation({
    mutationFn: ({ id, autoInvest }: { id: string, autoInvest: boolean }) => 
      apiRequest(`/api/investment-plans/${id}`, 'PATCH', { autoInvest }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update auto-invest setting', 
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (data: PlanForm) => {
    const nextDate = data.frequency === 'weekly' 
      ? addWeeks(new Date(), 1)
      : addMonths(new Date(), 1);

    const payload = {
      name: data.name,
      amount: data.amount, // Keep as string - server expects string for validation
      frequency: data.frequency,
      autoInvest: data.autoInvest,
      nextContribution: nextDate.toISOString(),
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (plan: InvestmentPlan) => {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      amount: plan.amount.toString(),
      frequency: plan.frequency,
      autoInvest: plan.autoInvest,
    });
    setOpen(true);
  };

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-background-secondary/50 backdrop-blur-sm border-b border-border/50 -mx-6 -mt-6 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-investment-title">
              Investment Plans
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-last-updated">
              Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Dialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              setEditingPlan(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-create-plan"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {editingPlan ? 'Edit Investment Plan' : 'Create New Investment Plan'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Set up automatic recurring investments to grow your portfolio
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Plan Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Retirement Fund" 
                            {...field} 
                            data-testid="input-plan-name"
                            className="font-normal"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Investment Amount (USDT)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1000.00" 
                            step="0.01"
                            {...field} 
                            data-testid="input-plan-amount"
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Investment Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-plan-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoInvest"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">Enable Auto-Invest</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">
                            Automatically execute investments on schedule
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-invest"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-plan"
                  >
                    {createMutation.isPending || updateMutation.isPending 
                      ? 'Processing...' 
                      : (editingPlan ? 'Update Plan' : 'Create Plan')
                    }
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-monthly-investment">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              {stats.totalMonthlyInvestment > 0 && (
                <ChevronUp className="h-4 w-4 text-success" />
              )}
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-monthly-investment">
              ${formatCompactNumber(stats.totalMonthlyInvestment)}
            </p>
            <p className="text-xs text-muted-foreground">Monthly Investment</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-active-plans">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <Badge 
                variant={stats.activePlans > 0 ? "default" : "secondary"}
                className="text-xs font-mono"
              >
                {stats.autoInvestEnabled} auto
              </Badge>
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-active-plans">
              {stats.activePlans}
            </p>
            <p className="text-xs text-muted-foreground">Active Plans</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-next-contribution">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {stats.nextContribution && (
                <Badge variant="outline" className="text-xs font-mono">
                  {differenceInDays(stats.nextContribution, new Date())}d
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold font-mono mt-2" data-testid="text-next-contribution">
              {stats.nextContribution 
                ? format(stats.nextContribution, 'MMM dd')
                : 'N/A'
              }
            </p>
            <p className="text-xs text-muted-foreground">Next Contribution</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-ytd-invested">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <Badge 
                variant="default"
                className="text-xs font-mono"
              >
                YTD
              </Badge>
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-ytd-invested">
              ${formatCompactNumber(stats.totalInvestedYTD)}
            </p>
            <p className="text-xs text-muted-foreground">Total Invested</p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Plans Grid */}
      {plans.length === 0 ? (
        <Card className="bg-background-secondary border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-3 bg-muted/20 rounded-full mb-4">
              <ChartBar className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-2">No Investment Plans</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Create your first investment plan to start building wealth automatically
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: InvestmentPlan) => {
            const nextDate = new Date(plan.nextContribution);
            const daysUntil = differenceInDays(nextDate, new Date());
            const isToday = isSameDay(nextDate, new Date());
            const isSoon = daysUntil >= 0 && daysUntil <= 3;
            
            return (
              <Card 
                key={plan.id} 
                className="bg-background-secondary border-border/50 relative overflow-hidden"
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.autoInvest && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 transform rotate-45 translate-x-8 -translate-y-8" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {plan.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant={plan.frequency === 'weekly' ? "secondary" : "outline"}
                          className="text-xs font-mono capitalize"
                          data-testid={`badge-frequency-${plan.id}`}
                        >
                          {plan.frequency}
                        </Badge>
                        {isToday && (
                          <Badge 
                            variant="destructive" 
                            className="text-xs font-mono"
                            data-testid={`badge-today-${plan.id}`}
                          >
                            Today
                          </Badge>
                        )}
                        {!isToday && isSoon && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs font-mono"
                            data-testid={`badge-soon-${plan.id}`}
                          >
                            Soon
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(plan)}
                        data-testid={`button-edit-plan-${plan.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => deleteMutation.mutate(plan.id)}
                        data-testid={`button-delete-plan-${plan.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount per Investment</span>
                    </div>
                    <p className="text-2xl font-bold font-mono" data-testid={`text-amount-${plan.id}`}>
                      ${formatCompactNumber(parseFloat(plan.amount))}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {format(nextDate, 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Auto</span>
                      <Switch
                        checked={plan.autoInvest}
                        onCheckedChange={(checked) => 
                          toggleAutoInvestMutation.mutate({ id: plan.id, autoInvest: checked })
                        }
                        disabled={toggleAutoInvestMutation.isPending}
                        data-testid={`toggle-autoinvest-${plan.id}`}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Days Until Next</span>
                      <span className="text-sm font-semibold font-mono text-primary">
                        {daysUntil >= 0 ? `${daysUntil} days` : 'Overdue'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}