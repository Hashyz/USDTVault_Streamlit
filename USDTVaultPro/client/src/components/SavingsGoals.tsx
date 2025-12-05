import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Plus, Edit, Trash2, DollarSign, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { normalizeFinancialData, validateAmount, formatAmount, calculatePercentage } from '@/lib/financial';

const goalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  target: z.string().min(1, 'Target amount is required').refine((val) => {
    try {
      validateAmount(val, '0.01', '1000000');
      return true;
    } catch {
      return false;
    }
  }, 'Must be between 0.01 and 1,000,000'),
  deadline: z.string().min(1, 'Deadline is required'),
});

type GoalForm = z.infer<typeof goalSchema>;

interface SavingsGoal {
  id: string;
  title: string;
  current: number;
  target: number;
  deadline: string;
}

interface SavingsGoalsProps {
  goals: SavingsGoal[];
  onDeposit?: (goalId: string) => void;  // Callback to trigger deposit modal in parent
}

export default function SavingsGoals({ goals, onDeposit }: SavingsGoalsProps) {
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  
  // Get wallet balance for validation
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ['/api/wallet'],
  });

  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: '',
      target: '',
      deadline: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: GoalForm) => {
      // Use normalizeFinancialData to ensure proper formatting
      const normalizedData = normalizeFinancialData({
        title: data.title,
        target: data.target,  // Already a validated string
        deadline: data.deadline,
      });
      return apiRequest('/api/savings-goals', 'POST', normalizedData);
    },
    onSuccess: () => {
      toast({ title: 'Goal Created', description: 'Your savings goal has been created successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create goal',
        variant: 'destructive'
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => {
      // Use normalizeFinancialData to ensure proper formatting
      const normalizedData = normalizeFinancialData(data);
      return apiRequest(`/api/savings-goals/${id}`, 'PATCH', normalizedData);
    },
    onSuccess: () => {
      toast({ title: 'Goal Updated', description: 'Your savings goal has been updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
      setEditModalOpen(false);
      setSelectedGoal(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update goal',
        variant: 'destructive'
      });
    },
  });

  // Remove contributeMutation - contributions should go through deposit flow
  // This ensures PIN verification and balance checking
  const handleContribute = (goalId: string) => {
    // Trigger the deposit modal in the parent page component
    if (onDeposit) {
      onDeposit(goalId);
    } else {
      toast({
        title: 'Deposit Required',
        description: 'Please use the deposit feature from your savings goals page to add funds.',
      });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/savings-goals/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Goal Deleted', description: 'Your savings goal has been deleted.' });
      queryClient.invalidateQueries({ queryKey: ['/api/savings-goals'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete goal',
        variant: 'destructive'
      });
    },
  });

  const handleCreateSubmit = (data: GoalForm) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: GoalForm) => {
    if (selectedGoal) {
      updateMutation.mutate({
        id: selectedGoal.id,
        data: {
          title: data.title,
          target: data.target,  // Already a validated string
          deadline: data.deadline,
        },
      });
    }
  };

  const openEditModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    form.setValue('title', goal.title);
    form.setValue('target', goal.target.toString());
    form.setValue('deadline', goal.deadline);
    setEditModalOpen(true);
  };

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Savings Goals</h3>
            <Button size="sm" onClick={() => setCreateModalOpen(true)} data-testid="button-create-goal">
              <Plus className="w-4 h-4 mr-2" />
              New Goal
            </Button>
          </div>
          <div className="space-y-4">
            {goals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No savings goals yet. Create one to get started!
              </p>
            ) : (
              goals.map((goal) => {
                // Use financial utilities for proper percentage calculation
                const percentage = Math.min(
                  parseFloat(calculatePercentage(goal.current.toString(), goal.target.toString())), 
                  100
                );
                return (
                  <div key={goal.id} className="p-4 border rounded-md space-y-3 hover-elevate" data-testid={`goal-${goal.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Target className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{goal.title}</h4>
                          <p className="text-sm text-muted-foreground">Due: {goal.deadline}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono mr-2">{percentage.toFixed(0)}%</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleContribute(goal.id)}
                          data-testid={`button-contribute-${goal.id}`}
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(goal)}
                          data-testid={`button-edit-${goal.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(goal.id)}
                          data-testid={`button-delete-${goal.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Progress value={percentage} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground font-mono">
                          ${formatAmount(goal.current, 2)} saved
                        </span>
                        <span className="text-muted-foreground font-mono">
                          ${formatAmount(goal.target, 2)} goal
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Create Goal Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Savings Goal</DialogTitle>
          </DialogHeader>
          {/* Display available balance */}
          {walletData && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Available Balance: <span className="font-mono font-semibold">${formatAmount(walletData.balance || '0', 2)}</span>
              </span>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Emergency Fund" {...field} data-testid="input-goal-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Amount (USDT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="10000" {...field} data-testid="input-goal-target" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-goal-deadline" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Goal'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Savings Goal</DialogTitle>
          </DialogHeader>
          {/* Display available balance */}
          {walletData && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Available Balance: <span className="font-mono font-semibold">${formatAmount(walletData.balance || '0', 2)}</span>
              </span>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Amount (USDT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-edit-target" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-edit-deadline" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Goal'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </>
  );
}