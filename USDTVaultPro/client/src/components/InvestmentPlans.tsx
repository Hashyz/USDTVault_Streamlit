import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  amount: z.string().min(1, 'Amount is required'),
  frequency: z.enum(['weekly', 'monthly']),
  nextContribution: z.string().min(1, 'Next contribution date is required'),
  autoInvest: z.boolean().default(true),
});

type PlanForm = z.infer<typeof planSchema>;

interface InvestmentPlan {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  nextContribution: string;
  autoInvest: boolean;
}

interface InvestmentPlansProps {
  plans: InvestmentPlan[];
}

export default function InvestmentPlans({ plans }: InvestmentPlansProps) {
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      amount: '',
      frequency: 'monthly',
      nextContribution: '',
      autoInvest: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: PlanForm) => 
      apiRequest('/api/investment-plans', 'POST', {
        ...data,
        amount: parseFloat(data.amount),
      }),
    onSuccess: () => {
      toast({ title: 'Plan Created', description: 'Your investment plan has been created successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create plan',
        variant: 'destructive'
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<InvestmentPlan> }) => 
      apiRequest(`/api/investment-plans/${id}`, 'PATCH', data),
    onSuccess: () => {
      toast({ title: 'Plan Updated', description: 'Your investment plan has been updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
      setEditModalOpen(false);
      setSelectedPlan(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update plan',
        variant: 'destructive'
      });
    },
  });

  const toggleAutoInvestMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string, enabled: boolean }) => 
      apiRequest(`/api/investment-plans/${id}`, 'PATCH', {
        autoInvest: enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update auto-invest',
        variant: 'destructive'
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/investment-plans/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Plan Deleted', description: 'Your investment plan has been deleted.' });
      queryClient.invalidateQueries({ queryKey: ['/api/investment-plans'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete plan',
        variant: 'destructive'
      });
    },
  });

  const handleCreateSubmit = (data: PlanForm) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: PlanForm) => {
    if (selectedPlan) {
      updateMutation.mutate({
        id: selectedPlan.id,
        data: {
          name: data.name,
          amount: parseFloat(data.amount),
          frequency: data.frequency,
          nextContribution: data.nextContribution,
          autoInvest: data.autoInvest,
        },
      });
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    toggleAutoInvestMutation.mutate({ id, enabled });
  };

  const openEditModal = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    form.setValue('name', plan.name);
    form.setValue('amount', plan.amount.toString());
    form.setValue('frequency', plan.frequency);
    form.setValue('nextContribution', plan.nextContribution);
    form.setValue('autoInvest', plan.autoInvest);
    setEditModalOpen(true);
  };

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Investment Plans</h3>
            <Button size="sm" onClick={() => setCreateModalOpen(true)} data-testid="button-create-plan">
              <Plus className="w-4 h-4 mr-2" />
              New Plan
            </Button>
          </div>
          <div className="space-y-3">
            {plans.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No investment plans yet. Create one to automate your investments!
              </p>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-md space-y-3 hover-elevate" data-testid={`plan-${plan.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{plan.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${plan.amount.toLocaleString()} / {plan.frequency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {plan.frequency}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(plan)}
                        data-testid={`button-edit-${plan.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(plan.id)}
                        data-testid={`button-delete-${plan.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Next: {plan.nextContribution}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Auto-invest</span>
                      <Switch
                        checked={plan.autoInvest}
                        onCheckedChange={(checked) => handleToggle(plan.id, checked)}
                        data-testid={`switch-auto-invest-${plan.id}`}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Create Plan Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Investment Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Monthly DCA Strategy" {...field} data-testid="input-plan-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investment Amount (USDT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="500" {...field} data-testid="input-plan-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextContribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Contribution Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-next-contribution" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoInvest"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Enable Auto-invest</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-create-auto-invest"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Plan'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Investment Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investment Amount (USDT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-edit-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-frequency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextContribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Contribution Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-edit-next" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoInvest"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Enable Auto-invest</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-auto-invest"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Plan'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}