import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle,
  Target,
  TrendingDown,
  Shield,
  CircleDollarSign,
  Trophy,
  RefreshCcw,
  HelpCircle,
  AlertCircle,
  Zap,
  Heart,
  Clock,
  TrendingUp,
  Award
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { type SavingsGoal } from '@shared/schema';

interface DeletionCoolingOffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SavingsGoal;
  onConfirmDeletion: (reason: string, details?: string, useCoolingPeriod?: boolean) => void;
  onCancel: () => void;
}

const DELETION_REASONS = [
  {
    id: 'achieved',
    label: 'I achieved my savings goal',
    icon: Trophy,
    color: 'text-success',
    message: 'Congratulations! This is a huge accomplishment!',
    severity: 'low'
  },
  {
    id: 'changed-mind',
    label: 'Changed my mind about this goal',
    icon: RefreshCcw,
    color: 'text-muted-foreground',
    warning: 'Every savings goal is a step toward financial freedom. Are you sure?',
    severity: 'medium'
  },
  {
    id: 'emergency',
    label: 'Need the money for an emergency',
    icon: AlertCircle,
    color: 'text-destructive',
    warning: 'Consider if this is truly an emergency that requires removing your entire goal.',
    severity: 'high'
  },
  {
    id: 'better-opportunity',
    label: 'Found a better savings/investment opportunity',
    icon: TrendingUp,
    color: 'text-info',
    warning: 'Make sure the new opportunity is legitimate and aligns with your goals.',
    severity: 'low'
  },
  {
    id: 'other',
    label: 'Other reason',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    severity: 'low',
    requiresDetails: true
  }
];

export default function DeletionCoolingOffModal({
  open,
  onOpenChange,
  goal,
  onConfirmDeletion,
  onCancel
}: DeletionCoolingOffModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReasonDetails, setOtherReasonDetails] = useState('');
  const [useCoolingPeriod, setUseCoolingPeriod] = useState(false);

  const currentAmount = parseFloat(goal.current || '0');
  const targetAmount = parseFloat(goal.target);
  const progress = (currentAmount / targetAmount) * 100;
  const savingsStreak = parseInt(goal.savingStreak || '0');
  const daysUntilDeadline = differenceInDays(new Date(goal.deadline), new Date());

  const selectedReasonData = DELETION_REASONS.find(r => r.id === selectedReason);

  const handleConfirmDeletion = () => {
    if (!selectedReason) return;
    
    const details = selectedReason === 'other' ? otherReasonDetails : undefined;
    onConfirmDeletion(selectedReason, details, useCoolingPeriod);
    resetModal();
  };

  const handleKeepGoal = () => {
    onCancel();
    resetModal();
    onOpenChange(false);
  };

  const resetModal = () => {
    setSelectedReason('');
    setOtherReasonDetails('');
    setUseCoolingPeriod(false);
  };

  const canConfirm = selectedReason && (
    selectedReason !== 'other' || otherReasonDetails.trim().length > 0
  );

  const getMotivationalMessage = () => {
    if (progress >= 75) {
      return {
        title: "You're so close to your goal!",
        message: `You've already saved ${progress.toFixed(0)}% of your target. Don't give up now!`,
        icon: Trophy,
        color: 'text-success',
        severity: 'high'
      };
    } else if (progress >= 50) {
      return {
        title: "You're more than halfway there!",
        message: `You've made great progress. Keep going!`,
        icon: Target,
        color: 'text-primary',
        severity: 'medium'
      };
    } else if (savingsStreak > 14) {
      return {
        title: `${savingsStreak} days of consistent saving!`,
        message: `Your dedication is impressive. This streak shows real commitment.`,
        icon: Zap,
        color: 'text-primary',
        severity: 'medium'
      };
    } else if (daysUntilDeadline < 30) {
      return {
        title: 'Your deadline is approaching!',
        message: `Only ${daysUntilDeadline} days left. Stay focused!`,
        icon: Clock,
        color: 'text-warning',
        severity: 'medium'
      };
    }
    return null;
  };

  const motivationalMessage = getMotivationalMessage();

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        resetModal();
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl" data-testid="modal-deletion-cooling">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Are you sure you want to delete this savings goal?
          </DialogTitle>
          <DialogDescription>
            This will return ${currentAmount.toFixed(2)} to your wallet and remove the goal permanently.
          </DialogDescription>
        </DialogHeader>

        {/* Goal Summary */}
        <Card className="bg-background-secondary/50 border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                {goal.title}
              </span>
              <Badge variant="outline" className="ml-2">
                {progress.toFixed(0)}% Complete
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Amount to Return</p>
                <p className="font-mono font-semibold text-lg text-primary">
                  ${currentAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Target Amount</p>
                <p className="font-mono font-semibold text-lg">
                  ${targetAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {savingsStreak > 0 && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Savings Streak</p>
                  <p className="text-xs text-muted-foreground">
                    You'll lose your {savingsStreak} day streak
                  </p>
                </div>
                <Badge variant="outline">{savingsStreak} days</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Motivational Message */}
        {motivationalMessage && (
          <Alert className={`border-${motivationalMessage.severity === 'high' ? 'success' : 'primary'}/20 bg-${motivationalMessage.severity === 'high' ? 'success' : 'primary'}/5`}>
            <motivationalMessage.icon className={`w-4 h-4 ${motivationalMessage.color}`} />
            <AlertDescription className="space-y-1">
              <p className="font-semibold">{motivationalMessage.title}</p>
              <p className="text-sm">{motivationalMessage.message}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Reason Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Why are you removing this savings goal?</Label>
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            <div className="space-y-3">
              {DELETION_REASONS.map((reason) => (
                <div key={reason.id} className="flex items-start space-x-3">
                  <RadioGroupItem 
                    value={reason.id} 
                    id={`deletion-${reason.id}`}
                    data-testid={`radio-deletion-${reason.id}`}
                  />
                  <Label 
                    htmlFor={`deletion-${reason.id}`} 
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <reason.icon className={`w-4 h-4 ${reason.color}`} />
                    <span>{reason.label}</span>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {/* Other Reason Details */}
          {selectedReason === 'other' && (
            <div className="space-y-2 mt-4">
              <Label htmlFor="deletion-other-details">Please specify your reason:</Label>
              <Textarea
                id="deletion-other-details"
                value={otherReasonDetails}
                onChange={(e) => setOtherReasonDetails(e.target.value)}
                placeholder="Tell us why you're removing this goal..."
                className="min-h-[80px]"
                data-testid="textarea-deletion-other"
              />
            </div>
          )}
        </div>

        {/* Warning Messages */}
        {selectedReasonData && selectedReasonData.warning && (
          <Alert className={`border-warning/20 bg-warning/5`}>
            <AlertTriangle className="w-4 h-4 text-warning" />
            <AlertDescription>
              <p className="font-medium">{selectedReasonData.warning}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message for Achievement */}
        {selectedReason === 'achieved' && (
          <Alert className="border-success/20 bg-success/5">
            <Award className="w-4 h-4 text-success" />
            <AlertDescription>
              <p className="font-medium text-success">
                {selectedReasonData?.message}
              </p>
              <p className="text-sm mt-1">
                You successfully saved ${currentAmount.toFixed(2)}! Consider creating a new goal to continue your financial journey.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Cooling Period Option */}
        {selectedReason && selectedReason !== 'achieved' && (
          <Alert className="border-info/20 bg-info/5">
            <Clock className="w-4 h-4 text-info" />
            <AlertDescription>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="deletion-cooling-period"
                  checked={useCoolingPeriod}
                  onCheckedChange={(checked) => setUseCoolingPeriod(checked as boolean)}
                  data-testid="checkbox-deletion-cooling"
                />
                <label
                  htmlFor="deletion-cooling-period"
                  className="text-sm font-medium leading-relaxed cursor-pointer"
                >
                  Give me 24 hours to think about this
                  <span className="block text-xs text-muted-foreground mt-1">
                    The goal will be scheduled for deletion tomorrow, giving you time to change your mind
                  </span>
                </label>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Alternative Suggestions */}
        {progress > 25 && selectedReason !== 'achieved' && (
          <Card className="bg-info/5 border-info/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-info" />
                Consider these alternatives:
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-info mt-0.5">•</span>
                  <span>Reduce the target amount instead of deleting the goal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info mt-0.5">•</span>
                  <span>Extend the deadline to make it more achievable</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info mt-0.5">•</span>
                  <span>Keep the goal but pause auto-save contributions</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 mt-6">
          <Button
            variant="default"
            onClick={handleKeepGoal}
            className="flex-1"
            data-testid="button-keep-goal"
          >
            <Shield className="w-4 h-4 mr-2" />
            Keep My Goal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDeletion}
            disabled={!canConfirm}
            className="flex-1"
            data-testid="button-confirm-deletion"
          >
            <TrendingDown className="w-4 h-4 mr-2" />
            {useCoolingPeriod ? 'Schedule Deletion' : 'Delete Goal'}
          </Button>
        </div>

        {/* Footer Message */}
        {currentAmount > 100 && (
          <div className="text-center text-sm text-muted-foreground mt-2">
            <Heart className="w-4 h-4 inline-block mr-1 text-primary" />
            You've saved ${currentAmount.toFixed(2)} so far. That's real progress!
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}