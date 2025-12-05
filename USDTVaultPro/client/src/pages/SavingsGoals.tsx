import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Target, 
  Trash2, 
  Edit, 
  CalendarIcon,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronUp,
  ChevronDown,
  DollarSign,
  AlertCircle,
  Wallet,
  Zap,
  Award,
  Save,
  PlusCircle
} from 'lucide-react';
import { format, addDays, differenceInDays, isAfter, isBefore } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type SavingsGoal } from '@shared/schema';
import WithdrawalModal from '@/components/WithdrawalModal';
import WithdrawalReasonModal from '@/components/WithdrawalReasonModal';
import DeletionCoolingOffModal from '@/components/DeletionCoolingOffModal';
import NotificationBar from '@/components/NotificationBar';
import { normalizeFinancialData, validateAmount, formatAmount, addAmounts, calculatePercentage } from '@/lib/financial';

const goalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(50, 'Title must be less than 50 characters'),
  targetAmount: z.string().refine((val) => {
    try {
      validateAmount(val, '0.01', '1000000');
      return true;
    } catch {
      return false;
    }
  }, 'Must be between 0.01 and 1,000,000'),
  deadline: z.date({
    required_error: 'Deadline is required',
  }).refine(
    (date) => isAfter(date, new Date()),
    'Deadline must be in the future'
  ),
  autoSaveEnabled: z.boolean().default(false),
  autoSaveAmount: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    try {
      validateAmount(val, '0.01', '100000');
      return true;
    } catch {
      return false;
    }
  }, 'Must be between 0.01 and 100,000'),
  autoSaveFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

type GoalForm = z.infer<typeof goalSchema>;

export default function SavingsGoals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [withdrawalModal, setWithdrawalModal] = useState<{
    open: boolean;
    goal: SavingsGoal | null;
  }>({ open: false, goal: null });
  const [withdrawalReasonModal, setWithdrawalReasonModal] = useState<{
    open: boolean;
    goal: SavingsGoal | null;
    reason?: string;
    reasonDetails?: string;
  }>({ open: false, goal: null });
  const [deletionModal, setDeletionModal] = useState<{
    open: boolean;
    goal: SavingsGoal | null;
  }>({ open: false, goal: null });
  const [depositModal, setDepositModal] = useState<{
    open: boolean;
    goal: SavingsGoal | null;
  }>({ open: false, goal: null });
  const [resistanceStreak, setResistanceStreak] = useState(0);

  const { data: goals = [], isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ['/api/savings-goals'],
  });

  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: '',
      targetAmount: '',
      deadline: addDays(new Date(), 30),
      autoSaveEnabled: false,
      autoSaveAmount: '',
      autoSaveFrequency: 'weekly',
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
    if (!goals.length) return {
      totalTargeted: 0,
      totalSaved: 0,
      averageProgress: 0,
      activeGoals: 0,
      completedGoals: 0,
      nearingDeadline: 0,
    };

    const totalTargeted = goals.reduce((sum: number, goal: SavingsGoal) => 
      sum + parseFloat(goal.target || "0"), 0);
    const totalSaved = goals.reduce((sum: number, goal: SavingsGoal) => 
      sum + parseFloat(goal.current || "0"), 0);
    const activeGoals = goals.filter((g: SavingsGoal) => 
      parseFloat(g.current || "0") < parseFloat(g.target)).length;
    const completedGoals = goals.filter((g: SavingsGoal) => 
      parseFloat(g.current || "0") >= parseFloat(g.target)).length;
    const nearingDeadline = goals.filter((g: SavingsGoal) => {
      const daysLeft = differenceInDays(new Date(g.deadline), new Date());
      return daysLeft > 0 && daysLeft <= 7;
    }).length;
    const averageProgress = goals.length > 0 
      ? goals.reduce((sum: number, goal: SavingsGoal) => {
          const progress = (parseFloat(goal.current || "0") / parseFloat(goal.target)) * 100;
          return sum + progress;
        }, 0) / goals.length
      : 0;

    return {
      totalTargeted,
      totalSaved,
      averageProgress,
      activeGoals,
      completedGoals,
      nearingDeadline,
    };
  }, [goals]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const normalizedData = normalizeFinancialData(data);
      return apiRequest('/api/savings-goals', 'POST', normalizedData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      toast({ 
        title: '🎯 New Goal Created!', 
        description: `Great decision! You're on your way to saving $${form.getValues('targetAmount')} for "${form.getValues('title')}". Every journey begins with a single step!`
      });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to create goal. Please try again.', 
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason, reasonDetails, useCoolingPeriod }: any) => 
      apiRequest(`/api/savings-goals/${id}`, 'DELETE', { reason, reasonDetails, useCoolingPeriod }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      if (variables.useCoolingPeriod) {
        toast({ 
          title: 'Deletion Scheduled', 
          description: 'Your goal will be deleted in 24 hours. You can cancel this anytime from Settings.'
        });
      } else {
        toast({ 
          title: 'Goal Removed', 
          description: 'Your savings goal has been removed. You can always create a new one when you\'re ready!'
        });
      }
      setDeletionModal({ open: false, goal: null });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete goal. Please try again.', 
        variant: 'destructive' 
      });
    },
  });
  
  const handleDelete = (goal: SavingsGoal) => {
    setDeletionModal({ open: true, goal });
  };
  
  const confirmDeletion = (reason: string, reasonDetails?: string, useCoolingPeriod?: boolean) => {
    if (!deletionModal.goal) return;
    
    deleteMutation.mutate({
      id: deletionModal.goal.id,
      reason,
      reasonDetails,
      useCoolingPeriod
    });
  };
  
  const cancelDeletion = () => {
    setResistanceStreak(prev => prev + 1);
    toast({
      title: '🎯 Goal Preserved!',
      description: 'Smart choice! Your savings goal is intact and your financial future is brighter.',
    });
    setDeletionModal({ open: false, goal: null });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => {
      const normalizedData = normalizeFinancialData(data);
      return apiRequest(`/api/savings-goals/${id}`, 'PATCH', normalizedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      toast({ 
        title: '✨ Goal Updated!', 
        description: 'Your savings goal has been updated. Stay focused on your financial future!'
      });
      setEditingGoal(null);
      setOpen(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update goal. Please try again.', 
        variant: 'destructive' 
      });
    },
  });

  // Add deposit mutation for adding money to goals
  const depositMutation = useMutation({
    mutationFn: ({ goalId, amount }: { goalId: string; amount: string | number }) => {
      const normalizedData = normalizeFinancialData({ amount });
      return apiRequest(`/api/savings-goals/${goalId}/deposit`, 'POST', normalizedData);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      const goal = goals.find(g => g.id === variables.goalId);
      if (goal) {
        // Handle amounts as strings using financial utilities
        const currentAmount = goal.current || '0';
        const depositAmount = String(variables.amount);
        const newTotal = addAmounts(currentAmount, depositAmount);
        const progress = calculatePercentage(newTotal, goal.target);
        
        if (parseFloat(progress) >= 100) {
          toast({
            title: '🎉 Goal Achieved!',
            description: `Congratulations! You've reached your "${goal.title}" goal! Time to celebrate your financial discipline!`,
          });
        } else if (progress >= 75) {
          toast({
            title: '🚀 Almost There!',
            description: `Great job! You've added $${variables.amount.toFixed(2)} to "${goal.title}". You're ${progress.toFixed(0)}% complete!`,
          });
        } else if (progress >= 50) {
          toast({
            title: '💪 Halfway Mark!',
            description: `Awesome! $${variables.amount.toFixed(2)} added to "${goal.title}". You're more than halfway to your goal!`,
          });
        } else {
          toast({
            title: '💰 Deposit Successful!',
            description: `$${variables.amount.toFixed(2)} added to "${goal.title}". Keep up the great work!`,
          });
        }
      }
    },
    onError: () => {
      toast({
        title: 'Deposit Failed',
        description: 'Could not add funds to your goal. Please try again.',
        variant: 'destructive'
      });
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setEditingGoal(null);
    }
  }, [open, form]);

  const onSubmit = (data: GoalForm) => {
    const mutationData: any = {
      title: data.title,
      target: data.targetAmount, // Already a string from form
      deadline: data.deadline.toISOString(),
      autoSaveEnabled: data.autoSaveEnabled,
    };

    if (data.autoSaveEnabled && data.autoSaveAmount) {
      mutationData.autoSaveAmount = data.autoSaveAmount; // Already a string from form
      mutationData.autoSaveFrequency = data.autoSaveFrequency;
    }

    if (editingGoal) {
      updateMutation.mutate({
        id: editingGoal.id,
        ...mutationData
      });
    } else {
      createMutation.mutate(mutationData);
    }
  };

  const handleWithdrawal = (goal: SavingsGoal) => {
    // First show the reason modal
    setWithdrawalReasonModal({ open: true, goal });
  };
  
  const handleWithdrawalReasonContinue = (reason: string, reasonDetails?: string) => {
    if (withdrawalReasonModal.goal) {
      // Store the reason and show the withdrawal modal
      setWithdrawalReasonModal({
        ...withdrawalReasonModal,
        open: false,
        reason,
        reasonDetails
      });
      setWithdrawalModal({ open: true, goal: withdrawalReasonModal.goal });
    }
  };
  
  const handleWithdrawalReasonCancel = () => {
    // User chose to keep saving
    setResistanceStreak(prev => prev + 1);
    toast({
      title: '💪 Great decision!',
      description: 'Your savings are growing! Every day you resist withdrawal builds stronger financial discipline.',
    });
    setWithdrawalReasonModal({ open: false, goal: null });
  };

  const handleDeposit = (goal: SavingsGoal) => {
    setDepositModal({ open: true, goal });
  };

  const confirmWithdrawal = async (amount: number, useCoolingPeriod: boolean) => {
    if (!withdrawalModal.goal) return;

    try {
      await apiRequest(`/api/savings-goals/${withdrawalModal.goal.id}/withdraw`, 'POST', {
        amount,
        useCoolingPeriod,
        reason: withdrawalReasonModal.reason || 'other',
        reasonDetails: withdrawalReasonModal.reasonDetails || null
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      
      toast({
        title: useCoolingPeriod ? 'Withdrawal Scheduled' : 'Withdrawal Complete',
        description: useCoolingPeriod 
          ? 'Your withdrawal is scheduled for 24 hours from now. You can cancel it anytime.'
          : `$${amount.toFixed(2)} withdrawn from ${withdrawalModal.goal.title}`,
      });
      
      setWithdrawalModal({ open: false, goal: null });
      setWithdrawalReasonModal({ open: false, goal: null });
    } catch (error) {
      toast({
        title: 'Withdrawal Failed',
        description: 'Could not process withdrawal. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const startEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    form.reset({
      title: goal.title,
      targetAmount: goal.target,
      deadline: new Date(goal.deadline),
    });
    setOpen(true);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
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
      {/* Smart Notifications */}
      <NotificationBar />
      
      {/* Professional Header */}
      <div className="bg-background-secondary/50 backdrop-blur-sm border-b border-border/50 -mx-6 -mt-6 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-savings-title">
              Savings Goals
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-last-updated">
              Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Dialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              setEditingGoal(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-create-goal"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Define your financial target and track progress towards your goal
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Goal Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Emergency Fund" 
                            {...field} 
                            data-testid="input-goal-title"
                            className="font-normal"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Target Amount (USDT)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            placeholder="10000.00" 
                            {...field}
                            onChange={(e) => {
                              // Keep the value as string but validate it's numeric
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                field.onChange(value);
                              }
                            }}
                            data-testid="input-goal-target"
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deadline"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">Target Date</FormLabel>
                        <FormControl>
                          <div className="relative flex items-center">
                            <Input
                              type="date"
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => {
                                const dateValue = e.target.value;
                                if (dateValue) {
                                  const parsedDate = new Date(dateValue + 'T00:00:00');
                                  if (!isNaN(parsedDate.getTime())) {
                                    field.onChange(parsedDate);
                                  }
                                }
                              }}
                              min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                              max={format(addDays(new Date(), 3650), 'yyyy-MM-dd')} // Max 10 years
                              className="font-mono pr-10"
                              placeholder="yyyy-mm-dd"
                              data-testid="input-goal-deadline"
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 h-full px-3 hover:bg-transparent"
                                >
                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                    if (date) {
                                      field.onChange(date);
                                    }
                                  }}
                                  disabled={(date) =>
                                    isBefore(date, new Date())
                                  }
                                  defaultMonth={field.value || addDays(new Date(), 30)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                        <p className="text-xs text-muted-foreground">
                          Enter a date or click the calendar icon
                        </p>
                      </FormItem>
                    )}
                  />
                  
                  {/* Auto-Save Section */}
                  <div className="space-y-4 border-t pt-4">
                    <FormField
                      control={form.control}
                      name="autoSaveEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium">
                              Enable Auto-Save
                            </FormLabel>
                            <FormDescription className="text-xs text-muted-foreground">
                              Automatically save towards this goal
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-auto-save"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {form.watch('autoSaveEnabled') && (
                      <>
                        <FormField
                          control={form.control}
                          name="autoSaveAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Auto-Save Amount (USDT)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="text" 
                                  placeholder="100.00" 
                                  {...field}
                                  onChange={(e) => {
                                    // Keep the value as string but validate it's numeric
                                    const value = e.target.value;
                                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                      field.onChange(value);
                                    }
                                  }}
                                  data-testid="input-auto-save-amount"
                                  className="font-mono"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="autoSaveFrequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-auto-save-frequency">
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-goal"
                  >
                    {createMutation.isPending || updateMutation.isPending 
                      ? 'Processing...' 
                      : (editingGoal ? 'Update Goal' : 'Create Goal')
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
        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-total-targeted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Target className="h-4 w-4 text-muted-foreground" />
              {stats.totalTargeted > stats.totalSaved ? (
                <ChevronUp className="h-4 w-4 text-warning" />
              ) : (
                <ChevronDown className="h-4 w-4 text-success" />
              )}
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-total-targeted">
              ${formatCompactNumber(stats.totalTargeted)}
            </p>
            <p className="text-xs text-muted-foreground">Total Targeted</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-total-saved">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Badge 
                variant={stats.totalSaved > 0 ? "default" : "secondary"}
                className="text-xs font-mono"
              >
                {((stats.totalSaved / (stats.totalTargeted || 1)) * 100).toFixed(0)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-total-saved">
              ${formatCompactNumber(stats.totalSaved)}
            </p>
            <p className="text-xs text-muted-foreground">Total Saved</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-active-goals">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {stats.nearingDeadline > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.nearingDeadline} urgent
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-active-goals">
              {stats.activeGoals}
            </p>
            <p className="text-xs text-muted-foreground">Active Goals</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary border-border/50" data-testid="card-stat-avg-progress">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Badge 
                variant={stats.averageProgress >= 75 ? "default" : stats.averageProgress >= 50 ? "secondary" : "outline"}
                className="text-xs font-mono"
              >
                On Track
              </Badge>
            </div>
            <p className="text-2xl font-bold font-mono mt-2" data-testid="text-avg-progress">
              {stats.averageProgress.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Avg. Progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <Card className="bg-background-secondary border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-3 bg-muted/20 rounded-full mb-4">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-2">No Savings Goals</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Start building your financial future by creating your first savings goal
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal: SavingsGoal) => {
            const currentNum = parseFloat(goal.current || "0");
            const targetNum = parseFloat(goal.target || "0");
            const progress = calculateProgress(currentNum, targetNum);
            const daysLeft = differenceInDays(new Date(goal.deadline), new Date());
            const isOverdue = daysLeft < 0;
            const isUrgent = daysLeft >= 0 && daysLeft <= 7;
            const isCompleted = progress >= 100;
            const savingStreak = parseInt(goal.savingStreak || '0');
            const hasAutoSave = goal.autoSaveEnabled;
            const nextAutoSaveDate = goal.nextAutoSave ? new Date(goal.nextAutoSave) : null;
            
            return (
              <Card 
                key={goal.id} 
                className="bg-background-secondary border-border/50 relative overflow-hidden"
                data-testid={`card-goal-${goal.id}`}
              >
                {isCompleted && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-success/10 transform rotate-45 translate-x-8 -translate-y-8" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {goal.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge 
                          variant={isCompleted ? "default" : isOverdue ? "destructive" : isUrgent ? "secondary" : "outline"}
                          className="text-xs font-mono"
                          data-testid={`badge-status-${goal.id}`}
                        >
                          {isCompleted ? "Completed" : isOverdue ? "Overdue" : `${daysLeft}d left`}
                        </Badge>
                        {hasAutoSave && (
                          <Badge variant="default" className="text-xs gap-1">
                            <Zap className="w-3 h-3" />
                            Auto-saving
                          </Badge>
                        )}
                        {savingStreak > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Award className="w-3 h-3" />
                            {savingStreak}d streak
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleDeposit(goal)}
                        data-testid={`button-deposit-goal-${goal.id}`}
                        title="Add funds to goal"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleWithdrawal(goal)}
                        disabled={currentNum <= 0}
                        data-testid={`button-withdraw-goal-${goal.id}`}
                        title={currentNum <= 0 ? "No funds to withdraw" : "Withdraw funds"}
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(goal)}
                        data-testid={`button-edit-goal-${goal.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleDelete(goal)}
                        data-testid={`button-delete-goal-${goal.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Progress</span>
                      <span className="text-sm font-semibold font-mono">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={progress} 
                      className="h-2"
                      data-testid={`progress-goal-${goal.id}`}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="text-lg font-bold font-mono" data-testid={`text-current-${goal.id}`}>
                        ${formatCompactNumber(currentNum)}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-lg font-bold font-mono" data-testid={`text-target-${goal.id}`}>
                        ${formatCompactNumber(targetNum)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Remaining</span>
                      <span className="text-sm font-semibold font-mono text-warning">
                        ${formatCompactNumber(Math.max(0, targetNum - currentNum))}
                      </span>
                    </div>
                    
                    {hasAutoSave && nextAutoSaveDate && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Next Auto-Save</span>
                        <span className="font-mono">
                          {format(nextAutoSaveDate, 'MMM dd')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Withdrawal Reason Modal - Shows first */}
      {withdrawalReasonModal.goal && (
        <WithdrawalReasonModal
          open={withdrawalReasonModal.open}
          onOpenChange={(open) => setWithdrawalReasonModal({ ...withdrawalReasonModal, open })}
          goal={withdrawalReasonModal.goal}
          onContinue={handleWithdrawalReasonContinue}
          onCancel={handleWithdrawalReasonCancel}
        />
      )}
      
      {/* Withdrawal Protection Modal - Shows after reason is selected */}
      {withdrawalModal.goal && (
        <WithdrawalModal
          open={withdrawalModal.open}
          onOpenChange={(open) => setWithdrawalModal({ open, goal: withdrawalModal.goal })}
          goal={withdrawalModal.goal}
          onConfirmWithdrawal={confirmWithdrawal}
          userBalance={parseFloat(user?.balance || '0')}
        />
      )}
      
      {/* Deletion Cooling-Off Modal */}
      {deletionModal.goal && (
        <DeletionCoolingOffModal
          open={deletionModal.open}
          onOpenChange={(open) => setDeletionModal({ open, goal: deletionModal.goal })}
          goal={deletionModal.goal}
          onConfirmDeletion={confirmDeletion}
          onCancel={cancelDeletion}
        />
      )}
      
      {/* Deposit Modal */}
      {depositModal.goal && (
        <Dialog
          open={depositModal.open}
          onOpenChange={(open) => setDepositModal({ open, goal: depositModal.goal })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Funds to Goal</DialogTitle>
              <DialogDescription>
                Transfer funds from your main wallet to "{depositModal.goal.title}"
              </DialogDescription>
            </DialogHeader>
            <DepositModalContent
              goal={depositModal.goal}
              userBalance={parseFloat(user?.balance || '0')}
              onDeposit={(amount: number) => {
                depositMutation.mutate({
                  goalId: depositModal.goal!.id,
                  amount
                });
                setDepositModal({ open: false, goal: null });
              }}
              onCancel={() => setDepositModal({ open: false, goal: null })}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Deposit Modal Content Component
function DepositModalContent({ 
  goal, 
  userBalance, 
  onDeposit, 
  onCancel 
}: { 
  goal: SavingsGoal;
  userBalance: number;
  onDeposit: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  
  const goalRemaining = parseFloat(goal.target) - parseFloat(goal.current || '0');
  const maxAmount = Math.min(userBalance, goalRemaining);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (depositAmount > userBalance) {
      setError('Insufficient balance in your main wallet');
      return;
    }
    
    if (depositAmount > goalRemaining) {
      setError(`Maximum needed for this goal: $${goalRemaining.toFixed(2)}`);
      return;
    }
    
    onDeposit(depositAmount);
  };
  
  const handleQuickAmount = (percentage: number) => {
    const quickAmount = Math.min(userBalance * percentage, goalRemaining);
    setAmount(quickAmount.toFixed(2));
    setError('');
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Available Balance</span>
          <span className="font-mono font-semibold">${userBalance.toFixed(2)} USDT</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Goal Remaining</span>
          <span className="font-mono font-semibold">${goalRemaining.toFixed(2)}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="amount">Amount to Deposit</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="pl-9"
            data-testid="input-deposit-amount"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickAmount(0.25)}
          disabled={userBalance === 0}
        >
          25%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickAmount(0.5)}
          disabled={userBalance === 0}
        >
          50%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickAmount(0.75)}
          disabled={userBalance === 0}
        >
          75%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAmount(maxAmount.toFixed(2))}
          disabled={userBalance === 0}
        >
          Max
        </Button>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!amount || userBalance === 0}
          data-testid="button-confirm-deposit"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Deposit
        </Button>
      </div>
    </form>
  );
}